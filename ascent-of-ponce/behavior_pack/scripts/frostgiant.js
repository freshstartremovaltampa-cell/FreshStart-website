// Floor 4 guardian: Rimegrasp, the Frost Giant. Fought in the Frozen Cirque.
// Tuned for a player around Lv 23-26; tougher than Thunderhoof, gentler than
// the Floor 5 Badlands guardian.
//
//  - Chill: while he lives, the Cirque's cold builds on everyone inside it (one stack every 3 s).
//    Stand by one of the four braziers to thaw out. At 5 stacks you freeze solid: heavy slowness and 6 damage.
//    A Warming Broth halves how fast the chill builds.
//  - Icicle Fall: he raises his club and slams the ice; icicles crack loose above every fighter (circles marked, 1.5 s warning): 10 damage. Move.
//  - Frost Breath: he rears back (1.25 s warning) and breathes a cone of frost in front of him:
//    8 damage and +2 Chill. Get behind or beside him.
//  - Below 50%: he calls two Frost Wolves, and from then on stamps out a brazier every 20 s
//    (each one relights 30 s later), so there are fewer places to warm up.
//  - Enrage (below 25%): faster, hits harder, icicles fall more often.

import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import * as F4 from "./floor4_gen.js";
import { directionText } from "./floor1_gen.js";
import { getData } from "./data.js";
import { hudHoldUntil } from "./combat.js";
import { rewardGuardian } from "./bosses.js";

const BOSS = "ponce:frost_giant";
const SIGIL = "ponce:frost_sigil";
const ARENA_TAG = "ponce_arena";
const WOLF_TAG = "ponce_giant_wolf";
const A = F4.ARENA;
const CENTER = { x: A.x + 0.5, y: A.y + 1, z: A.z + 0.5 };
const IGNORED_MODES = [GameMode?.Creative ?? GameMode?.creative, GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);
const FIRE = "minecraft:campfire";

export const TUNING = {
  chillEvery: 60, chillEveryWarm: 120, chillMax: 5, thawEvery: 20, warmRadius: 3.5,
  frozenTicks: 60, frozenDamage: 6, frozenResetTo: 2,
  icicleEvery: 180, icicleEveryEnraged: 120, icicleWindup: 30, icicleRadius: 2, icicleDamage: 10, extraIcicles: 2,
  breathEvery: 220, breathWindup: 25, breathRange: 9, breathDamage: 8, breathChill: 2, breathTrigger: 8,
  wolvesAt: 0.5, wolves: 2, snuffEvery: 400, relightTicks: 600,
  enrageAt: 0.25, leashTicks: 20 * 60, col: 550,
};

const state = new Map();
export const chill = new Map(); // player id -> stacks
const now = () => system.currentTick;

function S(boss) {
  let s = state.get(boss.id);
  if (!s) {
    s = { enraged: false, wolvesCalled: false, lastNear: now(), attack: undefined, out: new Map(),
      nextIcicle: now() + 120, nextBreath: now() + 80, nextSnuff: 0 };
    state.set(boss.id, s);
  }
  return s;
}

const ratio = (e) => { const h = e.getComponent("minecraft:health"); return h ? h.currentValue / h.effectiveMax : 1; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function players(boss, range) {
  return boss.dimension.getPlayers({ location: boss.location, maxDistance: range, excludeGameModes: IGNORED_MODES });
}

function warn(p, text, ticks) { p.onScreenDisplay.setActionBar(text); hudHoldUntil.set(p.id, now() + ticks); }
function warnAll(boss, text, ticks) { for (const p of players(boss, 40)) warn(p, text, ticks); }
function tellAll(boss, text) { for (const p of players(boss, 48)) p.sendMessage(text); }
function fx(dim, id, loc) { try { dim.spawnParticle(id, loc); } catch { /* ignore */ } }

function nearest(boss, range) {
  let best, bd = range;
  for (const p of players(boss, range + 4)) { const d = flat(p.location, boss.location); if (d <= bd) { best = p; bd = d; } }
  return best;
}

export function inCirque(loc) {
  return flat(loc, A) <= A.radius + 1 && Math.abs(loc.y - (A.y + 1)) <= 10;
}

// ---------- Braziers and Chill ----------

export function brazierLit(dim, b) {
  try { return dim.getBlock(b)?.typeId === FIRE; } catch { return false; }
}

export function nearLitBrazier(dim, loc) {
  return F4.BRAZIERS.some((b) => flat(loc, b) <= TUNING.warmRadius && Math.abs(loc.y - b.y) <= 3 && brazierLit(dim, b));
}

function warmMeal(player) {
  const b = getData(player).foodBuff;
  return !!b && b.name === "Warming Broth" && b.until > world.getAbsoluteTime();
}

function chillBar(n) {
  return `§bChill ${"§b❄".repeat(n)}${"§8❄".repeat(Math.max(0, TUNING.chillMax - n))}`;
}

export function addChill(player, n) {
  const v = Math.min(TUNING.chillMax, (chill.get(player.id) ?? 0) + n);
  chill.set(player.id, v);
  if (v >= TUNING.chillMax) freeze(player);
  else warn(player, chillBar(v) + (v >= 3 ? "  §f- get to a brazier!" : ""), 30);
}

function freeze(player) {
  chill.set(player.id, TUNING.frozenResetTo);
  player.addEffect("slowness", TUNING.frozenTicks, { amplifier: 4, showParticles: true });
  player.addEffect("mining_fatigue", TUNING.frozenTicks, { amplifier: 2, showParticles: false });
  player.applyDamage(TUNING.frozenDamage, { cause: EntityDamageCause.freezing ?? EntityDamageCause.magic });
  warn(player, "§b§lFROZEN! §r§fThaw out at a brazier.", 50);
  try { player.dimension.playSound("random.glass", player.location, { volume: 1.5, pitch: 0.6 }); } catch { /* ignore */ }
}

function chillTick(boss, s) {
  const dim = boss.dimension;
  for (const p of players(boss, 48)) {
    if (!inCirque(p.location)) continue;
    if (nearLitBrazier(dim, p.location)) {
      if (now() % TUNING.thawEvery === 0 && (chill.get(p.id) ?? 0) > 0) {
        chill.set(p.id, chill.get(p.id) - 1);
        warn(p, chillBar(chill.get(p.id)) + "  §6warming up...", 25);
      }
      continue;
    }
    const every = warmMeal(p) ? TUNING.chillEveryWarm : TUNING.chillEvery;
    if (now() % every === 0) addChill(p, 1);
  }
  // Snuffed braziers relight on their own
  for (const [i, until] of s.out) {
    if (now() < until) continue;
    s.out.delete(i);
    try { dim.getBlock(F4.BRAZIERS[i])?.setType(FIRE); } catch { /* unloaded */ }
    fx(dim, "minecraft:lava_particle", F4.BRAZIERS[i]);
  }
}

function snuff(boss, s) {
  const dim = boss.dimension;
  const lit = F4.BRAZIERS.map((b, i) => i).filter((i) => !s.out.has(i) && brazierLit(dim, F4.BRAZIERS[i]));
  s.nextSnuff = now() + TUNING.snuffEvery;
  if (lit.length <= 1) return; // always leave at least one fire burning
  const target = nearest(boss, 40);
  // the brazier nearest the player he's fighting goes out first
  lit.sort((a, b) => (target ? flat(F4.BRAZIERS[a], target.location) - flat(F4.BRAZIERS[b], target.location) : 0));
  const i = lit[0];
  try { dim.getBlock(F4.BRAZIERS[i])?.setType("minecraft:air"); } catch { return; }
  s.out.set(i, now() + TUNING.relightTicks);
  dim.playSound("random.fizz", F4.BRAZIERS[i], { volume: 2, pitch: 0.6 });
  fx(dim, "minecraft:large_explosion", F4.BRAZIERS[i]);
  tellAll(boss, "§3[Rimegrasp] §bA gust of frost snuffs out a brazier! §7It will relight in 30 s.");
}

// ---------- Attacks ----------

function startIcicles(boss, s) {
  const spots = players(boss, 40).filter((p) => inCirque(p.location)).map((p) => ({ x: p.location.x, y: p.location.y, z: p.location.z }));
  for (let i = 0; i < TUNING.extraIcicles; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (A.radius - 6);
    spots.push({ x: A.x + 0.5 + Math.cos(a) * r, y: A.y + 1, z: A.z + 0.5 + Math.sin(a) * r });
  }
  s.attack = { kind: "icicles", until: now() + TUNING.icicleWindup, spots };
  setPose(boss, 2); // he raises his club to slam the ice and shake the icicles loose
  boss.dimension.playSound("random.glass", boss.location, { volume: 2, pitch: 0.4 });
  warnAll(boss, "§b§l! Icicles crack loose overhead - move out of the circles !", TUNING.icicleWindup + 10);
}

function icicleMarks(dim, spots) {
  for (const c of spots) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    fx(dim, "minecraft:snowflake_particle", { x: c.x + Math.cos(a) * TUNING.icicleRadius, y: c.y + 0.3, z: c.z + Math.sin(a) * TUNING.icicleRadius });
  }
}

function dropIcicles(boss, s) {
  const dim = boss.dimension, spots = s.attack.spots;
  s.attack = undefined;
  s.nextIcicle = now() + (s.enraged ? TUNING.icicleEveryEnraged : TUNING.icicleEvery);
  setPose(boss, 0);
  dim.playSound("random.explode", boss.location, { volume: 1.2, pitch: 0.5 });
  const hit = new Set();
  for (const c of spots) {
    dim.playSound("random.glass", c, { volume: 1.5, pitch: 0.8 });
    fx(dim, "minecraft:knockback_roar_particle", c);
    for (const p of dim.getPlayers({ location: c, maxDistance: TUNING.icicleRadius + 0.5, excludeGameModes: IGNORED_MODES })) {
      if (hit.has(p.id)) continue;
      hit.add(p.id);
      p.applyDamage(TUNING.icicleDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
    }
  }
}

function facing(boss) {
  const v = boss.getViewDirection?.() ?? { x: 0, z: 1 };
  const len = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / len, z: v.z / len };
}

function setPose(boss, n) { try { boss.setProperty("ponce:pose", n); } catch { /* ignore */ } }

function startBreath(boss, s) {
  s.attack = { kind: "breath", until: now() + TUNING.breathWindup };
  setPose(boss, 1);
  boss.addEffect("slowness", TUNING.breathWindup, { amplifier: 10, showParticles: false });
  boss.dimension.playSound("mob.irongolem.say", boss.location, { volume: 2, pitch: 0.4 });
  warnAll(boss, "§3§l! Rimegrasp draws a freezing breath - get out of his way !", TUNING.breathWindup + 10);
}

function breathe(boss, s) {
  s.attack = undefined;
  s.nextBreath = now() + (s.enraged ? Math.round(TUNING.breathEvery * 0.7) : TUNING.breathEvery);
  setPose(boss, 0);
  const dim = boss.dimension, f = facing(boss);
  for (let d = 2; d <= TUNING.breathRange; d += 2) fx(dim, "minecraft:snowflake_particle", { x: boss.location.x + f.x * d, y: boss.location.y + 2, z: boss.location.z + f.z * d });
  dim.playSound("mob.breeze.wind_burst", boss.location, { volume: 2, pitch: 0.5 });
  for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.breathRange + 1, excludeGameModes: IGNORED_MODES })) {
    const dx = p.location.x - boss.location.x, dz = p.location.z - boss.location.z, len = Math.hypot(dx, dz) || 1;
    if (len > TUNING.breathRange || (dx * f.x + dz * f.z) / len < 0.55) continue;
    p.applyDamage(TUNING.breathDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
    addChill(p, TUNING.breathChill);
  }
}

function callWolves(boss, s) {
  s.wolvesCalled = true;
  s.nextSnuff = now() + 100;
  for (let i = 0; i < TUNING.wolves; i++) {
    const a = Math.random() * Math.PI * 2;
    try {
      const w = boss.dimension.spawnEntity("ponce:frost_wolf", { x: A.x + 0.5 + Math.cos(a) * 8, y: A.y + 1, z: A.z + 0.5 + Math.sin(a) * 8 });
      w.addTag(WOLF_TAG);
    } catch { /* blocked */ }
  }
  boss.dimension.playSound("mob.wolf.howl", boss.location, { volume: 3, pitch: 0.7 });
  for (const p of players(boss, 48)) {
    p.onScreenDisplay.setTitle("§bThe Pack Answers", { subtitle: "§7Rimegrasp calls his wolves", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
  }
  tellAll(boss, "§3[Rimegrasp] §bThe giant howls for his pack! §7From now on he'll snuff out braziers too.");
}

function relightAll(dim, s) {
  for (const i of s.out.keys()) { try { dim.getBlock(F4.BRAZIERS[i])?.setType(FIRE); } catch { /* unloaded */ } }
  s.out.clear();
}

function endFight(boss, s) {
  relightAll(boss.dimension, s);
  for (const w of boss.dimension.getEntities({ type: "ponce:frost_wolf", tags: [WOLF_TAG] })) w.remove();
  chill.clear();
}

// ---------- Tick ----------

function tick(boss) {
  const s = S(boss);
  const dim = boss.dimension;
  const target = nearest(boss, 40);
  if (target) s.lastNear = now();
  else if (now() - s.lastNear > TUNING.leashTicks) { endFight(boss, s); state.delete(boss.id); boss.remove(); return; }

  if (boss.hasTag(ARENA_TAG) && flat(boss.location, A) > A.radius + 4) { try { boss.teleport(CENTER); } catch { /* ignore */ } }

  chillTick(boss, s);

  const r = ratio(boss);
  if (!s.wolvesCalled && r <= TUNING.wolvesAt) callWolves(boss, s);
  if (!s.enraged && r <= TUNING.enrageAt) {
    s.enraged = true;
    boss.triggerEvent("ponce:enrage");
    dim.playSound("mob.irongolem.death", boss.location, { volume: 3, pitch: 0.4 });
    tellAll(boss, "§3[Rimegrasp] §bThe Frost Giant is enraged! He's faster and hits harder.");
  }

  const a = s.attack;
  if (a?.kind === "icicles") {
    if (now() % 6 === 0) icicleMarks(dim, a.spots);
    if (now() >= a.until) dropIcicles(boss, s);
    return;
  }
  if (a?.kind === "breath") { if (now() >= a.until) breathe(boss, s); return; }

  if (!target) return;
  if (s.wolvesCalled && now() >= s.nextSnuff) snuff(boss, s);
  if (now() >= s.nextIcicle) return startIcicles(boss, s);
  if (now() >= s.nextBreath && flat(target.location, boss.location) <= TUNING.breathTrigger) return startBreath(boss, s);
}

// ---------- Summoning and victory ----------

export function raiseSigil(player) {
  if ((getData(player).highestFloor ?? 1) < 4) {
    player.sendMessage("§7[Ponce] The sigil stays cold and dark. §fYou haven't reached Floor 4 yet.");
    return false;
  }
  if (!inCirque(player.location)) {
    const where = F4.isOnFloor(player.location) ? `It's ${directionText(player.location, A)}, at the end of the north trail.` : "It's on Floor 4, at the end of the north trail from Frosthollow.";
    player.sendMessage(`§7[Ponce] The sigil glimmers faintly, then fades. §fRaise it inside the Frozen Cirque. §7${where}`);
    return false;
  }
  if (player.dimension.getEntities({ type: BOSS, location: A, maxDistance: 64 }).length > 0) {
    player.sendMessage("§c[Ponce] Rimegrasp is already here.");
    return false;
  }
  player.dimension.spawnEntity(BOSS, CENTER).addTag(ARENA_TAG);
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (inv && inv.getItem(player.selectedSlotIndex)?.typeId === SIGIL) inv.setItem(player.selectedSlotIndex, undefined);
  player.dimension.playSound("mob.irongolem.say", A, { volume: 4, pitch: 0.3 });
  for (const p of player.dimension.getPlayers({ location: A, maxDistance: 48 })) {
    p.onScreenDisplay.setTitle("§bRimegrasp", { subtitle: "§7the Frost Giant, Guardian of Floor 4", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
    p.sendMessage("§3[Rimegrasp] §bThe Cirque's cold bites deeper. §7Keep near the braziers to stay warm.");
  }
  return true;
}

export function registerFrostGiant() {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack?.typeId === SIGIL && source.typeId === "minecraft:player") raiseSigil(source);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== BOSS) return;
    const s = state.get(deadEntity.id);
    if (s) endFight(deadEntity, s);
    state.delete(deadEntity.id);
    rewardGuardian(deadEntity.dimension, deadEntity.location, { floor: 4, type: BOSS, fallen: "Rimegrasp, the Frost Giant has fallen", col: TUNING.col });
  });
  world.afterEvents.playerLeave?.subscribe(({ playerId }) => chill.delete(playerId));
  system.runInterval(() => {
    for (const boss of world.getDimension("overworld").getEntities({ type: BOSS })) {
      try { tick(boss); } catch (e) { console.warn(`[Ponce] frost giant: ${e}`); }
    }
  }, 1);
}

export { state as frostState };
