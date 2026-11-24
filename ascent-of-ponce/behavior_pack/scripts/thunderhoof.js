// Floor 3 guardian: Thunderhoof, the Centaur King. Fought in the Crown of Stones.
// Tuned for a player around Lv 17-20; tougher than the Floor 1-2 guardians,
// gentler than the Floor 5 Badlands guardian.
//
// Phase 1 - the Archer (above 50% health):
//  - Aimed Shot: looses an arrow at the nearest player every couple of seconds. Keep moving, use cover (the stones).
//  - Arrow Rain: marks a circle under a player (1.5 s warning), then arrows rain down on it: 9 damage. Leave the circle.
//  - Kiting: he gallops away from anyone who gets close. Corner him against the stones.
// At 50% he throws the bow aside and draws a sword and shield.
// Phase 2 - the Warrior:
//  - Melee: he fights up close with his sword.
//  - Charge: a 1 s warning, then a straight charge (12 damage, big knockback). Sidestep.
//  - Sword Sweep: he raises the blade (1 s warning), then sweeps the area in front of him: 11 damage. Get behind him or back off.
//  - Shield Stance: he raises his shield for 3 s. Hits from the front are blocked; hits from behind land in full.
//  - Enrage (below 25%): faster, hits harder, attacks more often.

import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import * as F3 from "./floor3_gen.js";
import { directionText } from "./floor1_gen.js";
import { getData } from "./data.js";
import { hudHoldUntil, push } from "./combat.js";
import { rewardGuardian } from "./bosses.js";

const BOSS = "ponce:thunderhoof";
const CALL = "ponce:thunder_call";
const ARENA_TAG = "ponce_arena";
const A = F3.ARENA;
const CENTER = { x: A.x + 0.5, y: A.y + 1, z: A.z + 0.5 };
const IGNORED_MODES = [GameMode?.Creative ?? GameMode?.creative, GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);

export const TUNING = {
  // Phase 1
  shotEvery: 40, shotEveryEnraged: 30, arrowSpeed: 2.2,
  rainEvery: 240, rainWindup: 30, rainRadius: 4, rainDamage: 9,
  kiteRange: 7, kiteImpulse: 0.7, kiteEvery: 30,
  phase2At: 0.5,
  // Phase 2
  chargeEvery: 180, chargeEveryEnraged: 110, chargeWindup: 20, chargeTicks: 14, chargeImpulse: 2.0, chargeDamage: 12, chargeRadius: 3,
  sweepEvery: 140, sweepWindup: 20, sweepRange: 5, sweepDamage: 11, sweepTrigger: 5,
  shieldEvery: 200, shieldTicks: 60, shieldBlock: 0.8,
  enrageAt: 0.25, leashTicks: 20 * 60, col: 400,
};

const state = new Map();
const now = () => system.currentTick;

function S(boss) {
  let s = state.get(boss.id);
  if (!s) {
    s = {
      phase: 1, enraged: false, lastNear: now(), attack: undefined, shieldUntil: 0,
      nextShot: now() + 40, nextRain: now() + 160, nextKite: 0,
      nextCharge: 0, nextSweep: 0, nextShield: 0,
    };
    state.set(boss.id, s);
  }
  return s;
}

const ratio = (e) => { const h = e.getComponent("minecraft:health"); return h ? h.currentValue / h.effectiveMax : 1; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function players(boss, range) {
  return boss.dimension.getPlayers({ location: boss.location, maxDistance: range, excludeGameModes: IGNORED_MODES });
}

function warnAll(boss, text, ticks) {
  for (const p of players(boss, 40)) {
    p.onScreenDisplay.setActionBar(text);
    hudHoldUntil.set(p.id, now() + ticks);
  }
}

function tellAll(boss, text) { for (const p of players(boss, 48)) p.sendMessage(text); }

function fx(dim, id, loc) { try { dim.spawnParticle(id, loc); } catch { /* ignore */ } }

function nearest(boss, range) {
  let best, bd = range;
  for (const p of players(boss, range + 4)) { const d = flat(p.location, boss.location); if (d <= bd) { best = p; bd = d; } }
  return best;
}

function facing(boss) {
  const v = boss.getViewDirection?.() ?? { x: 0, z: 1 };
  const len = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / len, z: v.z / len };
}

/** True when `loc` is in front of the boss (within ~60 degrees either side of where he faces). */
function inFront(boss, loc, cosLimit = 0.5) {
  const f = facing(boss);
  const dx = loc.x - boss.location.x, dz = loc.z - boss.location.z, len = Math.hypot(dx, dz) || 1;
  return (dx * f.x + dz * f.z) / len >= cosLimit;
}

// ---------- Phase 1: the Archer ----------

/** Fires one arrow from the boss's shoulder towards `to`. Returns the arrow (or undefined). */
export function shootArrow(boss, to, speed = TUNING.arrowSpeed) {
  const from = { x: boss.location.x, y: boss.location.y + 3.6, z: boss.location.z };
  const dx = to.x - from.x, dy = to.y + 1.2 - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  // a little lift so long shots arc onto the target
  const v = { x: (dx / len) * speed, y: (dy / len) * speed + Math.min(0.25, len * 0.008), z: (dz / len) * speed };
  let arrow;
  try { arrow = boss.dimension.spawnEntity("minecraft:arrow", { x: from.x + v.x * 0.6, y: from.y, z: from.z + v.z * 0.6 }); } catch { return undefined; }
  const proj = arrow.getComponent?.("minecraft:projectile");
  if (proj) {
    try { proj.owner = boss; } catch { /* ignore */ }
    try { proj.shoot(v); } catch { arrow.applyImpulse(v); }
  } else {
    try { arrow.applyImpulse(v); } catch { /* ignore */ }
  }
  return arrow;
}

function aimedShot(boss, s, target) {
  shootArrow(boss, target.location);
  boss.dimension.playSound("random.bow", boss.location, { volume: 1.5, pitch: 0.8 });
  s.nextShot = now() + (s.enraged ? TUNING.shotEveryEnraged : TUNING.shotEvery);
}

function startRain(boss, s, target) {
  const c = { x: target.location.x, y: target.location.y, z: target.location.z };
  s.attack = { kind: "rain", until: now() + TUNING.rainWindup, center: c };
  boss.dimension.playSound("random.bow", boss.location, { volume: 2, pitch: 0.5 });
  warnAll(boss, "§6§l! Thunderhoof draws to the sky - leave the marked circle !", TUNING.rainWindup + 10);
}

function rainMarks(dim, c) {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    fx(dim, "minecraft:villager_angry", { x: c.x + Math.cos(a) * TUNING.rainRadius, y: c.y + 0.3, z: c.z + Math.sin(a) * TUNING.rainRadius });
  }
}

function landRain(boss, s) {
  const dim = boss.dimension, c = s.attack.center;
  s.attack = undefined;
  s.nextRain = now() + TUNING.rainEvery;
  s.nextShot = Math.max(s.nextShot, now() + 20);
  for (let i = 0; i < 6; i++) { // visual volley falling into the circle
    const a = Math.random() * Math.PI * 2, r = Math.random() * TUNING.rainRadius;
    try {
      const arrow = dim.spawnEntity("minecraft:arrow", { x: c.x + Math.cos(a) * r, y: c.y + 8, z: c.z + Math.sin(a) * r });
      arrow.applyImpulse({ x: 0, y: -1.5, z: 0 });
    } catch { /* blocked */ }
  }
  dim.playSound("random.bowhit", c, { volume: 2, pitch: 0.7 });
  for (const p of dim.getPlayers({ location: c, maxDistance: TUNING.rainRadius + 0.5, excludeGameModes: IGNORED_MODES })) {
    p.applyDamage(TUNING.rainDamage, { cause: EntityDamageCause.projectile, damagingEntity: boss });
  }
}

function kite(boss, s, target) {
  if (now() < s.nextKite || flat(target.location, boss.location) > TUNING.kiteRange) return;
  const dx = boss.location.x - target.location.x, dz = boss.location.z - target.location.z, len = Math.hypot(dx, dz) || 1;
  let dir = { x: dx / len, z: dz / len };
  // don't gallop out of the Crown: if that would leave it, veer back towards the middle instead
  const ahead = { x: boss.location.x + dir.x * 6, z: boss.location.z + dir.z * 6 };
  if (flat(ahead, A) > A.radius - 2) {
    const cx = A.x - boss.location.x, cz = A.z - boss.location.z, cl = Math.hypot(cx, cz) || 1;
    dir = { x: (cx / cl + -dir.z) / 2, z: (cz / cl + dir.x) / 2 };
  }
  try { boss.applyImpulse({ x: dir.x * TUNING.kiteImpulse, y: 0.1, z: dir.z * TUNING.kiteImpulse }); } catch { /* ignore */ }
  s.nextKite = now() + TUNING.kiteEvery;
}

function enterPhase2(boss, s) {
  s.phase = 2;
  s.attack = undefined;
  s.nextCharge = now() + 80;
  s.nextSweep = now() + 50;
  s.nextShield = now() + 120;
  try { boss.triggerEvent("ponce:phase2"); } catch { /* ignore */ }
  boss.dimension.playSound("item.shield.block", boss.location, { volume: 2, pitch: 0.6 });
  boss.dimension.playSound("mob.horse.angry", boss.location, { volume: 3, pitch: 0.6 });
  for (const p of players(boss, 48)) {
    p.onScreenDisplay.setTitle("§cSword and Shield", { subtitle: "§7Thunderhoof casts his bow aside", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
  }
  tellAll(boss, "§4[Thunderhoof] §cThe Centaur King draws his sword! §7Strike from behind while his shield is up.");
}

// ---------- Phase 2: the Warrior ----------

function startCharge(boss, s, target) {
  s.attack = { kind: "charge", phase: "windup", until: now() + TUNING.chargeWindup, target, hit: new Set() };
  boss.addEffect("slowness", TUNING.chargeWindup, { amplifier: 10, showParticles: false });
  boss.dimension.playSound("mob.horse.angry", boss.location, { volume: 2, pitch: 0.6 });
  warnAll(boss, "§c§l! Thunderhoof paws the ground - move sideways !", TUNING.chargeWindup + 10);
}

function runCharge(boss, s, a) {
  const dim = boss.dimension;
  if (a.phase === "windup") {
    if (now() < a.until) return;
    const t = a.target?.isValid ? a.target.location : boss.location;
    const dx = t.x - boss.location.x, dz = t.z - boss.location.z, len = Math.hypot(dx, dz) || 1;
    a.dir = { x: dx / len, z: dz / len };
    a.phase = "dash";
    a.until = now() + TUNING.chargeTicks;
    boss.applyImpulse({ x: a.dir.x * TUNING.chargeImpulse, y: 0.15, z: a.dir.z * TUNING.chargeImpulse });
    return;
  }
  boss.applyImpulse({ x: a.dir.x * 0.3, y: 0, z: a.dir.z * 0.3 });
  for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.chargeRadius, excludeGameModes: IGNORED_MODES })) {
    if (a.hit.has(p.id)) continue;
    a.hit.add(p.id);
    p.applyDamage(TUNING.chargeDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
    push(p, a.dir, 3, 0.6);
  }
  if (now() >= a.until) { s.attack = undefined; s.nextCharge = now() + (s.enraged ? TUNING.chargeEveryEnraged : TUNING.chargeEvery); }
}

function startSweep(boss, s) {
  s.attack = { kind: "sweep", until: now() + TUNING.sweepWindup };
  boss.addEffect("slowness", TUNING.sweepWindup, { amplifier: 10, showParticles: false });
  boss.dimension.playSound("mob.horse.angry", boss.location, { volume: 2, pitch: 1.1 });
  warnAll(boss, "§6§l! Thunderhoof raises his blade - get behind him !", TUNING.sweepWindup + 10);
}

function landSweep(boss, s) {
  s.attack = undefined;
  s.nextSweep = now() + (s.enraged ? Math.round(TUNING.sweepEvery * 0.7) : TUNING.sweepEvery);
  const dim = boss.dimension;
  dim.playSound("entity.player.attack.sweep", boss.location, { volume: 2, pitch: 0.6 });
  const f = facing(boss);
  fx(dim, "minecraft:critical_hit_emitter", { x: boss.location.x + f.x * 2.5, y: boss.location.y + 1.5, z: boss.location.z + f.z * 2.5 });
  for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.sweepRange + 1, excludeGameModes: IGNORED_MODES })) {
    if (flat(p.location, boss.location) > TUNING.sweepRange || !inFront(boss, p.location, 0.2)) continue;
    p.applyDamage(TUNING.sweepDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
    push(p, f, 1.6, 0.4);
  }
}

function raiseShield(boss, s) {
  s.shieldUntil = now() + TUNING.shieldTicks;
  s.nextShield = now() + TUNING.shieldEvery + TUNING.shieldTicks;
  boss.dimension.playSound("item.shield.block", boss.location, { volume: 2, pitch: 0.8 });
  warnAll(boss, "§b§l! Thunderhoof raises his shield - strike from behind !", TUNING.shieldTicks);
}

export function shieldUp(boss) {
  const s = state.get(boss.id);
  return !!s && s.phase === 2 && now() < s.shieldUntil;
}

/** Called from entityHurt: frontal hits while the shield is up are mostly blocked. */
export function onBossHurt(boss, damage, attacker) {
  if (!shieldUp(boss) || !attacker?.location || !inFront(boss, attacker.location, 0.2)) return false;
  const h = boss.getComponent("minecraft:health");
  if (!h) return false;
  const back = damage * TUNING.shieldBlock;
  h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + back));
  boss.dimension.playSound("item.shield.block", boss.location, { volume: 1.5, pitch: 1 });
  if (attacker.typeId === "minecraft:player") {
    attacker.onScreenDisplay?.setActionBar("§7Blocked! §fGet behind him.");
    hudHoldUntil.set(attacker.id, now() + 20);
  }
  return true;
}

// ---------- Tick ----------

function tick(boss) {
  const s = S(boss);
  const dim = boss.dimension;
  const target = nearest(boss, 40);
  if (target) s.lastNear = now();
  else if (now() - s.lastNear > TUNING.leashTicks) { state.delete(boss.id); boss.remove(); return; }

  // Leash to the Crown
  if (boss.hasTag(ARENA_TAG) && flat(boss.location, A) > A.radius + 4) { try { boss.teleport(CENTER); } catch { /* ignore */ } }

  const r = ratio(boss);
  if (s.phase === 1 && r <= TUNING.phase2At && !s.attack) return enterPhase2(boss, s);
  if (!s.enraged && s.phase === 2 && r <= TUNING.enrageAt) {
    s.enraged = true;
    boss.triggerEvent("ponce:enrage");
    dim.playSound("mob.horse.angry", boss.location, { volume: 3, pitch: 0.4 });
    tellAll(boss, "§4[Thunderhoof] §cThe Centaur King is enraged! He's faster and hits harder.");
  }
  if (s.phase === 2 && now() < s.shieldUntil && now() % 8 === 0) fx(dim, "minecraft:villager_happy", { ...boss.location, y: boss.location.y + 2 });

  const a = s.attack;
  if (a?.kind === "rain") {
    if (now() % 6 === 0) rainMarks(dim, a.center);
    if (now() >= a.until) landRain(boss, s);
    return;
  }
  if (a?.kind === "charge") return runCharge(boss, s, a);
  if (a?.kind === "sweep") { if (now() >= a.until) landSweep(boss, s); return; }

  if (!target) return;
  if (s.phase === 1) {
    kite(boss, s, target);
    if (now() >= s.nextRain) return startRain(boss, s, target);
    if (now() >= s.nextShot) return aimedShot(boss, s, target);
    return;
  }
  if (now() < s.shieldUntil) return; // he holds his ground behind the shield
  if (now() >= s.nextShield) return raiseShield(boss, s);
  if (now() >= s.nextSweep && flat(target.location, boss.location) <= TUNING.sweepTrigger) return startSweep(boss, s);
  if (now() >= s.nextCharge) return startCharge(boss, s, target);
}

// ---------- Summoning and victory ----------

export function inCrown(loc) {
  return flat(loc, A) <= A.radius + 1 && Math.abs(loc.y - (A.y + 1)) <= 8;
}

export function blowCall(player) {
  if ((getData(player).highestFloor ?? 1) < 3) {
    player.sendMessage("§7[Ponce] The call fades on the wind. §fYou haven't reached Floor 3 yet.");
    return false;
  }
  if (!inCrown(player.location)) {
    const where = F3.isOnFloor(player.location) ? `It's ${directionText(player.location, A)}, at the end of the north trail.` : "It's on Floor 3, at the end of the north trail from Cairnhold.";
    player.sendMessage(`§7[Ponce] The call rolls across the hills, but nothing answers. §fBlow it inside the Crown of Stones. §7${where}`);
    return false;
  }
  if (player.dimension.getEntities({ type: BOSS, location: A, maxDistance: 64 }).length > 0) {
    player.sendMessage("§c[Ponce] Thunderhoof is already here.");
    return false;
  }
  player.dimension.spawnEntity(BOSS, CENTER).addTag(ARENA_TAG);
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (inv && inv.getItem(player.selectedSlotIndex)?.typeId === CALL) inv.setItem(player.selectedSlotIndex, undefined);
  player.dimension.playSound("raid.horn", A, { volume: 4, pitch: 0.7 });
  for (const p of player.dimension.getPlayers({ location: A, maxDistance: 48 })) {
    p.onScreenDisplay.setTitle("§bThunderhoof", { subtitle: "§7the Centaur King, Guardian of Floor 3", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
  }
  return true;
}

export function registerThunderhoof() {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack?.typeId === CALL && source.typeId === "minecraft:player") blowCall(source);
  });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== BOSS || !hurtEntity.isValid) return;
    try { onBossHurt(hurtEntity, damage, damageSource?.damagingEntity); } catch { /* ignore */ }
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== BOSS) return;
    state.delete(deadEntity.id);
    rewardGuardian(deadEntity.dimension, deadEntity.location, { floor: 3, type: BOSS, fallen: "Thunderhoof, the Centaur King has fallen", col: TUNING.col });
  });
  system.runInterval(() => {
    for (const boss of world.getDimension("overworld").getEntities({ type: BOSS })) {
      try { tick(boss); } catch (e) { console.warn(`[Ponce] thunderhoof: ${e}`); }
    }
  }, 2);
}

export { state as thunderState };
