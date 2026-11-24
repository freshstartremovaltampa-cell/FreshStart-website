// The player menu, opened with the Wayfarer's Compass.

import { system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { MASTERY_CAP, STATS, STAT_KEYS, WEAPONS, WEAPON_HANDLING, WEAPON_KEYS, xpToNext } from "./config.js";
import { getData, markDirty, resetData } from "./data.js";
import {
  addMastery, addXp, applyStatEffects, checkSkillUnlocks, critChance, damageMultiplier,
  dodgeChance, masteryRank,
} from "./progression.js";
import { SKILLS, describeRequirements } from "./skills.js";
import { LORE } from "./lore.js";
import { show } from "./ui.js";
import { JOBS, JOB_MAX, jobXpToNext } from "./jobs.js";
import { ORES } from "./jobs_data.js";
import { buffActive } from "./cooking.js";
import { needsStarter, offerStarter } from "./starter.js";
import { activeQuests, completedCount, isComplete, MAX_ACTIVE, objectiveProgress, openQuest } from "./quests.js";
import { DIFFICULTY, NPCS } from "./quests_data.js";
import { travelToFloor1, travelToWorldSpawn } from "./floor1.js";
import { FLOOR1 } from "./floor1_gen.js";
import { equippedSkill } from "./abilities.js";
import { INFUSIONS, WEAPON_DEFS } from "./weapon_data.js";
import { describeInfusion, describeWeaponReq } from "./weapons.js";
import { itemName } from "./inventory.js";

const DIV = "§8────────────────";

function bar(value, max, len = 20, on = "§a", off = "§8") {
  const filled = Math.round((Math.min(value, max) / max) * len);
  return `${on}${"|".repeat(filled)}${off}${"|".repeat(len - filled)}`;
}

const pct = (n) => `${Math.round(n * 100)}%`;

// ---------- Main menu ----------

export async function openMainMenu(player) {
  const d = getData(player);
  const hp = player.getComponent("minecraft:health");
  const next = xpToNext(d.level);

  const form = new ActionFormData()
    .title("§l§6THE ASCENT OF PONCE")
    .body(
      `§f${player.name}  §eLv ${d.level}\n` +
      `§cHP §f${Math.ceil(hp?.currentValue ?? 0)} / ${Math.round(hp?.effectiveMax ?? 20)}\n` +
      `§bEXP ${bar(d.xp, next)} §7${d.xp}/${next}\n` +
      `§6Col §f${d.col}    §dFloor §f${d.highestFloor}\n${DIV}`
    );

  const entries = [];
  if (needsStarter(player)) entries.push(["§a§lChoose your starter weapon", "textures/items/weapons/wayfarers_sword", offerStarter]);
  entries.push(
    [`Status${d.statPoints > 0 ? `  §a(+${d.statPoints})` : ""}`, "textures/items/totem", openStatus],
    ["Skills", "textures/items/book_enchanted", openSkills],
    ["Weapon Mastery", "textures/items/weapons/iron_longsword", openMastery],
    ["Armory", "textures/items/weapons/iron_greatsword", openArmory],
    ["Jobs", "textures/items/iron_pickaxe", openJobs],
    [`Quests  §8(${activeQuests(player).length}/${MAX_ACTIVE})`, "textures/items/book_writable", openQuestLog],
    ["Travel", "textures/items/map_filled", openTravel],
    ["Journal", "textures/items/book_normal", openJournal],
    ["Settings", "textures/items/redstone_dust", openSettings],
  );
  if (player.hasTag("ponce_dev")) entries.push(["§cDev Tools", "textures/items/barrier", openDev]);
  for (const [label, icon] of entries) form.button(label, icon);

  const res = await show(player, form);
  if (res.canceled) return;
  player.playSound("random.click");
  await entries[res.selection]?.[2](player);
}


// ---------- Status / stats ----------

async function openStatus(player) {
  const d = getData(player);
  const lines = STAT_KEYS.map((k) => `${STATS[k].color}${STATS[k].name}: §f${d.stats[k]}\n§7  ${STATS[k].desc}`);
  const form = new ActionFormData()
    .title("§l§6Status")
    .body(
      `§eLv ${d.level}   §aUnspent points: ${d.statPoints}\n${DIV}\n` +
      lines.join("\n") +
      `\n${DIV}\n§7Melee bonus: §f+${pct(damageMultiplier(d) - 1)}  §7Crit: §f${pct(critChance(d))}  §7Dodge: §f${pct(dodgeChance(d))}\n` +
      `§7Kills: §f${d.kills}   §7Deaths: §f${d.deaths}` +
      (buffActive(d) ? `\n§eMeal: ${d.foodBuff.name} §7(${Object.entries(d.foodBuff.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(", ")}, already included above)` : "")
    );
  if (d.statPoints > 0) form.button("§aAllocate Points", "textures/items/experience_bottle");
  form.button("Back");

  const res = await show(player, form);
  if (res.canceled) return;
  if (d.statPoints > 0 && res.selection === 0) return allocatePoints(player);
  return openMainMenu(player);
}

async function allocatePoints(player) {
  const d = getData(player);
  const form = new ModalFormData().title("§l§6Allocate Points");
  form.label?.(`§7You have §a${d.statPoints}§7 points. Points are permanent.`);
  for (const k of STAT_KEYS) {
    form.slider(`${STATS[k].color}${STATS[k].name} §7(now ${d.stats[k]})`, 0, d.statPoints, { valueStep: 1, defaultValue: 0 });
  }
  form.submitButton("Confirm");

  const res = await show(player, form);
  if (res.canceled) return openStatus(player);
  const values = res.formValues.filter((v) => typeof v === "number");
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return openStatus(player);
  if (total > d.statPoints) {
    player.sendMessage(`§c[Ponce] You tried to spend ${total} points but only have ${d.statPoints}.`);
    return allocatePoints(player);
  }
  STAT_KEYS.forEach((k, i) => (d.stats[k] += values[i]));
  d.statPoints -= total;
  markDirty(player);
  applyStatEffects(player);
  checkSkillUnlocks(player);
  player.playSound("random.orb");
  return openStatus(player);
}

// ---------- Skills ----------

async function openSkills(player) {
  const d = getData(player);
  const form = new ActionFormData()
    .title("§l§6Skills")
    .body(
      "§7Skills belong to you, not your weapon. Train with a weapon type and your stats to unlock its skills.\n\n" +
      "§fHow to use: §7hold a Ponce weapon and press §fuse§7 (right-click, or long-press on mobile).\n" +
      "§fSwitch skill: §7sneak + use, or pick one here.\n§8Vanilla weapons build mastery but can't use skills."
    );
  for (const key of WEAPON_KEYS) {
    const total = SKILLS.filter((s) => s.weapon === key).length;
    const owned = SKILLS.filter((s) => s.weapon === key && d.skills.includes(s.id)).length;
    form.button(`${WEAPONS[key].name}  §8${owned}/${total}`, WEAPONS[key].icon);
  }
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled) return;
  if (res.selection >= WEAPON_KEYS.length) return openMainMenu(player);
  return openWeaponSkills(player, WEAPON_KEYS[res.selection]);
}

async function openWeaponSkills(player, weapon) {
  const d = getData(player);
  const equipped = equippedSkill(d, weapon);
  const all = SKILLS.filter((s) => s.weapon === weapon);
  const text = all.map((s) => {
    const owned = d.skills.includes(s.id);
    const kind = s.kind === "active" ? `§3Active, ${s.cooldown}s cooldown` : "§5Passive";
    const tag = owned && s.id === equipped?.id ? " §b[EQUIPPED]" : "";
    const head = owned ? `§a[+] §f${s.name}${tag}` : `§8[-] §7${s.name}`;
    const req = owned ? "" : `\n§7  Needs: ${describeRequirements(d, s, WEAPONS[weapon].name)}`;
    return `${head}  ${kind}\n§7  ${s.desc}${req}`;
  }).join(`\n${DIV}\n`);
  const choices = all.filter((s) => s.kind === "active" && d.skills.includes(s.id) && s.id !== equipped?.id);
  const form = new ActionFormData()
    .title(`§l§6${WEAPONS[weapon].name}`)
    .body(
      `§7Mastery: §f${Math.floor(d.mastery[weapon])}/${MASTERY_CAP} ${masteryRank(d.mastery[weapon])}\n` +
      `§7Handling: §f${WEAPON_HANDLING[weapon].trait}\n${DIV}\n${text}`
    );
  for (const s of choices) form.button(`Equip ${s.name}`);
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled) return;
  if (res.selection < choices.length) {
    d.activeSkill[weapon] = choices[res.selection].id;
    markDirty(player);
    player.playSound("random.click");
    return openWeaponSkills(player, weapon);
  }
  return openSkills(player);
}

// ---------- Travel ----------

async function openTravel(player) {
  const res = await show(player, new ActionFormData()
    .title("§l§6Travel")
    .body("§7Floor 1 is a floating island far above the world. Its town is safe; the forest around it is not.\n§8More floors open as the tower is built.")
    .button(`§f${FLOOR1.name}\n§7Floor 1 town`, "textures/items/compass_item")
    .button("§fWorld spawn\n§7The world below the tower", "textures/items/map_empty")
    .button("Back"));
  if (res.canceled) return;
  if (res.selection === 0) return travelToFloor1(player);
  if (res.selection === 1) return travelToWorldSpawn(player);
  return openMainMenu(player);
}

// ---------- Quests ----------

async function openQuestLog(player) {
  const list = activeQuests(player);
  const form = new ActionFormData()
    .title("§l§6Quest Log")
    .body(
      `§7Active: §f${list.length}/${MAX_ACTIVE}   §7Completed: §f${completedCount(player)}\n` +
      "§7Quest givers on this floor: " + Object.values(NPCS).map((n) => `§f${n.name}`).join("§7, ") +
      (list.length === 0 ? "\n\n§8No active quests. Talk to a quest giver to take one." : "")
    );
  for (const q of list) {
    const done = q.objectives.reduce((a, o, i) => a + Math.min(1, objectiveProgress(player, q, i) / o.count), 0);
    const pctDone = Math.floor((done / q.objectives.length) * 100);
    const d = DIFFICULTY[q.difficulty];
    form.button(`${isComplete(player, q) ? "§a[Ready] " : ""}§f${q.name}\n${d.color}${d.name} §8- ${pctDone}%`);
  }
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled) return;
  if (res.selection < list.length) {
    await openQuest(player, list[res.selection]);
    return openQuestLog(player);
  }
  return openMainMenu(player);
}

// ---------- Jobs ----------

async function openJobs(player) {
  const d = getData(player);
  const lines = Object.entries(JOBS).map(([k, j]) => {
    const { level, xp } = d.jobs[k];
    const next = jobXpToNext(level);
    const prog = level >= JOB_MAX ? "§6MAX" : `${bar(xp, next, 20, "§e")} §7${xp}/${next}`;
    return `${j.color}${j.name} §fLv ${level}\n${prog}\n§8${j.desc}`;
  }).join(`\n${DIV}\n`);
  const ores = Object.values(ORES).map((o) => `§f${o.name}: §7Mining ${o.level}, ${o.pickaxe} pickaxe+, regrows in ${o.regen}s`).join("\n");
  const res = await show(player, new ActionFormData()
    .title("§l§6Jobs")
    .body(
      `${lines}\n${DIV}\n§6How it works\n` +
      "§fMining: §7find ore nodes underground. They regrow after you mine them. Smelt raw ore in a furnace.\n" +
      "§fSmithing: §7use a Smithing Forge, pick a weapon, then punch the forge in time to shape the blade.\n" +
      "§fCooking: §7use a Cooking Pot, pick a recipe, then punch the pot when it's done. Meals give a temporary stat buff.\n" +
      `${DIV}\n§6Ore nodes\n${ores}`
    )
    .button("Back"));
  if (!res.canceled) return openMainMenu(player);
}

// ---------- Armory ----------

function infusionList() {
  return Object.entries(INFUSIONS).map(([id, inf]) => `§f${inf.name} §8(${inf.cost}x ${itemName(id)})§7: ${describeInfusion(inf)}`).join("\n");
}

async function openArmory(player) {
  const d = getData(player);
  const byTier = (tier) => Object.values(WEAPON_DEFS).filter((w) => w.tier === tier)
    .map((w) => `§f${w.name} §8(${WEAPONS[w.type].name}, ${w.damage} dmg)\n  ${describeWeaponReq(d, w)}`).join("\n");
  const res = await show(player, new ActionFormData()
    .title("§l§6Armory")
    .body(
      "§7Ponce weapons are §fforged§7 at a Smithing Forge, not crafted. They have level and stat requirements. Below them, a weapon deals only 25% damage and can't use skills. " +
      "Weapons never grant abilities; every weapon type handles differently.\n" +
      `${DIV}\n§7Starter §8- chosen once on first login, can't be forged\n${byTier(0)}\n` +
      `${DIV}\n§eTier I §7- Ironheart + Ember Copper, Smithing 1\n${byTier(1)}\n` +
      `${DIV}\n§bTier II §7- Ironheart + Glimmer Silver + Floor 1 materials, Smithing 8\n${byTier(2)}\n` +
      `${DIV}\n§dInfusions §7- optional monster drops added while forging (Tier I: 1 slot, Tier II: 2)\n${infusionList()}`
    )
    .button("Back"));
  if (!res.canceled) return openMainMenu(player);
}

// ---------- Mastery ----------

async function openMastery(player) {
  const d = getData(player);
  const text = WEAPON_KEYS.map((k) =>
    `§f${WEAPONS[k].name} ${masteryRank(d.mastery[k])}\n${bar(d.mastery[k], MASTERY_CAP, 25, "§b")} §7${Math.floor(d.mastery[k])}/${MASTERY_CAP}  §8(${d.weaponMinutes[k]} min)`
  ).join("\n");
  const res = await show(player, new ActionFormData()
    .title("§l§6Weapon Mastery")
    .body(`§7Mastery grows slowly from kills, hits and time spent fighting with a weapon type. Tougher enemies teach you more. True mastery takes a long climb.\n${DIV}\n${text}`)
    .button("Back"));
  if (!res.canceled) return openMainMenu(player);
}

// ---------- Journal ----------

async function openJournal(player, page = 0) {
  const entry = LORE[page];
  const form = new ActionFormData().title(`§l§6Journal §8${page + 1}/${LORE.length}`).body(`§l${entry.title}§r\n\n${entry.text}`);
  const hasPrev = page > 0;
  const hasNext = page < LORE.length - 1;
  if (hasPrev) form.button("< Previous");
  if (hasNext) form.button("Next >");
  form.button("Back");
  const res = await show(player, form);
  if (res.canceled) return;
  let i = res.selection;
  if (hasPrev && i-- === 0) return openJournal(player, page - 1);
  if (hasNext && i-- === 0) return openJournal(player, page + 1);
  return openMainMenu(player);
}

// ---------- Settings ----------

async function openSettings(player) {
  const d = getData(player);
  const res = await show(player, new ModalFormData()
    .title("§l§6Settings")
    .toggle("Show HP / EXP bar above hotbar", { defaultValue: d.settings.hud })
    .submitButton("Save"));
  if (res.canceled) return openMainMenu(player);
  d.settings.hud = res.formValues.find((v) => typeof v === "boolean") ?? d.settings.hud;
  markDirty(player);
  return openMainMenu(player);
}

// ---------- Dev tools (players tagged "ponce_dev") ----------

async function openDev(player) {
  const res = await show(player, new ActionFormData()
    .title("§l§cDev Tools")
    .button("+1,000 EXP")
    .button("+10,000 EXP")
    .button("+100 mastery to all weapons")
    .button("+10 Col")
    .button("Give all Ponce weapons")
    .button("Unlock all skills + 60 in every stat")
    .button("Job kit: ingots, forge, pot, ingredients")
    .button("All jobs to level 20")
    .button("Spawn the quest givers here")
    .button("§cReset my progress")
    .button("Back"));
  if (res.canceled) return;
  const d = getData(player);
  switch (res.selection) {
    case 0: addXp(player, 1000); break;
    case 1: addXp(player, 10000); break;
    case 2: WEAPON_KEYS.forEach((k) => addMastery(player, k, 100, true)); break;
    case 3: d.col += 10; markDirty(player); break;
    case 4: {
      const inv = player.getComponent("minecraft:inventory")?.container;
      for (const id of Object.keys(WEAPON_DEFS)) inv?.addItem(new ItemStack(id, 1));
      player.sendMessage("§a[Ponce] Gave every Ponce weapon (needs free inventory space).");
      break;
    }
    case 5:
      d.level = Math.max(d.level, 40);
      for (const k of STAT_KEYS) d.stats[k] = Math.max(d.stats[k], 60);
      for (const s of SKILLS) if (!d.skills.includes(s.id)) d.skills.push(s.id);
      markDirty(player);
      applyStatEffects(player);
      player.sendMessage("§a[Ponce] All skills unlocked, Lv 40, 60 in every stat.");
      break;
    case 6: {
      const kit = [["ponce:ironheart_ingot", 16], ["ponce:ember_copper_ingot", 8], ["ponce:glimmer_silver_ingot", 4],
        ["ponce:smithing_forge", 1], ["ponce:cooking_pot", 1], ["ponce:raw_boar", 8], ["ponce:raw_hare", 4],
        ["ponce:jelly_gel", 6], ["minecraft:stick", 8], ["minecraft:carrot", 4], ["minecraft:bowl", 4],
        ["minecraft:wheat", 4], ["minecraft:sugar", 4], ["minecraft:potato", 8], ["minecraft:iron_pickaxe", 1]];
      const inv = player.getComponent("minecraft:inventory")?.container;
      for (const [id, n] of kit) inv?.addItem(new ItemStack(id, n));
      player.sendMessage("§a[Ponce] Job kit given (needs free inventory space).");
      break;
    }
    case 7:
      for (const j of Object.values(d.jobs)) j.level = Math.max(j.level, 20);
      markDirty(player);
      player.sendMessage("§a[Ponce] Mining, Smithing and Cooking set to level 20.");
      break;
    case 8: {
      const ids = Object.keys(NPCS);
      ids.forEach((id, i) => {
        const a = (i / ids.length) * Math.PI * 2;
        const loc = { x: player.location.x + Math.cos(a) * 3, y: player.location.y, z: player.location.z + Math.sin(a) * 3 };
        const npc = player.dimension.spawnEntity(id, loc);
        npc.nameTag = NPCS[id].name;
      });
      player.sendMessage("§a[Ponce] Spawned the quest givers. Use them (right-click / long-press) to talk.");
      break;
    }
    case 9: resetData(player); applyStatEffects(player); player.sendMessage("§c[Ponce] Progress reset."); break;
    default: return openMainMenu(player);
  }
  return openDev(player);
}
