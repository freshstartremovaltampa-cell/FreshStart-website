// Floor 4 generator: the Frozen Peaks. Snow-capped ridges rising toward the
// rim, spruce forests in the valleys, frozen tarns, an old watchtower; the
// sheltered valley town of Frosthollow; and the Frozen Cirque, a bowl of ice
// ringed with braziers, where Rimegrasp the Frost Giant guards the next gate.
// Same interface as the other floor modules. Pure code.

import { directionText, fbm, hash, smooth, valueNoise } from "./floor1_gen.js";

export { directionText };

export const FLOOR = {
  id: 4,
  name: "Frosthollow",
  title: "the Frozen Peaks",
  center: { x: -10000, z: -10000 },
  base: 200,
  radius: 240,
  townRadius: 38,
};

const C = FLOOR.center;
const BASE = FLOOR.base;
const TOWN_R = FLOOR.townRadius;
const TOWN_Y = BASE + 6; // the town sits in a sheltered valley
const TARN = BASE + 2; // frozen lakes
const SNOWLINE = BASE + 22; // above this, bare snow and ice

const dist = (x, z) => Math.hypot(x - C.x, z - C.z);

function edgeAt(x, z) {
  const a = Math.atan2(z - C.z, x - C.x);
  return FLOOR.radius * (0.88 + 0.12 * valueNoise(Math.cos(a) * 60, Math.sin(a) * 60, 24, 503));
}

export const onIsland = (x, z) => dist(x, z) <= edgeAt(x, z);
export const inTown = (x, z) => dist(x, z) <= TOWN_R;

// ---------- Trails (they follow the valleys) ----------

const ROAD_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
function trailAngle(k, d) {
  const wobble = d > TOWN_R ? (valueNoise(d, k * 50, 45, 511) - 0.5) * 0.45 * Math.min(1, (d - TOWN_R) / 40) : 0;
  return ROAD_ANGLES[k] + wobble;
}

const ARENA_D = 175;
export const ARENA = (() => {
  const a = trailAngle(0, ARENA_D - 22);
  return { x: C.x + Math.round(Math.cos(a) * ARENA_D), z: C.z + Math.round(Math.sin(a) * ARENA_D), y: BASE + 8, radius: 21 };
})();
export const GATE = { x: ARENA.x, y: ARENA.y + 1, z: ARENA.z - 23 };
export const arenaDistance = (x, z) => Math.hypot(x - ARENA.x, z - ARENA.z);

/** The four braziers in the Cirque (the campfire block positions). Warmth against the giant's chill. */
export const BRAZIERS = [45, 135, 225, 315].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: ARENA.x + Math.round(Math.cos(a) * 13), y: ARENA.y + 2, z: ARENA.z + Math.round(Math.sin(a) * 13) };
});

/** A point along trail k (0 north, 1 east, 2 south, 3 west), d blocks from the town centre. */
export function trailPoint(k, d) {
  const a = trailAngle(k, d);
  return { x: Math.round(C.x + Math.cos(a) * d), z: Math.round(C.z + Math.sin(a) * d) };
}

function roadDistance(x, z) {
  const d = dist(x, z);
  if (d < 12) return 99;
  let best = 99;
  ROAD_ANGLES.forEach((_, k) => {
    const a = trailAngle(k, d);
    const along = (x - C.x) * Math.cos(a) + (z - C.z) * Math.sin(a);
    if (along <= 0) return;
    if (k === 0 && along > ARENA_D - 22) return; // ends at the Frozen Cirque
    best = Math.min(best, Math.abs(-(x - C.x) * Math.sin(a) + (z - C.z) * Math.cos(a)));
  });
  return best;
}

// ---------- Landmarks ----------

export const WATCHTOWER = (() => {
  const a = 2.3, d = 110;
  return { x: C.x + Math.round(Math.cos(a) * d), z: C.z + Math.round(Math.sin(a) * d) };
})();
const towerDistance = (x, z) => Math.hypot(x - WATCHTOWER.x, z - WATCHTOWER.z);

/** Landmarks shown on the map page. */
export const LANDMARKS = [{ name: "Old Watchtower", x: WATCHTOWER.x, z: WATCHTOWER.z }];

// ---------- Terrain ----------

/** Natural height, before flattening for the town, arena and landmarks. */
function rawHeight(x, z) {
  const d = dist(x, z);
  const rolling = (fbm(x, z, 60, 501) - 0.45) * 14;
  const n = fbm(x, z, 90, 507);
  const ridge = Math.pow(1 - Math.abs(2 * n - 1), 2.2); // sharp ridgelines
  const rise = smooth(Math.min(1, Math.max(0, (d - 55) / 120))); // peaks grow toward the rim
  const valley = smooth(Math.min(1, Math.max(0, (roadDistance(x, z) - 5) / 22))); // the trails run along valley floors
  const basin = Math.max(0, fbm(x, z, 40, 513) - 0.55) * 80 * smooth(Math.min(1, Math.max(0, (d - 60) / 30))); // frozen tarns
  let h = BASE + 6 + Math.round(rolling + ridge * 58 * rise * valley - basin);
  const edge = edgeAt(x, z);
  if (edge - d < 4) h = Math.max(h, TARN + 1); // a rim so tarns never spill off the edge
  return h;
}

let towerY;
export function surfaceY(x, z) {
  const d = dist(x, z);
  if (d <= TOWN_R + 2) return TOWN_Y;
  towerY ??= Math.max(TARN + 1, Math.min(BASE + 20, rawHeight(WATCHTOWER.x, WATCHTOWER.z)));
  const dt = towerDistance(x, z);
  if (dt <= 5) return towerY;
  let h = rawHeight(x, z);
  if (dt < 14) h = Math.round(towerY + (h - towerY) * smooth((dt - 5) / 9));
  if (d < TOWN_R + 24) h = Math.round(TOWN_Y + (h - TOWN_Y) * smooth((d - TOWN_R - 2) / 22));
  const da = arenaDistance(x, z);
  if (da <= ARENA.radius + 3) return ARENA.y;
  if (da < ARENA.radius + 16) h = Math.round(ARENA.y + (h - ARENA.y) * smooth((da - ARENA.radius - 3) / 13));
  const road = roadDistance(x, z);
  if (road < 2) h = Math.round((h + rawHeight(x + 1, z) + rawHeight(x - 1, z)) / 3);
  if (road < 4 || da < ARENA.radius + 26) h = Math.max(h, TARN + 1);
  return h;
}

/** Frozen tarns: the ice surface sits at TARN. */
export const isIce = (x, z) => onIsland(x, z) && !inTown(x, z) && surfaceY(x, z) < TARN;

function steep(x, z, h) {
  return Math.max(Math.abs(surfaceY(x + 1, z) - h), Math.abs(surfaceY(x, z + 1) - h)) >= 2;
}

function undersideY(x, z, top) {
  const inner = Math.max(0, 1 - dist(x, z) / edgeAt(x, z));
  return Math.round(Math.min(top, TARN) - (6 + Math.pow(inner, 1.4) * 42 * (0.65 + 0.35 * fbm(x, z, 20, 519))));
}

// ---------- Structures ----------

const OPS = [];
const P = (key, x, y, z) => OPS.push(["s", key, x, y, z]);
function box(key, x1, y1, z1, x2, y2, z2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) P(key, x, y, z);
}

/** Timber lodge on a stone footing with a steep, snow-covered roof. (x, z) = NW corner, absolute. */
function lodge(x, z, w, d, h, { wall = "spruce_planks", door = "s" } = {}) {
  const Y = TOWN_Y;
  box("cobble", x, Y, z, x + w - 1, Y, z + d - 1);
  box("spruce_planks", x + 1, Y, z + 1, x + w - 2, Y, z + d - 2);
  for (let y = 1; y <= h; y++) {
    const k = y <= 1 ? "cobble" : wall;
    for (let i = 0; i < w; i++) { P(k, x + i, Y + y, z); P(k, x + i, Y + y, z + d - 1); }
    for (let j = 0; j < d; j++) { P(k, x, Y + y, z + j); P(k, x + w - 1, Y + y, z + j); }
    for (const [cx, cz] of [[x, z], [x + w - 1, z], [x, z + d - 1], [x + w - 1, z + d - 1]]) P("spruce_log", cx, Y + y, cz);
  }
  box("air", x + 1, Y + 1, z + 1, x + w - 2, Y + h, z + d - 2);
  for (let i = 2; i < w - 2; i += 3) { P("glass", x + i, Y + 2, z); P("glass", x + i, Y + 2, z + d - 1); }
  for (let j = 2; j < d - 2; j += 3) { P("glass", x, Y + 2, z + j); P("glass", x + w - 1, Y + 2, z + j); }
  const mx = x + Math.floor(w / 2), mz = z + Math.floor(d / 2);
  const [dx, dz] = { n: [mx, z], s: [mx, z + d - 1], w: [x, mz], e: [x + w - 1, mz] }[door];
  P("air", dx, Y + 1, dz); P("air", dx, Y + 2, dz);
  for (let i = 0; ; i++) {
    const z1 = z - 1 + i, z2 = z + d - i;
    if (z1 > z2) break;
    box("spruce_planks", x - 1, Y + h + 1 + i, z1, x + w, Y + h + 1 + i, z1);
    box("spruce_planks", x - 1, Y + h + 1 + i, z2, x + w, Y + h + 1 + i, z2);
    box("snow_layer", x - 1, Y + h + 2 + i, z1, x + w, Y + h + 2 + i, z1);
    box("snow_layer", x - 1, Y + h + 2 + i, z2, x + w, Y + h + 2 + i, z2);
    if (z2 - z1 <= 1) break;
    for (let zz = z1 + 1; zz < z2; zz++) { P(wall, x, Y + h + 1 + i, zz); P(wall, x + w - 1, Y + h + 1 + i, zz); }
  }
  P("lantern", x + 1, Y + 1, z + 1);
  P("campfire", x + w - 2, Y + 1, z + d - 2); // every lodge keeps a fire going
  return { x: mx + 0.5, y: Y + 1, z: mz + 0.5 };
}

function brazier(x, y, z) {
  P("cobble", x, y - 1, z);
  P("campfire", x, y, z);
}

export const NPC_SPOTS = {};

function buildTown() {
  const Y = TOWN_Y;
  for (let x = -TOWN_R; x <= TOWN_R; x++) for (let z = -TOWN_R; z <= TOWN_R; z++) {
    const r = Math.hypot(x, z);
    if (r <= 10) P(hash(C.x + x, C.z + z, 521) < 0.25 ? "cobble" : "bricks", C.x + x, Y, C.z + z);
    else if (r <= TOWN_R && (Math.abs(x) <= 1 || Math.abs(z) <= 1)) P("path", C.x + x, Y, C.z + z);
  }
  // The town fire: a great brazier in a stone ring at the heart of the plaza
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    const r = Math.hypot(x, z);
    if (r > 2.2 && r <= 3.2) P("bricks", C.x + x, Y + 1, C.z + z);
  }
  box("cobble", C.x - 1, Y + 1, C.z - 1, C.x + 1, Y + 1, C.z + 1);
  P("campfire", C.x, Y + 2, C.z);
  for (const [x, z] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) { box("fence", C.x + x, Y + 1, C.z + z, C.x + x, Y + 2, C.z + z); P("lantern", C.x + x, Y + 3, C.z + z); }
  // Buildings
  NPC_SPOTS["ponce:npc_guide"] = lodge(C.x + 5, C.z - 26, 13, 9, 5, { door: "s" });
  const smithy = lodge(C.x + 12, C.z + 8, 9, 9, 4, { wall: "cobble", door: "w" });
  P("forge", C.x + 18, Y + 1, C.z + 10); P("furnace", C.x + 19, Y + 1, C.z + 12); P("anvil", C.x + 15, Y + 1, C.z + 14);
  NPC_SPOTS["ponce:npc_smith"] = { ...smithy, x: smithy.x - 1 };
  const kitchen = lodge(C.x - 22, C.z - 16, 9, 9, 4, { door: "e" });
  P("pot", C.x - 18, Y + 1, C.z - 14); P("barrel", C.x - 21, Y + 1, C.z - 9);
  NPC_SPOTS["ponce:npc_cook"] = { ...kitchen, x: kitchen.x - 1 };
  // Wren's stall on the plaza
  for (const [dx, dz] of [[0, 0], [3, 0], [0, 2], [3, 2]]) box("fence", C.x + 3 + dx, Y + 1, C.z + 4 + dz, C.x + 3 + dx, Y + 2, C.z + 4 + dz);
  box("blue_wool", C.x + 3, Y + 3, C.z + 4, C.x + 6, Y + 3, C.z + 6);
  box("barrel", C.x + 4, Y + 1, C.z + 4, C.x + 5, Y + 1, C.z + 4);
  NPC_SPOTS["ponce:npc_merchant"] = { x: C.x + 4.5, y: Y + 1, z: C.z + 5.5 };
  lodge(C.x - 24, C.z + 6, 8, 7, 4, { door: "e" });
  lodge(C.x - 12, C.z + 18, 7, 7, 4, { door: "n" });
  lodge(C.x + 3, C.z + 20, 7, 7, 4, { door: "n" });
  lodge(C.x - 10, C.z - 30, 7, 7, 4, { door: "s" });
  lodge(C.x + 24, C.z - 10, 7, 7, 4, { door: "w" });
  // Log palisade against the wind, with gates on the streets
  for (let a = 0; a < 360; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * TOWN_R), z = Math.round(Math.sin(rad) * TOWN_R);
    if (Math.abs(x) <= 2 || Math.abs(z) <= 2) continue;
    box("spruce_log", C.x + x, Y + 1, C.z + z, C.x + x, Y + 3, C.z + z);
  }
  for (const [x, z] of [[3, -TOWN_R], [-3, -TOWN_R], [3, TOWN_R], [-3, TOWN_R], [TOWN_R, 3], [TOWN_R, -3], [-TOWN_R, 3], [-TOWN_R, -3]]) {
    box("spruce_log", C.x + x, Y + 1, C.z + z, C.x + x, Y + 4, C.z + z);
    P("lantern", C.x + x, Y + 5, C.z + z);
  }
}
buildTown();

function buildWatchtower() {
  const Y = surfaceY(WATCHTOWER.x, WATCHTOWER.z);
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    const r = Math.hypot(x, z);
    if (r > 3.3) continue;
    P("cobble", WATCHTOWER.x + x, Y, WATCHTOWER.z + z);
    for (let y = 1; y <= 12; y++) {
      if (r > 2.3) P(hash(x, y, 523 + z) < 0.25 ? "mossy_bricks" : "bricks", WATCHTOWER.x + x, Y + y, WATCHTOWER.z + z);
      else P("air", WATCHTOWER.x + x, Y + y, WATCHTOWER.z + z);
    }
  }
  box("air", WATCHTOWER.x, Y + 1, WATCHTOWER.z + 3, WATCHTOWER.x, Y + 2, WATCHTOWER.z + 3); // doorway (south)
  for (let y = 1; y <= 11; y++) { // a spiral of planks up the inside
    const a = (y / 4) * Math.PI;
    P("spruce_planks", WATCHTOWER.x + Math.round(Math.cos(a) * 1.6), Y + y, WATCHTOWER.z + Math.round(Math.sin(a) * 1.6));
  }
  box("spruce_planks", WATCHTOWER.x - 2, Y + 12, WATCHTOWER.z - 2, WATCHTOWER.x + 2, Y + 12, WATCHTOWER.z + 2);
  P("air", WATCHTOWER.x + Math.round(Math.cos(3 * Math.PI) * 1.6), Y + 12, WATCHTOWER.z);
  brazier(WATCHTOWER.x, Y + 13, WATCHTOWER.z);
  for (const [x, z] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) P("bricks", WATCHTOWER.x + x, Y + 13, WATCHTOWER.z + z);
}
buildWatchtower();

function buildArena() {
  const A = ARENA, Y = A.y;
  for (let x = -24; x <= 24; x++) for (let z = -24; z <= 24; z++) {
    const r = Math.hypot(x, z);
    if (r <= 5) P("packed_ice", A.x + x, Y, A.z + z);
    else if (r <= A.radius) P(hash(A.x + x, A.z + z, 527) < 0.35 ? "packed_ice" : "snow", A.x + x, Y, A.z + z);
    else if (r <= A.radius + 1.5) P("bricks", A.x + x, Y, A.z + z); // kerb marking the ring
  }
  // A ring of tall ice pillars
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.PI / 14;
    const x = A.x + Math.round(Math.cos(a) * 23), z = A.z + Math.round(Math.sin(a) * 23);
    if (z < A.z - 19 && Math.abs(x - A.x) <= 4) continue; // leave room for the gate
    const h = 6 + Math.floor(hash(x, z, 529) * 4);
    box("packed_ice", x, Y + 1, z, x, Y + h, z);
    P("ice", x, Y + h + 1, z);
  }
  // The four braziers: stone plinths with a fire on top
  for (const b of BRAZIERS) {
    box("bricks", b.x, Y + 1, b.z, b.x, b.y - 1, b.z);
    P("campfire", b.x, b.y, b.z);
  }
  // Stair Gate on the north side
  for (const dx of [-3, 3]) box("bricks", A.x + dx, Y + 1, GATE.z, A.x + dx, Y + 7, GATE.z);
  box("packed_ice", A.x - 3, Y + 8, GATE.z, A.x + 3, Y + 8, GATE.z);
  box("stair_gate", A.x - 2, Y + 1, GATE.z, A.x + 2, Y + 5, GATE.z);
  box("bricks", A.x - 2, Y + 6, GATE.z, A.x + 2, Y + 7, GATE.z);
  for (let i = 0; i < 7; i++) box("bricks", A.x - 2, Y - 2, GATE.z - 1 - i, A.x + 2, Y + 1 + i, GATE.z - 1 - i);
  // Path from the end of the north trail to the ring
  const a = trailAngle(0, ARENA_D - 22);
  const end = { x: C.x + Math.cos(a) * (ARENA_D - 22), z: C.z + Math.sin(a) * (ARENA_D - 22) };
  for (let t = 0; t <= 1; t += 0.02) {
    const x = Math.round(end.x + (A.x - end.x) * t), z = Math.round(end.z + (A.z + 23 - end.z) * t);
    for (let dx = -1; dx <= 1; dx++) { const y = surfaceY(x + dx, z); P("path", x + dx, y, z); P("air", x + dx, y + 1, z); }
  }
}
buildArena();

export const ARRIVAL = { x: C.x + 0.5, y: TOWN_Y + 1, z: C.z + 12.5 };

const OPS_BY_CHUNK = new Map();
for (const op of OPS) {
  const key = `${op[2] >> 4},${op[4] >> 4}`;
  if (!OPS_BY_CHUNK.has(key)) OPS_BY_CHUNK.set(key, []);
  OPS_BY_CHUNK.get(key).push(op);
}

// ---------- Spruce forests (below the snowline) and outcrops ----------

const CELL = 5;

function treeInCell(gx, gz) {
  const x = gx * CELL + Math.floor(hash(gx, gz, 533) * CELL);
  const z = gz * CELL + Math.floor(hash(gx, gz, 537) * CELL);
  const d = dist(x, z);
  if (d < TOWN_R + 6 || d > edgeAt(x, z) - 5 || roadDistance(x, z) < 3.5 || arenaDistance(x, z) < ARENA.radius + 10 || isIce(x, z)) return undefined;
  if (towerDistance(x, z) < 9) return undefined;
  const h = surfaceY(x, z);
  if (h > SNOWLINE - 2 || steep(x, z, h)) return undefined;
  const forest = fbm(x, z, 50, 539);
  if (hash(gx, gz, 541) > (forest > 0.55 ? 0.6 : 0.06)) return undefined;
  return { x, z, height: 7 + Math.floor(hash(gx, gz, 547) * 6) };
}

function treeOps(t, out) {
  const y0 = surfaceY(t.x, t.z) + 1;
  const top = y0 + t.height - 1;
  for (let y = y0 + 2; y <= top + 1; y++) {
    const fromTop = top + 1 - y;
    const r = fromTop === 0 ? 0 : Math.min(3, 1 + Math.floor(fromTop / 2)) - (fromTop % 2 === 1 ? 0 : 1);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
      out.push(["s", "spruce_leaves", t.x + dx, y, t.z + dz]);
    }
  }
  out.push(["s", "snow_layer", t.x, top + 2, t.z]);
  out.push(["f", "spruce_log", t.x, y0, top, t.z]);
}

const ROCK_CELL = 20;

function outcropInCell(bx, bz) {
  if (hash(bx, bz, 551) > 0.55) return undefined;
  const x = bx * ROCK_CELL + 3 + Math.floor(hash(bx, bz, 553) * (ROCK_CELL - 6));
  const z = bz * ROCK_CELL + 3 + Math.floor(hash(bx, bz, 557) * (ROCK_CELL - 6));
  const d = dist(x, z);
  if (d < TOWN_R + 10 || d > edgeAt(x, z) - 8 || roadDistance(x, z) < 5 || arenaDistance(x, z) < ARENA.radius + 14 || isIce(x, z)) return undefined;
  if (towerDistance(x, z) < 12) return undefined;
  const roll = hash(bx, bz, 559);
  const ore = roll < 0.3 ? "stormsteel_node" : roll < 0.55 ? "glimmer_silver_node" : roll < 0.7 ? "ironheart_node" : undefined;
  return { x, z, r: 2 + Math.floor(hash(bx, bz, 561) * 2), h: 2 + Math.floor(hash(bx, bz, 563) * 3), ore };
}

function outcropOps(o, out) {
  let placedOre = false;
  for (let dx = -o.r; dx <= o.r; dx++) for (let dz = -o.r; dz <= o.r; dz++) {
    const rr = Math.hypot(dx, dz);
    if (rr > o.r + 0.3) continue;
    const g = surfaceY(o.x + dx, o.z + dz);
    const h = Math.max(1, Math.round(o.h * (1 - rr / (o.r + 1))));
    for (let y = 1; y <= h; y++) out.push(["s", hash(o.x + dx, o.z + dz, 567 + y) < 0.3 ? "packed_ice" : "stone", o.x + dx, g + y, o.z + dz]);
    if (o.ore && !placedOre && rr > 0.5 && rr < 1.6) { out.push(["s", o.ore, o.x + dx, g + h, o.z + dz]); placedOre = true; }
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
    ops.push(["f", "stone", x, bottom, top - 4, z]);
    ops.push(["f", "dirt", x, top - 3, top - 1, z]);
    const d = dist(x, z), road = roadDistance(x, z);
    if (top < TARN) {
      ops.push(["s", "dirt", x, top, z]);
      if (TARN - 1 > top) ops.push(["f", "water", x, top + 1, TARN - 1, z]);
      ops.push(["s", "ice", x, TARN, z]);
      continue;
    }
    let surface = "grass", cover = true;
    if (road < 1.6 && d > TOWN_R) { surface = hash(x, z, 571) < 0.5 ? "path" : "coarse"; cover = false; }
    else if (edgeAt(x, z) - d < 2 || steep(x, z, top)) { surface = hash(x, z, 573) < 0.35 ? "packed_ice" : "stone"; cover = false; }
    else if (top >= SNOWLINE) { surface = "snow"; cover = false; }
    ops.push(["s", surface, x, top, z]);
    if (arenaDistance(x, z) <= ARENA.radius + 2) continue;
    if (d <= TOWN_R + 2) { // snow in the town's yards, but not on the plaza or streets
      const tx = Math.abs(x - C.x), tz = Math.abs(z - C.z);
      if (d > 12 && tx > 2 && tz > 2 && hash(x, z, 581) < 0.85) ops.push(["s", "snow_layer", x, top + 1, z]);
      continue;
    }
    if (cover && hash(x, z, 577) < 0.9) ops.push(["s", "snow_layer", x, top + 1, z]);
    else if (surface === "grass" && hash(x, z, 579) < 0.3) ops.push(["s", "fern", x, top + 1, z]);
  }
  for (const op of OPS_BY_CHUNK.get(`${cx},${cz}`) ?? []) ops.push(op);
  const inChunk = (op) => (op[2] >> 4) === cx && (op[op[0] === "f" ? 5 : 4] >> 4) === cz;
  const features = [];
  for (let bx = Math.floor((x0 - 4) / ROCK_CELL); bx <= Math.floor((x0 + 19) / ROCK_CELL); bx++)
    for (let bz = Math.floor((z0 - 4) / ROCK_CELL); bz <= Math.floor((z0 + 19) / ROCK_CELL); bz++) {
      const o = outcropInCell(bx, bz);
      if (o) outcropOps(o, features);
    }
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
  return onIsland(Math.floor(loc.x), Math.floor(loc.z)) && loc.y > BASE - 60 && loc.y < BASE + 100;
}
