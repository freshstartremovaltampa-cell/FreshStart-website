// Forging, done the way a smith does it. Use the Smithing Forge (right-click / long-press) to pick a
// weapon; the materials go in as a bar of hot metal. Then:
//   HEAT    Crouch at the forge to pump the bellows. The metal glows cherry, orange, yellow...
//           and white-hot burns it. Hammering only shapes metal that's orange or hotter;
//           striking it once it's gone cold cracks it.
//   SHAPE   The blade is a row of 9 sections (tip to tang) beside the outline for this weapon type.
//           Look left or right along the forge to pick a section, then swing your Smith's Hammer:
//           look up to raise it and bring your view down onto the forge. A quick, full swing knocks
//           2 off that section, a slower swing or a punch knocks 1. Metal you hammer away is gone,
//           so ease off as you near the outline.
//   QUENCH  When no section is thicker than the outline, plunge it: strike or punch the forge while
//           it's orange for the hardest blade.
// Quality comes from how close the shape is to the outline, plus cracks, burning and the quench.
// Smithing level slows the cooling and sets how likely you are to get the quality you earned.

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { WEAPONS } from "./config.js";
import { INFUSIONS, WEAPON_DEFS } from "./weapon_data.js";
import { getData } from "./data.js";
import { addJobXp, jobLevel } from "./jobs.js";
import { countItem, give, hasAll, itemName, takeAll } from "./inventory.js";
import { QUALITIES, describeInfusion, weaponLore } from "./weapons.js";
import { hudHoldUntil } from "./combat.js";
import { show } from "./ui.js";
import { notify } from "./quests.js";
import { getHeldItem } from "./progression.js";
import { removeDisplay, setDisplay, spawnDisplay, sweepDisplays } from "./displays.js";

const FORGE = "ponce:smithing_forge";
const MAX_DISTANCE = 6;
export const HAMMER = "ponce:smith_hammer";
export const RAISE_PITCH = -15; // looking at least this far up raises the hammer
export const LAND_PITCH = 20; // looking at least this far down brings it down on the forge
export const SWING_WINDOW = 8; // ticks from raised to landed, or the swing peters out
export const FAST_SWING = 4; // a swing this quick (or quicker) is a full-strength blow
export const SECTIONS = 9;
export const SECTION_DEGREES = 8; // looking this many degrees further left/right moves one section
export const START_THICKNESS = 5;
export const HEAT = { start: 40, max: 100, workable: 55, crack: 30, burn: 95, strikeCost: 4, bellows: 2.2, bellowsRange: 3.5 };
export const QUENCH = { perfect: [55, 80], ok: [40, 92] };
export const TIME_LIMIT = 20 * 120; // two minutes, then the blade is finished as it stands

// The outline each weapon type is shaped to: thickness per section, tip to tang (0-5).
export const TARGETS = {
  sword: [1, 2, 3, 3, 3, 3, 3, 3, 4],
  dagger: [0, 0, 0, 1, 2, 3, 3, 3, 4],
  rapier: [1, 1, 2, 2, 2, 2, 2, 2, 4],
  katana: [1, 2, 2, 2, 3, 3, 3, 3, 4],
  greatsword: [2, 3, 4, 4, 4, 4, 4, 4, 5],
  axe: [5, 5, 4, 1, 1, 1, 1, 1, 2],
  hammer: [5, 5, 5, 1, 1, 1, 1, 1, 2],
  spear: [1, 3, 3, 1, 1, 1, 1, 1, 2],
};

/** How fast the metal cools per tick. Higher Smithing levels keep it workable longer. */
export function coolRate(level) {
  return Math.max(0.18, 0.32 - level * 0.006);
}

export const sessions = new Map(); // player id -> forging session
const DISPLAY = "ponce:forge_work";

/** Ends a forging job and clears the blade off the forge. */
function endForge(pid) {
  removeDisplay(sessions.get(pid)?.display);
  sessions.delete(pid);
}

/** 0 dull, 1 cherry, 2 orange, 3 yellow, 4 white: how the blade on the forge glows. */
export function heatLevel(h) {
  return h > HEAT.burn ? 4 : h >= 80 ? 3 : h >= HEAT.workable ? 2 : h >= HEAT.crack ? 1 : 0;
}

function showForge(s) {
  const props = { heat: heatLevel(s.heat) };
  s.profile.forEach((v, i) => { props[`s${i}`] = Math.max(0, v); });
  setDisplay(s.display, s.shown, props);
}

function sameSpot(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function inUse(loc, exceptId) {
  for (const [id, s] of sessions) if (id !== exceptId && sameSpot(s.loc, loc)) return true;
  return false;
}

// ---------- Menu ----------

// Starter weapons have no forge recipe and never show up here
export const ORDER = Object.entries(WEAPON_DEFS).filter(([, d]) => d.forge)
  .sort(([, a], [, b]) => a.tier - b.tier || a.type.localeCompare(b.type));

/** Recipe materials plus the chosen infusions, merged by item. */
export function totalMaterials(mats, infusions) {
  const total = new Map(mats.map((m) => [m.item, m.count]));
  for (const id of infusions) total.set(id, (total.get(id) ?? 0) + INFUSIONS[id].cost);
  return [...total].map(([item, count]) => ({ item, count }));
}

/** Infusions the player can afford on top of the recipe's own materials. */
function affordableInfusions(player, mats) {
  return Object.keys(INFUSIONS).filter((id) => !INFUSIONS[id].relicOnly && hasAll(player, totalMaterials(mats, [id])));
}

function materialList(player, mats) {
  return mats.map((m) => {
    const have = countItem(player, m.item);
    return `${have >= m.count ? "§a" : "§c"}${m.count}x ${itemName(m.item)} §8(${have})`;
  }).join("§7, ");
}

export async function openForgeMenu(player, block) {
  if (sessions.has(player.id)) return;
  const loc = block.location;
  if (inUse(loc, player.id)) return player.sendMessage("§7[Ponce] Someone is already working at this forge.");
  const level = jobLevel(getData(player), "smithing");

  const form = new ActionFormData()
    .title("§l§6Smithing Forge")
    .body(
      `§7Smithing level: §e${level}\n` +
      "§7Pick a weapon to forge. Then work it like a smith:\n" +
      "§6Heat§7: §fcrouch§7 at the forge to pump the bellows until the metal glows orange or yellow (not white: it burns).\n" +
      "§6Shape§7: §flook left/right§7 to pick a section of the blade, then hold your §6Smith's Hammer§7, §flook up§7 to raise it and " +
      "§fswing your view down§7 onto the forge. Bring every section down to the outline, but not past it.\n" +
      "§6Quench§7: when it matches, strike the forge while it's §6orange§7.\n§8Punching works as a light blow. Stay within a few blocks."
    );
  for (const [, def] of ORDER) {
    const ok = level >= def.forge.smithing && hasAll(player, def.forge.materials);
    form.button(`${ok ? "§f" : "§8"}${def.name} §7(T${def.tier}, Smithing ${def.forge.smithing})`, WEAPONS[def.type].icon);
  }
  form.button("Close");

  const res = await show(player, form);
  if (res.canceled || res.selection >= ORDER.length) return;
  const [id, def] = ORDER[res.selection];
  return confirmForge(player, loc, block.dimension, id, def, level);
}

async function confirmForge(player, loc, dimension, id, def, level) {
  const mats = def.forge.materials;
  const ready = level >= def.forge.smithing && hasAll(player, mats);
  const form = new ActionFormData()
    .title(`§l§6${def.name}`)
    .body(
      `§7${WEAPONS[def.type].name}, Tier ${def.tier === 1 ? "I" : "II"}, ${def.damage} damage\n` +
      `§7Needs Smithing §e${def.forge.smithing}§7 (you're ${level})\n` +
      `§7Materials: ${materialList(player, mats)}\n` +
      `§8Weapon requirements: Lv ${def.req.level}, ${Object.entries(def.req.stats).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(", ")}\n` +
      `§d${def.forge.slots} optional infusion slot${def.forge.slots > 1 ? "s" : ""}§7: add monster drops to change the weapon's stats. ` +
      "§8You'll be asked after you start, if you carry any."
    );
  if (ready) form.button("§aStart forging");
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled) return;
  if (!ready || res.selection !== 0) return openForgeMenu(player, dimension.getBlock(loc));
  const infusions = await pickInfusions(player, def);
  if (infusions === undefined) return openForgeMenu(player, dimension.getBlock(loc));
  const all = totalMaterials(mats, infusions);
  if (!hasAll(player, all) || sessions.has(player.id) || inUse(loc, player.id)) return;
  takeAll(player, all);
  start(player, loc, dimension, id, def, level, infusions);
}

/**
 * One dropdown per infusion slot, each defaulting to None. Returns the chosen
 * infusion ids ([] for none), or undefined if the player backed out.
 */
async function pickInfusions(player, def) {
  const options = affordableInfusions(player, def.forge.materials);
  if (options.length === 0 || !def.forge.slots) return [];
  const labels = ["None", ...options.map((id) => `${INFUSIONS[id].name} (${INFUSIONS[id].cost}x ${itemName(id)}): ${describeInfusion(INFUSIONS[id])}`)];
  const form = new ModalFormData().title("§l§dInfusions (optional)");
  for (let i = 0; i < def.forge.slots; i++) form.dropdown(`§7Slot ${i + 1}`, labels, { defaultValueIndex: 0 });
  form.submitButton("Forge");
  const res = await show(player, form);
  if (res.canceled) return undefined;
  const picked = [];
  for (const v of res.formValues.filter((x) => typeof x === "number")) {
    const id = options[v - 1];
    if (id && !picked.includes(id)) picked.push(id);
  }
  if (!hasAll(player, totalMaterials(def.forge.materials, picked))) {
    player.sendMessage("§c[Ponce] You don't have enough materials for those infusions together.");
    return undefined;
  }
  return picked;
}

// ---------- Minigame ----------

function start(player, loc, dimension, id, def, level, infusions = []) {
  const s = {
    id, def, infusions, loc: { ...loc }, dim: dimension.id, level,
    profile: new Array(SECTIONS).fill(START_THICKNESS), target: TARGETS[def.type] ?? TARGETS.sword,
    heat: HEAT.start, phase: "shape", cracks: 0, burn: 0, quench: undefined, ticks: 0, lastStrike: -10, section: 4,
  };
  sessions.set(player.id, s);
  // The blank on the forge, turned the way the smith faces so the tip is on their left
  s.display = spawnDisplay(dimension, DISPLAY, { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 }, player.getRotation?.().y ?? 0);
  s.shown = {};
  showForge(s);
  if (countItem(player, HAMMER) === 0) {
    give(player, new ItemStack(HAMMER, 1));
    player.sendMessage("§6[Forge] §fBram's spare Smith's Hammer is yours.");
  }
  player.sendMessage("§6[Forge] §fCrouch§7 to pump the bellows. §fLook left/right§7 to pick a section, §fraise§7 the hammer (look up) and §fswing down§7 onto the forge.");
  player.onScreenDisplay.setTitle("§6Heat the metal", {
    subtitle: "§fCrouch to pump the bellows", fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10,
  });
  dimension.playSound("bucket.fill_lava", { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
}

export function heatName(h) {
  if (h > HEAT.burn) return "§f§lWHITE (burning!)";
  if (h >= 80) return "§eyellow";
  if (h >= HEAT.workable) return "§6orange";
  if (h >= HEAT.crack) return "§ccherry §7(too cold to shape)";
  return "§9dull §7(cold: it'll crack)";
}

const GLYPHS = ["_", "▁", "▂", "▃", "▄", "▅"];

/** The two-line forge display: the outline, the blade (the picked section in aqua), and the heat. */
export function renderForge(s) {
  const target = s.target.map((t) => GLYPHS[t]).join("");
  const blade = s.profile.map((t, i) => {
    const c = i === s.section ? "§b§l" : t > s.target[i] ? "§f" : t === s.target[i] ? "§a" : "§c";
    return `${c}${GLYPHS[Math.max(0, t)]}§r`;
  }).join("");
  const hammer = s.raised ? "§a▲ swing down!" : s.holding === false ? "§7hold your hammer" : "§7look up to raise";
  const step = s.phase === "quench" ? "§b§lQUENCH§r§7 - strike while it's §6orange" : `§7section ${s.section + 1}/9: §f${s.profile[s.section]}§7 → §a${s.target[s.section]}`;
  return `§7Outline §8${target}§7   Blade ${blade}   ${heatName(s.heat)}\n${step}   ${hammer}`;
}

/** Which section the player is looking at: their view yaw relative to the direction of the forge. */
export function sectionFor(player, s) {
  const dx = s.loc.x + 0.5 - player.location.x, dz = s.loc.z + 0.5 - player.location.z;
  const toForge = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const yaw = player.getRotation?.().y ?? toForge;
  const off = ((yaw - toForge + 540) % 360) - 180; // + = looking to the right of the forge
  return Math.max(0, Math.min(SECTIONS - 1, Math.round(off / SECTION_DEGREES + (SECTIONS - 1) / 2)));
}

function spark(s, big) {
  const dim = world.getDimension(s.dim);
  const top = { x: s.loc.x + 0.5, y: s.loc.y + 1.1, z: s.loc.z + 0.5 };
  try {
    dim.spawnParticle("minecraft:lava_particle", top);
    if (big) dim.spawnParticle("minecraft:critical_hit_emitter", top);
  } catch { /* ignore */ }
  return { dim, top };
}

/**
 * One hammer blow. kind: "swing" (swingTicks = how long the swing took) or "tap" (a punch).
 * Shapes the picked section if the metal is hot enough; in the quench phase, it plunges the blade.
 */
export function strike(player, s, { kind = "tap", swingTicks = 0 } = {}) {
  const now = system.currentTick;
  if (now - s.lastStrike < 4) return; // one strike per blow
  s.lastStrike = now;
  if (s.phase === "quench") return quench(player, s);
  const { dim, top } = spark(s, kind === "swing");
  if (s.heat < HEAT.crack) {
    s.cracks++;
    dim.playSound("random.break", top, { volume: 0.8, pitch: 0.6 });
    player.onScreenDisplay.setTitle(" ", { subtitle: "§cThe cold metal cracks! §7Crouch to reheat it.", fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
    return;
  }
  if (s.heat < HEAT.workable) {
    dim.playSound("random.anvil_use", top, { volume: 0.5, pitch: 0.5 });
    player.onScreenDisplay.setTitle(" ", { subtitle: "§7Too cold to move. §fCrouch to pump the bellows.", fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 5 });
    return;
  }
  const blow = kind === "swing" && swingTicks <= FAST_SWING ? 2 : 1;
  const i = s.section;
  s.profile[i] = Math.max(0, s.profile[i] - blow);
  s.heat -= HEAT.strikeCost * blow;
  dim.playSound(kind === "swing" ? "random.anvil_land" : "random.anvil_use", top, { volume: 0.6, pitch: blow === 2 ? 0.9 : 1.3 });
  const t = s.target[i], v = s.profile[i];
  player.onScreenDisplay.setTitle(" ", {
    subtitle: `${blow === 2 ? "§6Heavy blow" : "§eLight blow"} §7on section ${i + 1}: ` + (v === t ? "§a§lon the line" : v > t ? `§f${v - t} to go` : "§cover-worked!"),
    fadeInDuration: 0, stayDuration: 12, fadeOutDuration: 4,
  });
  if (s.profile.every((p, k) => p <= s.target[k])) {
    s.phase = "quench";
    player.onScreenDisplay.setTitle("§bQuench it!", { subtitle: "§fStrike the forge while the metal is §6orange", fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
  }
}

function quench(player, s) {
  const h = s.heat;
  s.quench = h >= QUENCH.perfect[0] && h <= QUENCH.perfect[1] ? "perfect" : h >= QUENCH.ok[0] && h <= QUENCH.ok[1] ? "ok" : "bad";
  const { dim, top } = spark(s, false);
  dim.playSound("random.fizz", top, { volume: 1, pitch: 0.8 });
  try {
    dim.spawnParticle("minecraft:large_explosion", top);
    for (let k = 0; k < 6; k++) dim.spawnParticle("minecraft:basic_smoke_particle", { x: top.x + (k % 3 - 1) * 0.3, y: top.y + 0.2, z: top.z + (k < 3 ? -0.2 : 0.2) });
  } catch { /* ignore */ }
  finish(player, s);
}

/** Shape error: leftover thickness, over-worked sections (worse), cracks, burning and the quench. */
export function forgeError(s) {
  let err = 0;
  s.profile.forEach((p, i) => { err += p > s.target[i] ? p - s.target[i] : (s.target[i] - p) * 1.5; });
  err += s.cracks * 2 + Math.floor(s.burn / 20);
  err += { perfect: 0, ok: 1 }[s.quench] ?? 3;
  return err;
}

export function qualityForError(err) {
  if (err <= 1) return "masterwork";
  if (err <= 3) return "fine";
  if (err <= 6) return "standard";
  return "crude";
}

/**
 * Chance (0-1) that a forge reaches the quality your work earned, by Smithing level.
 * Low at Smithing 1, certain by Smithing 16 (Fine) and 20 (Masterwork). A missed roll drops one grade.
 */
export function qualityChance(quality, smithing) {
  if (quality === "masterwork") return Math.min(1, 0.05 + (smithing - 1) * 0.05);
  if (quality === "fine") return Math.min(1, 0.25 + (smithing - 1) * 0.05);
  return 1;
}

/** Applies the Smithing-level roll to the quality earned by the minigame. */
export function rollQuality(earned, smithing, rand = Math.random) {
  if (earned === "masterwork" && rand() >= qualityChance("masterwork", smithing)) earned = "fine";
  if (earned === "fine" && rand() >= qualityChance("fine", smithing)) earned = "standard";
  return earned;
}

function finish(player, s) {
  endForge(player.id);
  const earned = qualityForError(forgeError(s));
  const smithing = jobLevel(getData(player), "smithing");
  const key = rollQuality(earned, smithing);
  const notes = [s.cracks ? `${s.cracks} crack${s.cracks > 1 ? "s" : ""}` : "", s.burn >= 20 ? "burnt in the forge" : "",
    { perfect: "a perfect quench", ok: "a decent quench", bad: "a poor quench" }[s.quench] ?? "never quenched"].filter(Boolean).join(", ");
  player.sendMessage(`§7[Forge] Shape off by ${forgeError(s).toFixed(1)}; ${notes}. Earned §f${QUALITIES[earned].name}§7.`);
  if (key !== earned) {
    player.sendMessage(`§7[Forge] Your hands aren't sure enough yet: it came out §f${QUALITIES[key].name}§7. ` +
      `§8(Smithing ${smithing}: higher levels make better results more likely.)`);
  }
  const q = QUALITIES[key];
  const item = new ItemStack(s.id, 1);
  item.setDynamicProperty("ponce:quality", key);
  if (s.infusions.length) item.setDynamicProperty("ponce:infusions", JSON.stringify(s.infusions));
  item.nameTag = `${q.name} ${s.def.name}${s.infusions.length ? " §d+" + s.infusions.length : ""}`;
  item.setLore(weaponLore(s.def, { quality: key, infusions: s.infusions }));
  if (key === "crude") {
    const dur = item.getComponent("minecraft:durability");
    if (dur) dur.damage = Math.floor(dur.maxDurability * 0.25);
  }
  give(player, item);
  addJobXp(player, "smithing", s.def.forge.xp * q.xp);
  notify(player, "forge", key);
  player.onScreenDisplay.setTitle("§6Forged!", { subtitle: `${q.name} §f${s.def.name}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
  player.playSound(key === "masterwork" ? "random.totem" : "random.anvil_land", { pitch: key === "crude" ? 0.7 : 1.2 });
}

function tickSessions() {
  for (const [pid, s] of sessions) {
    const player = world.getEntity(pid);
    if (!player?.isValid) { endForge(pid); continue; }
    const dx = player.location.x - (s.loc.x + 0.5), dz = player.location.z - (s.loc.z + 0.5);
    const dist = Math.hypot(dx, dz);
    if (dist > MAX_DISTANCE || player.dimension.id !== s.dim) {
      endForge(pid);
      player.sendMessage("§c[Ponce] You left the forge and the metal cooled into scrap. The materials are lost.");
      continue;
    }
    s.ticks++;
    const now = system.currentTick;
    // Bellows: crouch near the forge to heat the metal. Past white-hot it burns.
    if (player.isSneaking && dist <= HEAT.bellowsRange) {
      s.heat = Math.min(HEAT.max, s.heat + HEAT.bellows);
      if (s.ticks % 6 === 0) try { player.dimension.spawnParticle("minecraft:basic_flame_particle", { x: s.loc.x + 0.5, y: s.loc.y + 1, z: s.loc.z + 0.5 }); } catch { /* ignore */ }
    } else s.heat = Math.max(0, s.heat - coolRate(s.level));
    if (s.heat > HEAT.burn) s.burn++;
    // Aim along the blade, and the hammer: look up to raise it, bring your view down to swing it
    if (s.phase === "shape") s.section = sectionFor(player, s);
    s.holding = getHeldItem(player)?.typeId === HAMMER;
    const pitch = player.getRotation?.().x ?? 0;
    if (!s.holding) s.raised = false;
    else if (pitch <= RAISE_PITCH) { s.raised = true; s.raisedAt = now; }
    else if (s.raised && pitch >= LAND_PITCH) {
      s.raised = false;
      strike(player, s, { kind: "swing", swingTicks: now - s.raisedAt });
      if (!sessions.has(pid)) continue;
    } else if (s.raised && now - s.raisedAt > SWING_WINDOW) s.raised = false;
    if (s.ticks >= TIME_LIMIT) {
      player.sendMessage("§7[Forge] You've worked it as long as you can. The blade is finished as it stands.");
      finish(player, s);
      continue;
    }
    showForge(s);
    player.onScreenDisplay.setActionBar(renderForge(s));
    hudHoldUntil.set(pid, now + 5);
  }
}

export function registerForging() {
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.block.typeId !== FORGE || ev.isFirstEvent === false) return;
    ev.cancel = true; // don't place blocks onto the forge
    const { player } = ev;
    const loc = { ...ev.block.location };
    const dim = ev.block.dimension;
    system.run(() => {
      const block = dim.getBlock(loc);
      if (block?.typeId === FORGE && player.isValid) openForgeMenu(player, block);
    });
  });

  world.afterEvents.entityHitBlock.subscribe(({ damagingEntity, hitBlock }) => {
    if (damagingEntity?.typeId !== "minecraft:player" || hitBlock.typeId !== FORGE) return;
    const s = sessions.get(damagingEntity.id);
    if (s && sameSpot(s.loc, hitBlock.location)) strike(damagingEntity, s, { kind: "tap" });
  });

  // Don't let a forge be broken mid-job
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (ev.block.typeId === FORGE && inUse(ev.block.location)) ev.cancel = true;
  });

  system.runInterval(tickSessions, 1);
  // Clear any blade left on a forge without a job (e.g. after the world was closed mid-forge)
  system.runInterval(() => sweepDisplays(DISPLAY, new Set([...sessions.values()].map((s) => s.display?.id))), 100);
}
