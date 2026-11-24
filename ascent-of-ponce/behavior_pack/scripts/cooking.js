// Cooking. Use the Cooking Pot (right-click / long-press) to pick a recipe.
// The bar fills as it cooks: PUNCH the pot to take it off the heat.
//   Too early (grey)   not ready, nothing happens
//   Yellow             done: 1 serving
//   Green              perfect: 2 servings
//   Past the window    burnt: a Burnt Mess
// Meals give a temporary stat buff (one at a time). Cooking level unlocks
// recipes and widens the perfect window.

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { COOK_RECIPES, FOODS } from "./jobs_data.js";
import { STATS } from "./config.js";
import { getData, markDirty } from "./data.js";
import { addJobXp, jobLevel } from "./jobs.js";
import { countItem, give, hasAll, itemName, takeAll } from "./inventory.js";
import { applyStatEffects } from "./progression.js";
import { hudHoldUntil } from "./combat.js";
import { show } from "./ui.js";

const POT = "ponce:cooking_pot";
export const COOK_TICKS = 160; // 8 seconds from raw to the end of the window
const BAR = 25;
const WINDOW = [55, 85]; // % range where the dish is done
const MAX_DISTANCE = 6;

export const pots = new Map(); // player id -> cooking session

export function perfectWidth(level) {
  return Math.min(14, 6 + level * 0.3);
}

function sameSpot(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

// ---------- Menu ----------

export async function openPotMenu(player, block) {
  if (pots.has(player.id)) return;
  const loc = { ...block.location };
  for (const [id, s] of pots) if (id !== player.id && sameSpot(s.loc, loc)) return player.sendMessage("§7[Ponce] Someone is already cooking here.");
  const level = jobLevel(getData(player), "cooking");

  const form = new ActionFormData()
    .title("§l§eCooking Pot")
    .body(
      `§7Cooking level: §e${level}\n` +
      "§7Pick a recipe, then §fpunch the pot§7 to take it off the heat. §aGreen§7 = perfect (2 servings), " +
      "§eyellow§7 = done (1 serving). Wait too long and it burns."
    );
  for (const r of COOK_RECIPES) {
    const food = FOODS[r.result];
    const buff = Object.entries(food.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ");
    const ok = level >= r.level && hasAll(player, r.ingredients);
    form.button(`${ok ? "§f" : "§8"}${r.name} §7(${buff}, Cooking ${r.level})`);
  }
  form.button("Close");
  const res = await show(player, form);
  if (res.canceled || res.selection >= COOK_RECIPES.length) return;
  const r = COOK_RECIPES[res.selection];
  if (level < r.level) return player.sendMessage(`§7[Ponce] ${r.name} needs Cooking level §e${r.level}§7 (you're ${level}).`);
  if (!hasAll(player, r.ingredients)) {
    const list = r.ingredients.map((i) => `${countItem(player, i.item) >= i.count ? "§a" : "§c"}${i.count}x ${itemName(i.item)}`).join("§7, ");
    return player.sendMessage(`§7[Ponce] ${r.name} needs: ${list}`);
  }
  if (pots.has(player.id)) return;
  takeAll(player, r.ingredients);
  const center = WINDOW[0] + perfectWidth(level) / 2 + Math.random() * (WINDOW[1] - WINDOW[0] - perfectWidth(level));
  pots.set(player.id, {
    recipe: r, loc, dim: block.dimension.id, progress: 0,
    perfect: [center - perfectWidth(level) / 2, center + perfectWidth(level) / 2],
  });
  block.dimension.playSound("bucket.fill_water", { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
}

// ---------- Minigame ----------

export function renderPot(s) {
  const at = Math.floor((s.progress / 100) * (BAR - 1));
  let bar = "";
  for (let i = 0; i < BAR; i++) {
    const pct = (i / (BAR - 1)) * 100;
    if (i === at) bar += "§f§l|§r";
    else if (pct >= s.perfect[0] && pct <= s.perfect[1]) bar += "§a|";
    else if (pct >= WINDOW[0] && pct <= WINDOW[1]) bar += "§e|";
    else if (pct > WINDOW[1]) bar += "§c|";
    else bar += "§8|";
  }
  return `§e${s.recipe.name}  ${bar}  §7punch the pot to serve`;
}

function serve(player, s, result) {
  pots.delete(player.id);
  const r = s.recipe;
  if (result === "burnt") {
    give(player, new ItemStack("ponce:burnt_mess", 1));
    addJobXp(player, "cooking", r.xp * 0.25);
    player.onScreenDisplay.setTitle(" ", { subtitle: "§8Burnt...", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10 });
    player.playSound("random.fizz");
    return;
  }
  const perfect = result === "perfect";
  give(player, new ItemStack(r.result, perfect ? 2 : 1));
  addJobXp(player, "cooking", r.xp * (perfect ? 1.5 : 1));
  player.onScreenDisplay.setTitle(" ", {
    subtitle: perfect ? `§a§lPERFECT! §r§f2x ${r.name}` : `§eDone. §f1x ${r.name}`, fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10,
  });
  player.playSound(perfect ? "random.levelup" : "random.pop", { pitch: 1.5 });
}

export function takeOff(player, s) {
  if (s.progress < WINDOW[0]) {
    player.onScreenDisplay.setTitle(" ", { subtitle: "§7Not ready yet", fadeInDuration: 0, stayDuration: 10, fadeOutDuration: 5 });
    return;
  }
  serve(player, s, s.progress >= s.perfect[0] && s.progress <= s.perfect[1] ? "perfect" : "done");
}

function tickPots() {
  for (const [pid, s] of pots) {
    const player = world.getEntity(pid);
    if (!player?.isValid) { pots.delete(pid); continue; }
    const dx = player.location.x - (s.loc.x + 0.5), dz = player.location.z - (s.loc.z + 0.5);
    if (Math.hypot(dx, dz) > MAX_DISTANCE || player.dimension.id !== s.dim) {
      pots.delete(pid);
      player.sendMessage("§c[Ponce] You walked away from the pot and the meal was ruined.");
      continue;
    }
    s.progress += 100 / COOK_TICKS;
    if (s.progress > WINDOW[1]) { serve(player, s, "burnt"); continue; }
    player.onScreenDisplay.setActionBar(renderPot(s));
    hudHoldUntil.set(pid, system.currentTick + 5);
  }
}

// ---------- Eating ----------

export function buffActive(data) {
  return !!data.foodBuff && data.foodBuff.until > world.getAbsoluteTime();
}

export function buffHudText(player) {
  const d = getData(player);
  if (!buffActive(d)) return "";
  const secs = Math.ceil((d.foodBuff.until - world.getAbsoluteTime()) / 20);
  const stats = Object.entries(d.foodBuff.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ");
  return `  §e[${stats} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}]`;
}

function onEat(player, itemStack) {
  const food = FOODS[itemStack.typeId];
  if (!food) return;
  const d = getData(player);
  d.foodBuff = { name: food.name, stats: { ...food.stats }, until: world.getAbsoluteTime() + food.seconds * 20 };
  markDirty(player);
  applyStatEffects(player);
  const stats = Object.entries(food.stats).map(([k, v]) => `${STATS[k].color}+${v} ${STATS[k].name}`).join("§f, ");
  player.sendMessage(`§e[Ponce] ${food.name}: ${stats}§f for ${Math.round(food.seconds / 60)} minutes.`);
}

function expireBuffs() {
  for (const player of world.getAllPlayers()) {
    const d = getData(player);
    if (!d.foodBuff || buffActive(d)) continue;
    player.sendMessage(`§7[Ponce] The ${d.foodBuff.name} wore off.`);
    d.foodBuff = null;
    markDirty(player);
    applyStatEffects(player);
  }
}

export function registerCooking() {
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.block.typeId !== POT || ev.isFirstEvent === false) return;
    ev.cancel = true;
    const { player } = ev;
    const loc = { ...ev.block.location };
    const dim = ev.block.dimension;
    system.run(() => {
      const block = dim.getBlock(loc);
      if (block?.typeId === POT && player.isValid) openPotMenu(player, block);
    });
  });

  world.afterEvents.entityHitBlock.subscribe(({ damagingEntity, hitBlock }) => {
    if (damagingEntity?.typeId !== "minecraft:player" || hitBlock.typeId !== POT) return;
    const s = pots.get(damagingEntity.id);
    if (s && sameSpot(s.loc, hitBlock.location)) takeOff(damagingEntity, s);
  });

  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (ev.block.typeId !== POT) return;
    for (const s of pots.values()) if (sameSpot(s.loc, ev.block.location)) ev.cancel = true;
  });

  world.afterEvents.itemCompleteUse.subscribe(({ source, itemStack }) => {
    if (source?.typeId === "minecraft:player" && itemStack) onEat(source, itemStack);
  });

  system.runInterval(tickPots, 1);
  system.runInterval(expireBuffs, 20);
}
