// World defaults the tower expects. Applied once per world, the first time the
// add-on runs in it, so a player who later changes a rule keeps their choice.
//  - Keep Inventory on: dying on a floor shouldn't scatter your forged weapons
//    and quest Relics across the snow.

import { world, system } from "@minecraft/server";

const FLAG = "ponce:default_rules_v1";

export function applyDefaultRules() {
  if (world.getDynamicProperty(FLAG)) return false;
  let ok = false;
  try {
    if (world.gameRules) { world.gameRules.keepInventory = true; ok = true; }
  } catch { /* fall back to the command */ }
  if (!ok) {
    try { world.getDimension("overworld").runCommand("gamerule keepinventory true"); ok = true; } catch { /* retried later */ }
  }
  if (ok) world.setDynamicProperty(FLAG, true);
  return ok;
}

export function registerGameRules() {
  // The world may not accept changes during startup, so try shortly after, and again when someone joins
  system.runTimeout(() => applyDefaultRules(), 20);
  world.afterEvents.playerSpawn.subscribe(() => applyDefaultRules());
}
