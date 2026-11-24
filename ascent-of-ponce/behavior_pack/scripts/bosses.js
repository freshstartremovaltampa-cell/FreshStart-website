// Floor guardians. Floor 1: Ironhide, the Boar King.
//
// The fight is tuned to last about 5 minutes for a player around Lv 5-7 with an
// iron-tier weapon, their first weapon skill, and some armor (1800 HP):
//  - Thick Hide: weak weapons (wood, stone, gold, fists) deal only 40% damage.
//  - Charge: Ironhide roars and stamps (1 s warning), then charges in a straight
//    line. Step sideways to dodge it. A hit deals 9 damage and heavy knockback.
//  - Call the Herd: at 80%, 60%, 40% and 20% HP he summons 2 hostile Tusk Boars.
//  - Earthshaker (below 60%): if you stay in melee range he rears up (1.25 s
//    warning) and slams the ground. Everyone within 5 blocks takes 7 damage
//    and is thrown back. Back off to avoid it.
//  - Enrage: below 30% HP he gets faster, hits harder and charges more often.
// He can only be summoned with the Boar King's Call, and only by a player who
// has unlocked at least one weapon skill.

import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import { getData, markDirty } from "./data.js";
import { getHeldItem } from "./progression.js";
import { hudHoldUntil } from "./combat.js";
import { notify } from "./quests.js";
import { ARENA, arenaDistance, directionText, isOnFloor1 } from "./floor1_gen.js";

const ARENA_TAG = "ponce_arena";
const ARENA_SPAWN = { x: ARENA.x + 0.5, y: ARENA.y + 1, z: ARENA.z + 0.5 };

export function inArena(loc) {
  return arenaDistance(loc.x, loc.z) <= ARENA.radius + 1 && Math.abs(loc.y - ARENA_SPAWN.y) <= 8;
}

const BOSS = "ponce:ironhide";
const HORN = "ponce:boar_kings_call";
const MINION_TAG = "ponce_minion";
const DIMENSIONS = ["overworld", "nether", "the_end"];

const TUNING = {
  weakWeaponDamageTaken: 0.4,
  chargeEveryTicks: 180, // 9 s
  chargeEveryTicksEnraged: 120, // 6 s
  chargeWindupTicks: 20,
  chargeDurationTicks: 14,
  chargeImpulse: 1.6,
  chargeDamage: 9,
  chargeHitRadius: 2.4,
  herdAt: [0.8, 0.6, 0.4, 0.2],
  herdSize: 2,
  maxMinions: 6,
  enrageAt: 0.3,
  stompBelow: 0.6,
  stompTriggerRange: 4.5,
  stompEveryTicks: 240, // 12 s
  stompWindupTicks: 25,
  stompRadius: 5,
  stompDamage: 7,
  leashRange: 40,
  leashTicks: 20 * 60, // despawns after 60 s with no player nearby
  rewardRange: 48,
  colReward: 100,
};

const IGNORED_MODES = [GameMode?.Creative ?? GameMode?.creative, GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);
const DECENT = /^minecraft:(iron|diamond|netherite)_(sword|axe)$|^minecraft:(mace|trident)$/;

/** Iron tier or better. Custom Ponce weapons opt in with the tag "ponce:tier_iron". */
export function isDecentWeapon(item) {
  return !!item && (DECENT.test(item.typeId) || item.hasTag("ponce:tier_iron"));
}

const state = new Map(); // boss id -> fight state

function stateFor(boss) {
  let s = state.get(boss.id);
  if (!s) {
    s = {
      nextCharge: system.currentTick + 100,
      charging: undefined, // { phase: "windup" | "dash", until, dir, hit: Set }
      stomp: undefined, // { until }
      nextStomp: 0,
      herdDone: [],
      enraged: false,
      lastPlayerNear: system.currentTick,
      glanceMsgAt: 0,
    };
    state.set(boss.id, s);
  }
  return s;
}

function healthRatio(entity) {
  const h = entity.getComponent("minecraft:health");
  return h ? h.currentValue / h.effectiveMax : 1;
}

function nearestPlayer(boss, range) {
  const players = boss.dimension.getPlayers({ location: boss.location, maxDistance: range, excludeGameModes: IGNORED_MODES });
  let best, bestD = Infinity;
  for (const p of players) {
    const dx = p.location.x - boss.location.x, dz = p.location.z - boss.location.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

function fx(dim, particle, loc) {
  try { dim.spawnParticle(particle, loc); } catch { /* particle missing on this version */ }
}

function announce(boss, text) {
  for (const p of boss.dimension.getPlayers({ location: boss.location, maxDistance: TUNING.rewardRange })) {
    p.sendMessage(text);
  }
}

function knockback(player, dir, strength) {
  try {
    player.applyKnockback({ x: dir.x * strength, z: dir.z * strength }, 0.5); // API 2.x
  } catch {
    try { player.applyKnockback(dir.x, dir.z, strength, 0.5); } catch { /* ignore */ }
  }
}

// ---------- Fight loop ----------

function tickBoss(boss) {
  const s = stateFor(boss);
  const now = system.currentTick;
  const dim = boss.dimension;
  const target = nearestPlayer(boss, TUNING.leashRange);

  if (target) s.lastPlayerNear = now;
  // Leash: the Boar King can't be dragged out of his arena
  if (boss.hasTag(ARENA_TAG) && arenaDistance(boss.location.x, boss.location.z) > ARENA.radius + 3) {
    try { boss.teleport(ARENA_SPAWN); } catch { /* ignore */ }
  }
  else if (now - s.lastPlayerNear > TUNING.leashTicks) {
    for (const m of dim.getEntities({ location: boss.location, maxDistance: 48, tags: [MINION_TAG] })) m.remove();
    state.delete(boss.id);
    boss.remove();
    return;
  }

  const ratio = healthRatio(boss);

  // Call the herd
  TUNING.herdAt.forEach((at, i) => {
    if (ratio > at || s.herdDone[i]) return;
    s.herdDone[i] = true;
    const alive = dim.getEntities({ location: boss.location, maxDistance: 48, tags: [MINION_TAG] }).length;
    const count = Math.min(TUNING.herdSize, TUNING.maxMinions - alive);
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const loc = { x: boss.location.x + Math.cos(a) * 4, y: boss.location.y + 0.5, z: boss.location.z + Math.sin(a) * 4 };
      try {
        const m = dim.spawnEntity("ponce:tusk_boar", loc);
        m.addTag(MINION_TAG);
        m.triggerEvent("ponce:enrage");
        fx(dim, "minecraft:huge_explosion_emitter", loc);
      } catch { /* blocked spot or unloaded chunk */ }
    }
    dim.playSound("mob.hoglin.angry", boss.location, { volume: 2, pitch: 0.6 });
    announce(boss, "§c[Ironhide] §fThe Boar King calls his herd!");
  });

  // Enrage
  if (!s.enraged && ratio <= TUNING.enrageAt) {
    s.enraged = true;
    boss.triggerEvent("ponce:enrage");
    dim.playSound("mob.ravager.roar", boss.location, { volume: 2, pitch: 0.7 });
    announce(boss, "§4[Ironhide] §cIronhide is enraged! He's faster and hits harder.");
  }

  // Earthshaker: punishes standing in melee range in the second half
  if (s.stomp) {
    if (now >= s.stomp.until) {
      s.stomp = undefined;
      s.nextStomp = now + TUNING.stompEveryTicks;
      s.nextCharge = Math.max(s.nextCharge, now + 60);
      dim.playSound("mob.ravager.stun", boss.location, { volume: 2, pitch: 0.5 });
      dim.playSound("random.explode", boss.location, { volume: 1.2, pitch: 0.7 });
      fx(dim, "minecraft:huge_explosion_emitter", boss.location);
      for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.stompRadius, excludeGameModes: IGNORED_MODES })) {
        p.applyDamage(TUNING.stompDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
        let dx = p.location.x - boss.location.x, dz = p.location.z - boss.location.z;
        const len = Math.hypot(dx, dz) || 1;
        knockback(p, { x: dx / len, z: dz / len }, 1.8);
      }
    }
    return;
  }
  if (!s.charging && target && ratio <= TUNING.stompBelow && now >= s.nextStomp) {
    const dx = target.location.x - boss.location.x, dz = target.location.z - boss.location.z;
    if (Math.hypot(dx, dz) <= TUNING.stompTriggerRange) {
      s.stomp = { until: now + TUNING.stompWindupTicks };
      boss.addEffect("slowness", TUNING.stompWindupTicks, { amplifier: 10, showParticles: false });
      dim.playSound("mob.ravager.roar", boss.location, { volume: 2, pitch: 0.9 });
      fx(dim, "minecraft:villager_angry", { ...boss.location, y: boss.location.y + 2.8 });
      for (const p of dim.getPlayers({ location: boss.location, maxDistance: 24 })) {
        p.onScreenDisplay.setActionBar("§6§l! Ironhide rears up - get clear !");
        hudHoldUntil.set(p.id, now + TUNING.stompWindupTicks + 10);
      }
      return;
    }
  }

  // Charge attack
  const c = s.charging;
  if (!c && target && now >= s.nextCharge) {
    s.charging = { phase: "windup", until: now + TUNING.chargeWindupTicks, target, hit: new Set() };
    boss.addEffect("slowness", TUNING.chargeWindupTicks, { amplifier: 10, showParticles: false });
    dim.playSound("mob.hoglin.angry", boss.location, { volume: 2, pitch: 0.5 });
    fx(dim, "minecraft:villager_angry", { ...boss.location, y: boss.location.y + 2.8 });
    for (const p of dim.getPlayers({ location: boss.location, maxDistance: 24 })) {
      p.onScreenDisplay.setActionBar("§c§l! Ironhide is about to charge - move sideways !");
      hudHoldUntil.set(p.id, now + TUNING.chargeWindupTicks + 10);
    }
  } else if (c?.phase === "windup" && now >= c.until) {
    // Lock the direction now. The charge goes straight, so sidestepping dodges it.
    const t = c.target?.isValid ? c.target.location : boss.location;
    let dx = t.x - boss.location.x, dz = t.z - boss.location.z;
    const len = Math.hypot(dx, dz) || 1;
    c.dir = { x: dx / len, z: dz / len };
    c.phase = "dash";
    c.until = now + TUNING.chargeDurationTicks;
    boss.applyImpulse({ x: c.dir.x * TUNING.chargeImpulse, y: 0.15, z: c.dir.z * TUNING.chargeImpulse });
    dim.playSound("mob.ravager.stun", boss.location, { volume: 1.5, pitch: 0.8 });
  } else if (c?.phase === "dash") {
    boss.applyImpulse({ x: c.dir.x * 0.25, y: 0, z: c.dir.z * 0.25 }); // keep momentum
    fx(dim, "minecraft:large_explosion", boss.location);
    for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.chargeHitRadius })) {
      if (c.hit.has(p.id)) continue;
      c.hit.add(p.id);
      p.applyDamage(TUNING.chargeDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
      knockback(p, c.dir, 2.5);
    }
    if (now >= c.until) {
      s.charging = undefined;
      s.nextCharge = now + (s.enraged ? TUNING.chargeEveryTicksEnraged : TUNING.chargeEveryTicks);
    }
  }
}

// ---------- Summoning ----------

function blowHorn(player) {
  const data = getData(player);
  if (data.skills.length === 0) {
    player.sendMessage("§7[Ponce] The horn stays silent in your hands. §fYou're not ready yet: unlock a weapon skill first.");
    player.playSound("note.bass", { pitch: 0.5 });
    return;
  }
  if (player.dimension.getEntities({ type: BOSS, location: player.location, maxDistance: 96 }).length > 0) {
    player.sendMessage("§c[Ponce] Ironhide is already nearby.");
    return;
  }
  if (!inArena(player.location)) {
    const where = isOnFloor1(player.location)
      ? `It's ${directionText(player.location, ARENA)}, at the end of the north trail.`
      : "It's on Floor 1, at the end of the north trail from Wayfarer's Rest.";
    player.sendMessage(`§7[Ponce] The Call echoes, but nothing answers. §fBlow it inside the Guardian's Arena. §7${where}`);
    player.playSound("note.bass", { pitch: 0.7 });
    return;
  }
  const loc = ARENA_SPAWN;
  try {
    player.dimension.spawnEntity(BOSS, loc).addTag(ARENA_TAG);
  } catch {
    player.sendMessage("§c[Ponce] The arena isn't ready yet. Try again in a moment.");
    return;
  }
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (inv && inv.getItem(player.selectedSlotIndex)?.typeId === HORN) inv.setItem(player.selectedSlotIndex, undefined);

  player.dimension.playSound("raid.horn", player.location, { volume: 4 });
  for (const p of player.dimension.getPlayers({ location: loc, maxDistance: TUNING.rewardRange })) {
    p.onScreenDisplay.setTitle("§cIronhide, the Boar King", {
      subtitle: "§7Guardian of the First Floor", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20,
    });
  }
}

// ---------- Registration ----------

export function registerBosses() {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack?.typeId === HORN && source.typeId === "minecraft:player") blowHorn(source);
  });

  // Thick Hide: weak weapons barely scratch him
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== BOSS || !hurtEntity.isValid) return;
    const attacker = damageSource.damagingEntity;
    if (attacker?.typeId !== "minecraft:player" || damageSource.cause !== "entityAttack") return;
    if (isDecentWeapon(getHeldItem(attacker))) return;
    const h = hurtEntity.getComponent("minecraft:health");
    if (!h || h.currentValue <= 0) return;
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage * (1 - TUNING.weakWeaponDamageTaken)));
    const s = stateFor(hurtEntity);
    if (system.currentTick >= s.glanceMsgAt) {
      s.glanceMsgAt = system.currentTick + 200;
      attacker.sendMessage("§7[Ponce] Your weapon glances off Ironhide's thick hide. §fYou need an iron-tier weapon or better.");
    }
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== BOSS) return;
    state.delete(deadEntity.id);
    const dim = deadEntity.dimension;
    const loc = deadEntity.location;
    for (const m of dim.getEntities({ location: loc, maxDistance: 48, tags: [MINION_TAG] })) {
      m.removeTag(MINION_TAG); // the herd scatters and goes back to normal
    }
    for (const p of dim.getPlayers({ location: loc, maxDistance: TUNING.rewardRange })) {
      const d = getData(p);
      const first = d.highestFloor < 2;
      d.highestFloor = Math.max(d.highestFloor, 2);
      d.col += TUNING.colReward;
      markDirty(p);
      p.onScreenDisplay.setTitle("§6FLOOR 1 CLEARED", {
        subtitle: "§fIronhide, the Boar King has fallen", fadeInDuration: 10, stayDuration: 80, fadeOutDuration: 20,
      });
      p.playSound("random.totem");
      p.sendMessage(`§6[Ponce] §fVictory! §6+${TUNING.colReward} Col${first ? "§f. The Stair Gate in the arena's north wall now opens for you." : "."}`);
      notify(p, "boss", BOSS);
    }
  });

  system.runInterval(() => {
    for (const id of DIMENSIONS) {
      for (const boss of world.getDimension(id).getEntities({ type: BOSS })) {
        try { tickBoss(boss); } catch (e) { console.warn(`[Ponce] boss tick: ${e}`); }
      }
    }
  }, 2);
}
