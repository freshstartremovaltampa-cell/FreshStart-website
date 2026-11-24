// Quests: accept from NPCs, progress from gameplay, turn in for rewards.
// Other modules report gameplay with notify(player, type, key).

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { DIFFICULTY, NPCS, QUESTS, QUESTS_BY_ID, SHOPS } from "./quests_data.js";
import { WEAPONS, WEAPON_KEYS } from "./config.js";
import { WEAPON_DEFS } from "./weapon_data.js";
import { getData, markDirty } from "./data.js";
import { addXp } from "./progression.js";
import { addJobXp, JOBS } from "./jobs.js";
import { countItem, give, itemName, takeAll } from "./inventory.js";
import { QUALITIES, weaponLore } from "./weapons.js";
import { INFUSIONS } from "./weapon_data.js";
import { show } from "./ui.js";

export const MAX_ACTIVE = 8;
const QUALITY_RANK = { crude: 0, standard: 1, fine: 2, masterwork: 3 };
const NPC_BY_KEY = Object.fromEntries(Object.values(NPCS).map((n) => [n.key, n]));

// ---------- State ----------

function qstate(data) {
  data.quests ??= { active: {}, done: {} };
  return data.quests;
}

function meetsRequires(data, q) {
  const r = q.requires ?? {};
  if (r.floor && (data.highestFloor ?? 1) < r.floor) return false;
  if (r.level && data.level < r.level) return false;
  return (r.quests ?? []).every((id) => (qstate(data).done[id] ?? 0) > 0);
}

function requiresText(data, q) {
  const r = q.requires ?? {};
  const parts = [];
  if (r.floor) parts.push(`${(data.highestFloor ?? 1) >= r.floor ? "§a" : "§c"}reach Floor ${r.floor}`);
  if (r.level) parts.push(`${data.level >= r.level ? "§a" : "§c"}Lv ${r.level}`);
  for (const id of r.quests ?? []) parts.push(`${(qstate(data).done[id] ?? 0) > 0 ? "§a" : "§c"}"${QUESTS_BY_ID[id].name}"`);
  return parts.join("§7, ");
}

/** "locked" | "available" | "active" | "ready" | "done" */
export function questStatus(player, q) {
  const data = getData(player);
  const s = qstate(data);
  if (s.active[q.id]) return isComplete(player, q) ? "ready" : "active";
  if ((s.done[q.id] ?? 0) > 0 && !q.repeatable) return "done";
  return meetsRequires(data, q) ? "available" : "locked";
}

function objectiveTarget(o) {
  return Array.isArray(o.target) ? o.target : o.target ? [o.target] : [];
}

export function objectiveProgress(player, q, i) {
  const o = q.objectives[i];
  const data = getData(player);
  if (o.type === "collect") return Math.min(o.count, countItem(player, o.item));
  if (o.type === "level") return Math.min(o.count, data.level);
  if (o.type === "job") return Math.min(o.count, data.jobs[o.job]?.level ?? 1);
  return Math.min(o.count, qstate(data).active[q.id]?.p?.[i] ?? 0);
}

export function isComplete(player, q) {
  return q.objectives.every((o, i) => objectiveProgress(player, q, i) >= o.count);
}

export function objectiveLabel(o) {
  if (o.label) return o.label;
  const names = objectiveTarget(o).map(itemName).join(" / ");
  switch (o.type) {
    case "kill": return `Defeat ${names}`;
    case "boss": return `Defeat ${names}`;
    case "collect": return `Bring ${itemName(o.item)}`;
    case "mine": return `Mine ${names}`;
    case "forge": return o.minQuality ? `Forge ${QUALITIES[o.minQuality].name}§f+ weapons` : "Forge weapons";
    case "cook": return o.target ? `Cook ${names}` : "Cook dishes";
    case "cook_perfect": return "Cook perfect dishes";
    case "level": return "Reach combat level";
    case "job": return `Reach ${JOBS[o.job].name} level`;
    default: return o.type;
  }
}

// ---------- Progress ----------

function matches(o, type, key) {
  if (o.type !== type) return false;
  if (type === "forge") return !o.minQuality || QUALITY_RANK[key] >= QUALITY_RANK[o.minQuality];
  const targets = objectiveTarget(o);
  return targets.length === 0 || targets.includes(key);
}

/** Report something the player did. type: kill, boss, mine, forge (key = quality), cook, cook_perfect. */
export function notify(player, type, key, amount = 1) {
  const data = getData(player);
  const s = qstate(data);
  for (const [id, st] of Object.entries(s.active)) {
    const q = QUESTS_BY_ID[id];
    if (!q) continue;
    const wasComplete = isComplete(player, q);
    let changed = false;
    q.objectives.forEach((o, i) => {
      if (!matches(o, type, key) || ["collect", "level", "job"].includes(o.type)) return;
      st.p ??= [];
      const before = st.p[i] ?? 0;
      if (before >= o.count) return;
      st.p[i] = Math.min(o.count, before + amount);
      changed = true;
      player.onScreenDisplay.setActionBar(`§e${q.name}: §f${st.p[i]}/${o.count} ${objectiveLabel(o).replace(/^(Defeat|Mine|Cook|Forge) /, "")}`);
    });
    if (!changed) continue;
    markDirty(player);
    if (!wasComplete && isComplete(player, q)) {
      player.sendMessage(`§a[Quest] §f${q.name}§a is ready to turn in. §7Return to ${NPC_BY_KEY[q.giver].name}.`);
      player.playSound("random.orb", { pitch: 1.4 });
    }
  }
}

export function accept(player, q) {
  const s = qstate(getData(player));
  if (Object.keys(s.active).length >= MAX_ACTIVE) {
    player.sendMessage(`§c[Quest] You can only have ${MAX_ACTIVE} quests at once. Finish or abandon one first.`);
    return false;
  }
  if (questStatus(player, q) !== "available") return false;
  s.active[q.id] = { p: q.objectives.map(() => 0) };
  markDirty(player);
  player.sendMessage(`§e[Quest] Accepted: §f${q.name}`);
  player.playSound("random.click");
  return true;
}

export function abandon(player, q) {
  delete qstate(getData(player)).active[q.id];
  markDirty(player);
  player.sendMessage(`§7[Quest] Abandoned: ${q.name}`);
}

// ---------- Rewards ----------

function rewardWeaponDef(kind, type) {
  const tier = { fine_t1: 1, fine_t2: 2, masterwork_t2: 2, relic: 3 }[kind];
  return Object.entries(WEAPON_DEFS).find(([, d]) => d.tier === tier && d.type === type);
}

export function makeRewardWeapon(reward, type) {
  const [id, def] = rewardWeaponDef(reward.kind, type);
  const item = new ItemStack(id, 1);
  if (reward.kind === "relic") {
    item.setLore(weaponLore(def));
    return item;
  }
  const quality = reward.kind.startsWith("fine") ? "fine" : "masterwork";
  const infusions = reward.infusions ?? [];
  item.setDynamicProperty("ponce:quality", quality);
  if (infusions.length) item.setDynamicProperty("ponce:infusions", JSON.stringify(infusions));
  item.nameTag = `${QUALITIES[quality].name} ${def.name}${infusions.length ? " §d+" + infusions.length : ""}`;
  item.setLore(weaponLore(def, { quality, infusions }));
  return item;
}

function rewardText(q) {
  const r = q.rewards;
  const lines = [`§b${r.xp} EXP§7, §6${r.col} Col`];
  for (const [id, n] of r.items ?? []) lines.push(`§f${n}x ${itemName(id)}`);
  for (const [job, xp] of Object.entries(r.jobXp ?? {})) lines.push(`${JOBS[job].color}${xp} ${JOBS[job].name} XP`);
  if (r.weapon?.kind === "fine_t1") lines.push("§aA Fine Tier I weapon §7(you choose the type)");
  if (r.weapon?.kind === "fine_t2") lines.push("§aA Fine Tier II weapon §7(you choose the type)");
  if (r.weapon?.kind === "masterwork_t2") {
    const inf = (r.weapon.infusions ?? []).map((id) => INFUSIONS[id].name).join(" + ");
    lines.push(`§6A Masterwork Tier II weapon${inf ? ` with ${inf}` : ""} §7(you choose the type)`);
  }
  if (r.weapon?.kind === "relic") lines.push("§d§lA Relic weapon§r§7: unbreakable, 3 built-in infusions, the best stats on the floor. Needs Lv 25 for full strength, but even at half it beats ordinary weapons (you choose the type)");
  return lines.join("\n");
}

async function chooseWeaponType(player, reward) {
  const form = new ActionFormData().title("§l§6Choose Your Reward").body("§7Pick the weapon type you want.");
  const options = WEAPON_KEYS.map((t) => [t, rewardWeaponDef(reward.kind, t)[1]]);
  for (const [t, def] of options) {
    const extra = reward.kind === "relic" ? `\n§8${def.infusions.map((id) => INFUSIONS[id].name).join(", ")}` : "";
    form.button(`${def.name} §8(${WEAPONS[t].name})${extra}`, WEAPONS[t].icon);
  }
  const res = await show(player, form);
  if (res.canceled || res.selection === undefined) return undefined;
  return options[res.selection][0];
}

export async function turnIn(player, q) {
  if (questStatus(player, q) !== "ready") return false;
  const r = q.rewards;
  let weapon;
  if (r.weapon) {
    const type = await chooseWeaponType(player, r.weapon);
    if (!type) { player.sendMessage("§7[Quest] Come back when you've decided on your reward."); return false; }
    if (questStatus(player, q) !== "ready") return false; // something changed while the form was open
    weapon = makeRewardWeapon(r.weapon, type);
  }
  const collects = q.objectives.filter((o) => o.type === "collect").map((o) => ({ item: o.item, count: o.count }));
  takeAll(player, collects);

  const data = getData(player);
  const s = qstate(data);
  delete s.active[q.id];
  s.done[q.id] = (s.done[q.id] ?? 0) + 1;
  data.col += r.col ?? 0;
  markDirty(player);
  addXp(player, r.xp ?? 0);
  for (const [job, xp] of Object.entries(r.jobXp ?? {})) addJobXp(player, job, xp);
  for (const [id, n] of r.items ?? []) give(player, new ItemStack(id, n));
  if (weapon) give(player, weapon);

  const d = DIFFICULTY[q.difficulty];
  player.onScreenDisplay.setTitle("§6QUEST COMPLETE", { subtitle: `${d.color}${q.name}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
  player.playSound(q.difficulty >= 4 ? "random.totem" : "random.levelup");
  player.sendMessage(`§6[Quest] Complete: §f${q.name}\n${rewardText(q)}`);
  return true;
}

// ---------- Dialogue ----------

const STATUS_TAG = {
  ready: "§a[Turn in] ", active: "§e[In progress] ", available: "", locked: "§8[Locked] ", done: "§8[Done] ",
};
const STATUS_ORDER = { ready: 0, available: 1, active: 2, locked: 3, done: 4 };

export async function openNpc(player, npcTypeId) {
  const npc = NPCS[npcTypeId];
  if (!npc) return;
  const quests = QUESTS.filter((q) => q.giver === npc.key)
    .map((q) => [q, questStatus(player, q)])
    .filter(([, st]) => st !== "done")
    .sort((a, b) => STATUS_ORDER[a[1]] - STATUS_ORDER[b[1]] || a[0].difficulty - b[0].difficulty);
  const form = new ActionFormData().title(`§l${npc.name}`).body(`§f"${npc.greeting}"`);
  for (const [q, st] of quests) {
    const d = DIFFICULTY[q.difficulty];
    form.button(`${STATUS_TAG[st]}§r${st === "locked" ? "§8" : "§f"}${q.name}\n${d.color}${d.name}`);
  }
  form.button("§6Shop", "textures/items/gold_nugget");
  form.button("Goodbye");
  const res = await show(player, form);
  if (res.canceled || res.selection === undefined) return;
  if (res.selection < quests.length) return openQuest(player, quests[res.selection][0], npcTypeId);
  if (res.selection === quests.length) return openShop(player, npc.key, npcTypeId);
}

export function questDetailText(player, q) {
  const data = getData(player);
  const d = DIFFICULTY[q.difficulty];
  const objectives = q.objectives.map((o, i) => {
    const have = objectiveProgress(player, q, i);
    return `${have >= o.count ? "§a" : "§7"}- ${objectiveLabel(o)}: ${have}/${o.count}`;
  }).join("\n");
  const st = questStatus(player, q);
  const req = st === "locked" ? `\n§cRequires: ${requiresText(data, q)}` : "";
  const repeat = q.repeatable ? `\n§8Repeatable. Completed ${qstate(data).done[q.id] ?? 0} times.` : "";
  return `${d.color}${d.name} quest§r  §7from ${NPC_BY_KEY[q.giver].name}\n§f${q.desc}${req}\n\n§6Objectives\n${objectives}\n\n§6Rewards\n${rewardText(q)}${repeat}`;
}

export async function openQuest(player, q, npcTypeId) {
  const st = questStatus(player, q);
  const atGiver = npcTypeId && NPCS[npcTypeId]?.key === q.giver;
  const actions = [];
  if (st === "available" && atGiver) actions.push(["§aAccept", () => accept(player, q)]);
  if (st === "ready" && atGiver) actions.push(["§a§lTurn in", () => turnIn(player, q)]);
  if (st === "ready" && !atGiver) actions.push([`§7Turn in at ${NPC_BY_KEY[q.giver].name}`, () => {}]);
  if (st === "active" || st === "ready") actions.push(["§cAbandon", () => abandon(player, q)]);
  const form = new ActionFormData().title(`§l${q.name}`).body(questDetailText(player, q));
  for (const [label] of actions) form.button(label);
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled || res.selection === undefined) return;
  if (res.selection < actions.length) {
    await actions[res.selection][1]();
    if (npcTypeId) return openNpc(player, npcTypeId);
    return;
  }
  if (npcTypeId) return openNpc(player, npcTypeId);
}

/** Quest log for the menu: every active quest, from any giver. */
export function activeQuests(player) {
  return Object.keys(qstate(getData(player)).active).map((id) => QUESTS_BY_ID[id]).filter(Boolean);
}

export function completedCount(player) {
  return Object.keys(qstate(getData(player)).done).length;
}

// ---------- Shops ----------

export async function openShop(player, key, npcTypeId) {
  const shop = SHOPS[key];
  const d = getData(player);
  const form = new ActionFormData().title("§l§6Shop").body(`§6Col: §f${d.col}\n§7Buy one at a time, or sell everything of a kind.`);
  const rows = [];
  for (const [id, price] of shop.buy) {
    rows.push(["buy", id, price]);
    form.button(`${d.col >= price ? "§f" : "§8"}Buy ${itemName(id)} §6${price} Col`);
  }
  for (const [id, price] of shop.sell) {
    const have = countItem(player, id);
    if (have === 0) continue;
    rows.push(["sell", id, price, have]);
    form.button(`§aSell ${have}x ${itemName(id)} §6+${price * have} Col`);
  }
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled || res.selection === undefined) return;
  const row = rows[res.selection];
  if (!row) return npcTypeId ? openNpc(player, npcTypeId) : undefined;
  const [kind, id, price] = row;
  if (kind === "buy") {
    if (d.col < price) player.sendMessage("§c[Shop] Not enough Col.");
    else {
      d.col -= price;
      give(player, new ItemStack(id, 1));
      player.playSound("random.orb");
    }
  } else {
    const have = countItem(player, id);
    takeAll(player, [{ item: id, count: have }]);
    d.col += price * have;
    player.playSound("random.orb", { pitch: 1.2 });
  }
  markDirty(player);
  return openShop(player, key, npcTypeId);
}

// ---------- Registration ----------

export function registerQuests() {
  world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
    const npc = NPCS[ev.target?.typeId];
    if (!npc) return;
    ev.cancel = true;
    const { player, target } = ev;
    system.run(() => {
      if (!player.isValid) return;
      if (target.isValid && !target.nameTag) target.nameTag = npc.name;
      openNpc(player, target.typeId);
    });
  });

  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    const npc = NPCS[entity?.typeId];
    if (npc && !entity.nameTag) entity.nameTag = npc.name;
  });
}
