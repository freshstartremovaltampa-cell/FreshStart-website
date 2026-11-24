// Player save data, stored as JSON in a dynamic property on the player.
// Lives inside the world save, so it works fully offline.

import { WEAPON_KEYS, STAT_KEYS } from "./config.js";

const KEY = "ponce:data";
const SCHEMA_VERSION = 1;

const cache = new Map(); // player.id -> data
const dirty = new Set(); // player.id

function freshData() {
  return {
    v: SCHEMA_VERSION,
    initialized: false,
    level: 1,
    xp: 0,
    statPoints: 0,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
    mastery: Object.fromEntries(WEAPON_KEYS.map((k) => [k, 0])),
    weaponMinutes: Object.fromEntries(WEAPON_KEYS.map((k) => [k, 0])),
    skills: [], // unlocked skill ids
    activeSkill: {}, // weapon type -> equipped active skill id
    col: 0, // currency
    highestFloor: 1,
    kills: 0,
    deaths: 0,
    settings: { hud: true },
  };
}

/** Fill in any fields added in later versions so old saves keep working. */
function migrate(raw) {
  const base = freshData();
  const data = { ...base, ...raw };
  data.stats = { ...base.stats, ...(raw.stats ?? {}) };
  data.mastery = { ...base.mastery, ...(raw.mastery ?? {}) };
  data.weaponMinutes = { ...base.weaponMinutes, ...(raw.weaponMinutes ?? {}) };
  data.settings = { ...base.settings, ...(raw.settings ?? {}) };
  data.activeSkill = { ...(raw.activeSkill ?? {}) };
  data.v = SCHEMA_VERSION;
  return data;
}

export function getData(player) {
  let data = cache.get(player.id);
  if (data) return data;
  const raw = player.getDynamicProperty(KEY);
  try {
    data = typeof raw === "string" ? migrate(JSON.parse(raw)) : freshData();
  } catch {
    console.warn(`[Ponce] Corrupt save for ${player.name}, starting fresh.`);
    data = freshData();
  }
  cache.set(player.id, data);
  return data;
}

export function markDirty(player) {
  dirty.add(player.id);
}

export function saveNow(player) {
  const data = cache.get(player.id);
  if (!data) return;
  player.setDynamicProperty(KEY, JSON.stringify(data));
  dirty.delete(player.id);
}

/** Write any changed data. Called on a short interval. */
export function flush(players) {
  for (const player of players) {
    if (dirty.has(player.id)) saveNow(player);
  }
}

export function forget(playerId) {
  cache.delete(playerId);
  dirty.delete(playerId);
}

export function resetData(player) {
  const data = freshData();
  data.initialized = true;
  cache.set(player.id, data);
  saveNow(player);
  return data;
}
