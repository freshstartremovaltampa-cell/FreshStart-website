// Job levels: Mining, Smithing, Cooking (1-50). Separate from combat level.

import { getData, markDirty } from "./data.js";

export const JOBS = {
  mining: { name: "Mining", color: "§7", desc: "Higher levels open tougher ore nodes and give a chance of double ore." },
  smithing: { name: "Smithing", color: "§6", desc: "Higher levels unlock better weapons and make forging timing more forgiving." },
  cooking: { name: "Cooking", color: "§e", desc: "Higher levels unlock recipes and widen the perfect cooking window." },
};
export const JOB_MAX = 50;

export function jobXpToNext(level) {
  return Math.floor(40 * Math.pow(level, 1.4));
}

export function jobLevel(data, job) {
  return data.jobs[job]?.level ?? 1;
}

export function addJobXp(player, job, amount) {
  const data = getData(player);
  const j = data.jobs[job];
  if (!j || j.level >= JOB_MAX || amount <= 0) return;
  j.xp += Math.round(amount);
  let up = false;
  while (j.level < JOB_MAX && j.xp >= jobXpToNext(j.level)) {
    j.xp -= jobXpToNext(j.level);
    j.level++;
    up = true;
  }
  markDirty(player);
  if (up) {
    player.sendMessage(`§6[Ponce] ${JOBS[job].color}${JOBS[job].name}§f is now level §e${j.level}§f!`);
    player.playSound("random.levelup", { pitch: 1.3 });
  }
}
