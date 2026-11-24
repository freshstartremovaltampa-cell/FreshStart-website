// Combat: every player hit, normal or skill, goes through resolveHit().
// Order of operations for a hit:
//   stats (STR + mastery) -> requirement penalty -> swing pacing (normal hits)
//   -> weapon-type trait -> passive skills -> crit -> apply -> after-effects
// Also handles kill XP/mastery, stances, dodges and bleed ticks.

import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import {
  MASTERY_GAIN, MIN_SWING_DAMAGE, MOBS, MOB_XP, PASSIVE_XP_MULTIPLIER, SPLASH, STAT_EFFECTS,
  UNMET_REQUIREMENT_DAMAGE, WEAPON_HANDLING,
} from "./config.js";
import { getData, markDirty } from "./data.js";
import {
  addMastery, addXp, critChance, damageMultiplier, dodgeChance, getHeldItem, weaponTypeOf,
} from "./progression.js";
import { getOffhand, meetsWeaponReq, qualityMult, wearWeapon, weaponDef } from "./weapons.js";
import {
  armorBroken, bleeds, lastHit, lastSwing, nextHitBuffs, reduceCooldowns, skillHits, stances,
} from "./effects.js";

const killCredit = new Map(); // entity id -> { player, weapon }, for kills finished by script
export const lastCombatTick = new Map(); // player id -> tick of last hit
export const hudHoldUntil = new Map(); // player id -> tick; HUD waits so combat text stays visible
const warnedAt = new Map(); // `${player id}:${key}` -> tick

const NOT_TARGETS = new Set([
  "minecraft:player", "minecraft:item", "minecraft:xp_orb", "minecraft:armor_stand", "minecraft:villager_v2",
  "minecraft:villager", "minecraft:wandering_trader", "minecraft:iron_golem", "minecraft:snow_golem", "minecraft:allay",
]);

// ---------- Shared helpers (also used by abilities.js) ----------

export function isPlayer(entity) {
  return entity?.typeId === "minecraft:player";
}

/** Living things skills are allowed to hit: no players, pets, villagers or items. */
export function isTarget(entity) {
  try {
    if (!entity?.isValid || NOT_TARGETS.has(entity.typeId)) return false;
    if (!entity.getComponent("minecraft:health")) return false;
    return !entity.getComponent("minecraft:tameable")?.isTamed;
  } catch {
    return false;
  }
}

export function flatDir(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len, dist: Math.hypot(dx, dz) };
}

export function push(entity, dir, horizontal, vertical) {
  try {
    entity.applyKnockback({ x: dir.x * horizontal, z: dir.z * horizontal }, vertical); // API 2.x
  } catch {
    try { entity.applyKnockback(dir.x, dir.z, horizontal, vertical); } catch { /* immovable */ }
  }
}

/** Kill an entity from script while still giving the player XP, mastery and loot credit. */
export function killWithCredit(target, player) {
  killCredit.set(target.id, { player, weapon: weaponTypeOf(getHeldItem(player)) });
  target.kill();
}

/** Base damage of the held Ponce weapon. Skills scale from this. */
export function heldDamage(player) {
  const item = getHeldItem(player);
  return (weaponDef(item)?.damage ?? 5) * qualityMult(item);
}

/**
 * Damage from a skill. Uses a real hit (red flash, knockback, death credit)
 * when it can, and falls back to direct damage if invulnerability frames
 * would swallow it, so skills always connect.
 */
export function dealSkillDamage(player, target, amount) {
  if (!isTarget(target)) return;
  skillHits.set(target.id, { playerId: player.id, tick: system.currentTick });
  let landed = false;
  try {
    landed = target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
  } catch { /* target gone */ }
  if (!landed && target.isValid) {
    skillHits.delete(target.id);
    resolveHit(player, target, amount, { skill: true, direct: true });
  }
}

function warn(player, key, text, ticks = 200) {
  const k = `${player.id}:${key}`;
  if ((warnedAt.get(k) ?? -Infinity) > system.currentTick) return;
  warnedAt.set(k, system.currentTick + ticks);
  player.sendMessage(text);
}

function isBehind(player, target) {
  try {
    const view = target.getViewDirection();
    const to = flatDir(target.location, player.location);
    return view.x * to.x + view.z * to.z < -0.3;
  } catch {
    return false;
  }
}

// ---------- Hits ----------

function resolveHit(player, target, damage, { skill = false, direct = false } = {}) {
  const now = system.currentTick;
  const data = getData(player);
  const item = getHeldItem(player);
  const weapon = weaponTypeOf(item);
  const def = weaponDef(item);
  const handling = WEAPON_HANDLING[weapon];
  const has = (id) => data.skills.includes(id);
  const notes = [];
  const prevHit = lastHit.get(player.id) ?? -Infinity;
  lastCombatTick.set(player.id, now);
  lastHit.set(player.id, now);

  let mult = damageMultiplier(data, weapon) * qualityMult(item);

  if (def && !meetsWeaponReq(data, def)) {
    mult *= UNMET_REQUIREMENT_DAMAGE;
    warn(player, "req", `§c[Ponce] You can't handle the ${def.name} yet, so it only deals 25% damage. §7Check its requirements on the tooltip.`);
  }

  if (!skill && handling) {
    const elapsed = now - (lastSwing.get(player.id) ?? -Infinity);
    const pace = Math.min(1, Math.max(MIN_SWING_DAMAGE, elapsed / handling.swingTicks));
    lastSwing.set(player.id, now);
    mult *= pace;
    if (pace < 0.6) notes.push("§7rushed");
  }

  if (!skill && weapon === "spear" && flatDir(player.location, target.location).dist >= 2.5) mult *= 1.25;
  if (weapon === "dagger" && has("dagger_backstab") && isBehind(player, target)) {
    mult *= 1.6;
    notes.push("§dBackstab!");
  }
  if (!skill && weapon === "katana" && has("katana_draw") && now - prevHit >= 80) {
    mult *= 2.5;
    notes.push("§bIaido!");
  }
  if ((armorBroken.get(target.id) ?? 0) > now) mult *= 1.3;

  const buff = nextHitBuffs.get(player.id);
  let stun = false, venom = false;
  if (!skill && buff) {
    if (buff.until <= now) nextHitBuffs.delete(player.id);
    else {
      if (buff.type === "stun") { mult *= 1.5; stun = true; notes.push("§6Concussion!"); }
      if (buff.type === "venom") venom = true;
      if (--buff.hits <= 0) nextHitBuffs.delete(player.id);
    }
  }

  const crit = Math.random() < critChance(data) + (weapon === "katana" ? 0.1 : 0);
  // Crits scale with everything above, so penalties (rushed swings, unmet requirements) apply to them too
  const total = damage * mult * (crit ? 1 + STAT_EFFECTS.critMultiplier : 1);
  if (crit && weapon === "katana" && has("katana_chain")) reduceCooldowns(player.id, 20);
  if (weapon) addMastery(player, weapon, MASTERY_GAIN.hit);

  const health = target.getComponent("minecraft:health");
  if (!health) return;
  const max = health.effectiveMax;
  const delta = direct ? total : total - damage;
  let remaining = health.currentValue - delta;
  if (remaining <= 0) {
    killWithCredit(target, player);
    remaining = 0;
  } else if (delta !== 0) {
    health.setCurrentValue(Math.min(max, remaining));
  }

  if (remaining > 0) {
    if (stun) {
      target.addEffect("slowness", 40, { amplifier: 6, showParticles: true });
      target.addEffect("weakness", 40, { amplifier: 1, showParticles: false });
    }
    if (venom) target.addEffect("poison", 80, { amplifier: 1 });
    if (weapon === "axe" && has("axe_bleed")) {
      const b = bleeds.get(target.id) ?? { stacks: 0 };
      bleeds.set(target.id, { stacks: Math.min(5, b.stacks + 1), until: now + 100, player });
    }
    if (!skill) afterNormalHit(player, target, weapon, damage, data);
  }
  if (!skill) wearWeapon(player);

  if (crit) player.playSound("random.anvil_land", { volume: 0.4, pitch: 1.8 });
  showTargetBar(player, target, remaining, max, crit, notes);
}

/** Weapon-type traits and Dual Wield. Only normal swings trigger these. */
function afterNormalHit(player, target, weapon, damage, data) {
  if (weapon === "hammer") target.addEffect("slowness", 20, { amplifier: 1, showParticles: false });
  if (weapon === "greatsword") push(target, flatDir(player.location, target.location), 0.8, 0.25);
  if (weapon === "axe") {
    const other = target.dimension.getEntities({ location: target.location, maxDistance: 2.5 })
      .find((e) => e.id !== target.id && isTarget(e));
    if (other) dealSkillDamage(player, other, damage * SPLASH);
  }
  if (weapon === "rapier" && Math.random() < 0.25) {
    system.runTimeout(() => target.isValid && player.isValid && dealSkillDamage(player, target, damage * 0.35), 6);
  }
  const off = weaponDef(getOffhand(player));
  if (weapon === "sword" && data.skills.includes("dual_wield") && off?.type === "sword") {
    system.runTimeout(() => {
      if (!target.isValid || !player.isValid) return;
      if (flatDir(player.location, target.location).dist > 4) return;
      dealSkillDamage(player, target, off.damage * 0.6);
      wearWeapon(player, EquipmentSlot.Offhand);
    }, 10);
  }
}

function displayName(entity) {
  const mob = MOBS[entity.typeId];
  if (mob) return `§f${mob.name} §7Lv${mob.level}`;
  if (isPlayer(entity)) return `§f${entity.name}`;
  const raw = entity.typeId.split(":")[1] ?? entity.typeId;
  return "§f" + raw.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Shows the struck enemy's name, level and HP above the hotbar for a moment. */
function showTargetBar(player, target, hp, max, crit, notes = []) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, hp) / max) : 0;
  const filled = Math.ceil(ratio * 20);
  const color = ratio > 0.5 ? "§a" : ratio > 0.25 ? "§e" : "§c";
  const tags = [crit ? "§e§lCRITICAL!§r" : "", ...notes].filter(Boolean).join(" ");
  player.onScreenDisplay.setActionBar(
    `${tags ? tags + " " : ""}${displayName(target)}  ${color}${"|".repeat(filled)}§8${"|".repeat(20 - filled)} §f${Math.ceil(Math.max(0, hp))}/${Math.round(max)}`
  );
  hudHoldUntil.set(player.id, system.currentTick + 30);
}

// ---------- Getting hit ----------

function onPlayerHurt(player, damage, attacker) {
  const now = system.currentTick;
  const data = getData(player);
  const health = player.getComponent("minecraft:health");
  if (!health || health.currentValue <= 0) return; // after-event: can't undo a killing blow
  const heal = (amount) => health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));

  const stance = stances.get(player.id);
  if (stance && stance.until > now && attacker && attacker.id !== player.id && isTarget(attacker)) {
    stances.delete(player.id);
    heal(damage);
    const base = heldDamage(player);
    if (stance.type === "riposte") {
      dealSkillDamage(player, attacker, base * 2);
      flash(player, "§b§lRIPOSTE!");
    } else {
      for (const e of player.dimension.getEntities({ location: player.location, maxDistance: 3.5 })) {
        if (isTarget(e)) dealSkillDamage(player, e, base * 1.5);
      }
      flash(player, "§b§lSTILL WATER!");
    }
    player.playSound("random.anvil_land", { volume: 0.5, pitch: 2 });
    return;
  }

  const item = getHeldItem(player);
  if (data.skills.includes("great_bulwark") && weaponTypeOf(item) === "greatsword" && now - (lastHit.get(player.id) ?? -Infinity) <= 20) {
    heal(damage * 0.3);
  }

  if (Math.random() < dodgeChance(data)) {
    heal(damage);
    flash(player, "§a§oDodged!");
    player.playSound("mob.bat.takeoff", { volume: 0.5, pitch: 1.4 });
  }
}

export function flash(player, text, ticks = 20) {
  player.onScreenDisplay.setActionBar(text);
  hudHoldUntil.set(player.id, system.currentTick + ticks);
}

// ---------- Kills ----------

function xpFor(entity) {
  if (MOB_XP[entity.typeId] !== undefined) return MOB_XP[entity.typeId];
  try {
    const maxHp = entity.getComponent("minecraft:health")?.effectiveMax ?? 10;
    const hostile = entity.matches({ families: ["monster"] });
    return Math.max(1, Math.round(maxHp * (hostile ? 1 : PASSIVE_XP_MULTIPLIER)));
  } catch {
    return 5; // entity already removed
  }
}

function tickBleeds() {
  const now = system.currentTick;
  for (const [id, b] of bleeds) {
    const target = world.getEntity?.(id);
    if (!target?.isValid || b.until <= now || !b.player.isValid) { bleeds.delete(id); continue; }
    const h = target.getComponent("minecraft:health");
    if (!h) { bleeds.delete(id); continue; }
    const remaining = h.currentValue - b.stacks * 0.6;
    if (remaining <= 0) { bleeds.delete(id); killWithCredit(target, b.player); }
    else h.setCurrentValue(remaining);
  }
}

export function registerCombat() {
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    const attacker = damageSource.damagingEntity;

    if (isPlayer(hurtEntity) && damage > 0) onPlayerHurt(hurtEntity, damage, attacker);

    if (isPlayer(attacker) && damageSource.cause === "entityAttack" && hurtEntity.isValid && !isPlayer(hurtEntity)) {
      const flag = skillHits.get(hurtEntity.id);
      const skill = !!flag && flag.playerId === attacker.id && system.currentTick - flag.tick <= 2;
      if (flag) skillHits.delete(hurtEntity.id);
      resolveHit(attacker, hurtEntity, damage, { skill });
    }
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (isPlayer(deadEntity)) {
      getData(deadEntity).deaths++;
      markDirty(deadEntity);
    }
    bleeds.delete(deadEntity.id);
    armorBroken.delete(deadEntity.id);

    let player = damageSource.damagingEntity;
    let weapon;
    const credit = killCredit.get(deadEntity.id);
    if (credit) {
      killCredit.delete(deadEntity.id);
      player = credit.player;
      weapon = credit.weapon;
    }
    if (!isPlayer(player) || !player.isValid || player === deadEntity) return;
    weapon ??= weaponTypeOf(getHeldItem(player));

    const data = getData(player);
    data.kills++;
    markDirty(player);
    if (isPlayer(deadEntity)) return; // no XP farming off other players
    const xp = xpFor(deadEntity);
    addXp(player, xp);
    const mob = MOBS[deadEntity.typeId];
    const gain = mob?.mastery ?? Math.min(MASTERY_GAIN.killMax, xp * MASTERY_GAIN.killPerXp);
    if (weapon) addMastery(player, weapon, gain);
  });

  system.runInterval(tickBleeds, 20);
}
