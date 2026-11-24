// Ponce weapons: requirements, durability and item tooltips.

import { EquipmentSlot } from "@minecraft/server";
import { STATS, WEAPONS, WEAPON_HANDLING } from "./config.js";
import { INFUSIONS, WEAPON_DEFS } from "./weapon_data.js";

// Forged weapons carry a quality (dynamic property "ponce:quality").
// Crafted-by-command or older weapons have none and count as Standard.
// durability is how long the weapon lasts relative to Standard.
export const QUALITIES = {
  crude: { name: "§8Crude", damage: 0.9, durability: 0.8, xp: 0.5 },
  standard: { name: "§fStandard", damage: 1.0, durability: 1, xp: 1 },
  fine: { name: "§aFine", damage: 1.1, durability: 1.25, xp: 1.25 },
  masterwork: { name: "§6Masterwork", damage: 1.2, durability: 1.5, xp: 1.5 },
};

// ---------- Infusions (optional monster drops added while forging) ----------

/** Infusions on this weapon. Relics have theirs built in, even when spawned by command. */
export function infusionsOf(item) {
  try {
    const raw = item?.getDynamicProperty("ponce:infusions");
    if (typeof raw === "string") return JSON.parse(raw).filter((id) => INFUSIONS[id]);
  } catch { /* fall through */ }
  return weaponDef(item)?.infusions ?? [];
}

/** Summed stat changes from a list of infusion item ids. */
export function infusionBonus(ids) {
  const b = { damage: 0, durability: 0, crit: 0, swing: 0, lifesteal: 0 };
  for (const id of ids) for (const k of Object.keys(b)) b[k] += INFUSIONS[id]?.[k] ?? 0;
  return b;
}

export function weaponBonus(item) {
  return infusionBonus(infusionsOf(item));
}

const pctText = (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** "+1 damage, -10% durability" */
export function describeInfusion(inf) {
  const parts = [];
  if (inf.damage) parts.push(`${inf.damage > 0 ? "+" : ""}${inf.damage} damage`);
  if (inf.durability) parts.push(`${pctText(inf.durability)} durability`);
  if (inf.crit) parts.push(`${pctText(inf.crit)} crit chance`);
  if (inf.swing) parts.push(inf.swing < 0 ? `${Math.round(-inf.swing * 100)}% faster swing` : `${Math.round(inf.swing * 100)}% slower swing`);
  if (inf.lifesteal) parts.push(`heals you for ${Math.round(inf.lifesteal * 100)}% of the damage you deal`);
  return parts.join(", ");
}

/** Base damage after quality and infusions: what skills scale from. */
export function effectiveDamage(item) {
  const def = weaponDef(item);
  if (!def) return 5;
  return Math.max(1, def.damage + weaponBonus(item).damage) * qualityMult(item);
}

export function qualityOf(item) {
  try { return QUALITIES[item?.getDynamicProperty("ponce:quality")]; } catch { return undefined; }
}

export function qualityMult(item) {
  return qualityOf(item)?.damage ?? 1;
}

export function weaponDef(item) {
  return item ? WEAPON_DEFS[item.typeId] : undefined;
}

export function getOffhand(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand);
}

export function meetsWeaponReq(data, def) {
  if (!def) return true;
  if (data.level < def.req.level) return false;
  return Object.entries(def.req.stats).every(([k, v]) => (data.stats[k] ?? 0) >= v);
}

/** "Lv 3, STR 2, DEX 2" with green for met and red for unmet. */
export function describeWeaponReq(data, def) {
  const c = (ok) => (ok ? "§a" : "§c");
  const parts = [`${c(data.level >= def.req.level)}Lv ${def.req.level}`];
  for (const [k, v] of Object.entries(def.req.stats)) parts.push(`${c((data.stats[k] ?? 0) >= v)}${k.toUpperCase()} ${v}`);
  return parts.join("§7, ");
}

// Tier numbers: 0 Starter, 1 Tier I, 2 Tier II, 3 Relic, 4 Tier III (forged, added after the Relics)
const TIER_NAMES = ["Starter", "Tier I", "Tier II", "§dRelic", "§3Tier III"];

export function weaponLore(def, { quality, infusions = def.infusions ?? [] } = {}) {
  const stats = Object.entries(def.req.stats).map(([k, v]) => `${STATS[k].color}${k.toUpperCase()} ${v}`).join(" §7/ ");
  const bonus = infusionBonus(infusions);
  const q = QUALITIES[quality];
  const dmg = Math.max(1, def.damage + bonus.damage) * (q?.damage ?? 1);
  const lines = [`§7${WEAPONS[def.type].name} §8- ${TIER_NAMES[def.tier] ?? "Tier " + def.tier}`];
  if (q) lines.push(`§7Quality: ${q.name}`);
  lines.push(`§7Damage §f${Math.round(dmg * 10) / 10}${dmg !== def.damage ? ` §8(base ${def.damage})` : ""}`);
  for (const id of infusions) lines.push(`§d${INFUSIONS[id].name}: §7${describeInfusion(INFUSIONS[id])}`);
  lines.push(stats ? `§7Requires §eLv ${def.req.level}§7 / ${stats}` : `§7Requires §eLv ${def.req.level}`);
  if (!def.durability) lines.push("§bUnbreakable");
  if (def.tier === 0) lines.push("§8Your first weapon. Can't be forged.");
  if (def.tier === 3) {
    const from = def.relic === "hydra" ? "Dropped by the Mire Hydra" : "A Legendary quest reward";
    lines.push(`§8${from}. Can't be forged. Below its requirements it works at half strength.`);
  }
  lines.push(`§8${WEAPON_HANDLING[def.type].trait}`);
  return lines;
}

/** Adds the tooltip to a held Ponce weapon that doesn't have one yet. */
export function ensureLore(player) {
  const eq = player.getComponent("minecraft:equippable");
  if (!eq) return;
  for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand]) {
    const item = eq.getEquipment(slot);
    const def = weaponDef(item);
    if (!def || item.getLore().length > 0) continue;
    item.setLore(weaponLore(def));
    eq.setEquipment(slot, item);
  }
}

/** Wears down a Ponce weapon by one use. Custom weapons don't lose durability on their own. */
export function wearWeapon(player, slot = EquipmentSlot.Mainhand) {
  const eq = player.getComponent("minecraft:equippable");
  const item = eq?.getEquipment(slot);
  if (!weaponDef(item)) return;
  const dur = item.getComponent("minecraft:durability");
  if (!dur) return;
  const unbreaking = item.getComponent("minecraft:enchantable")?.getEnchantment?.("unbreaking")?.level ?? 0;
  if (unbreaking > 0 && Math.random() < unbreaking / (unbreaking + 1)) return;
  // Longer-lasting weapons (quality, infusions) sometimes skip wear; flimsier ones sometimes wear double
  const factor = Math.max(0.3, (qualityOf(item)?.durability ?? 1) * (1 + weaponBonus(item).durability));
  if (factor > 1 && Math.random() < 1 - 1 / factor) return;
  const amount = factor < 1 && Math.random() < Math.min(1, 1 / factor - 1) ? 2 : 1;
  if (dur.damage + amount >= dur.maxDurability) {
    eq.setEquipment(slot, undefined);
    player.playSound("random.break");
    player.sendMessage(`§c[Ponce] Your ${weaponDef(item).name} broke!`);
    return;
  }
  dur.damage += amount;
  eq.setEquipment(slot, item);
}
