// Cooking. Use the Cooking Pot (right-click / long-press) to pick a recipe,
// then STIR it: look down into the pot and circle your view around it.
// The pot calls for a GENTLE or a BRISK stir, and changes its mind as it cooks.
//   Stirring at the called pace   cooks the dish fastest and counts toward a perfect meal
//   Too slow / too fast           still cooks, but slowly (too slow also lets it catch)
//   Not stirring                  the bottom scorches; fully scorched = a Burnt Mess
// When the dish is cooked: mostly at the right pace = perfect (2 servings), otherwise 1.
// Punching the pot counts as a small stir, for when circling the camera isn't practical.
// Meals give a temporary stat buff (one at a time). Cooking level unlocks
// recipes and widens the pace bands.

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
import { notify } from "./quests.js";

const POT = "ponce:cooking_pot";
export const COOK_TICKS = 120; // 6 seconds of stirring at the right pace cooks a dish
export const SCORCH_TICKS = 80; // 4 seconds without stirring burns it
export const MAX_TICKS = 20 * 40; // a safety limit: a dish never takes longer than 40 s
export const LOOK_IN_PITCH = 15; // look at least this far down to be stirring the pot
export const TAP_DEGREES = 60; // a punch counts as this much stirring
export const PACE_CHANGE_TICKS = 60;
const METER = 20, METER_MAX = 400; // the pace meter shows 0-400 degrees per second
const MAX_DISTANCE = 6;

export const pots = new Map(); // player id -> cooking session

/** The two paces the pot can call for, in degrees of stirring per second. Cooking level widens them. */
export function paceBands(level) {
  const w = Math.min(40, level * 2);
  return { gentle: [60 - w / 2, 150 + w / 2], brisk: [190 - w / 2, 330 + w / 2] };
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
      "§7Pick a recipe, then §fstir§7: look down into the pot and §fcircle your view§7 around it. " +
      "Keep to the pace it calls for (§agently§7 or §abriskly§7). Stop stirring and it scorches. " +
      "Stir well most of the time for a §aperfect§7 meal (2 servings).\n§8Punching the pot counts as a small stir."
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
  pots.set(player.id, {
    recipe: r, loc, dim: block.dimension.id, progress: 0, scorch: 0, ticks: 0, inPace: 0,
    bands: paceBands(level), pace: "gentle", nextChange: system.currentTick + PACE_CHANGE_TICKS,
    history: [], yaw: player.getRotation?.().y ?? 0, taps: 0,
  });
  player.onScreenDisplay.setTitle("§eStir the pot", {
    subtitle: "§fLook into the pot and circle your view around it", fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10,
  });
  block.dimension.playSound("bucket.fill_water", { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
}

// ---------- Minigame ----------

export function stirRate(s) {
  return s.history.reduce((n, d) => n + d, 0) * (20 / Math.max(1, s.history.length)); // degrees per second
}

export function renderPot(s) {
  const [lo, hi] = s.bands[s.pace];
  const rate = stirRate(s);
  const at = Math.min(METER - 1, Math.floor((rate / METER_MAX) * METER));
  let meter = "";
  for (let i = 0; i < METER; i++) {
    const deg = ((i + 0.5) / METER) * METER_MAX;
    if (i === at) meter += "§f§l|§r";
    else if (deg >= lo && deg <= hi) meter += "§a|";
    else meter += "§8|";
  }
  const scorch = s.scorch > 66 ? "§4" : s.scorch > 33 ? "§c" : "§7";
  return `§e${s.recipe.name} §f${Math.min(100, Math.floor(s.progress))}%  §7Stir ${s.pace === "gentle" ? "§bgently" : "§6briskly"}  ${meter}  ${scorch}scorch ${Math.floor(s.scorch)}%`;
}

function serve(player, s, result) {
  pots.delete(player.id);
  const r = s.recipe;
  if (result === "burnt") {
    give(player, new ItemStack("ponce:burnt_mess", 1));
    addJobXp(player, "cooking", r.xp * 0.25);
    player.onScreenDisplay.setTitle(" ", { subtitle: "§8Burnt... keep stirring next time", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10 });
    player.playSound("random.fizz");
    return;
  }
  const perfect = result === "perfect";
  give(player, new ItemStack(r.result, perfect ? 2 : 1));
  addJobXp(player, "cooking", r.xp * (perfect ? 1.5 : 1));
  notify(player, "cook", r.result);
  if (perfect) notify(player, "cook_perfect", r.result);
  player.onScreenDisplay.setTitle(" ", {
    subtitle: perfect ? `§a§lPERFECT! §r§f2x ${r.name}` : `§eDone. §f1x ${r.name}`, fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10,
  });
  player.playSound(perfect ? "random.levelup" : "random.pop", { pitch: 1.5 });
}

/** A punch on the pot: a small stir, for when circling the camera isn't practical. */
export function stirTap(player, s) {
  s.taps += TAP_DEGREES;
  player.dimension.playSound("bucket.empty_water", { x: s.loc.x + 0.5, y: s.loc.y + 1, z: s.loc.z + 0.5 }, { volume: 0.4, pitch: 1.6 });
}

function tickPot(player, s) {
  const rot = player.getRotation?.() ?? { x: 0, y: s.yaw };
  let delta = Math.abs(((rot.y - s.yaw + 540) % 360) - 180);
  s.yaw = rot.y;
  if (rot.x < LOOK_IN_PITCH) delta = 0; // circling the camera only stirs while you're looking into the pot
  delta = Math.min(delta, 45) + s.taps; // a wild flick isn't a stir
  s.taps = 0;
  s.history.push(delta);
  if (s.history.length > 20) s.history.shift();
  s.ticks++;

  const now = system.currentTick;
  if (now >= s.nextChange) {
    s.pace = s.pace === "gentle" ? "brisk" : "gentle";
    s.nextChange = now + PACE_CHANGE_TICKS + Math.floor(Math.random() * 40);
    player.playSound("note.pling", { pitch: s.pace === "brisk" ? 1.4 : 0.9 });
  }

  const rate = stirRate(s);
  const [lo, hi] = s.bands[s.pace];
  const step = 100 / COOK_TICKS;
  const top = { x: s.loc.x + 0.5, y: s.loc.y + 1.1, z: s.loc.z + 0.5 };
  if (rate < 20) s.scorch += 100 / SCORCH_TICKS; // not stirring: the bottom catches
  else if (rate < lo) { s.progress += step * 0.4; s.scorch += 100 / SCORCH_TICKS / 3; }
  else if (rate > hi) s.progress += step * 0.5; // sloshing: cooks, but unevenly
  else { s.progress += step; s.inPace++; s.scorch = Math.max(0, s.scorch - 0.5); }
  if (s.ticks % 8 === 0) {
    try { player.dimension.spawnParticle(s.scorch > 50 ? "minecraft:basic_smoke_particle" : "minecraft:bubble_column_up_particle", top); } catch { /* ignore */ }
  }

  if (s.scorch >= 100) return serve(player, s, "burnt");
  if (s.progress >= 100 || s.ticks >= MAX_TICKS) {
    const share = s.inPace / s.ticks;
    return serve(player, s, s.progress < 100 ? (s.scorch > 50 ? "burnt" : "done") : share >= 0.55 && s.scorch < 50 ? "perfect" : "done");
  }
  player.onScreenDisplay.setActionBar(renderPot(s));
  hudHoldUntil.set(player.id, now + 5);
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
    tickPot(player, s);
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
    if (s && sameSpot(s.loc, hitBlock.location)) stirTap(damagingEntity, s);
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
