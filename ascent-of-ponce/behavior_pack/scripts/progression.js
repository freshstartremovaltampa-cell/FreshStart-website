// Leveling, weapon mastery, skill unlocks and stat effects.

import { EquipmentSlot } from "@minecraft/server";
import {
  MAX_LEVEL, STAT_POINTS_PER_LEVEL, MASTERY_CAP, MASTERY_GAIN, MASTERY_RANKS,
  STAT_EFFECTS, WEAPONS, WEAPON_KEYS, xpToNext,
} from "./config.js";
import { getData, markDirty } from "./data.js";
import { SKILLS, meetsRequirements } from "./skills.js";

// ---------- Weapon detection ----------

const VANILLA_WEAPONS = {
  "minecraft:mace": "hammer",
  "minecraft:trident": "spear",
};

export function getHeldItem(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
}

/** Returns a weapon type key ("sword", "hammer", ...) or undefined. */
export function weaponTypeOf(item) {
  if (!item) return undefined;
  for (const key of WEAPON_KEYS) {
    if (item.hasTag(`ponce:${key}`)) return key;
  }
  if (VANILLA_WEAPONS[item.typeId]) return VANILLA_WEAPONS[item.typeId];
  if (item.hasTag("minecraft:is_sword")) return "sword";
  if (item.hasTag("minecraft:is_axe")) return "axe";
  return undefined;
}

export function masteryRank(points) {
  let rank = MASTERY_RANKS[0].name;
  for (const r of MASTERY_RANKS) if (points >= r.min) rank = r.name;
  return rank;
}

// ---------- XP and levels ----------

export function addXp(player, amount) {
  const data = getData(player);
  if (data.level >= MAX_LEVEL || amount <= 0) return;
  data.xp += Math.round(amount);
  let leveled = 0;
  while (data.level < MAX_LEVEL && data.xp >= xpToNext(data.level)) {
    data.xp -= xpToNext(data.level);
    data.level++;
    data.statPoints += STAT_POINTS_PER_LEVEL;
    leveled++;
  }
  if (data.level >= MAX_LEVEL) data.xp = 0;
  markDirty(player);

  if (leveled > 0) {
    player.onScreenDisplay.setTitle("§6LEVEL UP", {
      subtitle: `§eLv ${data.level}  §7(+${leveled * STAT_POINTS_PER_LEVEL} stat points)`,
      fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10,
    });
    player.playSound("random.levelup");
    player.sendMessage(`§6[Ponce] §eYou reached level ${data.level}! Open your Wayfarer's Compass to spend stat points.`);
    checkSkillUnlocks(player);
  }
}

// ---------- Mastery ----------

/** Adds mastery with diminishing returns. Pass raw = true to skip them (dev tools). */
export function addMastery(player, weapon, amount, raw = false) {
  if (!weapon || amount <= 0) return;
  const data = getData(player);
  const before = data.mastery[weapon] ?? 0;
  if (before >= MASTERY_CAP) return;
  const scale = raw ? 1 : 1 - MASTERY_GAIN.diminishing * (before / MASTERY_CAP);
  const after = Math.min(MASTERY_CAP, Math.round((before + amount * scale) * 1000) / 1000);
  data.mastery[weapon] = after;
  markDirty(player);

  const oldRank = masteryRank(before);
  const newRank = masteryRank(after);
  if (oldRank !== newRank) {
    player.sendMessage(`§6[Ponce] §f${WEAPONS[weapon].name} mastery is now ${newRank}§f.`);
    player.playSound("random.orb");
  }
  checkSkillUnlocks(player);
}

// ---------- Skills ----------

export function checkSkillUnlocks(player) {
  const data = getData(player);
  const owned = new Set(data.skills);
  for (const skill of SKILLS) {
    if (owned.has(skill.id) || !meetsRequirements(data, skill)) continue;
    data.skills.push(skill.id);
    markDirty(player);
    player.onScreenDisplay.setTitle("§bSKILL ACQUIRED", {
      subtitle: `§f${skill.name}`,
      fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10,
    });
    player.playSound("random.totem");
    player.sendMessage(`§b[Ponce] New skill: §f${skill.name}§7 - ${skill.desc}`);
  }
}

// ---------- Stat effects ----------

const LONG = 20000000; // effectively permanent; reapplied after death or milk

/**
 * Keeps one of our near-permanent effects at the given level (-1 = none).
 * Effects from other sources (potions, skills, mobs) are short, so they're
 * told apart by duration and never removed or downgraded here.
 */
function ensureEffect(player, type, amplifier) {
  const current = player.getEffect(type);
  const ours = !!current && current.duration > LONG / 20;
  if (amplifier < 0) {
    if (ours) player.removeEffect(type);
    return;
  }
  if (current && !ours && current.amplifier >= amplifier) return;
  if (ours && current.amplifier === amplifier) return;
  if (current) player.removeEffect(type); // a weaker effect can't replace a stronger one
  player.addEffect(type, LONG, { amplifier, showParticles: false });
}

/**
 * Apply passive bonuses: VIT health, AGI speed, and weapon handling
 * (daggers add a speed level, greatswords slow you). Safe to call often.
 */
export function applyStatEffects(player) {
  const { stats } = getData(player);
  const held = weaponTypeOf(getHeldItem(player));
  ensureEffect(player, "health_boost", Math.floor(stats.vit / STAT_EFFECTS.vitPerHealthBoost) - 1);
  const agiLevel = STAT_EFFECTS.agiSpeedThresholds.filter((t) => stats.agi >= t).length;
  const speedLevel = Math.min(2, agiLevel + (held === "dagger" ? 1 : 0));
  ensureEffect(player, "speed", speedLevel - 1);
  ensureEffect(player, "slowness", held === "greatsword" ? 0 : -1);
}

export function critChance(data) {
  return Math.min(STAT_EFFECTS.maxCrit, data.stats.dex * STAT_EFFECTS.dexCritPerPoint);
}

export function dodgeChance(data) {
  return Math.min(STAT_EFFECTS.maxDodge, data.stats.agi * STAT_EFFECTS.agiDodgePerPoint);
}

export function damageMultiplier(data, weapon) {
  const str = data.stats.str * STAT_EFFECTS.strDamagePerPoint;
  const mastery = weapon ? ((data.mastery[weapon] ?? 0) / MASTERY_CAP) * STAT_EFFECTS.masteryMaxDamageBonus : 0;
  return 1 + str + mastery;
}
