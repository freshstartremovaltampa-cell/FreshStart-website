// Floor 1 in the game: builds the island chunk by chunk around players,
// places the quest givers, handles travel, keeps Minecraft mobs off the floor,
// and spawns Floor 1 mobs in the forest.

import { world, system, BlockPermutation, BlockTypes, BlockVolume, GameMode } from "@minecraft/server";
import {
  ARENA, GATE, arenaDistance, directionText,
  ARRIVAL, CHUNK_BOUNDS, FLOOR1, NPC_SPOTS, chunkHasIsland, chunkOps, inTown, isOnFloor1, onIsland, surfaceY,
} from "./floor1_gen.js";
import { NPCS } from "./quests_data.js";
import { getData } from "./data.js";

const DIM = "overworld";
const SAVE_KEY = "ponce:floor1_chunks";
const NPC_KEY = "ponce:floor1_npcs";
const BUILD_RADIUS = 4; // chunks around each nearby player
const OPS_PER_TICK = 700;
const IGNORED_MODES = [GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);

// Symbolic block names from the generator -> candidate ids (first valid one wins)
const BLOCKS = {
  air: ["minecraft:air"], stone: ["minecraft:stone"], dirt: ["minecraft:dirt"],
  grass: ["minecraft:grass_block", "minecraft:grass"], coarse: ["minecraft:coarse_dirt", "minecraft:dirt"],
  path: ["minecraft:grass_path", "minecraft:dirt_path", "minecraft:coarse_dirt"],
  cobble: ["minecraft:cobblestone"], mossy: ["minecraft:mossy_cobblestone", "minecraft:cobblestone"],
  bricks: ["minecraft:stone_bricks", "minecraft:stonebrick"], chiseled: ["minecraft:chiseled_stone_bricks", "minecraft:stone_bricks"],
  water: ["minecraft:water"],
  oak_log: ["minecraft:oak_log", "minecraft:log"], birch_log: ["minecraft:birch_log", "minecraft:log"], spruce_log: ["minecraft:spruce_log", "minecraft:log"],
  oak_leaves: ["minecraft:oak_leaves", "minecraft:leaves"], birch_leaves: ["minecraft:birch_leaves", "minecraft:leaves"],
  spruce_leaves: ["minecraft:spruce_leaves", "minecraft:leaves"],
  oak_planks: ["minecraft:oak_planks", "minecraft:planks"], spruce_planks: ["minecraft:spruce_planks", "minecraft:planks"],
  birch_planks: ["minecraft:birch_planks", "minecraft:planks"],
  glass: ["minecraft:glass_pane"], fence: ["minecraft:oak_fence", "minecraft:fence"], lantern: ["minecraft:lantern", "minecraft:torch"],
  bookshelf: ["minecraft:bookshelf"], furnace: ["minecraft:furnace"], anvil: ["minecraft:anvil"], chest: ["minecraft:chest"],
  barrel: ["minecraft:barrel"], campfire: ["minecraft:campfire"], hay: ["minecraft:hay_block"],
  red_wool: ["minecraft:red_wool", "minecraft:wool"], blue_wool: ["minecraft:blue_wool", "minecraft:wool"],
  yellow_wool: ["minecraft:yellow_wool", "minecraft:wool"],
  short_grass: ["minecraft:short_grass", "minecraft:tallgrass"], fern: ["minecraft:fern", "minecraft:tallgrass"],
  poppy: ["minecraft:poppy", "minecraft:red_flower"], dandelion: ["minecraft:dandelion", "minecraft:yellow_flower"],
  cornflower: ["minecraft:cornflower", "minecraft:red_flower"], oxeye_daisy: ["minecraft:oxeye_daisy", "minecraft:red_flower"],
  azure_bluet: ["minecraft:azure_bluet", "minecraft:red_flower"],
  forge: ["ponce:smithing_forge"], pot: ["ponce:cooking_pot"], stair_gate: ["ponce:stair_gate"],
  ember_copper_node: ["ponce:ember_copper_node"], ironheart_node: ["ponce:ironheart_node"], glimmer_silver_node: ["ponce:glimmer_silver_node"],
};
const LEAVES = new Set(["oak_leaves", "birch_leaves", "spruce_leaves"]);
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
  if (!perm) console.warn(`[Ponce] Floor 1: no valid block for "${key}"`);
  resolved.set(key, perm);
  return perm;
}

// ---------- Which chunks are built (saved in the world) ----------

const W = CHUNK_BOUNDS.max.x - CHUNK_BOUNDS.min.x + 1;
const H = CHUNK_BOUNDS.max.z - CHUNK_BOUNDS.min.z + 1;
let built;

function loadBuilt() {
  if (built) return built;
  const raw = world.getDynamicProperty(SAVE_KEY);
  built = typeof raw === "string" && raw.length === W * H ? raw.split("") : new Array(W * H).fill("0");
  return built;
}

const idx = (cx, cz) => (cz - CHUNK_BOUNDS.min.z) * W + (cx - CHUNK_BOUNDS.min.x);
const inBounds = (cx, cz) => cx >= CHUNK_BOUNDS.min.x && cx <= CHUNK_BOUNDS.max.x && cz >= CHUNK_BOUNDS.min.z && cz <= CHUNK_BOUNDS.max.z;

export function isChunkBuilt(cx, cz) {
  return loadBuilt()[idx(cx, cz)] === "1";
}

function markBuilt(cx, cz) {
  loadBuilt()[idx(cx, cz)] = "1";
  world.setDynamicProperty(SAVE_KEY, built.join(""));
}

// ---------- Building ----------

let job; // { cx, cz, ops, i }

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
    const dx = p.location.x - FLOOR1.center.x, dz = p.location.z - FLOOR1.center.z;
    if (Math.hypot(dx, dz) > FLOOR1.radius + 96) continue;
    const pcx = Math.floor(p.location.x) >> 4, pcz = Math.floor(p.location.z) >> 4;
    for (let cx = pcx - BUILD_RADIUS; cx <= pcx + BUILD_RADIUS; cx++)
      for (let cz = pcz - BUILD_RADIUS; cz <= pcz + BUILD_RADIUS; cz++) {
        if (!inBounds(cx, cz) || isChunkBuilt(cx, cz) || !chunkHasIsland(cx, cz)) continue;
        wanted.push([cx, cz, (cx - pcx) ** 2 + (cz - pcz) ** 2]);
      }
  }
  wanted.sort((a, b) => a[2] - b[2]);
  for (const [cx, cz] of wanted) {
    if (!dim.getBlock({ x: cx * 16, y: FLOOR1.base, z: cz * 16 })) continue; // not loaded yet
    return { cx, cz, ops: chunkOps(cx, cz), i: 0 };
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
    markBuilt(job.cx, job.cz);
    placeNpcs(job.cx, job.cz);
    job = undefined;
  }
}

// ---------- Quest givers live in town ----------

function placeNpcs(cx, cz) {
  let placed;
  try { placed = JSON.parse(world.getDynamicProperty(NPC_KEY) ?? "[]"); } catch { placed = []; }
  const dim = world.getDimension(DIM);
  for (const [id, spot] of Object.entries(NPC_SPOTS)) {
    if (placed.includes(id) || (Math.floor(spot.x) >> 4) !== cx || (Math.floor(spot.z) >> 4) !== cz) continue;
    if (dim.getEntities({ type: id, location: spot, maxDistance: 16 }).length === 0) {
      const npc = dim.spawnEntity(id, spot);
      npc.nameTag = NPCS[id]?.name ?? npc.nameTag;
    }
    placed.push(id);
  }
  world.setDynamicProperty(NPC_KEY, JSON.stringify(placed));
}

// ---------- Travel ----------

export function travelToFloor1(player) {
  const dim = world.getDimension(DIM);
  player.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
  player.addEffect("resistance", 200, { amplifier: 4, showParticles: false });
  player.teleport({ x: ARRIVAL.x, y: ARRIVAL.y + 1, z: ARRIVAL.z }, { dimension: dim, facingLocation: { x: FLOOR1.center.x + 0.5, y: ARRIVAL.y + 2, z: FLOOR1.center.z + 0.5 } });
  try { player.setSpawnPoint({ ...ARRIVAL, dimension: dim }); } catch { /* older API */ }
  player.onScreenDisplay.setTitle(`§6${FLOOR1.name}`, { subtitle: "§fFloor 1", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
}

export function travelToWorldSpawn(player) {
  const dim = world.getDimension(DIM);
  const s = world.getDefaultSpawnLocation();
  let y = 100;
  try { y = (dim.getTopmostBlock({ x: s.x, z: s.z })?.location.y ?? 99) + 1; } catch { /* fall with slow falling */ }
  player.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
  player.teleport({ x: s.x + 0.5, y, z: s.z + 0.5 }, { dimension: dim });
}

/** Catch players who fall off the island and bring them back to town. */
function rescueFallers() {
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== world.getDimension(DIM).id) continue;
    const { x, y, z } = p.location;
    if (y > FLOOR1.base - 70 || y < FLOOR1.base - 140) continue;
    if (Math.hypot(x - FLOOR1.center.x, z - FLOOR1.center.z) > FLOOR1.radius + 40) continue;
    if (p.getVelocity().y > -0.6) continue;
    travelToFloor1(p);
    p.sendMessage("§7[Ponce] The tower catches you as you fall, and you wake up in town.");
  }
}

// ---------- Mobs ----------

const DAY_WEIGHTS = [["ponce:meadow_jelly", 30], ["ponce:thornback_hare", 20], ["ponce:tusk_boar", 20], ["ponce:field_wasp", 15], ["ponce:burrow_mole", 10], ["ponce:moss_golemite", 5]];
const NIGHT_WEIGHTS = [["ponce:meadow_jelly", 30], ["ponce:thornback_hare", 8], ["ponce:tusk_boar", 20], ["ponce:burrow_mole", 18], ["ponce:moss_golemite", 14]];
export const SPAWN = { cap: 8, range: 40, minDist: 16, maxDist: 32, everyTicks: 40 };

function pickMob() {
  const t = world.getTimeOfDay();
  const table = t >= 13000 && t < 23000 ? NIGHT_WEIGHTS : DAY_WEIGHTS;
  let r = Math.random() * table.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of table) if ((r -= w) < 0) return id;
  return table[0][0];
}

function spawnTick() {
  const dim = world.getDimension(DIM);
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== dim.id || !isOnFloor1(p.location)) continue;
    if (IGNORED_MODES.includes(p.getGameMode?.())) continue;
    const near = dim.getEntities({ location: p.location, maxDistance: SPAWN.range, families: ["ponce_mob"] })
      .filter((e) => !e.matches({ families: ["ponce_boss"] })).length;
    if (near >= SPAWN.cap) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = SPAWN.minDist + Math.random() * (SPAWN.maxDist - SPAWN.minDist);
      const x = Math.floor(p.location.x + Math.cos(a) * r), z = Math.floor(p.location.z + Math.sin(a) * r);
      if (!onIsland(x, z) || inTown(x, z) || Math.hypot(x - FLOOR1.center.x, z - FLOOR1.center.z) < FLOOR1.townRadius + 8) continue;
      if (arenaDistance(x, z) < ARENA.radius + 10) continue; // keep the arena clear for the guardian fight
      if (!isChunkBuilt(x >> 4, z >> 4)) continue;
      const y = surfaceY(x, z) + 1;
      const at = dim.getBlock({ x, y, z }), below = dim.getBlock({ x, y: y - 1, z });
      if (!at || !below || !(at.isAir || at.typeId.includes("grass") || at.typeId.includes("fern") || at.typeId.includes("flower"))) continue;
      if (below.typeId.includes("water") || below.typeId.includes("leaves")) continue;
      const id = pickMob();
      const herd = id === "ponce:tusk_boar" ? 2 : 1;
      for (let i = 0; i < herd; i++) dim.spawnEntity(id, { x: x + 0.5 + i, y, z: z + 0.5 });
      break;
    }
  }
}

// ---------- Stair Gate ----------

// Set once Floor 2 exists: a function that sends a player there.
export const NEXT_FLOOR = { travel: undefined };

export function useStairGate(player) {
  const d = getData(player);
  const top = { x: GATE.x + 0.5, y: GATE.y + 2, z: GATE.z + 0.5 };
  if ((d.highestFloor ?? 1) < 2) {
    player.sendMessage("§7[Ponce] The Stair Gate is sealed. §fDefeat Ironhide, the Boar King, to open the way up.");
    player.playSound("note.bass", { pitch: 0.5 });
    return "sealed";
  }
  try { player.dimension.spawnParticle("minecraft:portal_reverse_particle", top); } catch { /* ignore */ }
  player.playSound("portal.trigger", { volume: 0.5, pitch: 1.4 });
  if (NEXT_FLOOR.travel) { NEXT_FLOOR.travel(player); return "travel"; }
  player.sendMessage("§d[Ponce] The gate opens to you, and the stairway climbs into the clouds... §7Floor 2 is still being built. It arrives in a coming update.");
  return "open";
}

/** "You are on Floor 1" plus directions to the landmarks, for the map page. */
export function mapText(player) {
  const p = player.location;
  const onFloor = isOnFloor1(p);
  const lines = [onFloor ? `§fYou are on §6Floor 1§f.` : "§fYou are in the world below the tower."];
  if (onFloor) {
    lines.push(`§6${FLOOR1.name}§7 (town): ${inTown(p.x, p.z) ? "you're in town" : directionText(p, FLOOR1.center)}`);
    lines.push(`§cGuardian's Arena§7: ${directionText(p, ARENA)}, at the end of the north trail`);
    const open = (getData(player).highestFloor ?? 1) >= 2;
    lines.push(`§dStair Gate§7: in the arena's north wall, ${open ? "§aopen to you" : "§csealed until Ironhide falls"}`);
  } else {
    lines.push("§7Use Travel to reach Floor 1.");
  }
  return lines.join("\n");
}

/** No Minecraft mobs on the tower floors. */
function onEntitySpawn({ entity }) {
  try {
    if (!entity?.isValid || !entity.typeId.startsWith("minecraft:") || entity.typeId === "minecraft:player") return;
    if (!entity.matches({ families: ["mob"] })) return;
    if (isOnFloor1(entity.location)) entity.remove();
  } catch { /* entity gone */ }
}

export function registerFloor1() {
  system.runInterval(buildTick, 1);
  system.runInterval(rescueFallers, 10);
  system.runInterval(spawnTick, SPAWN.everyTicks);
  world.afterEvents.entitySpawn.subscribe(onEntitySpawn);
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.block.typeId !== "ponce:stair_gate" || ev.isFirstEvent === false) return;
    ev.cancel = true;
    const { player } = ev;
    system.run(() => player.isValid && useStairGate(player));
  });
}
