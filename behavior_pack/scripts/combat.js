// Combat hooks: stat-based bonus damage, crits, dodges, kill XP and mastery.

import { world, system } from "@minecraft/server";
import { MASTERY_GAIN, MOB_XP, PASSIVE_XP_MULTIPLIER, STAT_EFFECTS } from "./config.js";
import { getData, markDirty } from "./data.js";
import {
  addMastery, addXp, critChance, damageMultiplier, dodgeChance, getHeldItem, weaponTypeOf,
} from "./progression.js";

const killCredit = new Map(); // entity id -> { player, weapon }, for kills our bonus damage finished
export const lastCombatTick = new Map(); // player id -> tick of last melee hit
export const hudHoldUntil = new Map(); // player id -> tick; HUD waits so combat text stays visible

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
  if (!health || bonus <= 0) return;
  const remaining = health.currentValue - bonus;
  if (remaining <= 0) {
    killCredit.set(target.id, { player, weapon });
    target.kill();
  } else {
    health.setCurrentValue(remaining);
  }
  if (crit) {
    player.playSound("random.anvil_land", { volume: 0.4, pitch: 1.8 });
    player.onScreenDisplay.setActionBar("§e§lCRITICAL!");
    hudHoldUntil.set(player.id, system.currentTick + 20);
  }
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
    if (weapon) addMastery(player, weapon, Math.min(MASTERY_GAIN.killMax, xp * MASTERY_GAIN.killPerXp));
  });
}
