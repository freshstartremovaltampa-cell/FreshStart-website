// Floor 2 generator: the Misty Marsh. Shallow water over mud, mossy hummocks,
// mangroves, lily pads and reeds; boardwalk trails; the stilt town of
// Stiltwater; and the Hydra Pool, where the Mire Hydra guards the next gate.
// Same interface as floor1_gen.js. Pure functions only (no Minecraft API).

import { directionText, fbm, hash, smooth, valueNoise } from "./floor1_gen.js";

export { directionText };

export const FLOOR = {
  id: 2,
  name: "Stiltwater",
  title: "the Misty Marsh",
  center: { x: 10000, z: -10000 },
  base: 200, // water level
  radius: 230,
  townRadius: 40,
};

const C = FLOOR.center;
const BASE = FLOOR.base;
const TOWN_R = FLOOR.townRadius;
const DECK_R = 27;

const dist = (x, z) => Math.hypot(x - C.x, z - C.z);

function edgeAt(x, z) {
  const a = Math.atan2(z - C.z, x - C.x);
  return FLOOR.radius * (0.88 + 0.12 * valueNoise(Math.cos(a) * 60, Math.sin(a) * 60, 22, 303));
}

export const onIsland = (x, z) => dist(x, z) <= edgeAt(x, z);
export const inTown = (x, z) => dist(x, z) <= TOWN_R;

// ---------- Trails (boardwalks over water) ----------

const ROAD_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
function trailAngle(k, d) {
  const wobble = d > TOWN_R ? (valueNoise(d, k * 50, 35, 311) - 0.5) * 0.6 * Math.min(1, (d - TOWN_R) / 40) : 0;
  return ROAD_ANGLES[k] + wobble;
}

const ARENA_D = 170;
export const ARENA = (() => {
  // Continue straight on from where the north trail ends, so the trail arrives at the south entrance
  const a = trailAngle(0, ARENA_D - 17);
  return { x: C.x + Math.round(Math.cos(a) * ARENA_D), z: C.z + Math.round(Math.sin(a) * ARENA_D), y: BASE + 1, radius: 18 };
})();
export const GATE = { x: ARENA.x, y: BASE + 2, z: ARENA.z - 19 };
export const arenaDistance = (x, z) => Math.hypot(x - ARENA.x, z - ARENA.z);

function roadDistance(x, z) {
  const d = dist(x, z);
  if (d < DECK_R - 1) return 99;
  let best = 99;
  ROAD_ANGLES.forEach((_, k) => {
    const a = trailAngle(k, d);
    const along = (x - C.x) * Math.cos(a) + (z - C.z) * Math.sin(a);
    if (along <= 0) return;
    if (k === 0 && along > ARENA_D - 17) return; // ends at the Hydra Pool
    best = Math.min(best, Math.abs(-(x - C.x) * Math.sin(a) + (z - C.z) * Math.cos(a)));
  });
  return best;
}

// ---------- Terrain ----------

/** 0 = dry hummock .. 1 = open water. Town and arena surroundings are wet/flat. */
function wetness(x, z) {
  return fbm(x, z, 42, 301);
}

const LAND = 0.43;

function isLand(x, z) {
  const d = dist(x, z);
  if (d <= TOWN_R) return false;
  if (arenaDistance(x, z) <= ARENA.radius + 3) return true;
  return wetness(x, z) < LAND;
}

/** Top solid block: hummock surface on land, the mud bed under water. */
export function surfaceY(x, z) {
  const da = arenaDistance(x, z);
  if (da <= ARENA.radius + 3) return BASE + 1;
  if (isLand(x, z)) {
    const h = BASE + 1 + Math.min(2, Math.round((LAND - wetness(x, z)) * 10));
    return da < ARENA.radius + 10 ? Math.round(BASE + 1 + (h - BASE - 1) * smooth((da - ARENA.radius - 3) / 7)) : h;
  }
  return wetness(x, z) > 0.62 && dist(x, z) > TOWN_R ? BASE - 2 : BASE - 1;
}

/** True where the surface is open water (for spawning and decoration). */
export function isWater(x, z) {
  return onIsland(x, z) && !isLand(x, z) && !onDeck(x, z) && roadDistance(x, z) > 1.5;
}

function onDeck(x, z) {
  return dist(x, z) <= DECK_R;
}

function undersideY(x, z, top) {
  const inner = Math.max(0, 1 - dist(x, z) / edgeAt(x, z));
  return Math.round(top - (5 + Math.pow(inner, 1.4) * 40 * (0.65 + 0.35 * fbm(x, z, 20, 309))));
}

// ---------- Structures (town and arena), built once ----------

const OPS = [];
const P = (key, x, y, z) => OPS.push(["s", key, x, y, z]);
function box(key, x1, y1, z1, x2, y2, z2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) P(key, x, y, z);
}

const DECK = BASE + 1;

/** A stilt hut on the deck. (x, z) absolute north-west corner. */
function hut(x, z, w, d, h, { wall = "mangrove_planks", corner = "spruce_log", roof = "spruce_planks", door = "s" } = {}) {
  for (let y = 1; y <= h; y++) {
    for (let i = 0; i < w; i++) { P(wall, x + i, DECK + y, z); P(wall, x + i, DECK + y, z + d - 1); }
    for (let j = 0; j < d; j++) { P(wall, x, DECK + y, z + j); P(wall, x + w - 1, DECK + y, z + j); }
    for (const [cx, cz] of [[x, z], [x + w - 1, z], [x, z + d - 1], [x + w - 1, z + d - 1]]) P(corner, cx, DECK + y, cz);
  }
  box("air", x + 1, DECK + 1, z + 1, x + w - 2, DECK + h, z + d - 2);
  for (let i = 2; i < w - 2; i += 3) { P("glass", x + i, DECK + 2, z); P("glass", x + i, DECK + 2, z + d - 1); }
  for (let j = 2; j < d - 2; j += 3) { P("glass", x, DECK + 2, z + j); P("glass", x + w - 1, DECK + 2, z + j); }
  const mx = x + Math.floor(w / 2), mz = z + Math.floor(d / 2);
  const [dx, dz] = { n: [mx, z], s: [mx, z + d - 1], w: [x, mz], e: [x + w - 1, mz] }[door];
  P("air", dx, DECK + 1, dz); P("air", dx, DECK + 2, dz);
  for (let i = 0; ; i++) {
    const z1 = z - 1 + i, z2 = z + d - i;
    if (z1 > z2) break;
    box(roof, x - 1, DECK + h + 1 + i, z1, x + w, DECK + h + 1 + i, z1);
    box(roof, x - 1, DECK + h + 1 + i, z2, x + w, DECK + h + 1 + i, z2);
    if (z2 - z1 <= 1) break;
    for (let zz = z1 + 1; zz < z2; zz++) { P(wall, x, DECK + h + 1 + i, zz); P(wall, x + w - 1, DECK + h + 1 + i, zz); }
  }
  P("lantern", x + 1, DECK + 1, z + 1);
  return { x: mx + 0.5, y: DECK + 1, z: mz + 0.5 };
}

export const NPC_SPOTS = {};

function buildTown() {
  // The deck: planks on mangrove stilts, a railing around the edge, gaps where boardwalks arrive
  for (let x = -DECK_R; x <= DECK_R; x++) for (let z = -DECK_R; z <= DECK_R; z++) {
    const r = Math.hypot(x, z);
    if (r > DECK_R) continue;
    P(r < 5 ? "mossy_bricks" : "mangrove_planks", C.x + x, DECK, C.z + z);
    if (x % 5 === 0 && z % 5 === 0) box("mangrove_log", C.x + x, BASE - 2, C.z + z, C.x + x, DECK - 1, C.z + z);
    if (r > DECK_R - 1 && Math.abs(x) > 2 && Math.abs(z) > 2) P("fence", C.x + x, DECK + 1, C.z + z);
  }
  // Marsh fountain: a smaller twin of the one in Wayfarer's Rest
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    const r = Math.hypot(x, z);
    if (r > 2.2 && r <= 3.2) P("mossy_bricks", C.x + x, DECK + 1, C.z + z);
    else if (r <= 2.2) P("water", C.x + x, DECK, C.z + z);
  }
  box("mossy_bricks", C.x, DECK, C.z, C.x, DECK + 3, C.z);
  P("water", C.x, DECK + 4, C.z);
  for (const [x, z] of [[7, 0], [-7, 0], [0, 7], [0, -7], [18, 18], [-18, 18], [18, -18], [-18, -18]]) {
    box("fence", C.x + x, DECK + 1, C.z + z, C.x + x, DECK + 2, C.z + z);
    P("lantern", C.x + x, DECK + 3, C.z + z);
  }
  // Huts
  NPC_SPOTS["ponce:npc_warden"] = hut(C.x + 4, C.z - 20, 13, 9, 5, { door: "s" });
  const smithy = hut(C.x + 12, C.z + 6, 9, 9, 4, { wall: "cobble", door: "w" });
  P("forge", C.x + 18, DECK + 1, C.z + 8); P("furnace", C.x + 19, DECK + 1, C.z + 12); P("anvil", C.x + 15, DECK + 1, C.z + 12);
  NPC_SPOTS["ponce:npc_smith"] = { ...smithy, x: smithy.x - 1 };
  const kitchen = hut(C.x - 21, C.z - 14, 9, 9, 4, { door: "e" });
  P("pot", C.x - 17, DECK + 1, C.z - 12); P("barrel", C.x - 20, DECK + 1, C.z - 7); P("campfire", C.x - 15, DECK + 1, C.z - 13);
  NPC_SPOTS["ponce:npc_cook"] = { ...kitchen, x: kitchen.x - 1 };
  hut(C.x - 22, C.z + 6, 7, 7, 4, { door: "e" });
  hut(C.x - 12, C.z + 16, 7, 7, 4, { door: "n" });
  hut(C.x + 2, C.z + 17, 7, 7, 4, { wall: "spruce_planks", door: "n" });
  hut(C.x - 9, C.z - 24, 7, 7, 4, { wall: "spruce_planks", door: "s" });
}
buildTown();

function buildArena() {
  const A = ARENA;
  for (let x = -21; x <= 21; x++) for (let z = -21; z <= 21; z++) {
    const r = Math.hypot(x, z);
    if (r <= 18.5) {
      // Stone floor with a flooded pool in the middle, where the hydra waits
      if (r <= 7) { P("mud", A.x + x, BASE, A.z + z); P("water", A.x + x, BASE + 1, A.z + z); }
      else P(hash(A.x + x, A.z + z, 17) < 0.35 ? "mossy_bricks" : "bricks", A.x + x, BASE + 1, A.z + z);
    } else if (r <= 19.6) {
      const southGap = z > 0 && Math.abs(x) <= 2, northGate = z < 0 && Math.abs(x) <= 3;
      P("mossy_bricks", A.x + x, BASE + 1, A.z + z);
      if (!southGap && !northGate) box("mossy_bricks", A.x + x, BASE + 2, A.z + z, A.x + x, BASE + 3, A.z + z);
    }
  }
  // A short walkway from the end of the boardwalk to the south entrance
  const a = trailAngle(0, ARENA_D - 17);
  const end = { x: C.x + Math.cos(a) * (ARENA_D - 17), z: C.z + Math.sin(a) * (ARENA_D - 17) };
  for (let t = 0; t <= 1; t += 0.02) {
    const x = Math.round(end.x + (A.x - end.x) * t), z = Math.round(end.z + (A.z + 21 - end.z) * t);
    for (let dx = -1; dx <= 1; dx++) { P("packed_mud", x + dx, BASE + 1, z); P("air", x + dx, BASE + 2, z); }
  }
  for (let deg = 15; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * 19), z = Math.round(Math.sin(rad) * 19);
    box("mossy_bricks", A.x + x, BASE + 2, A.z + z, A.x + x, BASE + 5, A.z + z);
    P("lantern", A.x + x, BASE + 6, A.z + z);
  }
  // Stair Gate to Floor 3
  for (const x of [-3, 3]) box("chiseled", A.x + x, BASE + 2, GATE.z, A.x + x, BASE + 7, GATE.z);
  box("mossy_bricks", A.x - 3, BASE + 8, GATE.z, A.x + 3, BASE + 8, GATE.z);
  box("stair_gate", A.x - 2, BASE + 2, GATE.z, A.x + 2, BASE + 6, GATE.z);
  P("mossy_bricks", A.x - 2, BASE + 7, GATE.z); box("mossy_bricks", A.x - 2, BASE + 7, GATE.z, A.x + 2, BASE + 7, GATE.z);
  for (let i = 0; i < 7; i++) box("mossy_bricks", A.x - 2, BASE - 1, GATE.z - 1 - i, A.x + 2, BASE + 2 + i, GATE.z - 1 - i);
}
buildArena();

export const ARRIVAL = { x: C.x + 0.5, y: DECK + 1, z: C.z + 10.5 };

const OPS_BY_CHUNK = new Map();
for (const op of OPS) {
  const key = `${op[2] >> 4},${op[4] >> 4}`;
  if (!OPS_BY_CHUNK.has(key)) OPS_BY_CHUNK.set(key, []);
  OPS_BY_CHUNK.get(key).push(op);
}

// ---------- Trees: mangroves with arching roots, and dead snags ----------

const CELL = 6;

function treeInCell(gx, gz) {
  const x = gx * CELL + Math.floor(hash(gx, gz, 331) * CELL);
  const z = gz * CELL + Math.floor(hash(gx, gz, 337) * CELL);
  const d = dist(x, z);
  if (d < TOWN_R + 4 || d > edgeAt(x, z) - 5 || roadDistance(x, z) < 3.5 || arenaDistance(x, z) < ARENA.radius + 8) return undefined;
  const land = isLand(x, z);
  if (hash(gx, gz, 347) > (land ? 0.7 : 0.22)) return undefined;
  const kind = hash(gx, gz, 349) < 0.15 ? "snag" : "mangrove";
  return { x, z, kind, height: kind === "snag" ? 3 + Math.floor(hash(gx, gz, 353) * 3) : 5 + Math.floor(hash(gx, gz, 353) * 3) };
}

function treeOps(t, out) {
  const ground = surfaceY(t.x, t.z);
  const lift = isLand(t.x, t.z) ? 1 : 2; // in water the trunk starts above the surface, on roots
  const y0 = Math.max(ground + 1, BASE + lift);
  const top = y0 + t.height - 1;
  if (t.kind === "mangrove") {
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      if (hash(t.x + dx, t.z + dz, 359) < 0.35) continue;
      out.push(["f", "mangrove_roots", t.x + dx, surfaceY(t.x + dx, t.z + dz) + 1, y0, t.z + dz]);
    }
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 1 ? 2 : 3;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1 || hash(t.x + dx, t.z + dz, 361 + dy) < 0.12) continue;
        out.push(["s", "mangrove_leaves", t.x + dx, top + dy, t.z + dz]);
      }
    }
    for (const [dx, dz] of [[2, 1], [-2, -1], [1, -2]]) { // hanging leaves
      out.push(["f", "mangrove_leaves", t.x + dx, top - 3, top - 2, t.z + dz]);
    }
    out.push(["f", "mangrove_log", t.x, ground + 1, top, t.z]);
  } else {
    out.push(["f", "mangrove_log", t.x, ground + 1, top, t.z]);
    out.push(["s", "mangrove_log", t.x + 1, top - 1, t.z]);
  }
}

// ---------- Chunks ----------

export function chunkHasIsland(cx, cz) {
  return Math.hypot(cx * 16 + 8 - C.x, cz * 16 + 8 - C.z) < FLOOR.radius + 16;
}

export function chunkOps(cx, cz) {
  const ops = [];
  const x0 = cx * 16, z0 = cz * 16;
  for (let x = x0; x < x0 + 16; x++) for (let z = z0; z < z0 + 16; z++) {
    if (!onIsland(x, z)) continue;
    const top = surfaceY(x, z);
    const bottom = undersideY(x, z, top);
    const d = dist(x, z), edge = edgeAt(x, z);
    ops.push(["f", "stone", x, bottom, top - 3, z]);
    ops.push(["f", isLand(x, z) ? "dirt" : "mud", x, top - 2, top - 1, z]);
    const road = roadDistance(x, z);
    if (edge - d < 2) { ops.push(["s", "mossy", x, top, z]); if (!isLand(x, z)) ops.push(["f", "mossy", x, top + 1, BASE, z]); continue; }
    if (isLand(x, z)) {
      ops.push(["s", road < 1.6 ? "packed_mud" : hash(x, z, 371) < 0.3 ? "moss" : "grass", x, top, z]);
      if (road >= 2.5 && arenaDistance(x, z) > ARENA.radius + 3) {
        const r = hash(x, z, 373);
        const nearWater = wetness(x, z) > LAND - 0.03;
        if (nearWater && r < 0.25) ops.push(["f", "reeds", x, top + 1, top + 2, z]);
        else if (r < 0.2) ops.push(["s", "short_grass", x, top + 1, z]);
        else if (r < 0.28) ops.push(["s", "moss_carpet", x, top + 1, z]);
        else if (r < 0.3) ops.push(["s", "blue_orchid", x, top + 1, z]);
      }
    } else {
      ops.push(["s", "mud", x, top, z]);
      ops.push(["f", "water", x, top + 1, BASE, z]);
      if (road < 1.6) ops.push(["s", "mangrove_planks", x, BASE + 1, z]); // boardwalk
      else if (road < 2.6 && Math.round(x + z) % 4 === 0) ops.push(["f", "fence", x, top + 1, BASE + 2, z]); // railing posts
      else if (!onDeck(x, z) && hash(x, z, 379) < 0.1) ops.push(["s", "lily", x, BASE + 1, z]);
    }
  }
  for (const op of OPS_BY_CHUNK.get(`${cx},${cz}`) ?? []) ops.push(op);
  const inChunk = (op) => (op[2] >> 4) === cx && (op[op[0] === "f" ? 5 : 4] >> 4) === cz;
  const features = [];
  for (let gx = Math.floor((x0 - 4) / CELL); gx <= Math.floor((x0 + 19) / CELL); gx++)
    for (let gz = Math.floor((z0 - 4) / CELL); gz <= Math.floor((z0 + 19) / CELL); gz++) {
      const t = treeInCell(gx, gz);
      if (t) treeOps(t, features);
    }
  for (const op of features) if (inChunk(op)) ops.push(op);
  return ops;
}

export const CHUNK_BOUNDS = {
  min: { x: (C.x - FLOOR.radius - 16) >> 4, z: (C.z - FLOOR.radius - 16) >> 4 },
  max: { x: (C.x + FLOOR.radius + 16) >> 4, z: (C.z + FLOOR.radius + 16) >> 4 },
};

export function isOnFloor(loc) {
  return onIsland(Math.floor(loc.x), Math.floor(loc.z)) && loc.y > BASE - 60 && loc.y < BASE + 60;
}
