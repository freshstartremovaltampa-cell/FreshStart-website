import { world, system, ItemStack } from "@minecraft/server";
import { log } from "@minecraft/server-ui";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

function makeEntity(typeId, hp, extra = {}) {
  const health = { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } };
  return { id: Math.random().toString(36), typeId, isValid: true, health, killed: false,
    getComponent(n) { return n === "minecraft:health" ? health : extra[n]; },
    matches: () => typeId !== "minecraft:cow", kill() { this.killed = true; health.currentValue = 0; }, ...extra.self };
}
function makePlayer(name) {
  const props = {}, effects = {}, msgs = [], items = new Array(36).fill(undefined);
  let held;
  const p = makeEntity("minecraft:player", 20, {
    "minecraft:inventory": { container: { size: 36, getItem: (i) => items[i], addItem: (it) => { items[items.indexOf(undefined)] = it; } } },
    "minecraft:equippable": { getEquipment: () => held },
  });
  Object.assign(p, { name, msgs, items, effects, tags: [],
    setHeld: (i) => (held = i), getDynamicProperty: (k) => props[k], setDynamicProperty: (k, v) => (props[k] = v), props,
    getEffect: (t) => effects[t], addEffect: (t, d, o) => (effects[t] = { duration: d, amplifier: o.amplifier }), removeEffect: (t) => delete effects[t],
    onScreenDisplay: { setTitle: (t, o) => msgs.push("TITLE " + t + " " + (o?.subtitle ?? "")), setActionBar: (t) => (p.actionBar = t) },
    sendMessage: (m) => msgs.push(m), playSound() {}, hasTag: (t) => p.tags.includes(t) });
  return p;
}

await import("../behavior_pack/scripts/main.js");
const fire = (n, e) => world.afterEvents[n].h.forEach((f) => f(e));

const p = makePlayer("Tester"); world.players.push(p);
fire("playerSpawn", { player: p, initialSpawn: true });
assert(p.items.some((i) => i?.typeId === "ponce:wayfarer_compass"), "compass given on first spawn");
system.tick(60);
assert(p.msgs.some((m) => m.includes("ASCENT OF PONCE")), "welcome title shown");
assert(typeof p.props["ponce:data"] === "string", "data saved to dynamic property");
assert(p.actionBar?.includes("Lv1"), "HUD shows level: " + p.actionBar);

// Kill zombies with an iron sword
const sword = new ItemStack("minecraft:iron_sword", 1, ["minecraft:is_sword"]);
p.setHeld(sword);
for (let i = 0; i < 30; i++) {
  const z = makeEntity("minecraft:zombie", 20);
  fire("entityHurt", { hurtEntity: z, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: p } });
  fire("entityDie", { deadEntity: z, damageSource: { cause: "entityAttack", damagingEntity: p } });
}
system.tick(20);
const d = JSON.parse(p.props["ponce:data"]);
assert(d.level > 1, `leveled up to ${d.level} with ${d.statPoints} points`);
assert(d.mastery.sword === 30 * 6, "sword mastery = " + d.mastery.sword);
assert(d.skills.includes("sword_dash"), "Dash Slash unlocked at 50 mastery");
assert(d.kills === 30, "kills tracked");

// Mace = hammer
p.setHeld(new ItemStack("minecraft:mace"));
const s = makeEntity("minecraft:skeleton", 20);
fire("entityHurt", { hurtEntity: s, damage: 5, damageSource: { cause: "entityAttack", damagingEntity: p } });
system.tick(20);
assert(JSON.parse(p.props["ponce:data"]).mastery.hammer === 1, "mace counts as hammer mastery");

// Allocate stats through the menu: VIT 10, STR 2
globalThis.nextFormResponse = [{ canceled: false, selection: 0 }, { canceled: false, selection: 0 }, { canceled: false, formValues: [1, 0, 0, 2] }];
fire("itemUse", { source: p, itemStack: new ItemStack("ponce:wayfarer_compass") });
await new Promise((r) => setTimeout(r, 20));
system.tick(20);
const d2 = JSON.parse(p.props["ponce:data"]);
assert(d2.stats.vit === 2 && d2.stats.str === 1 && d2.statPoints === 0, "stats allocated via menu");
assert(!p.effects.health_boost, "VIT 2 -> no health boost yet");

// Bonus damage lethal -> kill credit
const weak = makeEntity("minecraft:creeper", 20); weak.health.currentValue = 6.05;
p.setHeld(sword);
const before = JSON.parse(p.props["ponce:data"]).kills;
fire("entityHurt", { hurtEntity: weak, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: p } });
weak.health.currentValue = 0.05; // simulate vanilla damage already applied
fire("entityHurt", { hurtEntity: weak, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: p } });
assert(weak.killed, "bonus damage finished the mob");
fire("entityDie", { deadEntity: weak, damageSource: { cause: "none" } });
system.tick(20);
assert(JSON.parse(p.props["ponce:data"]).kills === before + 1, "kill credited to player");

// Respawn without compass gets a new one
p.items.fill(undefined);
fire("playerSpawn", { player: p, initialSpawn: false });
assert(p.items.some((i) => i?.typeId === "ponce:wayfarer_compass"), "compass returned on respawn");

// Active minute mastery
system.tick(1200);
assert(JSON.parse(p.props["ponce:data"]).weaponMinutes.sword >= 1, "weapon minutes tracked");
console.log("forms shown:", log.length);
