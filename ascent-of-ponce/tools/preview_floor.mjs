// Builds a floor in memory with the real generator and writes preview data:
//   <out>/floorN_map.json    top-down colors for the whole island
//   <out>/floorN_town.json   block list for a 3D render of the town
//   <out>/floorN_arena.json  block list for a 3D render of the guardian arena
// Usage: node tools/preview_floor.mjs <floor number> <out-dir>
import fs from "node:fs";

const n = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? ".";
const g = await import(`../behavior_pack/scripts/floor${n}_gen.js`);
const COLORS = {
  stone: [125, 125, 125], dirt: [134, 96, 67], grass: [96, 152, 64], coarse: [120, 86, 60], path: [148, 122, 72],
  cobble: [110, 110, 110], mossy: [92, 118, 84], bricks: [140, 140, 140], chiseled: [160, 160, 160], water: [52, 98, 200],
  oak_log: [102, 80, 50], birch_log: [216, 212, 200], spruce_log: [64, 48, 32],
  oak_leaves: [66, 122, 40], birch_leaves: [110, 150, 70], spruce_leaves: [46, 84, 52],
  oak_planks: [170, 136, 86], spruce_planks: [110, 82, 52], birch_planks: [200, 184, 130],
  glass: [190, 220, 230], fence: [150, 120, 80], lantern: [255, 200, 90], bookshelf: [120, 80, 50], furnace: [90, 90, 90],
  anvil: [60, 60, 60], chest: [160, 110, 50], barrel: [130, 95, 60], campfire: [220, 120, 40], hay: [210, 180, 60],
  red_wool: [180, 40, 40], blue_wool: [50, 70, 170], yellow_wool: [230, 200, 50],
  stair_gate: [150, 120, 240], forge: [150, 70, 50], stormsteel_node: [80, 120, 168],
  mud: [70, 56, 48], moss: [90, 120, 50], moss_carpet: [100, 130, 56], packed_mud: [140, 104, 76], mossy_bricks: [110, 125, 100],
  mangrove_log: [100, 50, 40], mangrove_leaves: [70, 110, 50], mangrove_roots: [80, 56, 40], mangrove_planks: [118, 54, 48],
  lily: [60, 140, 60], reeds: [130, 170, 90], blue_orchid: [60, 150, 220], pot: [200, 110, 60], ember_copper_node: [214, 120, 60], ironheart_node: [170, 50, 50], glimmer_silver_node: [220, 225, 240],
  short_grass: [90, 150, 60], fern: [70, 130, 60], poppy: [200, 40, 40], dandelion: [240, 220, 40], cornflower: [80, 100, 220],
  oxeye_daisy: [240, 240, 230], azure_bluet: [220, 230, 250],
};
const blocks = new Map();
const set = (k, x, y, z) => (k === "air" ? blocks.delete(`${x},${y},${z}`) : blocks.set(`${x},${y},${z}`, k));
const { min, max } = g.CHUNK_BOUNDS;
for (let cx = min.x; cx <= max.x; cx++) for (let cz = min.z; cz <= max.z; cz++) {
  if (!g.chunkHasIsland(cx, cz)) continue;
  for (const op of g.chunkOps(cx, cz)) {
    if (op[0] === "f") for (let y = op[3]; y <= op[4]; y++) set(op[1], op[2], y, op[5]);
    else set(op[1], op[2], op[3], op[4]);
  }
}
// Top-down map
const F = g.FLOOR;
const C = F.center, R = F.radius + 8, size = R * 2;
const tops = new Map();
for (const [k, v] of blocks) {
  const [x, y, z] = k.split(",").map(Number);
  const key = `${x},${z}`;
  const t = tops.get(key);
  if (!t || y > t[0]) tops.set(key, [y, v]);
}
const map = [];
for (let z = C.z - R; z < C.z + R; z++) for (let x = C.x - R; x < C.x + R; x++) {
  const t = tops.get(`${x},${z}`);
  if (!t) { map.push(null); continue; }
  const shade = 1 + (t[0] - F.base) * 0.04;
  map.push((COLORS[t[1]] ?? [255, 0, 255]).map((c) => Math.max(0, Math.min(255, Math.round(c * shade)))));
}
fs.writeFileSync(`${out}/floor${n}_map.json`, JSON.stringify({ size, map }));
// Town and arena blocks (above ground only, so the renders stay light)
for (const [name, cx, cz, r] of [["town", C.x, C.z, 56], ["arena", g.ARENA.x, g.ARENA.z, 34]]) {
  const list = [];
  for (const [k, v] of blocks) {
    const [x, y, z] = k.split(",").map(Number);
    if (Math.hypot(x - cx, z - cz) > r || y < F.base - 2) continue;
    list.push([x - cx, y - F.base, z - cz, ...(COLORS[v] ?? [255, 0, 255])]);
  }
  fs.writeFileSync(`${out}/floor${n}_${name}.json`, JSON.stringify(list));
}
console.log(`blocks ${blocks.size}, unknown colors: ${[...new Set(blocks.values())].filter((v) => !COLORS[v]).join(",") || "none"}`);
