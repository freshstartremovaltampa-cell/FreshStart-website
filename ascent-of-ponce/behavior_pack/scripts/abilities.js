// Active skills. Hold a Ponce weapon and press "use" to fire the equipped skill
// for that weapon type. Sneak + use cycles which unlocked skill is equipped.
// Skill damage scales from the weapon's base damage, then goes through the
// normal hit pipeline (stats, crits, passives) in combat.js.

import { world, system, EquipmentSlot } from "@minecraft/server";
import { WEAPONS } from "./config.js";
import { getData, markDirty } from "./data.js";
import { getHeldItem } from "./progression.js";
import { activeSkillsFor, SKILLS, SKILLS_BY_ID } from "./skills.js";
import { effectiveDamage, getOffhand, meetsWeaponReq, wearWeapon, weaponDef } from "./weapons.js";
import { dealSkillDamage, flash, flatDir, isTarget, push } from "./combat.js";
import { armorBroken, cooldownLeft, nextHitBuffs, setCooldown, stances } from "./effects.js";

// ---------- Targeting ----------

function forward(player) {
  const v = player.getViewDirection();
  const len = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / len, z: v.z / len };
}

function enemiesNear(player, radius, center = player.location) {
  return player.dimension.getEntities({ location: center, maxDistance: radius }).filter(isTarget);
}

/** Enemies in front of the player. cosMin 0.5 = 120 degree cone, 0 = half circle. */
function inCone(player, range, cosMin) {
  const f = forward(player);
  return enemiesNear(player, range).filter((e) => {
    const d = flatDir(player.location, e.location);
    return d.dist < 0.5 || d.x * f.x + d.z * f.z >= cosMin;
  });
}

function closestInFront(player, range = 4, cosMin = 0.3) {
  const list = inCone(player, range, cosMin);
  list.sort((a, b) => flatDir(player.location, a.location).dist - flatDir(player.location, b.location).dist);
  return list[0];
}

function inLine(player, length, width) {
  const f = forward(player);
  return enemiesNear(player, length + 1).filter((e) => {
    const dx = e.location.x - player.location.x, dz = e.location.z - player.location.z;
    const along = dx * f.x + dz * f.z;
    const side = Math.abs(dx * f.z - dz * f.x);
    return along >= 0 && along <= length && side <= width;
  });
}

function knockAway(player, e, h, v) {
  push(e, flatDir(player.location, e.location), h, v);
}

const later = (ticks, fn) => system.runTimeout(fn, ticks);
const sound = (player, id, pitch = 1) => player.dimension.playSound(id, player.location, { volume: 1, pitch });
const particle = (player, id, loc = player.location) => { try { player.dimension.spawnParticle(id, loc); } catch { /* ignore */ } };

// ---------- Skill implementations ----------
// Each returns false if it couldn't fire (no target, missing offhand...),
// in which case no cooldown starts.

const IMPL = {
  // One-handed sword
  sword_dash(p, dmg) {
    push(p, forward(p), 2.2, 0.15);
    sound(p, "game.player.attack.strong", 1.2);
    later(5, () => { const t = closestInFront(p, 3.5); if (t) dealSkillDamage(p, t, dmg * 1.5); });
  },
  sword_combo(p, dmg) {
    for (let i = 0; i < 3; i++) {
      later(i * 10, () => {
        sound(p, "game.player.attack.strong", 1 + i * 0.15);
        for (const e of inCone(p, 3.5, 0.3)) dealSkillDamage(p, e, dmg * 0.8);
      });
    }
  },
  twin_tempest(p, dmg) {
    const off = weaponDef(getOffhand(p));
    if (off?.type !== "sword") { flash(p, "§7Twin Tempest needs a Ponce sword in your offhand.", 40); return false; }
    for (let i = 0; i < 6; i++) {
      later(i * 8, () => {
        const t = closestInFront(p, 4, 0.2);
        sound(p, "game.player.attack.strong", 1.1 + (i % 2) * 0.2);
        if (t) dealSkillDamage(p, t, (i % 2 ? effectiveDamage(getOffhand(p)) : dmg) * 0.9);
      });
    }
    wearWeapon(p, EquipmentSlot.Offhand);
  },

  // Dagger
  dagger_venom(p) {
    nextHitBuffs.set(p.id, { type: "venom", hits: 3, until: system.currentTick + 200 });
    sound(p, "mob.spider.say", 1.6);
  },
  dagger_blink(p, dmg) {
    const hit = p.getEntitiesFromViewDirection({ maxDistance: 10 }).find((h) => isTarget(h.entity));
    if (!hit) { flash(p, "§7Look at an enemy to Shadow Step behind it.", 30); return false; }
    const t = hit.entity;
    const view = t.getViewDirection();
    const len = Math.hypot(view.x, view.z) || 1;
    const behind = { x: t.location.x - (view.x / len) * 1.5, y: t.location.y, z: t.location.z - (view.z / len) * 1.5 };
    particle(p, "minecraft:large_explosion");
    p.teleport(behind, { facingLocation: t.location });
    sound(p, "mob.endermen.portal", 1.4);
    later(2, () => t.isValid && dealSkillDamage(p, t, dmg * 1.2));
  },

  // Rapier
  rapier_flurry(p, dmg) {
    for (let i = 0; i < 4; i++) {
      later(i * 8, () => {
        const t = closestInFront(p, 3.5);
        sound(p, "game.player.attack.nodamage", 1.4 + i * 0.1);
        if (t) dealSkillDamage(p, t, dmg * 0.6);
      });
    }
  },
  rapier_lunge(p, dmg) {
    push(p, forward(p), 3, 0.1);
    sound(p, "game.player.attack.strong", 1.4);
    const hit = new Set();
    for (let i = 1; i <= 4; i++) {
      later(i * 2, () => {
        for (const e of enemiesNear(p, 2)) {
          if (hit.has(e.id)) continue;
          hit.add(e.id);
          dealSkillDamage(p, e, dmg * 1.4);
        }
      });
    }
  },
  rapier_riposte(p) {
    stances.set(p.id, { type: "riposte", until: system.currentTick + 60 });
    sound(p, "random.anvil_use", 1.8);
    flash(p, "§b§lRiposte stance §r§7- the next attack in 3s is countered", 40);
    return "silent";
  },

  // Hammer
  hammer_slam(p, dmg) {
    sound(p, "random.explode", 0.7);
    particle(p, "minecraft:huge_explosion_emitter");
    for (const e of enemiesNear(p, 4)) {
      dealSkillDamage(p, e, dmg * 1.2);
      knockAway(p, e, 0.4, 0.6);
      e.addEffect?.("slowness", 40, { amplifier: 2 });
    }
  },
  hammer_stun(p) {
    nextHitBuffs.set(p.id, { type: "stun", hits: 1, until: system.currentTick + 100 });
    sound(p, "random.anvil_use", 0.6);
    flash(p, "§6§lConcussion ready §r§7- your next hit stuns", 40);
    return "silent";
  },
  hammer_break(p, dmg) {
    const t = closestInFront(p, 4);
    if (!t) { flash(p, "§7No enemy in front of you.", 30); return false; }
    armorBroken.set(t.id, system.currentTick + 160);
    dealSkillDamage(p, t, dmg * 0.8);
    sound(p, "random.anvil_land", 0.6);
  },

  // Axe
  axe_cleave(p, dmg) {
    sound(p, "game.player.attack.strong", 0.8);
    for (const e of inCone(p, 3.5, 0.1)) dealSkillDamage(p, e, dmg * 1.1);
  },
  axe_whirlwind(p, dmg) {
    for (let i = 0; i < 3; i++) {
      later(i * 10, () => {
        sound(p, "game.player.attack.strong", 0.7 + i * 0.1);
        for (const e of enemiesNear(p, 3.5)) dealSkillDamage(p, e, dmg * 0.8);
      });
    }
  },

  // Spear
  spear_pierce(p, dmg) {
    sound(p, "item.trident.throw", 1.2);
    for (const e of inLine(p, 6, 1.2)) dealSkillDamage(p, e, dmg * 1.3);
  },
  spear_vault(p) {
    push(p, forward(p), 1.6, 0.9);
    p.addEffect("slow_falling", 40, { amplifier: 0, showParticles: false });
    sound(p, "item.trident.riptide_1", 1.2);
  },
  spear_sweep(p, dmg) {
    sound(p, "game.player.attack.strong", 0.9);
    for (const e of enemiesNear(p, 4.5)) {
      dealSkillDamage(p, e, dmg * 0.7);
      knockAway(p, e, 1.5, 0.4);
    }
  },

  // Katana
  katana_counter(p) {
    stances.set(p.id, { type: "still_water", until: system.currentTick + 40 });
    sound(p, "random.anvil_use", 2);
    flash(p, "§b§lStill Water §r§7- the next attack in 2s is turned back on everything nearby", 40);
    return "silent";
  },

  // Greatsword
  great_overhead(p, dmg) {
    p.addEffect("slowness", 15, { amplifier: 3, showParticles: false });
    sound(p, "mob.ravager.roar", 1.6);
    later(15, () => {
      const t = closestInFront(p, 4);
      sound(p, "random.anvil_land", 0.5);
      if (!t) return;
      dealSkillDamage(p, t, dmg * 3);
      for (const e of enemiesNear(p, 1.5, t.location)) if (e.id !== t.id) dealSkillDamage(p, e, dmg);
    });
  },
  great_arc(p, dmg) {
    sound(p, "game.player.attack.strong", 0.6);
    for (const e of inCone(p, 4, 0.1)) {
      dealSkillDamage(p, e, dmg * 1.2);
      knockAway(p, e, 2, 0.4);
    }
  },
};

// ---------- Activation ----------

function unlockedActive(data, weapon) {
  return activeSkillsFor(weapon).filter((s) => data.skills.includes(s.id));
}

export function equippedSkill(data, weapon) {
  const list = unlockedActive(data, weapon);
  return list.find((s) => s.id === data.activeSkill[weapon]) ?? list[0];
}

function nextSkillHint(data, weapon) {
  const next = activeSkillsFor(weapon).find((s) => !data.skills.includes(s.id));
  return next ? ` §8(next: ${next.name.replace(/§./g, "")} at ${next.req.mastery} mastery, you have ${Math.floor(data.mastery[weapon])})` : "";
}

function cycle(player, data, weapon) {
  const list = unlockedActive(data, weapon);
  if (list.length === 0) return flash(player, `§7No ${WEAPONS[weapon].name} skills yet.${nextSkillHint(data, weapon)}`, 50);
  const cur = equippedSkill(data, weapon);
  const next = list[(list.indexOf(cur) + 1) % list.length];
  data.activeSkill[weapon] = next.id;
  markDirty(player);
  player.playSound("random.click");
  flash(player, `§bEquipped: §f${next.name} §7(${list.indexOf(next) + 1}/${list.length})`, 40);
}

export function useSkill(player, item) {
  const def = weaponDef(item);
  if (!def) return;
  const data = getData(player);
  const weapon = def.type;
  if (player.isSneaking) return cycle(player, data, weapon);

  if (!meetsWeaponReq(data, def)) return flash(player, `§cYou can't use skills with a weapon you can't handle yet.`, 40);
  const skill = equippedSkill(data, weapon);
  if (!skill) return flash(player, `§7No ${WEAPONS[weapon].name} skills yet.${nextSkillHint(data, weapon)}`, 50);
  const now = system.currentTick;
  const left = cooldownLeft(player.id, skill.id, now);
  if (left > 0) return flash(player, `§7${skill.name} §8- ready in ${Math.ceil(left / 20)}s`, 20);

  const result = IMPL[skill.id]?.(player, effectiveDamage(item), data);
  if (result === false) return;
  setCooldown(player.id, skill.id, now + skill.cooldown * 20);
  wearWeapon(player);
  if (result !== "silent") flash(player, `§b§l${skill.name}!`, 30);
}

/** Short HUD tag for the held weapon's equipped skill, e.g. "[Dash Slash] READY". */
export function skillHudText(player) {
  const def = weaponDef(getHeldItem(player));
  if (!def) return "";
  const data = getData(player);
  const skill = equippedSkill(data, def.type);
  if (!skill) return "";
  const left = cooldownLeft(player.id, skill.id, system.currentTick);
  const name = skill.name.replace(/§./g, "");
  return left > 0 ? `  §8[${name} ${Math.ceil(left / 20)}s]` : `  §b[${name}] §aREADY`;
}

export function registerAbilities() {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (source.typeId !== "minecraft:player" || !weaponDef(itemStack)) return;
    try { useSkill(source, itemStack); } catch (e) { console.warn(`[Ponce] skill error: ${e}`); }
  });
}

// Exposed for tests and the menu
export const IMPLEMENTED = Object.keys(IMPL);
export { SKILLS, SKILLS_BY_ID };
