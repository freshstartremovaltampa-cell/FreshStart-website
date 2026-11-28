// Cooking. Use the Cooking Pot (right-click / long-press) to pick a recipe. Each dish is cooked its own way:
//   GRILL  (skewers)  Each side browns over the fire: turn the skewer when the side is golden. Three sides.
//   STEW   (stews, soups, broths)  Look into the pot and circle your view to stir, at the gentle or brisk pace
//          the pot calls for. It calls for each extra ingredient as it cooks: add it (punch the pot) in time.
//          Stop stirring and the bottom scorches.
//   BAKE   (tarts)  First whisk the batter (stir briskly), then watch it bake and take it out when golden.
//   ROAST  (roasts)  The meat dries as it roasts: baste it when it's drying (not when it's still wet),
//          then take it off the fire as soon as it's done.
// "Turn", "add", "take out" and "baste" are all the same action: punch the pot, or flick your view sideways
// while looking into it. Do it well throughout for a perfect meal (2 servings); otherwise you get 1, and
// letting it burn gives a Burnt Mess. Cooking level widens the windows.

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
import { removeDisplay, setDisplay, spawnDisplay, sweepDisplays } from "./displays.js";

const POT = "ponce:cooking_pot";
export const COOK_TICKS = 120; // 6 seconds of stirring at the right pace cooks a dish
export const SCORCH_TICKS = 80; // 4 seconds without stirring burns it
export const MAX_TICKS = 20 * 40; // a safety limit: a dish never takes longer than 40 s
export const LOOK_IN_PITCH = 15; // look at least this far down to be stirring the pot
export const TAP_DEGREES = 60; // a punch counts as this much stirring
export const PACE_CHANGE_TICKS = 60;
export const FLICK_DEGREES = 30; // a sideways flick of the view this big in one tick counts as an action
const ACTION_COOLDOWN = 6;

/** How each dish is cooked. */
export const METHODS = {
  "ponce:boar_skewer": "grill",
  "ponce:hare_stew": "stew", "ponce:marsh_gumbo": "stew", "ponce:highland_stew": "stew", "ponce:warming_broth": "stew",
  "ponce:jelly_tart": "bake",
  "ponce:hearty_roast": "roast",
};
const HOW = {
  grill: "turn the skewer when each side is §6golden§7 (punch the pot or flick your view)",
  stew: "§fstir§7: look into the pot and circle your view; add each ingredient when it's called for (punch the pot)",
  bake: "§fwhisk§7 the batter (stir briskly), then take it out when §6golden§7",
  roast: "§fbaste§7 when the meat starts drying, then take it off as soon as it's done",
};
/** Golden/done windows widen with Cooking level. */
export function windowFor(level, [lo, hi]) {
  const w = Math.min(8, level * 0.4);
  return [lo - w, hi + w];
}
const METER = 20, METER_MAX = 400; // the pace meter shows 0-400 degrees per second
const MAX_DISTANCE = 6;

export const pots = new Map(); // player id -> cooking session
const DISPLAY = "ponce:cook_display";
const DISH = { grill: 0, stew: 1, bake: 2, roast: 3 };
const SOUP = { "ponce:hare_stew": 0, "ponce:marsh_gumbo": 1, "ponce:highland_stew": 2, "ponce:warming_broth": 3 };

/** Ends a cooking job and clears the food off the pot. */
function endPot(pid) {
  removeDisplay(pots.get(pid)?.display);
  pots.delete(pid);
}

/** What the model on the pot shows: the dish, how far it's cooked, the skewer side, the stew's swirl. */
function showPot(s) {
  const brown = (b) => Math.max(0, Math.min(10, Math.floor(b / 13)));
  const props = { dish: DISH[s.method], soup: SOUP[s.recipe.result] ?? 0 };
  if (s.method === "grill") Object.assign(props, { side: Math.min(2, s.side), cook: brown(s.brown) });
  if (s.method === "stew") Object.assign(props, { stir: Math.floor(s.angle ?? 0) % 360, added: Math.min(3, 1 + s.cues.filter((c) => c.added).length), cook: 0 });
  if (s.method === "bake") Object.assign(props, { fill: s.phase === "mix" ? Math.min(10, Math.floor(s.mix / 10)) : 10, cook: s.phase === "mix" ? 0 : brown(s.brown) });
  if (s.method === "roast") Object.assign(props, { cook: Math.min(10, Math.floor(s.progress / 11) + (s.dry > 120 ? 2 : 0)) });
  setDisplay(s.display, s.shown, props);
}

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
      "§7Every dish is cooked its own way:\n" +
      "§6Grill§7 (skewers): turn each side when it's golden.\n" +
      "§6Stew§7 (stews and soups): stir at the pace the pot calls for, and add each ingredient in time.\n" +
      "§6Bake§7 (tarts): whisk the batter, then take it out when golden.\n" +
      "§6Roast§7: baste when it dries, take it off when done.\n" +
      "§8Stir by looking into the pot and circling your view. Every other action: punch the pot, or flick your view sideways."
    );
  for (const r of COOK_RECIPES) {
    const food = FOODS[r.result];
    const buff = Object.entries(food.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ");
    const ok = level >= r.level && hasAll(player, r.ingredients);
    form.button(`${ok ? "§f" : "§8"}${r.name} §7(${buff}, Cooking ${r.level})\n§8${{ grill: "Grill", stew: "Stew", bake: "Bake", roast: "Roast" }[METHODS[r.result] ?? "stew"]}`);
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
  const method = METHODS[r.result] ?? "stew";
  const s = {
    recipe: r, method, level, loc, dim: block.dimension.id, progress: 0, scorch: 0, ticks: 0, inPace: 0,
    bands: paceBands(level), pace: "gentle", nextChange: system.currentTick + PACE_CHANGE_TICKS,
    history: [], yaw: player.getRotation?.().y ?? 0, taps: 0, lastAction: -99, faults: 0,
  };
  if (method === "grill") Object.assign(s, { side: 0, brown: 0, speed: grillSpeed(), golden: windowFor(level, [68, 88]), sides: [] });
  if (method === "stew") {
    const extras = r.ingredients.filter((i) => i.item !== "minecraft:bowl").slice(1).map((i) => i.item);
    s.cues = extras.map((item, k) => ({ item, at: Math.round(((k + 1) / (extras.length + 1)) * 80) + 5 }));
    s.cue = undefined;
  }
  if (method === "bake") Object.assign(s, { phase: "mix", mix: 0, brown: 0, golden: windowFor(level, [66, 86]) });
  if (method === "roast") Object.assign(s, { moisture: 100, dry: 0, soggy: 0, done: undefined });
  pots.set(player.id, s);
  s.display = spawnDisplay(block.dimension, DISPLAY, { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 }, player.getRotation?.().y ?? 0);
  s.shown = {};
  s.angle = 0;
  showPot(s);
  const title = { grill: "Grill the skewer", stew: "Stir the pot", bake: "Whisk the batter", roast: "Roast the meat" }[method];
  player.onScreenDisplay.setTitle(`§e${title}`, { subtitle: `§7${HOW[method]}`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 10 });
  player.sendMessage(`§e[Cooking] ${r.name}: §7${HOW[method]}.`);
  block.dimension.playSound("bucket.fill_water", { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
}

// ---------- Minigame ----------

const grillSpeed = () => 1.5 + Math.random() * 0.9; // browning per tick: each side cooks a little differently

export function stirRate(s) {
  return s.history.reduce((n, d) => n + d, 0) * (20 / Math.max(1, s.history.length)); // degrees per second
}

function meter(value, max, band, cells = 20) {
  const at = Math.min(cells - 1, Math.floor((value / max) * cells));
  let out = "";
  for (let i = 0; i < cells; i++) {
    const v = ((i + 0.5) / cells) * max;
    if (i === at) out += "§f§l|§r";
    else if (band && v >= band[0] && v <= band[1]) out += "§a|";
    else if (v > (band?.[1] ?? max)) out += "§c|";
    else out += "§8|";
  }
  return out;
}

export function renderPot(s) {
  const name = `§e${s.recipe.name}`;
  if (s.method === "grill") {
    return `${name}  §7side ${s.side + 1}/3  ${meter(s.brown, 130, s.golden)}  §7turn when §6golden`;
  }
  if (s.method === "bake") {
    if (s.phase === "mix") return `${name}  §7whisk briskly  §fmixed ${Math.floor(s.mix)}%  ${meter(stirRate(s), METER_MAX, s.bands.brisk)}`;
    return `${name}  §7baking  ${meter(s.brown, 130, s.golden)}  §7take it out when §6golden`;
  }
  if (s.method === "roast") {
    const m = s.moisture < 25 ? "§c§ldrying - baste!" : s.moisture > 75 ? "§9juicy" : "§fbasted";
    const done = s.done !== undefined ? "  §a§lDONE - take it off!" : `  §fdone ${Math.floor(s.progress)}%`;
    return `${name}  ${m}  ${meter(s.moisture, 100, [25, 75])}${done}`;
  }
  // stew
  const [lo, hi] = s.bands[s.pace];
  const scorch = s.scorch > 66 ? "§4" : s.scorch > 33 ? "§c" : "§7";
  const cue = s.cue ? `  §6§lADD THE ${itemName(s.cue.item).toUpperCase()}!` : "";
  return `${name} §f${Math.min(100, Math.floor(s.progress))}%  §7Stir ${s.pace === "gentle" ? "§bgently" : "§6briskly"}  ${meter(stirRate(s), METER_MAX, [lo, hi])}  ${scorch}scorch ${Math.floor(s.scorch)}%${cue}`;
}

function serve(player, s, result) {
  endPot(player.id);
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
  notify(player, "cook", r.result);
  if (perfect) notify(player, "cook_perfect", r.result);
  player.onScreenDisplay.setTitle(" ", {
    subtitle: perfect ? `§a§lPERFECT! §r§f2x ${r.name}` : `§eDone. §f1x ${r.name}`, fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10,
  });
  player.playSound(perfect ? "random.levelup" : "random.pop", { pitch: 1.5 });
}

function say(player, text, ticks = 14) {
  player.onScreenDisplay.setTitle(" ", { subtitle: text, fadeInDuration: 0, stayDuration: ticks, fadeOutDuration: 4 });
}

/** The one action every method uses: turn, add, take out or baste. From a punch or a sideways flick. */
export function cookAction(player, s) {
  const now = system.currentTick;
  if (now - s.lastAction < ACTION_COOLDOWN) return;
  s.lastAction = now;
  const at = { x: s.loc.x + 0.5, y: s.loc.y + 1, z: s.loc.z + 0.5 };
  if (s.method === "grill") {
    const b = s.brown;
    const grade = b >= s.golden[0] && b <= s.golden[1] ? "golden" : b < 45 ? "raw" : b > 110 ? "charred" : "fair";
    s.sides.push(grade);
    player.dimension.playSound("random.fizz", at, { volume: 0.4, pitch: 1.6 });
    say(player, { golden: "§6§lGolden!", fair: "§eNot bad", raw: "§7Still raw on that side", charred: "§8Charred..." }[grade]);
    s.side++; s.brown = 0; s.speed = grillSpeed();
    if (s.side >= 3) {
      const golden = s.sides.filter((g) => g === "golden").length, charred = s.sides.filter((g) => g === "charred").length;
      serve(player, s, charred >= 2 ? "burnt" : golden === 3 ? "perfect" : "done");
    }
    return;
  }
  if (s.method === "bake") {
    if (s.phase === "mix") { s.taps += TAP_DEGREES; return; } // a punch while mixing is a stroke of the whisk
    const b = s.brown;
    if (b < 40) return say(player, "§7Not set yet - leave it in");
    serve(player, s, b >= s.golden[0] && b <= s.golden[1] ? "perfect" : b > 110 ? "burnt" : "done");
    return;
  }
  if (s.method === "roast") {
    if (s.done !== undefined) {
      const late = system.currentTick - s.done;
      return serve(player, s, s.dry <= 40 && s.soggy <= 1 && late <= windowFor(s.level, [0, 40])[1] ? "perfect" : "done");
    }
    if (s.moisture > 75) { s.soggy++; say(player, "§9Still juicy - basting now just washes it off"); }
    else say(player, "§eBasted");
    s.moisture = Math.min(100, s.moisture + 45);
    try { player.dimension.spawnParticle("minecraft:water_splash_particle", at); } catch { /* ignore */ }
    player.dimension.playSound("bucket.empty_water", at, { volume: 0.4, pitch: 1.4 });
    return;
  }
  // stew: a punch adds the called ingredient (if one is called) and also counts as a small stir
  s.taps += TAP_DEGREES;
  if (s.cue) {
    say(player, `§aAdded the ${itemName(s.cue.item)}`);
    const added = s.cues.find((c) => c.item === s.cue.item && !c.added);
    if (added) added.added = true;
    player.dimension.playSound("bucket.empty_water", at, { volume: 0.5, pitch: 1.2 });
    s.cue = undefined;
  }
}

/** Kept for compatibility: a punch on the pot. */
export function stirTap(player, s) {
  cookAction(player, s);
}

function tickPot(player, s) {
  const rot = player.getRotation?.() ?? { x: 0, y: s.yaw };
  const raw = Math.abs(((rot.y - s.yaw + 540) % 360) - 180);
  s.yaw = rot.y;
  const lookingIn = rot.x >= LOOK_IN_PITCH;
  let delta = lookingIn ? Math.min(raw, 45) : 0; // circling the camera only stirs while you're looking into the pot
  delta += s.taps;
  s.taps = 0;
  s.angle = ((s.angle ?? 0) + delta) % 360; // the stew's surface swirls with your stirring
  s.history.push(delta);
  if (s.history.length > 20) s.history.shift();
  s.ticks++;
  const now = system.currentTick;
  const top = { x: s.loc.x + 0.5, y: s.loc.y + 1.1, z: s.loc.z + 0.5 };
  const puff = (id) => { if (s.ticks % 8 === 0) try { player.dimension.spawnParticle(id, top); } catch { /* ignore */ } };
  // A sideways flick while looking into the pot is the same action as a punch (except while stirring a stew)
  if (lookingIn && raw >= FLICK_DEGREES && !(s.method === "stew" || (s.method === "bake" && s.phase === "mix"))) cookAction(player, s);
  if (!pots.has(player.id)) return;

  if (s.method === "grill") {
    s.brown += s.speed;
    puff("minecraft:basic_smoke_particle");
    if (s.brown >= 130) { s.sides.push("charred"); say(player, "§8That side charred - turn it!"); s.side++; s.brown = 0; s.speed = grillSpeed(); }
    if (s.side >= 3) return serve(player, s, "burnt");
  } else if (s.method === "bake") {
    if (s.phase === "mix") {
      const rate = stirRate(s);
      if (rate >= s.bands.brisk[0]) s.mix += 100 / 50;
      if (s.mix >= 100) { s.phase = "bake"; say(player, "§aMixed! §fInto the heat - take it out when golden", 30); }
      if (s.ticks > MAX_TICKS) return serve(player, s, "done");
    } else {
      s.brown += 100 / 110;
      puff(s.brown > s.golden[1] ? "minecraft:basic_smoke_particle" : "minecraft:basic_flame_particle");
      if (s.brown >= 130) return serve(player, s, "burnt");
    }
  } else if (s.method === "roast") {
    s.moisture = Math.max(0, s.moisture - 1.1);
    if (s.moisture < 25) s.dry++;
    if (s.done === undefined) {
      s.progress += 100 / 200;
      if (s.progress >= 100) { s.done = now; say(player, "§a§lDone! §fTake it off the fire", 30); player.playSound("note.pling", { pitch: 1.6 }); }
    } else if (now - s.done > 100) return serve(player, s, s.dry > 120 ? "burnt" : "done"); // left on the fire: overdone
    if (s.dry > 160) return serve(player, s, "burnt");
    puff(s.moisture < 25 ? "minecraft:basic_smoke_particle" : "minecraft:basic_flame_particle");
  } else {
    // stew
    if (now >= s.nextChange) {
      s.pace = s.pace === "gentle" ? "brisk" : "gentle";
      s.nextChange = now + PACE_CHANGE_TICKS + Math.floor(Math.random() * 40);
      player.playSound("note.pling", { pitch: s.pace === "brisk" ? 1.4 : 0.9 });
    }
    const next = s.cues.find((c) => !c.called && s.progress >= c.at);
    if (next && !s.cue) { next.called = true; s.cue = { ...next, until: now + 50 }; player.playSound("note.bell", { pitch: 1.2 }); }
    if (s.cue && now > s.cue.until) { s.faults++; say(player, `§7The ${itemName(s.cue.item)} went in late`); s.cue = undefined; }
    const rate = stirRate(s);
    const [lo, hi] = s.bands[s.pace];
    const step = 100 / COOK_TICKS;
    if (rate < 20) s.scorch += 100 / SCORCH_TICKS;
    else if (rate < lo) { s.progress += step * 0.4; s.scorch += 100 / SCORCH_TICKS / 3; }
    else if (rate > hi) s.progress += step * 0.5;
    else { s.progress += step; s.inPace++; s.scorch = Math.max(0, s.scorch - 0.5); }
    puff(s.scorch > 50 ? "minecraft:basic_smoke_particle" : "minecraft:bubble_column_up_particle");
    if (s.scorch >= 100) return serve(player, s, "burnt");
    if (s.progress >= 100 || s.ticks >= MAX_TICKS) {
      const share = s.inPace / s.ticks;
      return serve(player, s, s.progress < 100 ? (s.scorch > 50 ? "burnt" : "done")
        : share >= 0.55 && s.scorch < 50 && s.faults === 0 && !s.cue && s.cues.every((c) => c.called) ? "perfect" : "done");
    }
  }
  showPot(s);
  player.onScreenDisplay.setActionBar(renderPot(s));
  hudHoldUntil.set(player.id, now + 5);
}

function tickPots() {
  for (const [pid, s] of pots) {
    const player = world.getEntity(pid);
    if (!player?.isValid) { endPot(pid); continue; }
    const dx = player.location.x - (s.loc.x + 0.5), dz = player.location.z - (s.loc.z + 0.5);
    if (Math.hypot(dx, dz) > MAX_DISTANCE || player.dimension.id !== s.dim) {
      endPot(pid);
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
  system.runInterval(() => sweepDisplays(DISPLAY, new Set([...pots.values()].map((s) => s.display?.id))), 100);
  system.runInterval(expireBuffs, 20);
}
