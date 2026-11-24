// Skill catalogue. Skills belong to the player, never to a weapon.
// Mastery tiers: ~25 early, ~150-225 mid, ~375-490 late, 600 endgame.
// Active skills fire with a Ponce weapon: press "use". Sneak + use picks which
// active skill is equipped. Passive skills are always on. See abilities.js.

export const SKILLS = [
  // One-handed sword
  { id: "sword_dash", kind: "active", cooldown: 6, weapon: "sword", name: "Dash Slash", desc: "Lunge forward and strike the first enemy in your path.", req: { mastery: 25 } },
  { id: "sword_combo", kind: "active", cooldown: 10, weapon: "sword", name: "Triple Arc", desc: "A fast three-hit combo.", req: { mastery: 150, stats: { dex: 10, str: 10 } } },
  { id: "dual_wield", kind: "passive", weapon: "sword", name: "§6Dual Wield", desc: "Passive: hold a Ponce sword in your offhand and every hit is followed by an offhand strike.", req: { mastery: 600, level: 25, stats: { dex: 40, str: 20 } } },
  { id: "twin_tempest", weapon: "sword", kind: "active", cooldown: 30, name: "§6Twin Tempest", desc: "Needs Dual Wield and an offhand sword. Six alternating strikes from both blades.", req: { skill: "dual_wield", mastery: 650, level: 28, stats: { dex: 45, str: 22 } } },

  // Dagger
  { id: "dagger_backstab", kind: "passive", weapon: "dagger", name: "Backstab", desc: "Passive: big bonus damage when hitting enemies from behind.", req: { mastery: 25 } },
  { id: "dagger_venom", kind: "active", cooldown: 15, weapon: "dagger", name: "Venom Edge", desc: "Your next hits poison the target.", req: { mastery: 150, stats: { dex: 12 } } },
  { id: "dagger_blink", kind: "active", cooldown: 12, weapon: "dagger", name: "Shadow Step", desc: "Blink behind the enemy you're looking at.", req: { mastery: 375, stats: { dex: 20, agi: 20 } } },

  // Rapier
  { id: "rapier_flurry", kind: "active", cooldown: 8, weapon: "rapier", name: "Flurry", desc: "A rapid burst of thrusts.", req: { mastery: 25 } },
  { id: "rapier_lunge", kind: "active", cooldown: 10, weapon: "rapier", name: "Comet Lunge", desc: "Close distance instantly with a piercing thrust.", req: { mastery: 150, stats: { dex: 15 } } },
  { id: "rapier_riposte", kind: "active", cooldown: 12, weapon: "rapier", name: "Riposte", desc: "Parry stance: the next hit you take is countered.", req: { mastery: 375, stats: { dex: 30 } } },

  // Hammer / Mace
  { id: "hammer_slam", kind: "active", cooldown: 10, weapon: "hammer", name: "Ground Slam", desc: "AoE: smash the ground, damaging and knocking up everything around you.", req: { mastery: 40, stats: { str: 10 } } },
  { id: "hammer_stun", kind: "active", cooldown: 12, weapon: "hammer", name: "Concussion", desc: "Charged hit that stuns the target.", req: { mastery: 225, stats: { str: 18 } } },
  { id: "hammer_break", kind: "active", cooldown: 20, weapon: "hammer", name: "Armor Break", desc: "Target takes increased damage for a short time.", req: { mastery: 450, stats: { str: 30, vit: 10 } } },

  // Axe
  { id: "axe_cleave", kind: "active", cooldown: 7, weapon: "axe", name: "Cleave", desc: "Hit every enemy in a wide arc in front of you.", req: { mastery: 25 } },
  { id: "axe_bleed", kind: "passive", weapon: "axe", name: "Rend", desc: "Passive: hits stack a bleed on the target.", req: { mastery: 190, stats: { str: 12, vit: 8 } } },
  { id: "axe_whirlwind", kind: "active", cooldown: 16, weapon: "axe", name: "Whirlwind", desc: "Spin, hitting everything around you several times.", req: { mastery: 410, stats: { str: 25, vit: 15 } } },

  // Spear
  { id: "spear_pierce", kind: "active", cooldown: 8, weapon: "spear", name: "Piercing Line", desc: "A thrust that hits every enemy in a line.", req: { mastery: 25 } },
  { id: "spear_vault", kind: "active", cooldown: 10, weapon: "spear", name: "Pole Vault", desc: "Launch yourself up and forward.", req: { mastery: 150, stats: { agi: 15 } } },
  { id: "spear_sweep", kind: "active", cooldown: 12, weapon: "spear", name: "Keep-Away Sweep", desc: "Knock all nearby enemies back.", req: { mastery: 375, stats: { agi: 20, str: 15 } } },

  // Katana
  { id: "katana_draw", kind: "passive", weapon: "katana", name: "Iaido Draw", desc: "Your first hit after sheathing deals massive damage.", req: { mastery: 25 } },
  { id: "katana_counter", kind: "active", cooldown: 14, weapon: "katana", name: "Still Water", desc: "Counter stance that negates and returns one attack.", req: { mastery: 225, stats: { dex: 15, agi: 10 } } },
  { id: "katana_chain", kind: "passive", weapon: "katana", name: "Crimson Chain", desc: "Critical hits reduce your skill cooldowns.", req: { mastery: 490, stats: { dex: 30, agi: 20 } } },

  // Greatsword
  { id: "great_overhead", kind: "active", cooldown: 12, weapon: "greatsword", name: "Titan Overhead", desc: "Charged overhead strike with huge damage.", req: { mastery: 25, stats: { str: 8 } } },
  { id: "great_arc", kind: "active", cooldown: 10, weapon: "greatsword", name: "Gale Arc", desc: "A wide swing that knocks enemies far back.", req: { mastery: 190, stats: { str: 15 } } },
  { id: "great_bulwark", kind: "passive", weapon: "greatsword", name: "Bulwark", desc: "Passive: take less damage while swinging.", req: { mastery: 410, stats: { str: 25, vit: 20 } } },
];

export const SKILLS_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function activeSkillsFor(weapon) {
  return SKILLS.filter((s) => s.weapon === weapon && s.kind === "active");
}

/** Returns true if player data meets every requirement of the skill. */
export function meetsRequirements(data, skill) {
  const r = skill.req;
  if (r.skill && !data.skills.includes(r.skill)) return false;
  if (r.level && data.level < r.level) return false;
  if (r.mastery && (data.mastery[skill.weapon] ?? 0) < r.mastery) return false;
  for (const [stat, min] of Object.entries(r.stats ?? {})) {
    if ((data.stats[stat] ?? 0) < min) return false;
  }
  return true;
}

/** Human-readable requirement list, green for met, red for not met. */
export function describeRequirements(data, skill, weaponName) {
  const r = skill.req;
  const part = (ok, text) => `${ok ? "§a" : "§c"}${text}`;
  const parts = [];
  if (r.skill) parts.push(part(data.skills.includes(r.skill), SKILLS_BY_ID[r.skill]?.name.replace(/§./g, "") ?? r.skill));
  if (r.level) parts.push(part(data.level >= r.level, `Lv ${r.level}`));
  if (r.mastery) parts.push(part((data.mastery[skill.weapon] ?? 0) >= r.mastery, `${weaponName} mastery ${r.mastery}`));
  for (const [stat, min] of Object.entries(r.stats ?? {})) {
    parts.push(part((data.stats[stat] ?? 0) >= min, `${stat.toUpperCase()} ${min}`));
  }
  return parts.join("§7, ");
}
