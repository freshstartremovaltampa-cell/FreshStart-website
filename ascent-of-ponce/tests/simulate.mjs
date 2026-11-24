import { world, system, ItemStack, dim } from "@minecraft/server";
import { log } from "@minecraft/server-ui";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

function makeEntity(typeId, hp, extra = {}) {
  const health = { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } };
  const e = { id: Math.random().toString(36), typeId, isValid: true, health, killed: false, dimension: dim,
    location: { x: 0, y: 64, z: 0 }, tagList: [], props: {}, getProperty(k) { return this.props[k]; }, events: [], effects: {}, impulses: [], damageTaken: 0,
    getComponent(n) { return n === "minecraft:health" ? health : extra[n]; },
    matches: () => typeId !== "minecraft:cow", kill() { this.killed = true; health.currentValue = 0; },
    addTag(t) { this.tagList.push(t); }, removeTag(t) { this.tagList = this.tagList.filter((x) => x !== t); },
    triggerEvent(ev) { this.events.push(ev); }, applyImpulse(v) { this.impulses.push(v); },
    addEffect(t, d, o) { this.effects[t] = { duration: d, amplifier: o?.amplifier ?? 0 }; }, getEffect(t) { return this.effects[t]; },
    removeEffect(t) { delete this.effects[t]; }, remove() { this.isValid = false; },
    getViewDirection() { return this.view ?? { x: 0, y: 0, z: 1 }; },
    applyDamage(n, o) { this.damageTaken += n; health.currentValue -= n; globalThis.__fire?.("entityHurt", { hurtEntity: this, damage: n, damageSource: { cause: o?.cause ?? "override", damagingEntity: o?.damagingEntity } }); return true; },
    applyKnockback() { this.knocked = true; }, ...extra.self };
  return e;
}
function makePlayer(name) {
  const props = {}, effects = {}, msgs = [], items = new Array(36).fill(undefined);
  let held;
  const p = makeEntity("minecraft:player", 20, {
    "minecraft:inventory": { container: { size: 36, getItem: (i) => items[i], setItem: (i, v) => (items[i] = v), addItem: (it) => { items[items.indexOf(undefined)] = it; } } },
    "minecraft:equippable": { getEquipment: (slot) => (slot === "Offhand" ? p.offhand : held), setEquipment: (slot, item) => (slot === "Offhand" ? (p.offhand = item) : (held = item)) },
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
const { getData: getDataFor } = await import("../behavior_pack/scripts/data.js");
const fire = (n, e) => world.afterEvents[n].h.forEach((f) => f(e));
globalThis.__fire = fire;

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
system.tick(20); // a real swing later, not a rushed one
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
  dim.factory = (id, loc) => { const e = makeEntity(id, id === "ponce:ironhide" ? 1800 : 24); e.location = { ...loc }; return e; };
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
  boss.health.currentValue = 1800 - 6;
  fire("entityHurt", { hurtEntity: boss, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: b } });
  assert(Math.abs(boss.health.currentValue - (1800 - 6 * 0.4)) < 0.6, "stone sword deals ~40%: hp " + boss.health.currentValue.toFixed(1));
  b.setHeld(new ItemStack("minecraft:iron_sword", 1, ["minecraft:is_sword"]));
  system.tick(20);
  const hp0 = boss.health.currentValue - 7; boss.health.currentValue = hp0;
  fire("entityHurt", { hurtEntity: boss, damage: 7, damageSource: { cause: "entityAttack", damagingEntity: b } });
  assert(boss.health.currentValue <= hp0, "iron sword deals full damage");

  // Herd calls at 80/60/40/20%, capped at 6 minions
  const minionCount = () => dim.getEntities({ type: "ponce:tusk_boar", tags: ["ponce_minion"] }).length;
  boss.health.currentValue = 1800 * 0.75; system.tick(2);
  assert(minionCount() === 2 && dim.getEntities({ tags: ["ponce_minion"] }).every((m) => m.events.includes("ponce:enrage")), "80%: summons 2 hostile boars");
  boss.health.currentValue = 1800 * 0.55; system.tick(2);
  assert(minionCount() === 4, "60%: summons 2 more");

  // Earthshaker: player hugging the boss below 60%
  b.location = { x: 0, y: 64, z: 3 }; boss.location = { x: 0, y: 64, z: 0 };
  let rearWarn = false;
  for (let i = 0; i < 60 && !b.hitByBoss; i++) { system.tick(1); if (b.actionBar?.includes("rears up")) rearWarn = true; }
  assert(rearWarn, "stomp is telegraphed");
  assert(b.hitByBoss === 7 && b.knocked, "stomp hits everyone within 5 blocks for 7");

  boss.health.currentValue = 1800 * 0.35; system.tick(2);
  assert(minionCount() === 6, "40%: summons 2 more");
  assert(!boss.events.includes("ponce:enrage"), "not enraged above 30%");
  boss.health.currentValue = 1800 * 0.25; system.tick(2);
  assert(boss.events.includes("ponce:enrage"), "enraged below 30%");
  boss.health.currentValue = 1800 * 0.15; system.tick(2);
  assert(minionCount() === 6, "20%: herd call respects the 6-minion cap");

  // Charge: player stands in the path
  b.hitByBoss = 0; b.knocked = false;
  b.location = { x: 0, y: 64, z: 3 };
  let warned = false;
  for (let i = 0; i < 300 && !b.hitByBoss; i++) { system.tick(1); if (b.actionBar?.includes("about to charge")) warned = true; if (boss.impulses.length) b.location = { x: 0, y: 64, z: 1 }; }
  assert(warned, "charge is telegraphed");
  assert(b.hitByBoss === 9 && b.knocked, "charge hits for 9 with knockback: " + b.hitByBoss);

  // Dodge: player keeps out of the charge line
  b.hitByBoss = 0; b.knocked = false; b.location = { x: 0, y: 64, z: 6 };
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
  assert(after.mastery.sword - sword0 > 8, "boss gives a big mastery boost: +" + (after.mastery.sword - sword0).toFixed(2));
  assert(dim.getEntities({ tags: ["ponce_minion"] }).length === 0, "minions released when boss dies");
  assert(b.msgs.some((m) => m.includes("FLOOR 1 CLEARED")), "victory title");
}

// ---------- Burrow Mole and Moss Golemite ----------
{
  const t = world.players.find((x) => x.name === "BossTester");
  const mole = dim.spawnEntity("ponce:burrow_mole", { x: 20, y: 64, z: 20 });
  mole.props["ponce:burrowed"] = true;
  t.location = { x: 30, y: 64, z: 30 }; system.tick(10);
  assert(!mole.events.includes("ponce:emerge"), "mole stays hidden when nobody is near");
  t.location = { x: 22, y: 64, z: 21 }; system.tick(10);
  assert(mole.events.includes("ponce:emerge"), "mole bursts out when a player is within 4 blocks");

  const g = dim.spawnEntity("ponce:moss_golemite", { x: 0, y: 64, z: 0 });
  g.health.effectiveMax = 40;
  t.setHeld(new ItemStack("minecraft:mace"));
  system.tick(20);
  g.health.currentValue = 40 - 6;
  fire("entityHurt", { hurtEntity: g, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: t } });
  assert(g.health.currentValue < 31.2 && g.health.currentValue > 30.5, "hammer deals +50% to golemite: " + g.health.currentValue.toFixed(2));
  t.setHeld(new ItemStack("minecraft:iron_sword", 1, ["minecraft:is_sword"]));
  system.tick(20);
  const before = g.health.currentValue - 6; g.health.currentValue = before;
  fire("entityHurt", { hurtEntity: g, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: t } });
  assert(g.health.currentValue > before + 2, "sword deals reduced damage to golemite");
  const kills0 = getDataFor(t).kills;
  g.health.currentValue = 0.5; // vanilla hit already landed; the +50% bonus (0.75) finishes it
  t.setHeld(new ItemStack("minecraft:mace"));
  system.tick(20);
  fire("entityHurt", { hurtEntity: g, damage: 1.5, damageSource: { cause: "entityAttack", damagingEntity: t } });
  assert(g.killed, "hammer bonus can finish the golemite");
  fire("entityDie", { deadEntity: g, damageSource: { cause: "none" } });
  assert(getDataFor(t).kills === kills0 + 1, "golemite kill credited to player");
}

// ================= Phase 2: weapons and skills =================
{
  const { WEAPON_DEFS } = await import("../behavior_pack/scripts/weapon_data.js");
  const { useSkill, IMPLEMENTED } = await import("../behavior_pack/scripts/abilities.js");
  const { SKILLS } = await import("../behavior_pack/scripts/skills.js");
  const { cooldowns } = await import("../behavior_pack/scripts/effects.js");
  const ponce = (id) => {
    const d = WEAPON_DEFS[`ponce:${id}`];
    return new ItemStack(`ponce:${id}`, 1, [`ponce:${d.type}`, "ponce:weapon", "ponce:tier_iron"], d.durability);
  };
  dim.factory = (id, loc) => { const e = makeEntity(id, 100); e.location = { ...loc }; return e; };
  const w = makePlayer("Weaponmaster"); world.players.push(w);
  Object.assign(w, { dimension: dim, location: { x: 100, y: 64, z: 0 }, isSneaking: false, teleport(loc) { w.location = { ...loc }; w.teleported = true; },
    getEntitiesFromViewDirection: () => dim.getEntities({ location: w.location, maxDistance: 10 }).filter((e) => e.location.z > w.location.z && e.isValid).map((entity) => ({ entity })) });
  fire("playerSpawn", { player: w, initialSpawn: true });
  const d = getDataFor(w);
  const enemy = (dx, dz, hp = 100) => { const e = dim.spawnEntity("ponce:tusk_boar", { x: 100 + dx, y: 64, z: dz }); e.health.currentValue = e.health.effectiveMax = hp; return e; };
  const clear = () => { for (const e of dim.entities) e.isValid = false; };
  const hit = (target, dmg) => { target.health.currentValue -= dmg; fire("entityHurt", { hurtEntity: target, damage: dmg, damageSource: { cause: "entityAttack", damagingEntity: w } }); };
  system.tick(40);

  // Requirements
  const sword = ponce("iron_longsword"); w.setHeld(sword);
  let t = enemy(0, 2);
  hit(t, 7);
  assert(Math.abs(t.health.currentValue - (100 - 7 * 0.25)) < 0.3, "unmet requirements: 25% damage, hp " + t.health.currentValue.toFixed(2));
  assert(w.msgs.some((m) => m.includes("can't handle the Iron Longsword")), "player is told why");
  Object.assign(d, { level: 10 }); Object.assign(d.stats, { str: 20, dex: 20, agi: 20, vit: 20 });
  system.tick(20);
  t.health.currentValue = 100;
  hit(t, 7);
  assert(t.health.currentValue < 93, "requirements met: full damage plus STR bonus");
  assert(sword.lore.length > 0 && sword.lore.some((l) => l.includes("Requires")), "tooltip added to held weapon");
  assert(sword.dur.damage >= 1, "weapon loses durability on hit");

  // Swing pacing: greatsword spam
  clear(); w.setHeld(ponce("iron_greatsword")); system.tick(40);
  t = enemy(0, 2, 1000);
  hit(t, 11); const afterFirst = t.health.currentValue;
  system.tick(5);
  hit(t, 11); const secondLoss = afterFirst - t.health.currentValue;
  assert(secondLoss < 11 * 1.4 * 0.4, "rushed greatsword swing deals much less: " + secondLoss.toFixed(1));
  assert(w.effects.slowness?.amplifier === 0, "greatsword applies Slowness I while held");
  w.setHeld(ponce("iron_dagger")); system.tick(10);
  assert(!w.effects.slowness && w.effects.speed?.amplifier >= 1, "dagger: no slowness, extra speed level");

  // Skills: none unlocked yet
  clear(); w.setHeld(sword); w.msgs.length = 0;
  useSkill(w, sword);
  assert(w.actionBar.includes("No One-Handed Sword skills yet"), "no skill yet: " + w.actionBar);

  // Dash Slash
  d.skills.push("sword_dash");
  t = enemy(0, 2);
  useSkill(w, sword); system.tick(6);
  assert(t.health.currentValue < 100 - 7 * 1.5, "Dash Slash hits the enemy in front: " + t.health.currentValue.toFixed(1));
  const hp1 = t.health.currentValue;
  useSkill(w, sword); system.tick(6);
  assert(t.health.currentValue === hp1 && w.actionBar.includes("ready in"), "cooldown blocks a second use");
  system.tick(120);
  useSkill(w, sword); system.tick(6);
  assert(t.health.currentValue < hp1, "usable again after the cooldown");

  // Sneak to cycle
  d.skills.push("sword_combo");
  w.isSneaking = true; useSkill(w, sword); w.isSneaking = false;
  assert(d.activeSkill.sword === "sword_combo" && w.actionBar.includes("Triple Arc"), "sneak + use equips the next skill");

  // Hammer slam: AoE around you only
  clear(); const hammer = ponce("iron_warhammer"); w.setHeld(hammer); d.skills.push("hammer_slam");
  const near = [enemy(2, 0), enemy(-2, 1), enemy(0, -3)], far = enemy(8, 0);
  useSkill(w, hammer);
  assert(near.every((e) => e.health.currentValue < 100) && far.health.currentValue === 100, "Ground Slam hits everything within 4 blocks, nothing beyond");

  // Spear pierce: only in a line ahead
  clear(); const spear = ponce("iron_spear"); w.setHeld(spear); d.skills.push("spear_pierce");
  const line = [enemy(0, 2), enemy(0.5, 5)], side = enemy(4, 2), behind = enemy(0, -2);
  useSkill(w, spear);
  assert(line.every((e) => e.health.currentValue < 100) && side.health.currentValue === 100 && behind.health.currentValue === 100, "Piercing Line hits only enemies in the line");

  // Riposte
  clear(); const rapier = ponce("iron_rapier"); w.setHeld(rapier); d.skills.push("rapier_riposte"); d.activeSkill.rapier = "rapier_riposte";
  const attacker = enemy(0, 2);
  useSkill(w, rapier);
  w.health.currentValue = 14; // took a 6-damage hit
  fire("entityHurt", { hurtEntity: w, damage: 6, damageSource: { cause: "entityAttack", damagingEntity: attacker } });
  assert(w.health.currentValue === 20 && attacker.health.currentValue < 100 - 6 * 2, "Riposte negates the hit and counters");

  // Backstab
  clear(); const dagger = ponce("iron_dagger"); w.setHeld(dagger); d.skills.push("dagger_backstab"); system.tick(20);
  const facingAway = enemy(0, 2); // faces +z, away from the player
  hit(facingAway, 5); const back = 100 - facingAway.health.currentValue;
  system.tick(20);
  const facingMe = enemy(1, 2); facingMe.view = { x: 0, y: 0, z: -1 };
  hit(facingMe, 5); const front = 100 - facingMe.health.currentValue;
  assert(back > front * 1.4, `Backstab: ${back.toFixed(1)} from behind vs ${front.toFixed(1)} from the front`);

  // Dual Wield follow-up and Twin Tempest
  clear(); w.setHeld(sword); w.offhand = undefined; d.skills.push("dual_wield");
  d.activeSkill.sword = "twin_tempest";
  d.skills.push("twin_tempest");
  cooldowns.delete(w.id);
  useSkill(w, sword);
  assert(w.actionBar.includes("needs a Ponce sword in your offhand") && !cooldowns.get(w.id)?.twin_tempest, "Twin Tempest refuses without an offhand sword, no cooldown");
  w.offhand = ponce("tuskfang_blade");
  t = enemy(0, 2, 1000); system.tick(20);
  hit(t, 7); const afterMain = t.health.currentValue;
  system.tick(11);
  assert(t.health.currentValue < afterMain, "Dual Wield: offhand follows up 10 ticks later");
  const beforeTempest = t.health.currentValue;
  useSkill(w, sword); system.tick(50);
  assert(beforeTempest - t.health.currentValue > 6 * 7 * 0.9, "Twin Tempest lands six strikes: " + (beforeTempest - t.health.currentValue).toFixed(1));

  // Axe bleed ticks
  clear(); const axe = ponce("iron_battleaxe"); w.setHeld(axe); d.skills.push("axe_bleed"); system.tick(40);
  t = enemy(0, 2);
  hit(t, 8); const afterAxe = t.health.currentValue;
  system.tick(40);
  assert(t.health.currentValue < afterAxe, "Rend bleed keeps damaging over time");

  // Smoke test: every active skill fires without errors
  clear();
  for (const s of SKILLS) if (!d.skills.includes(s.id)) d.skills.push(s.id);
  d.level = 50; Object.assign(d.stats, { str: 60, dex: 60, agi: 60, vit: 60 });
  const tierOne = { sword: "iron_longsword", dagger: "iron_dagger", rapier: "iron_rapier", hammer: "iron_warhammer", axe: "iron_battleaxe", spear: "iron_spear", katana: "iron_katana", greatsword: "iron_greatsword" };
  w.offhand = ponce("tuskfang_blade");
  const missing = SKILLS.filter((s) => s.kind === "active" && !IMPLEMENTED.includes(s.id)).map((s) => s.id);
  assert(missing.length === 0, "every active skill is implemented " + missing.join(","));
  let errors = 0;
  for (const s of SKILLS.filter((x) => x.kind === "active")) {
    cooldowns.delete(w.id);
    const item = ponce(tierOne[s.weapon]); w.setHeld(item); d.activeSkill[s.weapon] = s.id;
    enemy(0, 2, 500); enemy(1, 3, 500);
    try { useSkill(w, item); system.tick(60); } catch (e) { errors++; console.error(s.id, e); }
  }
  assert(errors === 0, "all active skills run cleanly");
}
