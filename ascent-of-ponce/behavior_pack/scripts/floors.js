// The tower floors in the game. Each floor is a floating island built chunk by
// chunk around players from its generator module (floorN_gen.js). This file
// handles every floor: building, quest givers, travel, Stair Gates, fog,
// spawning each floor's mobs, keeping Minecraft mobs off, and fall rescue.

import { world, system, BlockPermutation, BlockTypes, BlockVolume, GameMode } from "@minecraft/server";
import * as F1 from "./floor1_gen.js";
import * as F2 from "./floor2_gen.js";
import * as F3 from "./floor3_gen.js";
import { directionText } from "./floor1_gen.js";
import { NPCS } from "./quests_data.js";
import { getData } from "./data.js";

const DIM = "overworld";
const BUILD_RADIUS = 4; // chunks around each nearby player
const OPS_PER_TICK = 700;
const IGNORED_MODES = [GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);
const FOG_ID = "ponce_floor";

// [mob, weight, habitat, herd size]
// habitat: "land" (dry ground), "water" (in shallow water), "any" (either), "air" (hovers above)
export const FLOORS = [
  {
    gen: F1, fog: undefined,
    spawn: {
      day: [["ponce:meadow_jelly", 30, "land"], ["ponce:thornback_hare", 20, "land"], ["ponce:tusk_boar", 20, "land"],
        ["ponce:field_wasp", 15, "air"], ["ponce:burrow_mole", 10, "land"], ["ponce:moss_golemite", 5, "land"]],
      night: [["ponce:meadow_jelly", 30, "land"], ["ponce:thornback_hare", 8, "land"], ["ponce:tusk_boar", 20, "land"],
        ["ponce:burrow_mole", 18, "land"], ["ponce:moss_golemite", 14, "land"]],
    },
  },
  {
    gen: F2, fog: "ponce:marsh_fog",
    spawn: {
      day: [["ponce:bog_frog", 35, "any"], ["ponce:marsh_gator", 20, "any"], ["ponce:mire_shambler", 15, "land"], ["ponce:will_o_wisp", 5, "air"]],
      night: [["ponce:bog_frog", 20, "any"], ["ponce:marsh_gator", 20, "any"], ["ponce:mire_shambler", 30, "land"], ["ponce:will_o_wisp", 30, "air"]],
    },
  },
  {
    gen: F3, fog: undefined,
    spawn: {
      day: [["ponce:highland_bull", 30, "land", 3], ["ponce:rock_lizard", 20, "land"], ["ponce:wind_sprite", 15, "air"], ["ponce:crag_hawk", 20, "air"]],
      night: [["ponce:highland_bull", 15, "land", 2], ["ponce:rock_lizard", 30, "land"], ["ponce:wind_sprite", 30, "air"], ["ponce:crag_hawk", 5, "air"]],
    },
  },
];
export const floorById = (id) => FLOORS[id - 1];
export const SPAWN = { cap: 8, range: 40, minDist: 16, maxDist: 32, everyTicks: 40 };

/** The floor a location is on, if any. */
export function floorAt(loc) {
  return FLOORS.find((f) => f.gen.isOnFloor(loc));
}

function nearFloor(f, loc) {
  return Math.hypot(loc.x - f.gen.FLOOR.center.x, loc.z - f.gen.FLOOR.center.z) <= f.gen.FLOOR.radius + 96;
}

// ---------- Block ids ----------

// Symbolic block names from the generators -> candidate ids (first valid one wins)
const BLOCKS = {
  air: ["minecraft:air"], stone: ["minecraft:stone"], dirt: ["minecraft:dirt"],
  grass: ["minecraft:grass_block", "minecraft:grass"], coarse: ["minecraft:coarse_dirt", "minecraft:dirt"],
  path: ["minecraft:grass_path", "minecraft:dirt_path", "minecraft:coarse_dirt"],
  cobble: ["minecraft:cobblestone"], mossy: ["minecraft:mossy_cobblestone", "minecraft:cobblestone"],
  bricks: ["minecraft:stone_bricks", "minecraft:stonebrick"], chiseled: ["minecraft:chiseled_stone_bricks", "minecraft:stone_bricks"],
  mossy_bricks: ["minecraft:mossy_stone_bricks", "minecraft:stone_bricks"],
  water: ["minecraft:water"],
  oak_log: ["minecraft:oak_log", "minecraft:log"], birch_log: ["minecraft:birch_log", "minecraft:log"], spruce_log: ["minecraft:spruce_log", "minecraft:log"],
  oak_leaves: ["minecraft:oak_leaves", "minecraft:leaves"], birch_leaves: ["minecraft:birch_leaves", "minecraft:leaves"],
  spruce_leaves: ["minecraft:spruce_leaves", "minecraft:leaves"],
  mangrove_log: ["minecraft:mangrove_log", "minecraft:oak_log"], mangrove_leaves: ["minecraft:mangrove_leaves", "minecraft:oak_leaves"],
  mangrove_roots: ["minecraft:mangrove_roots", "minecraft:oak_fence"], mangrove_planks: ["minecraft:mangrove_planks", "minecraft:spruce_planks"],
  oak_planks: ["minecraft:oak_planks", "minecraft:planks"], spruce_planks: ["minecraft:spruce_planks", "minecraft:planks"],
  birch_planks: ["minecraft:birch_planks", "minecraft:planks"],
  mud: ["minecraft:mud", "minecraft:dirt"], packed_mud: ["minecraft:packed_mud", "minecraft:coarse_dirt"],
  moss: ["minecraft:moss_block", "minecraft:grass_block"], moss_carpet: ["minecraft:moss_carpet", "minecraft:short_grass"],
  glass: ["minecraft:glass_pane"], fence: ["minecraft:oak_fence", "minecraft:fence"], lantern: ["minecraft:lantern", "minecraft:torch"],
  bookshelf: ["minecraft:bookshelf"], furnace: ["minecraft:furnace"], anvil: ["minecraft:anvil"], chest: ["minecraft:chest"],
  barrel: ["minecraft:barrel"], campfire: ["minecraft:campfire"], hay: ["minecraft:hay_block"],
  red_wool: ["minecraft:red_wool", "minecraft:wool"], blue_wool: ["minecraft:blue_wool", "minecraft:wool"],
  yellow_wool: ["minecraft:yellow_wool", "minecraft:wool"],
  short_grass: ["minecraft:short_grass", "minecraft:tallgrass"], fern: ["minecraft:fern", "minecraft:tallgrass"],
  poppy: ["minecraft:poppy", "minecraft:red_flower"], dandelion: ["minecraft:dandelion", "minecraft:yellow_flower"],
  cornflower: ["minecraft:cornflower", "minecraft:red_flower"], oxeye_daisy: ["minecraft:oxeye_daisy", "minecraft:red_flower"],
  azure_bluet: ["minecraft:azure_bluet", "minecraft:red_flower"], blue_orchid: ["minecraft:blue_orchid", "minecraft:red_flower"],
  lily: ["minecraft:waterlily", "minecraft:lily_pad"], reeds: ["minecraft:reeds", "minecraft:sugar_cane"],
  forge: ["ponce:smithing_forge"], pot: ["ponce:cooking_pot"], stair_gate: ["ponce:stair_gate"],
  ember_copper_node: ["ponce:ember_copper_node"], ironheart_node: ["ponce:ironheart_node"], glimmer_silver_node: ["ponce:glimmer_silver_node"],
  stormsteel_node: ["ponce:stormsteel_node"],
};
const LEAVES = new Set(["oak_leaves", "birch_leaves", "spruce_leaves", "mangrove_leaves"]);
const resolved = new Map();

/** Block permutation for a symbolic name. Leaves are made persistent so they never decay. */
export function blockFor(key) {
  if (resolved.has(key)) return resolved.get(key);
  let perm;
  for (const id of BLOCKS[key] ?? []) {
    try {
      if (!BlockTypes.get(id)) continue;
      if (LEAVES.has(key)) {
        try { perm = BlockPermutation.resolve(id, { persistent_bit: true }); } catch { perm = BlockPermutation.resolve(id); }
      } else perm = BlockPermutation.resolve(id);
      break;
    } catch { /* try the next candidate */ }
  }
  if (!perm) console.warn(`[Ponce] floors: no valid block for "${key}"`);
  resolved.set(key, perm);
  return perm;
}

// ---------- Built chunks (saved in the world, one string per floor) ----------

const built = new Map(); // floor id -> array of "0"/"1"

function dims(f) {
  const b = f.gen.CHUNK_BOUNDS;
  return { b, w: b.max.x - b.min.x + 1, h: b.max.z - b.min.z + 1 };
}

function loadBuilt(f) {
  const id = f.gen.FLOOR.id;
  if (built.has(id)) return built.get(id);
  const { w, h } = dims(f);
  const raw = world.getDynamicProperty(`ponce:floor${id}_chunks`);
  const arr = typeof raw === "string" && raw.length === w * h ? raw.split("") : new Array(w * h).fill("0");
  built.set(id, arr);
  return arr;
}

const index = (f, cx, cz) => { const { b, w } = dims(f); return (cz - b.min.z) * w + (cx - b.min.x); };
const inBounds = (f, cx, cz) => { const { b } = dims(f); return cx >= b.min.x && cx <= b.max.x && cz >= b.min.z && cz <= b.max.z; };

export function isChunkBuilt(floorId, cx, cz) {
  const f = floorById(floorId);
  return inBounds(f, cx, cz) && loadBuilt(f)[index(f, cx, cz)] === "1";
}

function markBuilt(f, cx, cz) {
  const arr = loadBuilt(f);
  arr[index(f, cx, cz)] = "1";
  world.setDynamicProperty(`ponce:floor${f.gen.FLOOR.id}_chunks`, arr.join(""));
}

// ---------- Building ----------

let job; // { f, cx, cz, ops, i }

function runOp(dim, op) {
  const perm = blockFor(op[1]);
  if (!perm) return true;
  if (op[0] === "f") {
    const [, , x, y1, y2, z] = op;
    if (y2 < y1) return true;
    try {
      dim.fillBlocks(new BlockVolume({ x, y: y1, z }, { x, y: y2, z }), perm);
      return true;
    } catch {
      for (let y = y1; y <= y2; y++) {
        const b = dim.getBlock({ x, y, z });
        if (!b) return false;
        b.setPermutation(perm);
      }
      return true;
    }
  }
  const b = dim.getBlock({ x: op[2], y: op[3], z: op[4] });
  if (!b) return false; // chunk unloaded
  b.setPermutation(perm);
  return true;
}

function nextChunk() {
  const dim = world.getDimension(DIM);
  const wanted = [];
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== dim.id) continue;
    for (const f of FLOORS) {
      if (!nearFloor(f, p.location)) continue;
      const pcx = Math.floor(p.location.x) >> 4, pcz = Math.floor(p.location.z) >> 4;
      for (let cx = pcx - BUILD_RADIUS; cx <= pcx + BUILD_RADIUS; cx++)
        for (let cz = pcz - BUILD_RADIUS; cz <= pcz + BUILD_RADIUS; cz++) {
          if (!inBounds(f, cx, cz) || isChunkBuilt(f.gen.FLOOR.id, cx, cz) || !f.gen.chunkHasIsland(cx, cz)) continue;
          wanted.push([f, cx, cz, (cx - pcx) ** 2 + (cz - pcz) ** 2]);
        }
    }
  }
  wanted.sort((a, b) => a[3] - b[3]);
  for (const [f, cx, cz] of wanted) {
    if (!dim.getBlock({ x: cx * 16, y: f.gen.FLOOR.base, z: cz * 16 })) continue; // not loaded yet
    return { f, cx, cz, ops: f.gen.chunkOps(cx, cz), i: 0 };
  }
  return undefined;
}

function buildTick() {
  job ??= nextChunk();
  if (!job) return;
  const dim = world.getDimension(DIM);
  const end = Math.min(job.ops.length, job.i + OPS_PER_TICK);
  for (; job.i < end; job.i++) {
    if (!runOp(dim, job.ops[job.i])) { job = undefined; return; } // unloaded mid-build: retry later
  }
  if (job.i >= job.ops.length) {
    markBuilt(job.f, job.cx, job.cz);
    placeNpcs(job.f, job.cx, job.cz);
    job = undefined;
  }
}

// ---------- Quest givers live in each floor's town ----------

function placeNpcs(f, cx, cz) {
  const key = `ponce:floor${f.gen.FLOOR.id}_npcs`;
  let placed;
  try { placed = JSON.parse(world.getDynamicProperty(key) ?? "[]"); } catch { placed = []; }
  const dim = world.getDimension(DIM);
  let changed = false;
  for (const [id, spot] of Object.entries(f.gen.NPC_SPOTS)) {
    if (placed.includes(id) || (Math.floor(spot.x) >> 4) !== cx || (Math.floor(spot.z) >> 4) !== cz) continue;
    if (dim.getEntities({ type: id, location: spot, maxDistance: 16 }).length === 0) {
      const npc = dim.spawnEntity(id, spot);
      npc.nameTag = NPCS[id]?.name ?? npc.nameTag;
    }
    placed.push(id);
    changed = true;
  }
  if (changed) world.setDynamicProperty(key, JSON.stringify(placed));
}

// ---------- Travel ----------

export function travelToFloor(player, id) {
  const f = floorById(id);
  const dim = world.getDimension(DIM);
  const a = f.gen.ARRIVAL;
  player.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
  player.addEffect("resistance", 200, { amplifier: 4, showParticles: false });
  player.teleport({ x: a.x, y: a.y + 1, z: a.z }, { dimension: dim, facingLocation: { x: f.gen.FLOOR.center.x + 0.5, y: a.y + 2, z: f.gen.FLOOR.center.z + 0.5 } });
  try { player.setSpawnPoint({ ...a, dimension: dim }); } catch { /* older API */ }
  player.onScreenDisplay.setTitle(`§6${f.gen.FLOOR.name}`, {
    subtitle: `§fFloor ${id}${f.gen.FLOOR.title ? `: ${f.gen.FLOOR.title}` : ""}`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20,
  });
}

export const travelToFloor1 = (player) => travelToFloor(player, 1);

/** Floors this player has unlocked (Floor 1 always; Floor N once Floor N-1's guardian is beaten). */
export function unlockedFloors(player) {
  const top = getData(player).highestFloor ?? 1;
  return FLOORS.filter((f) => f.gen.FLOOR.id <= top);
}

export function travelToWorldSpawn(player) {
  const dim = world.getDimension(DIM);
  const s = world.getDefaultSpawnLocation();
  let y = 100;
  try { y = (dim.getTopmostBlock({ x: s.x, z: s.z })?.location.y ?? 99) + 1; } catch { /* fall with slow falling */ }
  player.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
  player.teleport({ x: s.x + 0.5, y, z: s.z + 0.5 }, { dimension: dim });
}

/** Catch players who fall off a floor and bring them back to its town. */
function rescueFallers() {
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== world.getDimension(DIM).id) continue;
    const { x, y, z } = p.location;
    for (const f of FLOORS) {
      const F = f.gen.FLOOR;
      if (y > F.base - 70 || y < F.base - 140) continue;
      if (Math.hypot(x - F.center.x, z - F.center.z) > F.radius + 40) continue;
      if (p.getVelocity().y > -0.6) continue;
      travelToFloor(p, F.id);
      p.sendMessage("§7[Ponce] The tower catches you as you fall, and you wake up in town.");
    }
  }
}

// ---------- Stair Gates ----------

/** Use the Stair Gate on floor `id`: sealed until its guardian is beaten, then leads up a floor. */
export function useStairGate(player, id) {
  const f = floorById(id);
  const d = getData(player);
  if ((d.highestFloor ?? 1) <= id) {
    player.sendMessage(`§7[Ponce] The Stair Gate is sealed. §fDefeat the guardian of Floor ${id} to open the way up.`);
    player.playSound("note.bass", { pitch: 0.5 });
    return "sealed";
  }
  const g = f.gen.GATE;
  try { player.dimension.spawnParticle("minecraft:portal_reverse_particle", { x: g.x + 0.5, y: g.y + 2, z: g.z + 0.5 }); } catch { /* ignore */ }
  player.playSound("portal.trigger", { volume: 0.5, pitch: 1.4 });
  if (floorById(id + 1)) { travelToFloor(player, id + 1); return "travel"; }
  player.sendMessage(`§d[Ponce] The gate opens to you, and the stairway climbs into the clouds... §7Floor ${id + 1} is still being built. It arrives in a coming update.`);
  return "open";
}

/** Where you are and how to reach the landmarks, for the map page. */
export function mapText(player) {
  const p = player.location;
  const f = floorAt(p);
  if (!f) return "§fYou are in the world below the tower.\n§7Use Travel to reach the floors you've unlocked.";
  const F = f.gen.FLOOR;
  const open = (getData(player).highestFloor ?? 1) > F.id;
  return [
    `§fYou are on §6Floor ${F.id}${F.title ? `, ${F.title}` : ""}§f.`,
    `§6${F.name}§7 (town): ${f.gen.inTown(p.x, p.z) ? "you're in town" : directionText(p, F.center)}`,
    `§cGuardian's arena§7: ${directionText(p, f.gen.ARENA)}, at the end of the north trail`,
    `§dStair Gate§7: in the arena's north wall, ${open ? "§aopen to you" : "§csealed until the guardian falls"}`,
    ...(f.gen.LANDMARKS ?? []).map((l) => `§b${l.name}§7: ${directionText(p, l)}`),
  ].join("\n");
}

// ---------- Mobs ----------

function pickMob(table) {
  let r = Math.random() * table.reduce((a, [, w]) => a + w, 0);
  for (const row of table) if ((r -= row[1]) < 0) return row;
  return table[0];
}

function spawnTick() {
  const dim = world.getDimension(DIM);
  const night = (() => { const t = world.getTimeOfDay(); return t >= 13000 && t < 23000; })();
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== dim.id) continue;
    const f = floorAt(p.location);
    if (!f || IGNORED_MODES.includes(p.getGameMode?.())) continue;
    const g = f.gen, F = g.FLOOR;
    const near = dim.getEntities({ location: p.location, maxDistance: SPAWN.range, families: ["ponce_mob"] })
      .filter((e) => !e.matches({ families: ["ponce_boss"] })).length;
    if (near >= SPAWN.cap) continue;
    for (let attempt = 0; attempt < 4; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = SPAWN.minDist + Math.random() * (SPAWN.maxDist - SPAWN.minDist);
      const x = Math.floor(p.location.x + Math.cos(a) * r), z = Math.floor(p.location.z + Math.sin(a) * r);
      if (!g.onIsland(x, z) || g.inTown(x, z) || Math.hypot(x - F.center.x, z - F.center.z) < F.townRadius + 8) continue;
      if (g.arenaDistance(x, z) < g.ARENA.radius + 10) continue; // the arena is for the guardian
      if (!isChunkBuilt(F.id, x >> 4, z >> 4)) continue;
      const [id, , habitat, herdSize] = pickMob(night ? f.spawn.night : f.spawn.day);
      const y = g.surfaceY(x, z) + 1;
      const at = dim.getBlock({ x, y, z }), below = dim.getBlock({ x, y: y - 1, z });
      if (!at || !below) continue;
      const wet = at.typeId.includes("water");
      const open = at.isAir || at.typeId.includes("grass") || at.typeId.includes("fern") || at.typeId.includes("flower") || at.typeId.includes("carpet");
      const solidBelow = !below.typeId.includes("water") && !below.typeId.includes("leaves");
      let spawnY = y;
      if (habitat === "land" && !(open && solidBelow)) continue;
      if (habitat === "water" && !wet) continue;
      if (habitat === "any" && !(wet || (open && solidBelow))) continue;
      if (habitat === "air") { if (!(open || wet)) continue; spawnY = Math.max(y, F.base + 1) + 2; }
      const herd = herdSize ?? (id === "ponce:tusk_boar" ? 2 : 1);
      for (let i = 0; i < herd; i++) dim.spawnEntity(id, { x: x + 0.5 + i, y: spawnY, z: z + 0.5 });
      break;
    }
  }
}

/** No Minecraft mobs on the tower floors. */
function onEntitySpawn({ entity }) {
  try {
    if (!entity?.isValid || !entity.typeId.startsWith("minecraft:") || entity.typeId === "minecraft:player") return;
    if (!entity.matches({ families: ["mob"] })) return;
    if (floorAt(entity.location)) entity.remove();
  } catch { /* entity gone */ }
}

// ---------- Fog ----------

const fogState = new Map(); // player id -> fog id currently pushed

function fogTick() {
  for (const p of world.getAllPlayers()) {
    const want = floorAt(p.location)?.fog;
    const have = fogState.get(p.id);
    if (want === have) continue;
    try {
      if (have) p.runCommand(`fog @s remove ${FOG_ID}`);
      if (want) p.runCommand(`fog @s push ${want} ${FOG_ID}`);
    } catch { /* fog command unavailable */ }
    if (want) fogState.set(p.id, want); else fogState.delete(p.id);
  }
}

export function registerFloors() {
  system.runInterval(buildTick, 1);
  system.runInterval(rescueFallers, 10);
  system.runInterval(spawnTick, SPAWN.everyTicks);
  system.runInterval(fogTick, 20);
  world.afterEvents.entitySpawn.subscribe(onEntitySpawn);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => fogState.delete(playerId));
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.block.typeId !== "ponce:stair_gate" || ev.isFirstEvent === false) return;
    ev.cancel = true;
    const { player } = ev;
    const f = floorAt(ev.block.location) ?? FLOORS[0];
    system.run(() => player.isValid && useStairGate(player, f.gen.FLOOR.id));
  });
}
