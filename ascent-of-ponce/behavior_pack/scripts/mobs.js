// Scripted behavior for regular tower mobs.
//  - Burrow Mole: hides under a dirt mound and bursts out when a player gets close.
//  - Moss Golemite: stone body. Hammers deal +50%, blades only 60%.

import { world, system, GameMode } from "@minecraft/server";
import { getHeldItem, weaponTypeOf } from "./progression.js";
import { killWithCredit } from "./combat.js";

const MOLE = "ponce:burrow_mole";
const WISP = "ponce:will_o_wisp";
const GOLEMITE = "ponce:moss_golemite";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const IGNORED_MODES = [GameMode?.Creative ?? GameMode?.creative, GameMode?.Spectator ?? GameMode?.spectator].filter(Boolean);

const MOLE_TRIGGER_RANGE = 4;
const GOLEMITE_DAMAGE = { hammer: 1.5, sword: 0.6, dagger: 0.6, rapier: 0.6, katana: 0.6 };

const hintCooldown = new Map(); // player id -> tick

function hint(player, text) {
  const now = system.currentTick;
  if ((hintCooldown.get(player.id) ?? 0) > now) return;
  hintCooldown.set(player.id, now + 400);
  player.sendMessage(text);
}

function tickMoles() {
  for (const id of DIMENSIONS) {
    const dim = world.getDimension(id);
    for (const mole of dim.getEntities({ type: MOLE })) {
      if (mole.getProperty("ponce:burrowed") !== true) continue;
      const near = dim.getPlayers({ location: mole.location, maxDistance: MOLE_TRIGGER_RANGE, excludeGameModes: IGNORED_MODES });
      if (near.length === 0) continue;
      mole.triggerEvent("ponce:emerge");
      dim.playSound("dig.gravel", mole.location, { volume: 1.2, pitch: 0.8 });
      try { dim.spawnParticle("minecraft:huge_explosion_emitter", mole.location); } catch { /* ignore */ }
    }
  }
}

/** Will-o'-Wisps flicker away when struck (35% chance): chase the light. */
function wispBlink(wisp) {
  if (Math.random() >= 0.35) return;
  const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 3;
  const to = { x: wisp.location.x + Math.cos(a) * r, y: wisp.location.y + 0.5, z: wisp.location.z + Math.sin(a) * r };
  try {
    wisp.dimension.spawnParticle("minecraft:villager_happy", wisp.location);
    wisp.teleport(to);
  } catch { /* blocked */ }
}

export function registerMobs() {
  system.runInterval(tickMoles, 10);
  world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
    if (hurtEntity.typeId === WISP && hurtEntity.isValid && (hurtEntity.getComponent("minecraft:health")?.currentValue ?? 0) > 0) wispBlink(hurtEntity);
  });

  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage, damageSource }) => {
    if (hurtEntity.typeId !== GOLEMITE || !hurtEntity.isValid) return;
    const attacker = damageSource.damagingEntity;
    if (attacker?.typeId !== "minecraft:player" || damageSource.cause !== "entityAttack") return;
    const mult = GOLEMITE_DAMAGE[weaponTypeOf(getHeldItem(attacker))] ?? 1;
    if (mult === 1) return;
    const h = hurtEntity.getComponent("minecraft:health");
    if (!h || h.currentValue <= 0) return;
    // Damage already landed, so adjust health by the difference
    const adjusted = h.currentValue - damage * (mult - 1);
    if (adjusted <= 0) killWithCredit(hurtEntity, attacker);
    else h.setCurrentValue(Math.min(h.effectiveMax, adjusted));
    if (mult > 1) hint(attacker, "§a[Ponce] §fThe Golemite's stone body cracks under your hammer!");
    else hint(attacker, "§7[Ponce] Your blade skids off the Golemite's stone. §fBlunt weapons would work better.");
  });
}
