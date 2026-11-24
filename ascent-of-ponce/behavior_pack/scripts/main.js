// The Ascent of Ponce: entry point.

import { world, system, ItemStack } from "@minecraft/server";
import { MASTERY_GAIN, xpToNext } from "./config.js";
import { getData, markDirty, flush, forget } from "./data.js";
import { registerCombat, lastCombatTick, hudHoldUntil } from "./combat.js";
import { addMastery, applyStatEffects, getHeldItem, weaponTypeOf } from "./progression.js";
import { openMainMenu } from "./menu.js";
import { registerBosses } from "./bosses.js";
import { registerMobs } from "./mobs.js";
import { registerAbilities, skillHudText } from "./abilities.js";
import { ensureLore } from "./weapons.js";
import { forgetPlayer } from "./effects.js";
import { registerMining } from "./mining.js";
import { registerForging } from "./forging.js";
import { registerCooking, buffHudText } from "./cooking.js";
import { needsStarter, offerStarter } from "./starter.js";
import { registerQuests } from "./quests.js";
import { registerFloors, travelToFloor1 } from "./floors.js";
import { registerMultihead } from "./multihead.js";
import { registerThunderhoof } from "./thunderhoof.js";

// New players begin their climb in Wayfarer's Rest, the Floor 1 town
const START_ON_FLOOR_1 = true;

const COMPASS = "ponce:wayfarer_compass";

function hasCompass(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return true;
  for (let i = 0; i < inv.size; i++) {
    if (inv.getItem(i)?.typeId === COMPASS) return true;
  }
  return false;
}

function giveCompass(player) {
  if (hasCompass(player)) return;
  player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(COMPASS, 1));
}

function welcome(player) {
  player.onScreenDisplay.setTitle("§l§6THE ASCENT OF PONCE", {
    subtitle: "§eSeek the Fountain of Youth",
    fadeInDuration: 20, stayDuration: 80, fadeOutDuration: 20,
  });
  player.playSound("random.totem", { volume: 0.6 });
  player.sendMessage(
    "§6§l[The Ascent of Ponce]§r\n" +
    "§fSomewhere above the clouds, at the top of the tower, the Fountain of Youth is waiting.\n" +
    "§7Use your §bWayfarer's Compass§7 to open your menu. Fight to earn EXP, and train with a weapon to unlock its skills."
  );
}

// ---------- Events ----------

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  const data = getData(player);
  if (!data.initialized) {
    data.initialized = true;
    markDirty(player);
    if (START_ON_FLOOR_1) system.runTimeout(() => player.isValid && travelToFloor1(player), 10);
    system.runTimeout(() => player.isValid && welcome(player), 40);
  }
  giveCompass(player);
  applyStatEffects(player);
  // New and existing players without a starter weapon get the picker (after the welcome title)
  if (needsStarter(player)) system.runTimeout(() => player.isValid && offerStarter(player), 120);
});

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (itemStack?.typeId === COMPASS && source.typeId === "minecraft:player") {
    source.playSound("item.book.page_turn");
    openMainMenu(source);
  }
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  lastCombatTick.delete(playerId);
  forgetPlayer(playerId);
  forget(playerId);
});

registerCombat();
registerBosses();
registerMobs();
registerAbilities();
registerMining();
registerForging();
registerCooking();
registerQuests();
registerFloors();
registerMultihead();
registerThunderhoof();

// ---------- Loops ----------

// HUD above the hotbar
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const d = getData(player);
    if (!d.settings.hud || (hudHoldUntil.get(player.id) ?? 0) > system.currentTick) continue;
    const hp = player.getComponent("minecraft:health");
    const max = Math.round(hp?.effectiveMax ?? 20);
    const cur = Math.max(0, Math.ceil(hp?.currentValue ?? 0));
    const ratio = max > 0 ? Math.min(1, cur / max) : 0;
    const hpColor = ratio > 0.5 ? "§a" : ratio > 0.25 ? "§e" : "§c";
    const filled = Math.round(ratio * 20);
    const next = xpToNext(d.level);
    player.onScreenDisplay.setActionBar(
      `§f${player.name} §eLv${d.level}  ${hpColor}${"|".repeat(filled)}§8${"|".repeat(20 - filled)} §f${cur}/${max}` +
      `  §bEXP ${Math.floor((d.xp / next) * 100)}%` + skillHudText(player) + buffHudText(player)
    );
  }
}, 10);

// Save changed data every second
system.runInterval(() => flush(world.getAllPlayers()), 20);

// Stat and weapon-handling effects (re-applied in case milk cleared them),
// plus tooltips on freshly crafted Ponce weapons
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    applyStatEffects(player);
    ensureLore(player);
  }
}, 10);

// Time-with-weapon mastery: +1 per minute holding a weapon while actively fighting
system.runInterval(() => {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    if (now - (lastCombatTick.get(player.id) ?? -Infinity) > MASTERY_GAIN.activeWindowTicks) continue;
    const weapon = weaponTypeOf(getHeldItem(player));
    if (!weapon) continue;
    getData(player).weaponMinutes[weapon]++;
    markDirty(player);
    addMastery(player, weapon, MASTERY_GAIN.perActiveMinute);
  }
}, 1200);
