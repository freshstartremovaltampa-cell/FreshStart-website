// Multi-head creatures (hydra-kind). The Mire Hydra on Floor 2 is the first;
// later floors add more species to SPECIES with the same rules:
//
//  - The body carries its heads as riders. The body can't be hurt; each head
//    has its own health pool and is fought separately.
//  - A slain head is severed and starts a regrowth timer. When it runs out the
//    head grows back at full health (with a warning shortly before).
//  - The creature only falls when every head is dead at the same time. So the
//    way to win is to wear all heads down, then finish them in quick succession.
//  - The body's health (and boss bar) mirrors the heads' combined health.
//  - Heads bite what's in front of them; acid heads spit pools of poison; the
//    last surviving head enrages and attacks twice as often.

import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import * as F2 from "./floor2_gen.js";
import { directionText } from "./floor1_gen.js";
import { getData, markDirty } from "./data.js";
import { addMastery, addXp, getHeldItem, weaponTypeOf } from "./progression.js";
import { hudHoldUntil, push } from "./combat.js";
import { rewardGuardian } from "./bosses.js";
import { MOBS } from "./config.js";

const DIM = "overworld";
const ARENA_TAG = "ponce_arena";

export const SPECIES = {
  "ponce:mire_hydra": {
    name: "Mire Hydra",
    floor: 2,
    heads: ["ponce:hydra_head", "ponce:hydra_head_acid", "ponce:hydra_head"], // one per seat
    headNames: ["Left head", "Middle head", "Right head"],
    seats: [[-1.3, 3.5, -1.5], [0, 3.9, -2.0], [1.3, 3.5, -1.5]],
    regrowSeconds: 30,
    warnSeconds: 8,
    bite: { damage: 9, everyTicks: 90, windupTicks: 15, reach: 8, radius: 3 },
    acid: { damage: 4, poisonTicks: 80, everyTicks: 160, windupTicks: 25, range: 16, radius: 2.5, lingerTicks: 60 },
    arena: F2.ARENA,
    lure: "ponce:mire_lure",
    fallen: "The Mire Hydra has fallen",
    col: 250,
    loot: [["ponce:hydra_fang", 1, 2], ["ponce:hydra_scale", 2, 4], ["ponce:gator_hide", 1, 2]],
  },
};

const HEAD_TYPES = new Set(Object.values(SPECIES).flatMap((s) => s.heads));

// body id -> { species, slots: [{ head, deadAt?, regrowAt?, warned, nextAttack, windup? }], pools: [], lastHitter, typeId }
export const fights = new Map();

const now = () => system.currentTick;

function seatPosition(body, seat) {
  const yaw = ((body.getRotation?.().y ?? 0) * Math.PI) / 180;
  const fwd = { x: -Math.sin(yaw), z: Math.cos(yaw) }, left = { x: Math.cos(yaw), z: Math.sin(yaw) };
  const [sx, sy, sz] = seat;
  return { x: body.location.x + left.x * sx - fwd.x * sz, y: body.location.y + sy, z: body.location.z + left.z * sx - fwd.z * sz };
}

function attachHead(body, f, i) {
  const sp = f.species;
  const head = body.dimension.spawnEntity(sp.heads[i], seatPosition(body, sp.seats[i]));
  head.setDynamicProperty("ponce:body", body.id);
  head.setDynamicProperty("ponce:seat", i);
  head.nameTag = `§c${sp.headNames[i]}`;
  try { body.getComponent("minecraft:rideable")?.addRider(head); } catch { /* positioned by tick instead */ }
  f.slots[i] = { head, warned: false, nextAttack: now() + 40 + i * 25 };
  return head;
}

/** Spawn a multi-head creature with all its heads. */
export function spawnMultihead(dim, typeId, loc) {
  const sp = SPECIES[typeId];
  const body = dim.spawnEntity(typeId, loc);
  body.addTag(ARENA_TAG);
  const f = { species: sp, typeId, slots: [], pools: [], lastHitter: undefined };
  fights.set(body.id, f);
  sp.heads.forEach((_, i) => attachHead(body, f, i));
  return body;
}

/** After a reload, rebuild the fight from the riders still attached. */
function fightFor(body) {
  let f = fights.get(body.id);
  if (f) return f;
  const sp = SPECIES[body.typeId];
  f = { species: sp, typeId: body.typeId, slots: sp.heads.map(() => undefined), pools: [], lastHitter: undefined };
  const riders = body.getComponent("minecraft:rideable")?.getRiders?.() ?? [];
  for (const r of riders) {
    const i = r.getDynamicProperty?.("ponce:seat");
    if (typeof i === "number" && HEAD_TYPES.has(r.typeId)) f.slots[i] = { head: r, warned: false, nextAttack: now() + 40 };
  }
  f.slots = f.slots.map((s) => s ?? { regrowAt: now() + sp.regrowSeconds * 20, warned: false });
  fights.set(body.id, f);
  return f;
}

const alive = (slot) => !!slot?.head?.isValid;

function nearbyPlayers(body, range = 40) {
  return body.dimension.getPlayers({ location: body.location, maxDistance: range });
}

function say(body, text, range = 48) {
  for (const p of nearbyPlayers(body, range)) p.sendMessage(text);
}

// ---------- Head deaths, regrowth and defeat ----------

function onHeadDeath(head, killer) {
  const bodyId = head.getDynamicProperty?.("ponce:body");
  const i = head.getDynamicProperty?.("ponce:seat");
  const body = typeof bodyId === "string" ? world.getEntity(bodyId) : undefined;
  if (!body?.isValid || typeof i !== "number") return;
  const f = fightFor(body);
  const sp = f.species;
  if (killer?.typeId === "minecraft:player") f.lastHitter = killer;
  f.slots[i] = { deadAt: now(), regrowAt: now() + sp.regrowSeconds * 20, warned: false };
  body.dimension.playSound("mob.ravager.death", body.location, { volume: 2, pitch: 0.6 });

  const living = f.slots.filter(alive).length;
  if (living === 0) return defeat(body, f);
  say(body, `§c[${sp.name}] §f${sp.headNames[i]} severed! §7It regrows in ${sp.regrowSeconds}s unless every head falls before then. (${living} left)`);
  if (living === 1) {
    say(body, `§4[${sp.name}] §cThe last head goes into a frenzy!`);
  }
}

function defeat(body, f) {
  const sp = f.species;
  const dim = body.dimension;
  const loc = { ...body.location };
  fights.delete(body.id);
  for (const p of f.pools) p.done = true;
  for (const [id, lo, hi] of sp.loot) {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (n > 0) dim.spawnItem(new ItemStack(id, n), { x: loc.x, y: loc.y + 1, z: loc.z });
  }
  const killer = f.lastHitter?.isValid ? f.lastHitter : undefined;
  const mob = MOBS[f.typeId];
  if (killer && mob) {
    addXp(killer, mob.xp);
    const weapon = weaponTypeOf(getHeldItem(killer));
    if (weapon) addMastery(killer, weapon, mob.mastery ?? 0);
    const d = getData(killer); d.kills++; markDirty(killer);
  }
  dim.playSound("mob.enderdragon.death", loc, { volume: 1.5, pitch: 1.2 });
  try { dim.spawnParticle("minecraft:huge_explosion_emitter", loc); } catch { /* ignore */ }
  body.remove();
  rewardGuardian(dim, loc, { floor: sp.floor, type: f.typeId, fallen: sp.fallen, col: sp.col });
}

function regrowTick(body, f) {
  const sp = f.species;
  f.slots.forEach((slot, i) => {
    if (alive(slot) || !slot?.regrowAt) return;
    const left = slot.regrowAt - now();
    if (!slot.warned && left <= sp.warnSeconds * 20) {
      slot.warned = true;
      say(body, `§e[${sp.name}] §f${sp.headNames[i]} is regrowing! §e${sp.warnSeconds}s §7to bring the other heads down.`);
      body.dimension.playSound("mob.ravager.roar", body.location, { volume: 1.5, pitch: 1.4 });
    }
    if (left <= 0) {
      attachHead(body, f, i);
      say(body, `§c[${sp.name}] §f${sp.headNames[i]} has grown back.`);
    }
  });
}

// ---------- Keeping heads on, health mirror, leash ----------

function upkeep(body, f) {
  const sp = f.species;
  let total = 0;
  f.slots.forEach((slot, i) => {
    if (!alive(slot)) return;
    const head = slot.head;
    total += head.getComponent("minecraft:health")?.currentValue ?? 0;
    const riding = head.getComponent("minecraft:riding")?.entityRidingOn;
    if (riding?.id === body.id) return;
    let attached = false;
    try { attached = body.getComponent("minecraft:rideable")?.addRider(head) ?? false; } catch { /* fall through */ }
    if (!attached) { try { head.teleport(seatPosition(body, sp.seats[i])); } catch { /* ignore */ } }
  });
  const hp = body.getComponent("minecraft:health");
  if (hp && total > 0) hp.setCurrentValue(Math.min(hp.effectiveMax, total));
  const A = sp.arena;
  if (body.hasTag(ARENA_TAG) && Math.hypot(body.location.x - A.x, body.location.z - A.z) > A.radius + 3) {
    try { body.teleport({ x: A.x + 0.5, y: A.y, z: A.z + 0.5 }); } catch { /* ignore */ }
  }
}

// ---------- Attacks ----------

function nearestPlayer(from, range) {
  let best, bestD = range;
  for (const p of from.dimension.getPlayers({ location: from.location, maxDistance: range + 4 })) {
    const d = Math.hypot(p.location.x - from.location.x, p.location.z - from.location.z);
    if (d <= bestD) { best = p; bestD = d; }
  }
  return best;
}

function warn(player, text, ticks = 20) {
  player.onScreenDisplay.setActionBar(text);
  hudHoldUntil.set(player.id, now() + ticks);
}

function attackTick(body, f) {
  const sp = f.species;
  const living = f.slots.filter(alive).length;
  const frenzy = living === 1 ? 2 : 1;
  f.slots.forEach((slot, i) => {
    if (!alive(slot)) return;
    const head = slot.head;
    const acid = head.typeId.endsWith("_acid") && sp.acid;
    const w = slot.windup;
    if (w && now() >= w.at) {
      slot.windup = undefined;
      if (w.kind === "bite") {
        for (const p of head.dimension.getPlayers({ location: w.point, maxDistance: sp.bite.radius + 2 })) {
          if (Math.hypot(p.location.x - w.point.x, p.location.z - w.point.z) > sp.bite.radius || Math.abs(p.location.y - w.point.y) > 4) continue;
          p.applyDamage(sp.bite.damage, { cause: EntityDamageCause.entityAttack, damagingEntity: head });
          push(p, { x: w.dir.x, z: w.dir.z }, 1.2, 0.3);
        }
        head.dimension.playSound("mob.ravager.bite", w.point, { volume: 1.5, pitch: 0.8 });
      } else {
        f.pools.push({ point: w.point, until: now() + sp.acid.lingerTicks, nextTick: now(), done: false });
        head.dimension.playSound("random.fizz", w.point, { volume: 1.5, pitch: 0.6 });
      }
      return;
    }
    if (w || now() < slot.nextAttack) return;
    const kind = acid && Math.random() < 0.6 ? "acid" : "bite";
    const cfg = kind === "acid" ? sp.acid : sp.bite;
    const target = nearestPlayer(head, kind === "acid" ? sp.acid.range : sp.bite.reach);
    if (!target) { slot.nextAttack = now() + 20; return; }
    const dx = target.location.x - head.location.x, dz = target.location.z - head.location.z;
    const len = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / len, z: dz / len };
    const point = kind === "acid"
      ? { ...target.location }
      : { x: head.location.x + dir.x * Math.min(len, 3), y: target.location.y, z: head.location.z + dir.z * Math.min(len, 3) };
    slot.windup = { kind, at: now() + cfg.windupTicks, point, dir };
    slot.nextAttack = now() + Math.round(cfg.everyTicks / frenzy) + Math.floor(Math.random() * 20);
    try { head.dimension.spawnParticle(kind === "acid" ? "minecraft:villager_happy" : "minecraft:villager_angry", kind === "acid" ? point : head.location); } catch { /* ignore */ }
    head.dimension.playSound("mob.ravager.roar", head.location, { volume: 1, pitch: kind === "acid" ? 1.6 : 1.2 });
    if (kind === "acid") warn(target, "§a§l! Acid incoming - move !", cfg.windupTicks + 5);
    else warn(target, `§c§l! The ${sp.headNames[i].toLowerCase()} rears back - get away !`, cfg.windupTicks + 5);
  });
  // Lingering acid pools
  for (const pool of f.pools) {
    if (pool.done || now() < pool.nextTick) continue;
    if (now() > pool.until) { pool.done = true; continue; }
    pool.nextTick = now() + 20;
    try { body.dimension.spawnParticle("minecraft:villager_happy", pool.point); } catch { /* ignore */ }
    for (const p of body.dimension.getPlayers({ location: pool.point, maxDistance: sp.acid.radius })) {
      p.addEffect("poison", sp.acid.poisonTicks, { amplifier: 1 });
      p.applyDamage(sp.acid.damage, { cause: EntityDamageCause.magic });
    }
  }
  f.pools = f.pools.filter((p) => !p.done);
}

// ---------- Head status HUD ----------

function hudText(f) {
  return f.slots.map((slot, i) => {
    const name = f.species.headNames[i].replace(" head", "");
    if (alive(slot)) {
      const h = slot.head.getComponent("minecraft:health");
      const cur = Math.ceil(h?.currentValue ?? 0), max = Math.round(h?.effectiveMax ?? 1);
      const c = cur / max > 0.5 ? "§a" : cur / max > 0.2 ? "§e" : "§c";
      return `${c}${name} ${cur}`;
    }
    return `§8${name} §7regrows ${Math.max(0, Math.ceil((slot.regrowAt - now()) / 20))}s`;
  }).join(" §8| ");
}

function hudTick(body, f) {
  const text = hudText(f);
  for (const p of nearbyPlayers(body, 32)) {
    if ((hudHoldUntil.get(p.id) ?? 0) > now()) continue;
    p.onScreenDisplay.setActionBar(text);
    hudHoldUntil.set(p.id, now() + 12);
  }
}

// ---------- Summoning ----------

export function useLure(player, typeId) {
  const sp = SPECIES[typeId];
  const A = sp.arena;
  const d = getData(player);
  if ((d.highestFloor ?? 1) < sp.floor) {
    player.sendMessage(`§7[Ponce] Nothing answers. §fYou haven't reached Floor ${sp.floor} yet.`);
    return false;
  }
  const inArena = Math.hypot(player.location.x - A.x, player.location.z - A.z) <= A.radius + 1 && Math.abs(player.location.y - A.y) <= 8;
  if (!inArena) {
    const where = F2.isOnFloor(player.location) ? `It's ${directionText(player.location, A)}, at the end of the north boardwalk.` : `It's on Floor ${sp.floor}, at the end of the north boardwalk from town.`;
    player.sendMessage(`§7[Ponce] The lure stirs the water, but nothing rises. §fUse it in the Hydra Pool. §7${where}`);
    return false;
  }
  if (player.dimension.getEntities({ type: typeId, location: A, maxDistance: 64 }).length > 0) {
    player.sendMessage(`§c[Ponce] The ${sp.name} is already here.`);
    return false;
  }
  spawnMultihead(player.dimension, typeId, { x: A.x + 0.5, y: A.y, z: A.z + 0.5 });
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (inv && inv.getItem(player.selectedSlotIndex)?.typeId === sp.lure) inv.setItem(player.selectedSlotIndex, undefined);
  player.dimension.playSound("mob.enderdragon.growl", A, { volume: 3, pitch: 0.6 });
  for (const p of player.dimension.getPlayers({ location: A, maxDistance: 48 })) {
    p.onScreenDisplay.setTitle(`§2${sp.name}`, { subtitle: `§7Guardian of Floor ${sp.floor}`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
    p.sendMessage(`§2[${sp.name}] §fEach head has its own life. §7Fell them all at once, or they grow back.`);
  }
  return true;
}

export function registerMultihead() {
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    if (HEAD_TYPES.has(deadEntity.typeId)) onHeadDeath(deadEntity, damageSource.damagingEntity);
  });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    if (!HEAD_TYPES.has(hurtEntity.typeId) || damageSource.damagingEntity?.typeId !== "minecraft:player") return;
    const bodyId = hurtEntity.getDynamicProperty?.("ponce:body");
    const f = typeof bodyId === "string" ? fights.get(bodyId) : undefined;
    if (f) f.lastHitter = damageSource.damagingEntity;
  });
  world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
    if (source.typeId !== "minecraft:player") return;
    for (const [typeId, sp] of Object.entries(SPECIES)) if (itemStack?.typeId === sp.lure) useLure(source, typeId);
  });
  system.runInterval(() => {
    const dim = world.getDimension(DIM);
    for (const typeId of Object.keys(SPECIES)) {
      for (const body of dim.getEntities({ type: typeId })) {
        try {
          const f = fightFor(body);
          upkeep(body, f);
          regrowTick(body, f);
          attackTick(body, f);
          if (now() % 10 === 0) hudTick(body, f);
        } catch (e) { console.warn(`[Ponce] multihead: ${e}`); }
      }
    }
  }, 2);
}
