// Short-lived combat state shared by combat.js and abilities.js.
// Everything here is in memory only: it resets when the world reloads.

export const skillHits = new Map(); // target id -> { playerId, tick }: next hurt event is a skill hit
export const armorBroken = new Map(); // target id -> tick it expires
export const nextHitBuffs = new Map(); // player id -> { type: "stun" | "venom", hits, until }
export const stances = new Map(); // player id -> { type: "riposte" | "still_water", until }
export const lastSwing = new Map(); // player id -> tick of last normal melee swing
export const lastHit = new Map(); // player id -> tick of last hit of any kind
export const bleeds = new Map(); // target id -> { stacks, until, player }
export const cooldowns = new Map(); // player id -> { skillId: tick it's ready }

export function cooldownLeft(playerId, skillId, now) {
  const ready = cooldowns.get(playerId)?.[skillId] ?? 0;
  return Math.max(0, ready - now);
}

export function setCooldown(playerId, skillId, readyTick) {
  const map = cooldowns.get(playerId) ?? {};
  map[skillId] = readyTick;
  cooldowns.set(playerId, map);
}

/** Crimson Chain: shave time off every cooldown. */
export function reduceCooldowns(playerId, ticks) {
  const map = cooldowns.get(playerId);
  if (!map) return;
  for (const k of Object.keys(map)) map[k] -= ticks;
}

export function forgetPlayer(playerId) {
  for (const m of [nextHitBuffs, stances, lastSwing, lastHit, cooldowns]) m.delete(playerId);
}
