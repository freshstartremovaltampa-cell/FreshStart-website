// Forging. Use the Smithing Forge (right-click / long-press) to pick a weapon.
// The materials go in, and you shape the hot blade by PUNCHING the forge when
// the sweeping marker is inside the green zone, before the metal cools.
//   Perfect (green)  +20% shape, best quality
//   Good (yellow)    +14% shape
//   Off              +7% shape, hurts quality
// Average accuracy decides the quality: Crude, Standard, Fine or Masterwork.
// Smithing level widens the green zone and slows the marker.

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

const FORGE = "ponce:smithing_forge";
export const BAR = 25;
export const HEAT_TICKS = 400; // 20 seconds before the metal cools
const MAX_DISTANCE = 6;

export const sessions = new Map(); // player id -> forging session

export function zoneWidth(level) {
  return 3 + (level >= 10 ? 1 : 0) + (level >= 25 ? 1 : 0);
}

export function markerSpeed(level) {
  return Math.max(0.6, 1.2 - level * 0.012); // bar positions per tick
}

function newZone(s) {
  s.zone = 2 + Math.floor(Math.random() * (BAR - s.width - 4));
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
  return Object.keys(INFUSIONS).filter((id) => hasAll(player, totalMaterials(mats, [id])));
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
      "§7Pick a weapon to forge. Then §fpunch the forge§7 each time the marker is in the §agreen§7 zone. " +
      "Finish shaping before the metal cools. Better timing makes a better weapon.\n§8Stay within a few blocks of the forge."
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
    id, def, infusions, loc: { ...loc }, dim: dimension.id,
    pos: 0, dir: 1, speed: markerSpeed(level), width: zoneWidth(level),
    progress: 0, score: 0, strikes: 0, heat: HEAT_TICKS, lastStrike: -10, zone: 0,
  };
  newZone(s);
  sessions.set(player.id, s);
  player.onScreenDisplay.setTitle("§6Shape the blade", {
    subtitle: "§fPunch the forge when the marker is in the §agreen", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10,
  });
  dimension.playSound("bucket.fill_lava", { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
}

export function renderBar(s) {
  const cursor = Math.round(s.pos);
  let bar = "";
  for (let i = 0; i < BAR; i++) {
    if (i === cursor) bar += "§f§l|§r";
    else if (i >= s.zone && i < s.zone + s.width) bar += "§a|";
    else if (i >= s.zone - 2 && i < s.zone + s.width + 2) bar += "§e|";
    else bar += "§8|";
  }
  const heatColor = s.heat > HEAT_TICKS / 2 ? "§6" : s.heat > HEAT_TICKS / 4 ? "§c" : "§4";
  return `§fSHAPE ${Math.min(100, Math.floor(s.progress))}%  ${bar}  ${heatColor}HEAT ${Math.ceil(s.heat / 20)}s`;
}

export function strike(player, s) {
  const now = system.currentTick;
  if (now - s.lastStrike < 4) return; // one strike per punch
  s.lastStrike = now;
  const p = Math.round(s.pos);
  const perfect = p >= s.zone && p < s.zone + s.width;
  const good = !perfect && p >= s.zone - 2 && p < s.zone + s.width + 2;
  s.strikes++;
  const dim = world.getDimension(s.dim);
  const top = { x: s.loc.x + 0.5, y: s.loc.y + 1.1, z: s.loc.z + 0.5 };
  if (perfect) { s.progress += 20; s.score += 3; }
  else if (good) { s.progress += 14; s.score += 1; }
  else { s.progress += 7; s.score -= 2; }
  dim.playSound("random.anvil_use", top, { volume: 0.8, pitch: perfect ? 1.4 : good ? 1.1 : 0.7 });
  try { dim.spawnParticle("minecraft:lava_particle", top); } catch { /* ignore */ }
  player.onScreenDisplay.setTitle(" ", {
    subtitle: perfect ? "§a§lPERFECT" : good ? "§eGood" : "§cOff", fadeInDuration: 0, stayDuration: 8, fadeOutDuration: 4,
  });
  newZone(s);
  if (s.progress >= 100) finish(player, s, false);
}

export function qualityFor(s, cooled) {
  if (cooled) return "crude";
  const avg = s.strikes ? s.score / s.strikes : -2;
  if (avg >= 2.4) return "masterwork";
  if (avg >= 1.5) return "fine";
  if (avg >= 0.3) return "standard";
  return "crude";
}

function finish(player, s, cooled) {
  sessions.delete(player.id);
  const key = qualityFor(s, cooled);
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
  player.onScreenDisplay.setTitle(cooled ? "§cThe metal cooled" : "§6Forged!", {
    subtitle: `${q.name} §f${s.def.name}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10,
  });
  player.playSound(key === "masterwork" ? "random.totem" : "random.anvil_land", { pitch: key === "crude" ? 0.7 : 1.2 });
}

function tickSessions() {
  for (const [pid, s] of sessions) {
    const player = world.getEntity(pid);
    if (!player?.isValid) { sessions.delete(pid); continue; }
    const dx = player.location.x - (s.loc.x + 0.5), dz = player.location.z - (s.loc.z + 0.5);
    if (Math.hypot(dx, dz) > MAX_DISTANCE || player.dimension.id !== s.dim) {
      sessions.delete(pid);
      player.sendMessage("§c[Ponce] You left the forge and the metal cooled into scrap. The materials are lost.");
      continue;
    }
    s.heat--;
    s.pos += s.dir * s.speed;
    if (s.pos >= BAR - 1) { s.pos = BAR - 1; s.dir = -1; }
    if (s.pos <= 0) { s.pos = 0; s.dir = 1; }
    if (s.heat <= 0) { finish(player, s, true); continue; }
    player.onScreenDisplay.setActionBar(renderBar(s));
    hudHoldUntil.set(pid, system.currentTick + 5);
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
    if (s && sameSpot(s.loc, hitBlock.location)) strike(damagingEntity, s);
  });

  // Don't let a forge be broken mid-job
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (ev.block.typeId === FORGE && inUse(ev.block.location)) ev.cancel = true;
  });

  system.runInterval(tickSessions, 1);
}
