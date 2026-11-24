// Ponce weapons: requirements, durability and item tooltips.

import { EquipmentSlot } from "@minecraft/server";
import { STATS, WEAPONS, WEAPON_HANDLING } from "./config.js";
import { WEAPON_DEFS } from "./weapon_data.js";

// Forged weapons carry a quality (dynamic property "ponce:quality").
// Crafted-by-command or older weapons have none and count as Standard.
export const QUALITIES = {
  crude: { name: "§8Crude", damage: 0.9, wearExtra: 0.25, xp: 0.5 },
  standard: { name: "§fStandard", damage: 1.0, xp: 1 },
  fine: { name: "§aFine", damage: 1.1, wearSkip: 0.2, xp: 1.25 },
  masterwork: { name: "§6Masterwork", damage: 1.2, wearSkip: 0.33, xp: 1.5 },
};

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

export function weaponLore(def) {
  const stats = Object.entries(def.req.stats).map(([k, v]) => `${STATS[k].color}${k.toUpperCase()} ${v}`).join(" §7/ ");
  return [
    `§7${WEAPONS[def.type].name} §8- Tier ${def.tier === 1 ? "I" : "II"}`,
    `§7Damage §f${def.damage}`,
    `§7Requires §eLv ${def.req.level}§7 / ${stats}`,
    `§8${WEAPON_HANDLING[def.type].trait}`,
  ];
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
  const q = qualityOf(item);
  if (q?.wearSkip && Math.random() < q.wearSkip) return;
  const amount = q?.wearExtra && Math.random() < q.wearExtra ? 2 : 1;
  if (dur.damage + amount >= dur.maxDurability) {
    eq.setEquipment(slot, undefined);
    player.playSound("random.break");
    player.sendMessage(`§c[Ponce] Your ${weaponDef(item).name} broke!`);
    return;
  }
  dur.damage += amount;
  eq.setEquipment(slot, item);
}
