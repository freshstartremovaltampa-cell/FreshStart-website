import { world, system, ItemStack, dim } from "@minecraft/server";
import { log } from "@minecraft/server-ui";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

function makeEntity(typeId, hp, extra = {}) {
  const health = { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } };
  const e = { id: Math.random().toString(36), typeId, isValid: true, health, killed: false, dimension: dim,
    location: { x: 0, y: 64, z: 0 }, tagList: [], events: [], effects: {}, impulses: [], damageTaken: 0,
    getComponent(n) { return n === "minecraft:health" ? health : extra[n]; },
    matches: () => typeId !== "minecraft:cow", kill() { this.killed = true; health.currentValue = 0; },
    addTag(t) { this.tagList.push(t); }, removeTag(t) { this.tagList = this.tagList.filter((x) => x !== t); },
    triggerEvent(ev) { this.events.push(ev); }, applyImpulse(v) { this.impulses.push(v); },
    addEffect(t, d, o) { this.effects[t] = { duration: d, amplifier: o?.amplifier ?? 0 }; }, getEffect(t) { return this.effects[t]; },
    removeEffect(t) { delete this.effects[t]; }, remove() { this.isValid = false; },
    applyDamage(n) { this.damageTaken += n; health.currentValue -= n; }, applyKnockback() { this.knocked = true; }, ...extra.self };
  return e;
}
function makePlayer(name) {
  const props = {}, effects = {}, msgs = [], items = new Array(36).fill(undefined);
  let held;
  const p = makeEntity("minecraft:player", 20, {
    "minecraft:inventory": { container: { size: 36, getItem: (i) => items[i], setItem: (i, v) => (items[i] = v), addItem: (it) => { items[items.indexOf(undefined)] = it; } } },
    "minecraft:equippable": { getEquipment: () => held },
  });
  Object.assign(p, { name, msgs, items, effects, tags: [],
    setHeld: (i) => (held = i), getDynamicProperty: (k) => props[k], setDynamicProperty: (k, v) => (props[k] = v), props,
    getEffect: (t) => effects[t], addEffect: (t, d, o) => (effects[t] = { duration: d, amplifier: o.amplifier }), removeEffect: (t) => delete effects[t],
    selectedSlotIndex: 0, getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
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
assert(d.mastery.sword > 3 && d.mastery.sword < 9, "30 zombie kills = only " + d.mastery.sword + " sword mastery");
assert(!d.skills.includes("sword_dash"), "Dash Slash still locked after 30 kills");
assert(d.kills === 30, "kills tracked");

// Mace = hammer
p.setHeld(new ItemStack("minecraft:mace"));
const s = makeEntity("minecraft:skeleton", 20);
fire("entityHurt", { hurtEntity: s, damage: 5, damageSource: { cause: "entityAttack", damagingEntity: p } });
system.tick(20);
assert(JSON.parse(p.props["ponce:data"]).mastery.hammer > 0, "mace counts as hammer mastery");

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

// Hitting a tower mob shows its name, level and HP bar
{
  const j = makeEntity("ponce:meadow_jelly", 12);
  fire("entityHurt", { hurtEntity: j, damage: 3, damageSource: { cause: "entityAttack", damagingEntity: p } });
  assert(p.actionBar.includes("Meadow Jelly") && p.actionBar.includes("Lv1"), "target bar: " + p.actionBar);
  system.tick(10);
  assert(p.actionBar.includes("Meadow Jelly"), "HUD waits while target bar is showing");
  const xpBefore = JSON.parse(p.props["ponce:data"]);
  fire("entityDie", { deadEntity: j, damageSource: { cause: "entityAttack", damagingEntity: p } });
  system.tick(20);
  const after = JSON.parse(p.props["ponce:data"]);
  assert(after.kills === xpBefore.kills + 1, "jelly kill counted");
}

// Respawn without compass gets a new one
p.items.fill(undefined);
fire("playerSpawn", { player: p, initialSpawn: false });
assert(p.items.some((i) => i?.typeId === "ponce:wayfarer_compass"), "compass returned on respawn");

// Active minute mastery
system.tick(1200);
assert(JSON.parse(p.props["ponce:data"]).weaponMinutes.sword >= 1, "weapon minutes tracked");
console.log("forms shown:", log.length);

// Pacing: simulate an hour of fighting (2 zombie kills/min, 3 hits each) and report mastery
{
  const q = makePlayer("Pacer"); world.players.push(q);
  fire("playerSpawn", { player: q, initialSpawn: true });
  q.setHeld(new ItemStack("minecraft:diamond_sword", 1, ["minecraft:is_sword"]));
  const hours = {};
  for (let min = 1; min <= 60 * 50; min++) {
    for (let k = 0; k < 2; k++) {
      const z = makeEntity("minecraft:zombie", 20000);
      for (let h = 0; h < 3; h++) fire("entityHurt", { hurtEntity: z, damage: 1, damageSource: { cause: "entityAttack", damagingEntity: q } });
      fire("entityDie", { deadEntity: z, damageSource: { cause: "entityAttack", damagingEntity: q } });
    }
    system.tick(1200);
    if (min % 60 === 0) { system.tick(20); hours[min / 60] = JSON.parse(q.props["ponce:data"]).mastery.sword; }
  }
  const at = (m) => Object.entries(hours).find(([, v]) => v >= m)?.[0] ?? ">50";
  console.log(`pacing: 25 -> ${at(25)}h, 150 -> ${at(150)}h, 375 -> ${at(375)}h, 600 -> ${at(600)}h`);
  assert(Number(at(600)) <= 25, "Dual Wield (600 mastery) reachable in ~20h of nonstop fighting");
}

// ---------- Floor 1 boss ----------
{
  const { getData } = await import("../behavior_pack/scripts/data.js");
  dim.factory = (id, loc) => { const e = makeEntity(id, id === "ponce:ironhide" ? 300 : 24); e.location = { ...loc }; return e; };
  const b = makePlayer("BossTester"); world.players.push(b);
  b.location = { x: 0, y: 64, z: 0 }; b.dimension = dim;
  b.applyDamage = (n) => { b.health.currentValue -= n; b.hitByBoss = (b.hitByBoss ?? 0) + n; };
  b.applyKnockback = () => (b.knocked = true);
  fire("playerSpawn", { player: b, initialSpawn: true });
  const horn = new ItemStack("ponce:boar_kings_call");
  b.items[0] = horn;
  fire("itemUse", { source: b, itemStack: horn });
  assert(dim.getEntities({ type: "ponce:ironhide" }).length === 0 && b.msgs.some((m) => m.includes("unlock a weapon skill")), "horn refuses without a skill");

  getData(b).skills.push("sword_dash");
  fire("itemUse", { source: b, itemStack: horn });
  const boss = dim.getEntities({ type: "ponce:ironhide" })[0];
  assert(boss && b.items[0] === undefined, "horn summons Ironhide and is consumed");
  fire("itemUse", { source: b, itemStack: horn });
  assert(dim.getEntities({ type: "ponce:ironhide" }).length === 1, "can't summon a second boss nearby");

  // Thick hide
  b.setHeld(new ItemStack("minecraft:stone_sword", 1, ["minecraft:is_sword"]));
  boss.health.currentValue = 300 - 6;
  fire("entityHurt", { hurtEntity: boss, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: b } });
  assert(Math.abs(boss.health.currentValue - (300 - 6 * 0.4)) < 0.6, "stone sword deals ~40%: hp " + boss.health.currentValue.toFixed(1));
  b.setHeld(new ItemStack("minecraft:iron_sword", 1, ["minecraft:is_sword"]));
  const hp0 = boss.health.currentValue - 7; boss.health.currentValue = hp0;
  fire("entityHurt", { hurtEntity: boss, damage: 7, damageSource: { cause: "entityAttack", damagingEntity: b } });
  assert(boss.health.currentValue <= hp0, "iron sword deals full damage");

  // Herd + enrage
  boss.health.currentValue = 300 * 0.65; system.tick(2);
  let minions = dim.getEntities({ type: "ponce:tusk_boar", tags: ["ponce_minion"] });
  assert(minions.length === 2 && minions.every((m) => m.events.includes("ponce:enrage")), "70%: summons 2 hostile boars");
  boss.health.currentValue = 300 * 0.35; system.tick(2);
  assert(dim.getEntities({ type: "ponce:tusk_boar", tags: ["ponce_minion"] }).length === 4, "40%: summons 2 more");
  assert(!boss.events.includes("ponce:enrage"), "not enraged above 30%");
  boss.health.currentValue = 300 * 0.25; system.tick(2);
  assert(boss.events.includes("ponce:enrage"), "enraged below 30%");

  // Charge: player stands in the path
  b.location = { x: 0, y: 64, z: 3 }; boss.location = { x: 0, y: 64, z: 0 };
  const hpBefore = b.health.currentValue;
  let warned = false;
  for (let i = 0; i < 200 && !b.hitByBoss; i++) { system.tick(1); if (b.actionBar?.includes("about to charge")) warned = true; if (boss.impulses.length) b.location = { x: 0, y: 64, z: 1 }; }
  assert(warned, "charge is telegraphed");
  assert(b.hitByBoss === 9 && b.knocked, "charge hits for 9 with knockback");

  // Dodge: next charge, player sidesteps out of range
  b.hitByBoss = 0; b.knocked = false;
  for (let i = 0; i < 200; i++) { system.tick(1); if (boss.impulses.length > 10) b.location = { x: 6, y: 64, z: 6 }; }
  assert(!b.hitByBoss, "sidestepping avoids the charge");

  // Kill
  b.location = { x: 0, y: 64, z: 2 };
  const before = getData(b);
  const col0 = before.col, sword0 = before.mastery.sword;
  fire("entityDie", { deadEntity: boss, damageSource: { cause: "entityAttack", damagingEntity: b } });
  boss.isValid = false;
  const after = getData(b);
  assert(after.highestFloor === 2 && after.col === col0 + 100, "floor 1 cleared, +100 Col");
  assert(after.mastery.sword - sword0 > 5, "boss gives a big mastery boost: +" + (after.mastery.sword - sword0).toFixed(2));
  assert(dim.getEntities({ tags: ["ponce_minion"] }).length === 0, "minions released when boss dies");
  assert(b.msgs.some((m) => m.includes("FLOOR 1 CLEARED")), "victory title");
}
