// Floor 1 generator: a floating island with the town of Wayfarer's Rest in the
// middle and a vast forest around it. Pure functions only (no Minecraft API),
// so the same code runs in the game, in tests and in the preview renderer.
//
// The island is built chunk by chunk. chunkOps(cx, cz) returns every block
// operation inside that 16x16 chunk, so chunks can be built in any order:
//   ["f", key, x, y1, y2, z]   fill a column from y1 to y2
//   ["s", key, x, y, z]        set one block
// `key` is a symbolic block name; floor1.js maps it to a real block id.

export const FLOOR1 = {
  name: "Wayfarer's Rest",
  center: { x: 10000, z: 10000 },
  base: 200, // surface height in town
  radius: 250, // island radius (the coastline wobbles a little inside this)
  townRadius: 46,
};

const C = FLOOR1.center;
const BASE = FLOOR1.base;
const TOWN_R = FLOOR1.townRadius;

// ---------- Noise ----------

export function hash(x, z, seed = 0) {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, z, scale, seed) {
  const fx = x / scale, fz = z / scale;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = smooth(fx - x0), tz = smooth(fz - z0);
  const a = hash(x0, z0, seed), b = hash(x0 + 1, z0, seed);
  const c = hash(x0, z0 + 1, seed), d = hash(x0 + 1, z0 + 1, seed);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz; // 0..1
}

export function fbm(x, z, scale, seed) {
  return (valueNoise(x, z, scale, seed) * 0.6 + valueNoise(x, z, scale / 2, seed + 7) * 0.3 + valueNoise(x, z, scale / 4, seed + 13) * 0.1);
}

// ---------- Terrain ----------

const dist = (x, z) => Math.hypot(x - C.x, z - C.z);

/** Island edge distance in the direction of (x, z). */
function edgeAt(x, z) {
  const a = Math.atan2(z - C.z, x - C.x);
  const wobble = valueNoise(Math.cos(a) * 60, Math.sin(a) * 60, 25, 3);
  return FLOOR1.radius * (0.9 + 0.1 * wobble);
}

export function onIsland(x, z) {
  return dist(x, z) <= edgeAt(x, z);
}

export function inTown(x, z) {
  return dist(x, z) <= TOWN_R;
}

const ROAD_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // N, E, S, W

/** Direction of trail k (0 N, 1 E, 2 S, 3 W) at distance d from the center: it winds outside town. */
function trailAngle(k, d) {
  const wobble = d > TOWN_R ? (valueNoise(d, k * 50, 40, 11) - 0.5) * 0.5 * Math.min(1, (d - TOWN_R) / 40) : 0;
  return ROAD_ANGLES[k] + wobble;
}

// ---------- Guardian's Arena: where the north trail ends ----------

const ARENA_D = 185;
export const ARENA = (() => {
  // Continue straight on from where the north trail ends, so the trail arrives at the south entrance
  const a = trailAngle(0, ARENA_D - 14);
  return { x: C.x + Math.round(Math.cos(a) * ARENA_D), z: C.z + Math.round(Math.sin(a) * ARENA_D), y: BASE, radius: 16 };
})();
/** The Stair Gate sits in the arena's north wall. */
export const GATE = { x: ARENA.x, y: BASE + 1, z: ARENA.z - 17 };
export const arenaDistance = (x, z) => Math.hypot(x - ARENA.x, z - ARENA.z);

/** Distance from (x, z) to the nearest trail, which leaves town through a gate and winds outward. */
function roadDistance(x, z) {
  const d = dist(x, z);
  if (d < 11) return 99;
  let best = 99;
  ROAD_ANGLES.forEach((base, k) => {
    const a = trailAngle(k, d);
    const along = (x - C.x) * Math.cos(a) + (z - C.z) * Math.sin(a);
    if (along <= 0) return;
    if (k === 0 && along > ARENA_D - 14) return; // the north trail ends at the arena
    const side = Math.abs(-(x - C.x) * Math.sin(a) + (z - C.z) * Math.cos(a));
    best = Math.min(best, side);
  });
  return best;
}

function isPond(x, z) {
  if (arenaDistance(x, z) < 30) return false;
  const d = dist(x, z);
  if (d < TOWN_R + 25 || d > edgeAt(x, z) - 12 || roadDistance(x, z) < 4) return false;
  return valueNoise(x, z, 22, 21) > 0.86;
}

/** Surface height at (x, z): flat in town, gentle hills in the forest, dips for ponds. */
export function surfaceY(x, z) {
  const d = dist(x, z);
  if (d <= TOWN_R) return BASE;
  const t = Math.min(1, (d - TOWN_R) / 25);
  const hill = (fbm(x, z, 48, 5) - 0.45) * 8 * smooth(t);
  let y = BASE + Math.round(hill);
  if (roadDistance(x, z) < 2.5) y = BASE + Math.round(hill * 0.5);
  if (isPond(x, z)) y -= 2; // a pond bed two below the land around it; the water sits one below the land
  const da = arenaDistance(x, z);
  if (da <= 20) return BASE; // the arena is flat
  if (da < 30) return Math.round(BASE + (y - BASE) * smooth((da - 20) / 10));
  return y;
}

function undersideY(x, z, top) {
  const d = dist(x, z), edge = edgeAt(x, z);
  const inner = Math.max(0, 1 - d / edge);
  const thick = 5 + Math.pow(inner, 1.4) * 42 * (0.65 + 0.35 * fbm(x, z, 20, 9));
  return Math.round(top - thick);
}

// ---------- Town ----------

const TOWN = []; // [type, x, y, z] relative ops, built once

function put(key, x, y, z) { TOWN.push(["s", key, C.x + x, BASE + y, C.z + z]); }

function box(key, x1, y1, z1, x2, y2, z2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) put(key, x, y, z);
}

/**
 * A simple house: stone foundation, plank walls with log corners, windows, a
 * doorway, a stepped gable roof and a lantern. (x, z) is the north-west corner.
 * door: "n" | "s" | "e" | "w"
 */
function building(x, z, w, d, h, { wall = "oak_planks", corner = "oak_log", roof = "spruce_planks", door = "s", floor = "oak_planks" } = {}) {
  box("cobble", x, 0, z, x + w - 1, 0, z + d - 1);
  box(floor, x + 1, 0, z + 1, x + w - 2, 0, z + d - 2);
  for (let y = 1; y <= h; y++) {
    for (let i = 0; i < w; i++) { put(wall, x + i, y, z); put(wall, x + i, y, z + d - 1); }
    for (let j = 0; j < d; j++) { put(wall, x, y, z + j); put(wall, x + w - 1, y, z + j); }
    for (const [cx, cz] of [[x, z], [x + w - 1, z], [x, z + d - 1], [x + w - 1, z + d - 1]]) put(corner, cx, y, cz);
  }
  box("air", x + 1, 1, z + 1, x + w - 2, h, z + d - 2);
  // windows on every wall, every third block
  for (let i = 2; i < w - 2; i += 3) { put("glass", x + i, 2, z); put("glass", x + i, 2, z + d - 1); }
  for (let j = 2; j < d - 2; j += 3) { put("glass", x, 2, z + j); put("glass", x + w - 1, 2, z + j); }
  // doorway (2 tall) and a lantern post beside it
  const mx = x + Math.floor(w / 2), mz = z + Math.floor(d / 2);
  const doorAt = { n: [mx, z, 0, -1], s: [mx, z + d - 1, 0, 1], w: [x, mz, -1, 0], e: [x + w - 1, mz, 1, 0] }[door];
  put("air", doorAt[0], 1, doorAt[1]); put("air", doorAt[0], 2, doorAt[1]);
  put("path", doorAt[0] + doorAt[2], 0, doorAt[1] + doorAt[3]);
  put("fence", doorAt[0] + doorAt[2] * 2 + (doorAt[3] ? 2 : 0), 1, doorAt[1] + doorAt[3] * 2 + (doorAt[2] ? 2 : 0));
  put("lantern", doorAt[0] + doorAt[2] * 2 + (doorAt[3] ? 2 : 0), 2, doorAt[1] + doorAt[3] * 2 + (doorAt[2] ? 2 : 0));
  // stepped gable roof running east-west, with a 1-block overhang
  for (let i = 0; ; i++) {
    const z1 = z - 1 + i, z2 = z + d - i;
    if (z1 > z2) break;
    box(roof, x - 1, h + 1 + i, z1, x + w, h + 1 + i, z1);
    box(roof, x - 1, h + 1 + i, z2, x + w, h + 1 + i, z2);
    if (z2 - z1 <= 1) break;
    // gable ends
    for (let zz = z1 + 1; zz < z2; zz++) { put(wall, x, h + 1 + i, zz); put(wall, x + w - 1, h + 1 + i, zz); }
  }
  put("lantern", x + 1, 1, z + 1); // light inside, in a corner (the middle is where NPCs stand)
  return { door: { x: doorAt[0] + doorAt[2], z: doorAt[1] + doorAt[3] }, inside: { x: mx, z: mz } };
}

function marketStall(x, z, wool) {
  for (const [dx, dz] of [[0, 0], [3, 0], [0, 2], [3, 2]]) box("fence", x + dx, 1, z + dz, x + dx, 2, z + dz);
  box(wool, x, 3, z, x + 3, 3, z + 2);
  box("barrel", x + 1, 1, z, x + 2, 1, z);
}

function lanternPost(x, z) {
  box("fence", x, 1, z, x, 3, z);
  put("lantern", x, 4, z);
}

// NPC spots (relative to the center), filled in by the town builder
export const NPC_SPOTS = {};

function buildTown() {
  // Plaza: stone bricks with a cobble ring
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
    const r = Math.hypot(x, z);
    if (r <= 11) put(r > 10 ? "cobble" : (x + z) % 5 === 0 ? "mossy" : "bricks", x, 0, z);
  }
  // Fountain of Youth: basin, pillar, water spilling from the top
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    const r = Math.hypot(x, z);
    if (r > 3.2 && r <= 4.2) { put("bricks", x, 1, z); put("bricks", x, 0, z); }
    else if (r <= 3.2) { put("water", x, 0, z); put("bricks", x, -1, z); }
  }
  box("chiseled", 0, 0, 0, 0, 4, 0);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put("bricks", dx, 4, dz);
  put("water", 0, 5, 0);
  for (const [dx, dz] of [[9, 0], [-9, 0], [0, 9], [0, -9], [6, 6], [-6, 6], [6, -6], [-6, -6]]) lanternPost(dx, dz);

  // Streets inside town
  for (let r = 12; r <= TOWN_R; r++) for (const [ax, az] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    for (let s = -1; s <= 1; s++) put("path", ax * r + (az !== 0 ? s : 0), 0, az * r + (ax !== 0 ? s : 0));
  }

  // Guild Hall (north-east): Marla
  const guild = building(8, -30, 15, 11, 6, { wall: "spruce_planks", corner: "spruce_log", roof: "oak_planks", door: "w", floor: "spruce_planks" });
  box("bookshelf", 21, 1, -29, 21, 3, -26);
  box("red_wool", 12, 1, -26, 18, 1, -26);
  NPC_SPOTS["ponce:npc_guild"] = guild.inside;

  // Smithy (south-east): Bram, with a working forge
  const smithy = building(10, 12, 11, 9, 5, { wall: "cobble", corner: "spruce_log", roof: "spruce_planks", door: "w", floor: "cobble" });
  put("forge", 17, 1, 15); put("furnace", 18, 1, 13); put("furnace", 19, 1, 13); put("anvil", 15, 1, 18); put("chest", 19, 1, 18);
  NPC_SPOTS["ponce:npc_smith"] = { x: 15, z: 15 };

  // Kitchen (north-west): Pip, with a cooking pot
  const kitchen = building(-22, -24, 11, 11, 5, { wall: "birch_planks", corner: "oak_log", roof: "spruce_planks", door: "e", floor: "oak_planks" });
  put("pot", -18, 1, -21); put("campfire", -16, 1, -22); put("barrel", -21, 1, -15); put("barrel", -21, 1, -16); put("hay", -21, 1, -23);
  NPC_SPOTS["ponce:npc_cook"] = kitchen.inside;

  // Houses (south-west and around)
  building(-24, 10, 8, 7, 4, { wall: "oak_planks", door: "e" });
  building(-24, 22, 8, 7, 4, { wall: "spruce_planks", corner: "spruce_log", door: "e" });
  building(-12, 28, 7, 7, 4, { wall: "birch_planks", door: "n" });
  building(24, -10, 7, 7, 4, { wall: "oak_planks", door: "w" });
  building(-32, -10, 7, 7, 4, { wall: "spruce_planks", corner: "spruce_log", door: "e" });
  building(22, 26, 7, 7, 4, { wall: "birch_planks", door: "n" });

  // Market stalls around the plaza
  marketStall(-9, 14, "red_wool");
  marketStall(5, -17, "blue_wool");
  marketStall(-17, 4, "yellow_wool");

  // Gardens: a few trees inside the walls and flowers ringing the plaza
  for (const [dx, dz, kind, h] of [[30, 10, "oak", 5], [-8, -36, "birch", 7], [36, -18, "oak", 6], [-38, 14, "birch", 6], [12, 36, "oak", 5], [-30, -30, "spruce", 9], [32, -32, "spruce", 8]]) {
    treeOps({ x: C.x + dx, z: C.z + dz, kind, height: h }, TOWN);
  }
  const FLOWERS = ["poppy", "dandelion", "cornflower", "oxeye_daisy", "azure_bluet"];
  for (let a = 0; a < 360; a += 6) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * 13), z = Math.round(Math.sin(rad) * 13);
    if (Math.abs(x) <= 2 || Math.abs(z) <= 2) continue;
    put(FLOWERS[(a / 6) % FLOWERS.length], x, 1, z);
  }

  // Log palisade with gates where the streets leave town
  for (let a = 0; a < 360; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * TOWN_R), z = Math.round(Math.sin(rad) * TOWN_R);
    if (Math.abs(x) <= 2 || Math.abs(z) <= 2) continue; // gates
    box("spruce_log", x, 1, z, x, 3, z);
  }
  for (const [x, z] of [[3, -TOWN_R], [-3, -TOWN_R], [3, TOWN_R], [-3, TOWN_R], [TOWN_R, 3], [TOWN_R, -3], [-TOWN_R, 3], [-TOWN_R, -3]]) {
    box("spruce_log", x, 1, z, x, 4, z);
    put("lantern", x, 5, z);
  }
}
buildTown();

function buildArena() {
  const A = ARENA;
  const P = (key, x, y, z) => TOWN.push(["s", key, A.x + x, BASE + y, A.z + z]);
  // Floor: stone bricks, a chiseled dais in the middle, a mossy ring around it
  for (let x = -18; x <= 18; x++) for (let z = -18; z <= 18; z++) {
    const r = Math.hypot(x, z);
    if (r <= 16.5) {
      const key = r < 3.5 ? "chiseled" : r < 4.5 ? "mossy" : hash(A.x + x, A.z + z, 7) < 0.15 ? "mossy" : "bricks";
      P(key, x, 0, z);
    } else if (r <= 17.6) {
      const southGap = z > 0 && Math.abs(x) <= 2;
      const northGate = z < 0 && Math.abs(x) <= 3;
      P("bricks", x, 0, z);
      if (!southGap && !northGate) { P("bricks", x, 1, z); P("bricks", x, 2, z); }
    }
  }
  // Pillars with lanterns around the ring (not over the entrances)
  for (let deg = 0; deg < 360; deg += 30) {
    if (deg === 90 || deg === 270) continue;
    const rad = (deg * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * 17), z = Math.round(Math.sin(rad) * 17);
    for (let y = 1; y <= 4; y++) P("chiseled", x, y, z);
    P("lantern", x, 5, z);
  }
  // South entrance, joined to wherever the trail ends by a short straight path
  for (let z = 16; z <= 21; z++) for (let x = -1; x <= 1; x++) P("path", x, 0, z);
  const a = trailAngle(0, ARENA_D - 14);
  const end = { x: C.x + Math.cos(a) * (ARENA_D - 14), z: C.z + Math.sin(a) * (ARENA_D - 14) };
  for (let t = 0; t <= 1; t += 0.02) {
    const x = Math.round(end.x + (A.x - end.x) * t) - A.x, z = Math.round(end.z + (A.z + 21 - end.z) * t) - A.z;
    for (let dx = -1; dx <= 1; dx++) P("path", x + dx, 0, z);
  }
  // Stair Gate in the north wall: an archway filled with the gate
  for (const x of [-3, 3]) for (let y = 1; y <= 6; y++) P("chiseled", x, y, -17);
  for (let x = -3; x <= 3; x++) P("bricks", x, 7, -17);
  P("lantern", -3, 7, -18); P("lantern", 3, 7, -18);
  for (let x = -2; x <= 2; x++) for (let y = 1; y <= 6; y++) P(y <= 5 ? "stair_gate" : "bricks", x, y, -17);
  // Beyond the gate, a stone stairway climbs toward the next floor
  for (let i = 0; i < 7; i++) for (let x = -2; x <= 2; x++) for (let y = 0; y <= 1 + i; y++) P("bricks", x, y, -18 - i);
}
buildArena();

// Absolute NPC spots and arrival point
for (const k of Object.keys(NPC_SPOTS)) NPC_SPOTS[k] = { x: C.x + NPC_SPOTS[k].x + 0.5, y: BASE + 1, z: C.z + NPC_SPOTS[k].z + 0.5 };
export const ARRIVAL = { x: C.x + 0.5, y: BASE + 1, z: C.z + 7.5 };

const TOWN_BY_CHUNK = new Map();
for (const op of TOWN) {
  const key = `${op[2] >> 4},${op[4] >> 4}`;
  if (!TOWN_BY_CHUNK.has(key)) TOWN_BY_CHUNK.set(key, []);
  TOWN_BY_CHUNK.get(key).push(op);
}

// ---------- Forest ----------

const TREE_CELL = 5;

/** The tree rooted in this cell, if any: { x, z, kind, height } */
function treeInCell(gx, gz) {
  const x = gx * TREE_CELL + Math.floor(hash(gx, gz, 31) * TREE_CELL);
  const z = gz * TREE_CELL + Math.floor(hash(gx, gz, 37) * TREE_CELL);
  const d = dist(x, z);
  if (d < TOWN_R + 5 || d > edgeAt(x, z) - 4 || arenaDistance(x, z) < 25) return undefined;
  if (roadDistance(x, z) < 3.5 || isPond(x, z) || boulderAt(x, z)) return undefined;
  const density = fbm(x, z, 60, 41); // low = meadow clearing, high = deep forest
  if (hash(gx, gz, 43) > density * 1.25 - 0.1) return undefined;
  const pick = hash(gx, gz, 47) + (z < C.z ? 0.15 : -0.1); // more spruce to the north
  const kind = pick < 0.45 ? "oak" : pick < 0.75 ? "birch" : "spruce";
  const height = kind === "spruce" ? 8 + Math.floor(hash(gx, gz, 53) * 4) : kind === "birch" ? 6 + Math.floor(hash(gx, gz, 53) * 3) : 5 + Math.floor(hash(gx, gz, 53) * 2);
  return { x, z, kind, height };
}

function treeOps(t, out) {
  const y0 = surfaceY(t.x, t.z) + 1;
  const log = `${t.kind}_log`, leaves = `${t.kind}_leaves`;
  const top = y0 + t.height - 1;
  if (t.kind === "spruce") {
    for (let y = y0 + 2; y <= top + 1; y++) {
      const fromTop = top + 1 - y;
      const r = fromTop === 0 ? 0 : Math.min(3, 1 + Math.floor(fromTop / 2)) - (fromTop % 2 === 1 ? 0 : 1);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        out.push(["s", leaves, t.x + dx, y, t.z + dz]);
      }
    }
  } else {
    const layers = t.kind === "birch" ? [[-2, 2], [-1, 2], [0, 1], [1, 1]] : [[-2, 2], [-1, 2], [0, 1], [1, 1]];
    for (const [dy, r] of layers) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (r === 1 && dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        out.push(["s", leaves, t.x + dx, top + dy, t.z + dz]);
      }
    }
  }
  out.push(["f", log, t.x, y0, top, t.z]); // trunk last so it replaces leaves
}

// Mossy boulders with ore nodes, roughly one per 28x28 area of forest
const BOULDER_CELL = 28;

function boulderInCell(bx, bz) {
  if (hash(bx, bz, 61) > 0.55) return undefined;
  const x = bx * BOULDER_CELL + 4 + Math.floor(hash(bx, bz, 67) * (BOULDER_CELL - 8));
  const z = bz * BOULDER_CELL + 4 + Math.floor(hash(bx, bz, 71) * (BOULDER_CELL - 8));
  const d = dist(x, z);
  if (d < TOWN_R + 12 || d > edgeAt(x, z) - 8 || roadDistance(x, z) < 5 || isPond(x, z) || arenaDistance(x, z) < 30) return undefined;
  const roll = hash(bx, bz, 73);
  const ore = roll < 0.55 ? "ember_copper_node" : roll < 0.88 ? "ironheart_node" : "glimmer_silver_node";
  return { x, z, ore, count: 1 + Math.floor(hash(bx, bz, 79) * 3) };
}

function boulderAt(x, z) {
  const b = boulderInCell(Math.floor(x / BOULDER_CELL), Math.floor(z / BOULDER_CELL));
  return !!b && Math.hypot(x - b.x, z - b.z) <= 3;
}

function boulderOps(b, out) {
  const y0 = surfaceY(b.x, b.z);
  const spots = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 1; dy <= 3; dy++) {
    const r = Math.hypot(dx, dz * 1.1, (dy - 1) * 1.3);
    if (r > 2.6) continue;
    const key = hash(b.x + dx, b.z + dz, 83 + dy) < 0.35 ? "mossy" : "stone";
    out.push(["s", key, b.x + dx, y0 + dy, b.z + dz]);
    if (dy >= 2 && r > 1.4) spots.push([b.x + dx, y0 + dy, b.z + dz]);
  }
  for (let i = 0; i < b.count && spots.length; i++) {
    const [x, y, z] = spots.splice(Math.floor(hash(b.x, b.z, 89 + i) * spots.length), 1)[0];
    out.push(["s", b.ore, x, y, z]);
  }
}

// ---------- Chunks ----------

export function chunkHasIsland(cx, cz) {
  const x0 = cx * 16, z0 = cz * 16;
  for (const [x, z] of [[x0, z0], [x0 + 15, z0], [x0, z0 + 15], [x0 + 15, z0 + 15], [x0 + 8, z0 + 8]]) if (onIsland(x, z)) return true;
  return dist(x0 + 8, z0 + 8) < FLOOR1.radius + 16;
}

/** Every block operation inside chunk (cx, cz), terrain first, then features. */
export function chunkOps(cx, cz) {
  const ops = [];
  const x0 = cx * 16, z0 = cz * 16;
  for (let x = x0; x < x0 + 16; x++) for (let z = z0; z < z0 + 16; z++) {
    if (!onIsland(x, z)) continue;
    const top = surfaceY(x, z);
    const bottom = undersideY(x, z, top);
    ops.push(["f", "stone", x, bottom, top - 4, z]);
    ops.push(["f", "dirt", x, top - 3, top - 1, z]);
    const d = dist(x, z);
    const road = roadDistance(x, z);
    const pond = isPond(x, z);
    if (pond) {
      ops.push(["s", "dirt", x, top, z]);
      ops.push(["s", "water", x, top + 1, z]);
      continue;
    }
    const edge = edgeAt(x, z);
    let surface = "grass";
    if (road < 1.6 && d > TOWN_R) surface = hash(x, z, 91) < 0.6 ? "coarse" : "path";
    if (edge - d < 2) surface = hash(x, z, 93) < 0.5 ? "stone" : "mossy";
    ops.push(["s", surface, x, top, z]);
    // ground cover in the forest
    if (surface === "grass" && d > TOWN_R + 2 && road > 2.5 && arenaDistance(x, z) > 20) {
      const r = hash(x, z, 97);
      const meadow = fbm(x, z, 60, 41) < 0.45;
      if (meadow && r < 0.06) ops.push(["s", ["poppy", "dandelion", "cornflower", "oxeye_daisy", "azure_bluet"][Math.floor(hash(x, z, 101) * 5)], x, top + 1, z]);
      else if (r < 0.22) ops.push(["s", z < C.z && r < 0.08 ? "fern" : "short_grass", x, top + 1, z]);
    }
  }
  // Town pieces in this chunk
  for (const op of TOWN_BY_CHUNK.get(`${cx},${cz}`) ?? []) ops.push(op);

  const inChunk = (op) => (op[2] >> 4) === cx && (op[op[0] === "f" ? 5 : 4] >> 4) === cz;
  const features = [];
  // Boulders (radius 3) and trees (radius 3) rooted near this chunk can spill into it
  for (let bx = Math.floor((x0 - 4) / BOULDER_CELL); bx <= Math.floor((x0 + 19) / BOULDER_CELL); bx++)
    for (let bz = Math.floor((z0 - 4) / BOULDER_CELL); bz <= Math.floor((z0 + 19) / BOULDER_CELL); bz++) {
      const b = boulderInCell(bx, bz);
      if (b) boulderOps(b, features);
    }
  for (let gx = Math.floor((x0 - 4) / TREE_CELL); gx <= Math.floor((x0 + 19) / TREE_CELL); gx++)
    for (let gz = Math.floor((z0 - 4) / TREE_CELL); gz <= Math.floor((z0 + 19) / TREE_CELL); gz++) {
      const t = treeInCell(gx, gz);
      if (t) treeOps(t, features);
    }
  for (const op of features) if (inChunk(op)) ops.push(op);
  return ops;
}

/** Chunk range that covers the island. */
export const CHUNK_BOUNDS = {
  min: { x: (C.x - FLOOR1.radius - 16) >> 4, z: (C.z - FLOOR1.radius - 16) >> 4 },
  max: { x: (C.x + FLOOR1.radius + 16) >> 4, z: (C.z + FLOOR1.radius + 16) >> 4 },
};

const COMPASS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];

/** "210 blocks north-west" (north is -z). */
export function directionText(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const d = Math.round(Math.hypot(dx, dz));
  if (d < 8) return "right here";
  const i = ((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  return `${d} blocks ${COMPASS[i]}`;
}

/** True if a location is on (or just above/below) Floor 1. */
export function isOnFloor(loc) {
  return isOnFloor1(loc);
}

/** Common floor interface (each floor module exports the same names). */
export const FLOOR = { ...FLOOR1, id: 1 };

export function isOnFloor1(loc) {
  return onIsland(Math.floor(loc.x), Math.floor(loc.z)) && loc.y > BASE - 60 && loc.y < BASE + 60;
}
