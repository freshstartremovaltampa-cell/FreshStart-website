// The player menu, opened with the Wayfarer's Compass.

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { MASTERY_CAP, STATS, STAT_KEYS, WEAPONS, WEAPON_KEYS, xpToNext } from "./config.js";
import { getData, markDirty, resetData } from "./data.js";
import {
  addMastery, addXp, applyStatEffects, checkSkillUnlocks, critChance, damageMultiplier,
  dodgeChance, masteryRank,
} from "./progression.js";
import { SKILLS, describeRequirements } from "./skills.js";
import { LORE } from "./lore.js";

const DIV = "§8────────────────";

/** Show a form, retrying while the player has chat or another screen open. */
async function show(player, form, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const res = await form.show(player);
    if (res.cancelationReason !== FormCancelationReason.UserBusy) return res;
    await new Promise((r) => system.runTimeout(r, 5));
  }
  return { canceled: true };
}

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
    )
    .button(`Status${d.statPoints > 0 ? `  §a(+${d.statPoints})` : ""}`, "textures/items/totem")
    .button("Skills", "textures/items/book_enchanted")
    .button("Weapon Mastery", "textures/items/iron_sword")
    .button("Quests  §8(coming soon)", "textures/items/book_writable")
    .button("Floor Map  §8(coming soon)", "textures/items/map_filled")
    .button("Journal", "textures/items/book_normal")
    .button("Settings", "textures/items/redstone_dust");

  const dev = player.hasTag("ponce_dev");
  if (dev) form.button("§cDev Tools", "textures/items/barrier");

  const res = await show(player, form);
  if (res.canceled) return;
  player.playSound("random.click");
  const pages = [openStatus, openSkills, openMastery, comingSoon, comingSoon, openJournal, openSettings, openDev];
  await pages[res.selection]?.(player);
}

async function comingSoon(player) {
  const res = await show(player, new ActionFormData()
    .title("§l§6Coming Soon")
    .body("Quests and the Floor Map come in a later update.\n\nFor now, climb by fighting: every kill earns EXP and weapon mastery.")
    .button("Back"));
  if (!res.canceled) await openMainMenu(player);
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
      `§7Kills: §f${d.kills}   §7Deaths: §f${d.deaths}`
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
  const form = new ActionFormData()
    .title("§l§6Skills")
    .body("§7Skills belong to you, not your weapon. Use a weapon type and train your stats to unlock its skills.\n§8(Using skills in combat comes in the next update.)")
    ;
  for (const key of WEAPON_KEYS) {
    const d = getData(player);
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
  const text = SKILLS.filter((s) => s.weapon === weapon).map((s) => {
    const owned = d.skills.includes(s.id);
    const head = owned ? `§a[+] §f${s.name}` : `§8[-] §7${s.name}`;
    const req = owned ? "" : `\n§7  Needs: ${describeRequirements(d, s, WEAPONS[weapon].name)}`;
    return `${head}\n§7  ${s.desc}${req}`;
  }).join(`\n${DIV}\n`);
  const res = await show(player, new ActionFormData()
    .title(`§l§6${WEAPONS[weapon].name}`)
    .body(`§7Mastery: §f${d.mastery[weapon]}/${MASTERY_CAP} ${masteryRank(d.mastery[weapon])}\n${DIV}\n${text}`)
    .button("Back"));
  if (!res.canceled) return openSkills(player);
}

// ---------- Mastery ----------

async function openMastery(player) {
  const d = getData(player);
  const text = WEAPON_KEYS.map((k) =>
    `§f${WEAPONS[k].name} ${masteryRank(d.mastery[k])}\n${bar(d.mastery[k], MASTERY_CAP, 25, "§b")} §7${d.mastery[k]}/${MASTERY_CAP}  §8(${d.weaponMinutes[k]} min)`
  ).join("\n");
  const res = await show(player, new ActionFormData()
    .title("§l§6Weapon Mastery")
    .body(`§7Mastery grows from hits, kills and time spent fighting with a weapon type. Higher mastery means more damage and unlocks skills.\n${DIV}\n${text}`)
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
    .button("§cReset my progress")
    .button("Back"));
  if (res.canceled) return;
  const d = getData(player);
  switch (res.selection) {
    case 0: addXp(player, 1000); break;
    case 1: addXp(player, 10000); break;
    case 2: WEAPON_KEYS.forEach((k) => addMastery(player, k, 100)); break;
    case 3: d.col += 10; markDirty(player); break;
    case 4: resetData(player); applyStatEffects(player); player.sendMessage("§c[Ponce] Progress reset."); break;
    default: return openMainMenu(player);
  }
  return openDev(player);
}
