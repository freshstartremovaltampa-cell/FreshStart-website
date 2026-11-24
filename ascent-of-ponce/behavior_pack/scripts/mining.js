// Regenerating ore nodes, RuneScape style.
// Mining a node gives ore and leaves a Depleted Node that can't be mined.
// After the ore's regen time it turns back into the node. Timers use world
// time and are saved in the world, so they survive leaving and rejoining.

import { world, system, ItemStack } from "@minecraft/server";
import { ORES, PICKAXE_TIERS } from "./jobs_data.js";
import { getData } from "./data.js";
import { addJobXp, jobLevel } from "./jobs.js";
import { notify } from "./quests.js";

const DEPLETED = "ponce:depleted_node";
const SAVE_KEY = "ponce:depleted_nodes";
const TIER_RANK = { wooden: 0, golden: 0, stone: 1, iron: 2, diamond: 3, netherite: 4 };

let records; // [{ d, x, y, z, type, at }]

function load() {
  if (records) return records;
  try { records = JSON.parse(world.getDynamicProperty(SAVE_KEY) ?? "[]"); } catch { records = []; }
  return records;
}

function save() {
  world.setDynamicProperty(SAVE_KEY, JSON.stringify(records));
}

function isCreative(player) {
  try {
    const mode = String(player.getGameMode()).toLowerCase();
    return mode === "creative";
  } catch {
    return false;
  }
}

/** Rank of the held pickaxe (0 wooden/golden ... 4 netherite), or -1 if not a pickaxe. */
export function pickaxeRank(item) {
  if (!item?.hasTag("minecraft:is_pickaxe")) return -1;
  for (const t of PICKAXE_TIERS) if (item.hasTag(`minecraft:${t}_tier`)) return TIER_RANK[t];
  return 0;
}

/** Why this player can't mine this node right now, or undefined if they can. */
export function miningBlocker(player, ore, item) {
  const need = TIER_RANK[ore.pickaxe];
  if (pickaxeRank(item) < need) return `§7[Ponce] You need a ${ore.pickaxe} pickaxe or better to mine ${ore.name}.`;
  const lvl = jobLevel(getData(player), "mining");
  if (lvl < ore.level) return `§7[Ponce] ${ore.name} needs Mining level §e${ore.level}§7 (you're ${lvl}).`;
  return undefined;
}

function regrow() {
  const list = load();
  if (list.length === 0) return;
  const now = world.getAbsoluteTime();
  let changed = false;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (r.at > now) continue;
    let block;
    try { block = world.getDimension(r.d).getBlock({ x: r.x, y: r.y, z: r.z }); } catch { block = undefined; }
    if (!block) continue; // chunk not loaded: try again later
    if (block.typeId === DEPLETED) {
      block.setType(r.type);
      try { block.dimension.spawnParticle("minecraft:villager_happy", { x: r.x + 0.5, y: r.y + 1.1, z: r.z + 0.5 }); } catch { /* ignore */ }
    }
    list.splice(i, 1);
    changed = true;
  }
  if (changed) save();
}

export function registerMining() {
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const ore = ORES[ev.block.typeId];
    if (!ore || isCreative(ev.player)) return;
    const reason = miningBlocker(ev.player, ore, ev.itemStack);
    if (!reason) return;
    ev.cancel = true;
    const player = ev.player;
    system.run(() => player.isValid && player.sendMessage(reason));
  });

  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, player, dimension }) => {
    const type = brokenBlockPermutation.type.id;
    const ore = ORES[type];
    if (!ore || isCreative(player)) return;
    const { x, y, z } = block.location;
    block.setType(DEPLETED);
    load().push({ d: dimension.id, x, y, z, type, at: world.getAbsoluteTime() + ore.regen * 20 });
    save();

    const lvl = jobLevel(getData(player), "mining");
    const doubleChance = Math.min(0.3, (lvl - ore.level) * 0.015);
    const amount = Math.random() < doubleChance ? 2 : 1;
    dimension.spawnItem(new ItemStack(ore.drop, amount), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (amount > 1) player.sendMessage(`§a[Ponce] Rich vein! Double ${ore.name}.`);
    addJobXp(player, "mining", ore.xp);
    notify(player, "mine", type);
  });

  system.runInterval(regrow, 20);
}
