// Floor 3 guardian: Thunderhoof, the Highland King. Fought in the Crown of Stones.
// Tuned for a player around Lv 17-20; tougher than the Floor 1-2 guardians,
// gentler than the Floor 5 Badlands guardian.
//  - Charge: a roar and a 1 s warning, then a straight charge (12 damage, big knockback). Sidestep.
//  - Ground Quake: if you stay close he rears up (1.25 s warning) and slams the ground: 9 damage and
//    slowness to anyone within 8 blocks who is on the ground. Jump at the right moment, or get clear.
//  - Stampede (below 70%): three lanes across the arena are marked (2 s warning), then a herd of bulls
//    thunders down them. Stand between the lanes. 10 damage per bull that tramples you.
//  - Enrage (below 30%): faster, hits harder, charges more often.

import { world, system, EntityDamageCause } from "@minecraft/server";
import * as F3 from "./floor3_gen.js";
import { directionText } from "./floor1_gen.js";
import { getData } from "./data.js";
import { hudHoldUntil, push } from "./combat.js";
import { rewardGuardian } from "./bosses.js";
import { GameMode } from "@minecraft/server";

const BOSS = "ponce:thunderhoof";
const CALL = "ponce:thunder_call";
const ARENA_TAG = "ponce_arena";
const STAMPEDE_TAG = "ponce_stampede";
const A = F3.ARENA;
const CENTER = { x: A.x + 0.5, y: A.y + 1, z: A.z + 0.5 };
const IGNORED_MODES = [GameMode?.Creative ?? GameMode?.creative, GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);

export const TUNING = {
  chargeEvery: 160, chargeEveryEnraged: 100, chargeWindup: 20, chargeTicks: 14, chargeImpulse: 2.0, chargeDamage: 12, chargeRadius: 3,
  quakeEvery: 280, quakeWindup: 25, quakeTrigger: 6, quakeRadius: 8, quakeDamage: 9,
  stampedeBelow: 0.7, stampedeEvery: 500, stampedeWindup: 40, stampedeTicks: 40, stampedeDamage: 10, lanes: 3, laneWidth: 3,
  enrageAt: 0.3, leashTicks: 20 * 60, col: 400,
};

const state = new Map();
const now = () => system.currentTick;

function S(boss) {
  let s = state.get(boss.id);
  if (!s) {
    s = { nextCharge: now() + 100, nextQuake: now() + 160, nextStampede: now() + 200, enraged: false, lastNear: now(), attack: undefined, bulls: [] };
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

function fx(dim, id, loc) { try { dim.spawnParticle(id, loc); } catch { /* ignore */ } }

function nearest(boss, range) {
  let best, bd = range;
  for (const p of players(boss, range + 4)) { const d = flat(p.location, boss.location); if (d <= bd) { best = p; bd = d; } }
  return best;
}

// ---------- Attacks ----------

function startCharge(boss, s, target) {
  s.attack = { kind: "charge", phase: "windup", until: now() + TUNING.chargeWindup, target, hit: new Set() };
  boss.addEffect("slowness", TUNING.chargeWindup, { amplifier: 10, showParticles: false });
  boss.dimension.playSound("mob.ravager.roar", boss.location, { volume: 2, pitch: 0.6 });
  warnAll(boss, "§c§l! Thunderhoof lowers his horns - move sideways !", TUNING.chargeWindup + 10);
}

function startQuake(boss, s) {
  s.attack = { kind: "quake", until: now() + TUNING.quakeWindup };
  boss.addEffect("slowness", TUNING.quakeWindup, { amplifier: 10, showParticles: false });
  boss.dimension.playSound("mob.ravager.roar", boss.location, { volume: 2, pitch: 1.0 });
  warnAll(boss, "§6§l! Thunderhoof rears up - JUMP or get clear !", TUNING.quakeWindup + 10);
}

function startStampede(boss, s) {
  // Lanes run across the arena along x or z, spaced so the gaps between them are safe
  const alongX = Math.random() < 0.5;
  const offsets = [-10, 0, 10];
  s.attack = { kind: "stampede", phase: "warn", until: now() + TUNING.stampedeWindup, alongX, offsets };
  boss.dimension.playSound("mob.ravager.roar", boss.location, { volume: 2.5, pitch: 0.5 });
  warnAll(boss, "§4§l! STAMPEDE - get out of the marked lanes !", TUNING.stampedeWindup + 10);
  for (const p of players(boss, 40)) p.sendMessage("§4[Thunderhoof] §cThe herd answers its king! §7Stand between the marked lanes.");
}

function laneMarks(dim, s) {
  for (const off of s.offsets) for (let t = -18; t <= 18; t += 3) {
    const loc = s.alongX ? { x: A.x + t + 0.5, y: A.y + 1.2, z: A.z + off + 0.5 } : { x: A.x + off + 0.5, y: A.y + 1.2, z: A.z + t + 0.5 };
    fx(dim, "minecraft:villager_angry", loc);
  }
}

function releaseHerd(boss, s) {
  const dim = boss.dimension;
  s.attack = { kind: "stampede", phase: "run", until: now() + TUNING.stampedeTicks, alongX: s.attack.alongX, offsets: s.attack.offsets };
  for (const off of s.attack.offsets) {
    const start = s.attack.alongX ? { x: A.x - 19.5, y: A.y + 1, z: A.z + off + 0.5 } : { x: A.x + off + 0.5, y: A.y + 1, z: A.z - 19.5 };
    try {
      const bull = dim.spawnEntity("ponce:highland_bull", start);
      bull.addTag(STAMPEDE_TAG);
      s.bulls.push({ bull, hit: new Set() });
    } catch { /* blocked */ }
  }
  dim.playSound("mob.ravager.step", boss.location, { volume: 3, pitch: 0.6 });
}

function runHerd(boss, s) {
  const dir = s.attack.alongX ? { x: 1, z: 0 } : { x: 0, z: 1 };
  for (const b of s.bulls) {
    if (!b.bull.isValid) continue;
    try { b.bull.applyImpulse({ x: dir.x * 0.6, y: 0, z: dir.z * 0.6 }); } catch { /* ignore */ }
    for (const p of b.bull.dimension.getPlayers({ location: b.bull.location, maxDistance: 2, excludeGameModes: IGNORED_MODES })) {
      if (b.hit.has(p.id)) continue;
      b.hit.add(p.id);
      p.applyDamage(TUNING.stampedeDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: b.bull });
      push(p, { x: dir.z || dir.x, z: dir.x || dir.z }, 1.5, 0.5);
    }
  }
}

function clearHerd(s) {
  for (const b of s.bulls) if (b.bull.isValid) b.bull.remove();
  s.bulls = [];
}

function tick(boss) {
  const s = S(boss);
  const dim = boss.dimension;
  const target = nearest(boss, 40);
  if (target) s.lastNear = now();
  else if (now() - s.lastNear > TUNING.leashTicks) { clearHerd(s); state.delete(boss.id); boss.remove(); return; }

  // Leash to the Crown
  if (boss.hasTag(ARENA_TAG) && flat(boss.location, A) > A.radius + 4) { try { boss.teleport(CENTER); } catch { /* ignore */ } }

  const r = ratio(boss);
  if (!s.enraged && r <= TUNING.enrageAt) {
    s.enraged = true;
    boss.triggerEvent("ponce:enrage");
    dim.playSound("mob.ravager.roar", boss.location, { volume: 3, pitch: 0.4 });
    for (const p of players(boss, 48)) p.sendMessage("§4[Thunderhoof] §cThe Highland King is enraged! He's faster and hits harder.");
  }

  const a = s.attack;
  if (a?.kind === "charge") {
    if (a.phase === "windup" && now() >= a.until) {
      const t = a.target?.isValid ? a.target.location : boss.location;
      const dx = t.x - boss.location.x, dz = t.z - boss.location.z, len = Math.hypot(dx, dz) || 1;
      a.dir = { x: dx / len, z: dz / len };
      a.phase = "dash";
      a.until = now() + TUNING.chargeTicks;
      boss.applyImpulse({ x: a.dir.x * TUNING.chargeImpulse, y: 0.15, z: a.dir.z * TUNING.chargeImpulse });
    } else if (a.phase === "dash") {
      boss.applyImpulse({ x: a.dir.x * 0.3, y: 0, z: a.dir.z * 0.3 });
      for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.chargeRadius, excludeGameModes: IGNORED_MODES })) {
        if (a.hit.has(p.id)) continue;
        a.hit.add(p.id);
        p.applyDamage(TUNING.chargeDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
        push(p, a.dir, 3, 0.6);
      }
      if (now() >= a.until) { s.attack = undefined; s.nextCharge = now() + (s.enraged ? TUNING.chargeEveryEnraged : TUNING.chargeEvery); }
    }
    return;
  }
  if (a?.kind === "quake") {
    if (now() < a.until) return;
    s.attack = undefined;
    s.nextQuake = now() + TUNING.quakeEvery;
    s.nextCharge = Math.max(s.nextCharge, now() + 40);
    dim.playSound("random.explode", boss.location, { volume: 1.5, pitch: 0.6 });
    fx(dim, "minecraft:huge_explosion_emitter", boss.location);
    for (const p of dim.getPlayers({ location: boss.location, maxDistance: TUNING.quakeRadius, excludeGameModes: IGNORED_MODES })) {
      if (p.isOnGround === false) continue; // jumped over the shockwave
      p.applyDamage(TUNING.quakeDamage, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
      p.addEffect("slowness", 60, { amplifier: 1 });
      const dx = p.location.x - boss.location.x, dz = p.location.z - boss.location.z, len = Math.hypot(dx, dz) || 1;
      push(p, { x: dx / len, z: dz / len }, 1.2, 0.4);
    }
    return;
  }
  if (a?.kind === "stampede") {
    if (a.phase === "warn") {
      if (now() % 6 === 0) laneMarks(dim, a);
      if (now() >= a.until) releaseHerd(boss, s);
      return;
    }
    runHerd(boss, s);
    if (now() >= a.until) { clearHerd(s); s.attack = undefined; s.nextStampede = now() + TUNING.stampedeEvery; }
    return;
  }

  if (!target) return;
  if (r <= TUNING.stampedeBelow && now() >= s.nextStampede) return startStampede(boss, s);
  if (now() >= s.nextQuake && flat(target.location, boss.location) <= TUNING.quakeTrigger) return startQuake(boss, s);
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
    p.onScreenDisplay.setTitle("§bThunderhoof", { subtitle: "§7the Highland King, Guardian of Floor 3", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
  }
  return true;
}

export function registerThunderhoof() {
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (itemStack?.typeId === CALL && source.typeId === "minecraft:player") blowCall(source);
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId !== BOSS) return;
    const s = state.get(deadEntity.id);
    if (s) clearHerd(s);
    state.delete(deadEntity.id);
    rewardGuardian(deadEntity.dimension, deadEntity.location, { floor: 3, type: BOSS, fallen: "Thunderhoof, the Highland King has fallen", col: TUNING.col });
  });
  system.runInterval(() => {
    for (const boss of world.getDimension("overworld").getEntities({ type: BOSS })) {
      try { tick(boss); } catch (e) { console.warn(`[Ponce] thunderhoof: ${e}`); }
    }
  }, 2);
}

export { state as thunderState };
