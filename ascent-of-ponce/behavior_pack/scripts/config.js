// Tuning values for The Ascent of Ponce. Balance changes should happen here.

export const MAX_LEVEL = 100;
export const STAT_POINTS_PER_LEVEL = 3;
export const MASTERY_CAP = 1000;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export const STATS = {
  str: { name: "Strength", color: "§c", desc: "+2% melee damage per point. Unlocks heavy-weapon skills." },
  dex: { name: "Dexterity", color: "§e", desc: "+1% critical chance per point (max 50%). Unlocks precision skills." },
  agi: { name: "Agility", color: "§a", desc: "+0.5% dodge chance per point (max 25%). Speed I at 15, Speed II at 30." },
  vit: { name: "Vitality", color: "§d", desc: "+2 max hearts for every 5 points." },
};
export const STAT_KEYS = Object.keys(STATS);

export const STAT_EFFECTS = {
  strDamagePerPoint: 0.02,
  dexCritPerPoint: 0.01,
  maxCrit: 0.5,
  critMultiplier: 0.5, // crit adds +50% of the hit
  agiDodgePerPoint: 0.005,
  maxDodge: 0.25,
  agiSpeedThresholds: [15, 30], // Speed I, Speed II
  vitPerHealthBoost: 5, // each 5 VIT = one health_boost level (+4 HP)
  masteryMaxDamageBonus: 0.25, // +25% damage at max mastery with that weapon
};

// Weapon types. Custom Ponce weapons carry a tag like "ponce:sword".
// Vanilla weapons are mapped so mastery works from day one.
export const WEAPONS = {
  sword: { name: "One-Handed Sword", icon: "textures/items/weapons/iron_longsword" },
  dagger: { name: "Dagger", icon: "textures/items/weapons/iron_dagger" },
  rapier: { name: "Rapier", icon: "textures/items/weapons/iron_rapier" },
  hammer: { name: "Hammer / Mace", icon: "textures/items/weapons/iron_warhammer" },
  axe: { name: "Axe", icon: "textures/items/weapons/iron_battleaxe" },
  spear: { name: "Spear", icon: "textures/items/weapons/iron_spear" },
  katana: { name: "Katana", icon: "textures/items/weapons/iron_katana" },
  greatsword: { name: "Greatsword", icon: "textures/items/weapons/iron_greatsword" },
};
export const WEAPON_KEYS = Object.keys(WEAPONS);

// How each weapon type handles. Bedrock has no attack cooldown, so heavy
// weapons lose damage when swung faster than their swing time (in ticks).
// Each type also has one built-in trait. Weapons never carry special abilities;
// these belong to the weapon TYPE, and skills belong to the player.
export const WEAPON_HANDLING = {
  sword: { swingTicks: 10, trait: "Balanced. No penalties, no tricks." },
  dagger: { swingTicks: 6, trait: "Light: Speed I while held." },
  rapier: { swingTicks: 8, trait: "Quick thrusts: 25% chance of a follow-up thrust for 35% damage." },
  hammer: { swingTicks: 18, trait: "Heavy: every hit staggers (slows) the target." },
  axe: { swingTicks: 14, trait: "Wide swings: 30% splash damage to one other nearby enemy." },
  spear: { swingTicks: 12, trait: "Reach: +25% damage when hitting from 2.5+ blocks away." },
  katana: { swingTicks: 10, trait: "Precise: +10% critical chance." },
  greatsword: { swingTicks: 20, trait: "Massive: knocks enemies back, but Slowness I while held." },
};
export const MIN_SWING_DAMAGE = 0.2; // spam-clicking a heavy weapon still does at least 20%
export const UNMET_REQUIREMENT_DAMAGE = 0.25; // weapons you can't handle yet deal 25%
export const UNMET_RELIC_DAMAGE = 0.5; // Relics are forgiving: half strength, and skills still work
export const SPLASH = 0.3;

// Mastery is an endgame grind. Pace counts only time spent actively fighting
// ordinary mobs with that one weapon (~2 kills/minute, nonstop):
//   25 mastery  ~ 45 minutes   (first skill)
//   150         ~ 5 hours      (mid skills)
//   375         ~ 12 hours     (late skills)
//   600         ~ 21 hours     (Dual Wield tier)
// Real play mixes in mining, forging and travel, so it stretches far longer.
// Tougher mobs, and floor guardians later on, speed it up.
export const MASTERY_GAIN = {
  hit: 0.015,
  killPerXp: 0.018, // a 10-XP mob gives 0.18 mastery
  killMax: 3, // most one kill can give (before diminishing returns)
  perActiveMinute: 0.15, // holding the weapon while you've been fighting recently
  activeWindowTicks: 20 * 120, // "recently" = hit something in the last 2 minutes
  diminishing: 0.6, // gains slow down as you climb: 100% at 0, 40% at the cap
};

export const MASTERY_RANKS = [
  { min: 0, name: "§7Novice" },
  { min: 50, name: "§fApprentice" },
  { min: 150, name: "§aAdept" },
  { min: 375, name: "§bExpert" },
  { min: 600, name: "§dMaster" },
  { min: 1000, name: "§6Grandmaster" },
];

// Tower mobs. The level shows in the target bar when you hit one.
export const MOBS = {
  "ponce:meadow_jelly": { name: "Meadow Jelly", level: 1, xp: 8 },
  "ponce:thornback_hare": { name: "Thornback Hare", level: 2, xp: 10 },
  "ponce:field_wasp": { name: "Field Wasp", level: 2, xp: 12 },
  "ponce:tusk_boar": { name: "Tusk Boar", level: 3, xp: 18 },
  "ponce:burrow_mole": { name: "Burrow Mole", level: 3, xp: 16 },
  "ponce:moss_golemite": { name: "Moss Golemite", level: 4, xp: 35 },
  // Floor guardians give a big flat mastery boost to the weapon that lands the final blow
  "ponce:ironhide": { name: "Ironhide, the Boar King", level: 8, xp: 600, mastery: 12, boss: true },
  // Floor 2: the Misty Marsh
  "ponce:bog_frog": { name: "Bog Frog", level: 8, xp: 30 },
  "ponce:will_o_wisp": { name: "Will-o'-Wisp", level: 10, xp: 34 },
  "ponce:mire_shambler": { name: "Mire Shambler", level: 11, xp: 45 },
  "ponce:marsh_gator": { name: "Marsh Gator", level: 12, xp: 60 },
  "ponce:hydra_head": { name: "Hydra Head", level: 15, xp: 40, mastery: 1.5 },
  "ponce:hydra_head_acid": { name: "Hydra Head", level: 15, xp: 40, mastery: 1.5 },
  // XP and mastery here go to whoever fells the last head
  "ponce:mire_hydra": { name: "Mire Hydra", level: 15, xp: 900, mastery: 15, boss: true },
};

// XP from kills. Anything not listed falls back to its max health.
export const MOB_XP = {
  ...Object.fromEntries(Object.entries(MOBS).map(([id, m]) => [id, m.xp])),
  "minecraft:zombie": 10,
  "minecraft:husk": 12,
  "minecraft:drowned": 12,
  "minecraft:skeleton": 12,
  "minecraft:stray": 14,
  "minecraft:spider": 10,
  "minecraft:cave_spider": 12,
  "minecraft:creeper": 15,
  "minecraft:witch": 25,
  "minecraft:enderman": 30,
  "minecraft:blaze": 25,
  "minecraft:wither_skeleton": 35,
  "minecraft:vindicator": 30,
  "minecraft:evocation_illager": 50,
  "minecraft:ravager": 80,
  "minecraft:warden": 300,
  "minecraft:elder_guardian": 200,
};
export const PASSIVE_XP_MULTIPLIER = 0.2;
