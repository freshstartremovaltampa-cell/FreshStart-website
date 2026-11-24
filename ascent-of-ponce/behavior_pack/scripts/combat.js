// Combat hooks: stat-based bonus damage, crits, dodges, kill XP and mastery.

import { world, system } from "@minecraft/server";
import { MASTERY_GAIN, MOBS, MOB_XP, PASSIVE_XP_MULTIPLIER, STAT_EFFECTS } from "./config.js";
import { getData, markDirty } from "./data.js";
import {
  addMastery, addXp, critChance, damageMultiplier, dodgeChance, getHeldItem, weaponTypeOf,
} from "./progression.js";

const killCredit = new Map(); // entity id -> { player, weapon }, for kills our bonus damage finished
export const lastCombatTick = new Map(); // player id -> tick of last melee hit
export const hudHoldUntil = new Map(); // player id -> tick; HUD waits so combat text stays visible

/** Kill an entity from script while still giving the player XP, mastery and loot credit. */
export function killWithCredit(target, player) {
  killCredit.set(target.id, { player, weapon: weaponTypeOf(getHeldItem(player)) });
  target.kill();
}

function isPlayer(entity) {
  return entity?.typeId === "minecraft:player";
}

function onPlayerMelee(player, target, damage) {
  const data = getData(player);
  const weapon = weaponTypeOf(getHeldItem(player));
  lastCombatTick.set(player.id, system.currentTick);

  // Bonus damage is subtracted straight from health. That way it skips
  // invulnerability frames and doesn't fire this event again.
  let bonus = damage * (damageMultiplier(data, weapon) - 1);
  const crit = Math.random() < critChance(data);
  if (crit) bonus += damage * STAT_EFFECTS.critMultiplier;

  if (weapon) addMastery(player, weapon, MASTERY_GAIN.hit);

  const health = target.getComponent("minecraft:health");
  if (!health) return;
  const max = health.effectiveMax;
  let remaining = health.currentValue - Math.max(0, bonus);
  if (remaining <= 0) {
    killCredit.set(target.id, { player, weapon });
    target.kill();
    remaining = 0;
  } else if (bonus > 0) {
    health.setCurrentValue(remaining);
  }
  if (crit) player.playSound("random.anvil_land", { volume: 0.4, pitch: 1.8 });
  showTargetBar(player, target, remaining, max, crit);
}

function displayName(entity) {
  const mob = MOBS[entity.typeId];
  if (mob) return `§f${mob.name} §7Lv${mob.level}`;
  if (isPlayer(entity)) return `§f${entity.name}`;
  const raw = entity.typeId.split(":")[1] ?? entity.typeId;
  return "§f" + raw.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Shows the struck enemy's name, level and HP above the hotbar for a moment. */
function showTargetBar(player, target, hp, max, crit) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, hp) / max) : 0;
  const filled = Math.ceil(ratio * 20);
  const color = ratio > 0.5 ? "§a" : ratio > 0.25 ? "§e" : "§c";
  player.onScreenDisplay.setActionBar(
    `${crit ? "§e§lCRITICAL! §r" : ""}${displayName(target)}  ${color}${"|".repeat(filled)}§8${"|".repeat(20 - filled)} §f${Math.ceil(Math.max(0, hp))}/${Math.round(max)}`
  );
  hudHoldUntil.set(player.id, system.currentTick + 30);
}

function onPlayerHurt(player, damage) {
  const data = getData(player);
  if (Math.random() >= dodgeChance(data)) return;
  // Undo the hit. Only works for non-lethal hits, because this runs after the damage.
  const health = player.getComponent("minecraft:health");
  if (!health || health.currentValue <= 0) return;
  health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage));
  player.onScreenDisplay.setActionBar("§a§oDodged!");
  hudHoldUntil.set(player.id, system.currentTick + 20);
  player.playSound("mob.bat.takeoff", { volume: 0.5, pitch: 1.4 });
}

function xpFor(entity) {
  if (MOB_XP[entity.typeId] !== undefined) return MOB_XP[entity.typeId];
  try {
    const maxHp = entity.getComponent("minecraft:health")?.effectiveMax ?? 10;
    const hostile = entity.matches({ families: ["monster"] });
    return Math.max(1, Math.round(maxHp * (hostile ? 1 : PASSIVE_XP_MULTIPLIER)));
  } catch {
    return 5; // entity already removed
  }
}

export function registerCombat() {
  world.afterEvents.entityHurt.subscribe((ev) => {
    const { hurtEntity, damage, damageSource } = ev;
    const attacker = damageSource.damagingEntity;

    if (isPlayer(hurtEntity) && damage > 0) onPlayerHurt(hurtEntity, damage);

    if (isPlayer(attacker) && damageSource.cause === "entityAttack" && hurtEntity.isValid) {
      onPlayerMelee(attacker, hurtEntity, damage);
    }
  });

  world.afterEvents.entityDie.subscribe((ev) => {
    const { deadEntity, damageSource } = ev;

    if (isPlayer(deadEntity)) {
      getData(deadEntity).deaths++;
      markDirty(deadEntity);
    }

    let player = damageSource.damagingEntity;
    let weapon;
    const credit = killCredit.get(deadEntity.id);
    if (credit) {
      killCredit.delete(deadEntity.id);
      player = credit.player;
      weapon = credit.weapon;
    }
    if (!isPlayer(player) || !player.isValid || player === deadEntity) return;
    weapon ??= weaponTypeOf(getHeldItem(player));

    const data = getData(player);
    data.kills++;
    markDirty(player);
    if (isPlayer(deadEntity)) return; // no XP farming off other players
    const xp = xpFor(deadEntity);
    addXp(player, xp);
    const mob = MOBS[deadEntity.typeId];
    const gain = mob?.mastery ?? Math.min(MASTERY_GAIN.killMax, xp * MASTERY_GAIN.killPerXp);
    if (weapon) addMastery(player, weapon, gain);
  });
}
