// Starter weapon. On first login every adventurer picks one Wayfarer's weapon.
// It's the weakest weapon of its type (and weaker than any forged weapon),
// can't be forged or crafted, and is given only once.

import { ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { WEAPONS, WEAPON_HANDLING } from "./config.js";
import { WEAPON_DEFS } from "./weapon_data.js";
import { getData, markDirty } from "./data.js";
import { give } from "./inventory.js";
import { weaponLore } from "./weapons.js";
import { show } from "./ui.js";

export const STARTERS = Object.entries(WEAPON_DEFS).filter(([, d]) => d.tier === 0);
const offering = new Set(); // player ids with the picker open

export function needsStarter(player) {
  return !getData(player).starter;
}

export async function offerStarter(player) {
  if (!needsStarter(player) || offering.has(player.id)) return;
  offering.add(player.id);
  try {
    const form = new ActionFormData()
      .title("§l§6Choose Your Weapon")
      .body(
        "§fEvery climber starts with one weapon.§7 Pick the kind you want to train with first. " +
        "Using a weapon type builds its mastery and unlocks its skills.\n\n" +
        "§8Wayfarer's weapons are the weakest in the tower and can't be forged. " +
        "You'll forge better ones later, of any type. This choice only decides where you begin."
      );
    for (const [, def] of STARTERS) {
      form.button(`§f${WEAPONS[def.type].name}\n§8${WEAPON_HANDLING[def.type].trait}`, WEAPONS[def.type].icon);
    }
    const res = await show(player, form);
    if (res.canceled || res.selection === undefined || !needsStarter(player)) {
      if (needsStarter(player)) player.sendMessage("§7[Ponce] You can choose your starter weapon any time from the Wayfarer's Compass.");
      return;
    }
    const [id, def] = STARTERS[res.selection];
    const item = new ItemStack(id, 1);
    item.setLore(weaponLore(def));
    give(player, item);
    getData(player).starter = id;
    markDirty(player);
    player.playSound("random.anvil_use", { pitch: 1.4 });
    player.sendMessage(`§6[Ponce] §fYou take up the §e${def.name}§f. Train with it to unlock your first ${WEAPONS[def.type].name} skill.`);
  } finally {
    offering.delete(player.id);
  }
}
