// Floor 3 generator: the Rolling Highlands. Windswept hills, rocky outcrops,
// standing-stone circles, sheltered groves, flower meadows and hill tarns; the
// walled hilltop town of Cairnhold; and the Crown of Stones, where Thunderhoof
// guards the next gate. Same interface as the other floor modules. Pure code.

import { directionText, fbm, hash, smooth, valueNoise } from "./floor1_gen.js";

export { directionText };

export const FLOOR = {
  id: 3,
  name: "Cairnhold",
  title: "the Rolling Highlands",
  center: { x: -10000, z: 10000 },
  base: 200,
  radius: 240,
  townRadius: 40,
};

const C = FLOOR.center;
const BASE = FLOOR.base;
const TOWN_R = FLOOR.townRadius;
const TOWN_Y = BASE + 14; // the town sits on a hilltop
const TARN = BASE - 3; // water level of the hill lakes

const dist = (x, z) => Math.hypot(x - C.x, z - C.z);

function edgeAt(x, z) {
  const a = Math.atan2(z - C.z, x - C.x);
  return FLOOR.radius * (0.89 + 0.11 * valueNoise(Math.cos(a) * 60, Math.sin(a) * 60, 24, 403));
}

export const onIsland = (x, z) => dist(x, z) <= edgeAt(x, z);
export const inTown = (x, z) => dist(x, z) <= TOWN_R;

// ---------- Trails ----------

const ROAD_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
function trailAngle(k, d) {
  const wobble = d > TOWN_R ? (valueNoise(d, k * 50, 45, 411) - 0.5) * 0.5 * Math.min(1, (d - TOWN_R) / 40) : 0;
  return ROAD_ANGLES[k] + wobble;
}

const ARENA_D = 180;
export const ARENA = (() => {
  const a = trailAngle(0, ARENA_D - 20);
  return { x: C.x + Math.round(Math.cos(a) * ARENA_D), z: C.z + Math.round(Math.sin(a) * ARENA_D), y: BASE + 4, radius: 20 };
})();
export const GATE = { x: ARENA.x, y: ARENA.y + 1, z: ARENA.z - 21 };
export const arenaDistance = (x, z) => Math.hypot(x - ARENA.x, z - ARENA.z);

function roadDistance(x, z) {
  const d = dist(x, z);
  if (d < 12) return 99;
  let best = 99;
  ROAD_ANGLES.forEach((_, k) => {
    const a = trailAngle(k, d);
    const along = (x - C.x) * Math.cos(a) + (z - C.z) * Math.sin(a);
    if (along <= 0) return;
    if (k === 0 && along > ARENA_D - 20) return; // ends at the Crown of Stones
    best = Math.min(best, Math.abs(-(x - C.x) * Math.sin(a) + (z - C.z) * Math.cos(a)));
  });
  return best;
}

// ---------- Stormsteel Quarry: a flattened stone pit full of regrowing nodes ----------

export const QUARRY = (() => {
  const a = 0.6, d = 95;
  return { x: C.x + Math.round(Math.cos(a) * d), z: C.z + Math.round(Math.sin(a) * d), r: 9 };
})();
const quarryDistance = (x, z) => Math.hypot(x - QUARRY.x, z - QUARRY.z);

/** Landmarks shown on the map page. */
export const LANDMARKS = [{ name: "Stormsteel Quarry", x: QUARRY.x, z: QUARRY.z }];

// ---------- Terrain ----------

/** Natural rolling height, before flattening for the town and arena. */
function rawHeight(x, z) {
  const d = dist(x, z);
  const hills = (fbm(x, z, 70, 401) - 0.42) * 30 + (valueNoise(x, z, 18, 409) - 0.5) * 4;
  const townHill = 16 * smooth(Math.max(0, 1 - d / 110)); // the land rises toward Cairnhold
  let h = BASE + Math.round(hills + townHill);
  const edge = edgeAt(x, z);
  if (edge - d < 4) h = Math.max(h, TARN + 1); // a rim so tarns never spill off the edge
  return h;
}

let quarryY;
export function surfaceY(x, z) {
  const d = dist(x, z);
  if (d <= TOWN_R + 2) return TOWN_Y;
  quarryY ??= Math.max(TARN + 2, rawHeight(QUARRY.x, QUARRY.z));
  const dq = quarryDistance(x, z);
  if (dq <= QUARRY.r + 1) return quarryY;
  if (dq < QUARRY.r + 8) return Math.round(quarryY + (rawHeight(x, z) - quarryY) * smooth((dq - QUARRY.r - 1) / 7));
  let h = rawHeight(x, z);
  if (d < TOWN_R + 22) h = Math.round(TOWN_Y + (h - TOWN_Y) * smooth((d - TOWN_R - 2) / 20));
  const da = arenaDistance(x, z);
  if (da <= ARENA.radius + 2) return ARENA.y;
  if (da < ARENA.radius + 14) h = Math.round(ARENA.y + (h - ARENA.y) * smooth((da - ARENA.radius - 2) / 12));
  const road = roadDistance(x, z);
  if (road < 2) h = Math.round((h + rawHeight(x + 1, z) + rawHeight(x - 1, z)) / 3); // smoother path
  // Trails and the land around the Crown stay above the tarns
  if (road < 4 || da < ARENA.radius + 24) h = Math.max(h, TARN + 1);
  return h;
}

export const isWater = (x, z) => onIsland(x, z) && !inTown(x, z) && quarryDistance(x, z) > QUARRY.r + 8 && surfaceY(x, z) < TARN;

function steep(x, z, h) {
  return Math.max(Math.abs(surfaceY(x + 1, z) - h), Math.abs(surfaceY(x, z + 1) - h)) >= 2;
}

function undersideY(x, z, top) {
  const inner = Math.max(0, 1 - dist(x, z) / edgeAt(x, z));
  return Math.round(Math.min(top, TARN) - (6 + Math.pow(inner, 1.4) * 40 * (0.65 + 0.35 * fbm(x, z, 20, 419))));
}

// ---------- Structures ----------

const OPS = [];
const P = (key, x, y, z) => OPS.push(["s", key, x, y, z]);
function box(key, x1, y1, z1, x2, y2, z2) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) P(key, x, y, z);
}

/** Stone-and-timber house: a cobble lower course, plank upper walls, steep roof. (x, z) = NW corner, absolute. */
function house(x, z, w, d, h, { wall = "spruce_planks", lower = "cobble", roof = "spruce_planks", door = "s" } = {}) {
  const Y = TOWN_Y;
  box("cobble", x, Y, z, x + w - 1, Y, z + d - 1);
  box("spruce_planks", x + 1, Y, z + 1, x + w - 2, Y, z + d - 2);
  for (let y = 1; y <= h; y++) {
    const k = y <= 1 ? lower : wall;
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
    box(roof, x - 1, Y + h + 1 + i, z1, x + w, Y + h + 1 + i, z1);
    box(roof, x - 1, Y + h + 1 + i, z2, x + w, Y + h + 1 + i, z2);
    if (z2 - z1 <= 1) break;
    for (let zz = z1 + 1; zz < z2; zz++) { P(wall, x, Y + h + 1 + i, zz); P(wall, x + w - 1, Y + h + 1 + i, zz); }
  }
  P("lantern", x + 1, Y + 1, z + 1);
  return { x: mx + 0.5, y: Y + 1, z: mz + 0.5 };
}

export const NPC_SPOTS = {};

function buildTown() {
  const Y = TOWN_Y;
  // Paved plaza and streets
  for (let x = -TOWN_R; x <= TOWN_R; x++) for (let z = -TOWN_R; z <= TOWN_R; z++) {
    const r = Math.hypot(x, z);
    if (r <= 10) P(hash(C.x + x, C.z + z, 421) < 0.2 ? "mossy" : "cobble", C.x + x, Y, C.z + z);
    else if (r <= TOWN_R && (Math.abs(x) <= 1 || Math.abs(z) <= 1)) P("path", C.x + x, Y, C.z + z);
  }
  // Fountain cairn: a stone basin and a cairn pillar topped with water, like the summit's fountain
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    const r = Math.hypot(x, z);
    if (r > 2.2 && r <= 3.2) P("mossy", C.x + x, Y + 1, C.z + z);
    else if (r <= 2.2) P("water", C.x + x, Y, C.z + z);
  }
  box("cobble", C.x, Y, C.z, C.x, Y + 3, C.z);
  box("mossy", C.x, Y + 4, C.z, C.x, Y + 4, C.z);
  P("water", C.x, Y + 5, C.z);
  for (const [x, z] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) { box("fence", C.x + x, Y + 1, C.z + z, C.x + x, Y + 2, C.z + z); P("lantern", C.x + x, Y + 3, C.z + z); }
  // Buildings
  NPC_SPOTS["ponce:npc_ranger"] = house(C.x + 6, C.z - 26, 13, 9, 5, { door: "s" });
  const smithy = house(C.x + 12, C.z + 8, 9, 9, 4, { wall: "cobble", door: "w" });
  P("forge", C.x + 18, Y + 1, C.z + 10); P("furnace", C.x + 19, Y + 1, C.z + 14); P("anvil", C.x + 15, Y + 1, C.z + 14);
  NPC_SPOTS["ponce:npc_smith"] = { ...smithy, x: smithy.x - 1 };
  const kitchen = house(C.x - 22, C.z - 16, 9, 9, 4, { door: "e" });
  P("pot", C.x - 18, Y + 1, C.z - 14); P("barrel", C.x - 21, Y + 1, C.z - 9); P("campfire", C.x - 16, Y + 1, C.z - 15);
  NPC_SPOTS["ponce:npc_cook"] = { ...kitchen, x: kitchen.x - 1 };
  house(C.x - 24, C.z + 6, 8, 7, 4, { door: "e" });
  house(C.x - 12, C.z + 18, 7, 7, 4, { wall: "birch_planks", door: "n" });
  house(C.x + 3, C.z + 20, 7, 7, 4, { door: "n" });
  house(C.x - 10, C.z - 30, 7, 7, 4, { wall: "birch_planks", door: "s" });
  house(C.x + 24, C.z - 10, 7, 7, 4, { door: "w" });
  // Drystone wall around the hilltop, with gates on the streets
  for (let a = 0; a < 360; a += 0.4) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * TOWN_R), z = Math.round(Math.sin(rad) * TOWN_R);
    if (Math.abs(x) <= 2 || Math.abs(z) <= 2) continue;
    box(hash(x, z, 423) < 0.3 ? "mossy" : "cobble", C.x + x, Y + 1, C.z + z, C.x + x, Y + 2, C.z + z);
  }
}
buildTown();

// Standing-stone circles: landmarks out in the hills
export const STONE_CIRCLES = [[0.9, 120], [2.4, 150], [3.9, 110], [5.2, 160]].map(([a, d]) => ({
  x: C.x + Math.round(Math.cos(a) * d), z: C.z + Math.round(Math.sin(a) * d),
}));

function buildStoneCircle(c) {
  const y = surfaceY(c.x, c.z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = c.x + Math.round(Math.cos(a) * 6), z = c.z + Math.round(Math.sin(a) * 6);
    const h = 2 + Math.floor(hash(x, z, 431) * 2);
    const g = surfaceY(x, z);
    box("stone", x, g + 1, z, x, g + h, z);
    P("mossy", x, g + h + 1, z);
  }
  P("chiseled", c.x, y + 1, c.z); // a low altar stone in the middle
}
STONE_CIRCLES.forEach(buildStoneCircle);

function buildQuarry() {
  const Y = surfaceY(QUARRY.x, QUARRY.z);
  for (let x = -QUARRY.r - 1; x <= QUARRY.r + 1; x++) for (let z = -QUARRY.r - 1; z <= QUARRY.r + 1; z++) {
    const r = Math.hypot(x, z);
    if (r > QUARRY.r + 1) continue;
    P(hash(QUARRY.x + x, QUARRY.z + z, 487) < 0.25 ? "cobble" : "stone", QUARRY.x + x, Y, QUARRY.z + z);
    P("air", QUARRY.x + x, Y + 1, QUARRY.z + z);
  }
  // Nodes: eight Stormsteel and three Ironheart around the pit, a lantern post in the middle
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = 3.5 + hash(i, 7, 491) * 3.5;
    P(i < 8 ? "stormsteel_node" : "ironheart_node", QUARRY.x + Math.round(Math.cos(a) * r), Y + 1, QUARRY.z + Math.round(Math.sin(a) * r));
  }
  box("fence", QUARRY.x, Y + 1, QUARRY.z, QUARRY.x, Y + 2, QUARRY.z);
  P("lantern", QUARRY.x, Y + 3, QUARRY.z);
}
buildQuarry();

function buildArena() {
  const A = ARENA, Y = A.y;
  for (let x = -23; x <= 23; x++) for (let z = -23; z <= 23; z++) {
    const r = Math.hypot(x, z);
    if (r <= 4) P("chiseled", A.x + x, Y, A.z + z);
    else if (r <= 5) P("mossy", A.x + x, Y, A.z + z);
    else if (r > 20 && r <= 21.5) P("cobble", A.x + x, Y, A.z + z); // kerb marking the ring
  }
  // The Crown: twelve great standing stones
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const x = A.x + Math.round(Math.cos(a) * 21), z = A.z + Math.round(Math.sin(a) * 21);
    if (z < A.z - 18 && Math.abs(x - A.x) <= 4) continue; // leave room for the gate
    box("stone", x, Y + 1, z, x, Y + 5, z);
    box("mossy", x, Y + 6, z, x, Y + 6, z);
  }
  // Stair Gate between two tall stones on the north side
  for (const dx of [-3, 3]) box("chiseled", A.x + dx, Y + 1, GATE.z, A.x + dx, Y + 7, GATE.z);
  box("stone", A.x - 3, Y + 8, GATE.z, A.x + 3, Y + 8, GATE.z);
  box("stair_gate", A.x - 2, Y + 1, GATE.z, A.x + 2, Y + 5, GATE.z);
  box("cobble", A.x - 2, Y + 6, GATE.z, A.x + 2, Y + 7, GATE.z);
  for (let i = 0; i < 7; i++) box("cobble", A.x - 2, Y - 2, GATE.z - 1 - i, A.x + 2, Y + 1 + i, GATE.z - 1 - i);
  // Path from the end of the north trail to the ring
  const a = trailAngle(0, ARENA_D - 20);
  const end = { x: C.x + Math.cos(a) * (ARENA_D - 20), z: C.z + Math.sin(a) * (ARENA_D - 20) };
  for (let t = 0; t <= 1; t += 0.02) {
    const x = Math.round(end.x + (A.x - end.x) * t), z = Math.round(end.z + (A.z + 22 - end.z) * t);
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

// ---------- Trees (groves in the dips) and outcrops ----------

const CELL = 6;

function nearLandmark(x, z) {
  return STONE_CIRCLES.some((c) => Math.hypot(x - c.x, z - c.z) < 10);
}

function treeInCell(gx, gz) {
  const x = gx * CELL + Math.floor(hash(gx, gz, 433) * CELL);
  const z = gz * CELL + Math.floor(hash(gx, gz, 437) * CELL);
  const d = dist(x, z);
  if (d < TOWN_R + 6 || d > edgeAt(x, z) - 5 || roadDistance(x, z) < 3.5 || arenaDistance(x, z) < ARENA.radius + 8 || isWater(x, z) || nearLandmark(x, z)) return undefined;
  if (quarryDistance(x, z) < QUARRY.r + 6) return undefined;
  const grove = fbm(x, z, 55, 439); // groves where this is high
  if (hash(gx, gz, 441) > (grove > 0.62 ? 0.55 : 0.015)) return undefined; // open hills, trees only in sheltered groves
  const kind = hash(gx, gz, 443) < 0.6 ? "spruce" : "birch";
  return { x, z, kind, height: kind === "spruce" ? 8 + Math.floor(hash(gx, gz, 447) * 4) : 6 + Math.floor(hash(gx, gz, 447) * 3) };
}

function treeOps(t, out) {
  const y0 = surfaceY(t.x, t.z) + 1;
  const top = y0 + t.height - 1;
  if (t.kind === "spruce") {
    for (let y = y0 + 2; y <= top + 1; y++) {
      const fromTop = top + 1 - y;
      const r = fromTop === 0 ? 0 : Math.min(3, 1 + Math.floor(fromTop / 2)) - (fromTop % 2 === 1 ? 0 : 1);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        out.push(["s", "spruce_leaves", t.x + dx, y, t.z + dz]);
      }
    }
  } else {
    for (const [dy, r] of [[-2, 2], [-1, 2], [0, 1], [1, 1]]) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        out.push(["s", "birch_leaves", t.x + dx, top + dy, t.z + dz]);
      }
    }
  }
  out.push(["f", `${t.kind}_log`, t.x, y0, top, t.z]);
}

const ROCK_CELL = 18;

function outcropInCell(bx, bz) {
  if (hash(bx, bz, 451) > 0.6) return undefined;
  const x = bx * ROCK_CELL + 3 + Math.floor(hash(bx, bz, 453) * (ROCK_CELL - 6));
  const z = bz * ROCK_CELL + 3 + Math.floor(hash(bx, bz, 457) * (ROCK_CELL - 6));
  const d = dist(x, z);
  if (d < TOWN_R + 10 || d > edgeAt(x, z) - 8 || roadDistance(x, z) < 5 || arenaDistance(x, z) < ARENA.radius + 12 || isWater(x, z) || nearLandmark(x, z)) return undefined;
  if (quarryDistance(x, z) < QUARRY.r + 8) return undefined;
  const roll = hash(bx, bz, 459);
  const ore = roll < 0.25 ? "stormsteel_node" : roll < 0.45 ? "ironheart_node" : roll < 0.65 ? "glimmer_silver_node" : roll < 0.75 ? "ember_copper_node" : undefined;
  return { x, z, r: 2 + Math.floor(hash(bx, bz, 461) * 2), h: 2 + Math.floor(hash(bx, bz, 463) * 3), ore };
}

function outcropOps(o, out) {
  let placedOre = false;
  for (let dx = -o.r; dx <= o.r; dx++) for (let dz = -o.r; dz <= o.r; dz++) {
    const rr = Math.hypot(dx, dz);
    if (rr > o.r + 0.3) continue;
    const g = surfaceY(o.x + dx, o.z + dz);
    const h = Math.max(1, Math.round(o.h * (1 - rr / (o.r + 1))));
    for (let y = 1; y <= h; y++) {
      const key = hash(o.x + dx, o.z + dz, 467 + y) < 0.3 ? "mossy" : hash(o.x + dx, o.z + dz, 469 + y) < 0.4 ? "cobble" : "stone";
      out.push(["s", key, o.x + dx, g + y, o.z + dz]);
    }
    if (o.ore && !placedOre && rr > 0.5 && rr < 1.6) { out.push(["s", o.ore, o.x + dx, g + h, o.z + dz]); placedOre = true; }
  }
}

// ---------- Chunks ----------

export function chunkHasIsland(cx, cz) {
  return Math.hypot(cx * 16 + 8 - C.x, cz * 16 + 8 - C.z) < FLOOR.radius + 16;
}

const FLOWERS = ["cornflower", "azure_bluet", "oxeye_daisy", "dandelion", "poppy"];

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
      ops.push(["f", "water", x, top + 1, TARN, z]);
      continue;
    }
    let surface = "grass";
    if (road < 1.6 && d > TOWN_R) surface = hash(x, z, 471) < 0.5 ? "path" : "coarse";
    else if (edgeAt(x, z) - d < 2 || steep(x, z, top)) surface = hash(x, z, 473) < 0.4 ? "mossy" : "stone";
    ops.push(["s", surface, x, top, z]);
    if (quarryDistance(x, z) <= QUARRY.r + 1) surface = "stone";
    if (surface === "grass" && d > TOWN_R + 3 && road > 2.5 && arenaDistance(x, z) > ARENA.radius + 2) {
      const r = hash(x, z, 477);
      const meadow = fbm(x, z, 40, 479) > 0.5;
      if (meadow && r < 0.08) ops.push(["s", FLOWERS[Math.floor(hash(x, z, 481) * FLOWERS.length)], x, top + 1, z]);
      else if (r < 0.4) ops.push(["s", fbm(x, z, 55, 439) > 0.55 && r < 0.15 ? "fern" : "short_grass", x, top + 1, z]);
    }
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
  return onIsland(Math.floor(loc.x), Math.floor(loc.z)) && loc.y > BASE - 60 && loc.y < BASE + 70;
}
