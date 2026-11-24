import { world, system, ItemStack, dim } from "@minecraft/server";
import { log } from "@minecraft/server-ui";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok:", m); };

function makeEntity(typeId, hp, extra = {}) {
  const health = { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } };
  const e = { id: Math.random().toString(36), typeId, isValid: true, health, killed: false, dimension: dim,
    location: { x: 0, y: 64, z: 0 }, tagList: [], props: {}, getProperty(k) { return this.props[k]; }, events: [], effects: {}, impulses: [], damageTaken: 0,
    getComponent(n) { return n === "minecraft:health" ? health : extra[n]; },
    families: typeId === "minecraft:cow" ? ["mob"] : typeId.startsWith("ponce:npc_") ? ["ponce_npc", "npc"]
      : typeId.startsWith("ponce:") ? ["ponce_mob", "mob", "monster", ...(typeId === "ponce:ironhide" ? ["ponce_boss"] : [])] : ["mob", "monster"],
    matches(o) { return !o?.families || o.families.every((f) => this.families.includes(f)); }, kill() { this.killed = true; health.currentValue = 0; },
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
    // Teleports are recorded, not applied, so tests keep players where they put them
    teleport(loc, o) { p.teleportedTo = { ...loc }; p.teleportOptions = o; }, setSpawnPoint(sp) { p.spawnPoint = sp; },
    velocity: { x: 0, y: 0, z: 0 }, getVelocity() { return p.velocity; },
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

// Allocate stats through the menu (this player already picked a starter, so Status is the first button)
getDataFor(p).starter = "ponce:wayfarers_sword";
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
  Object.assign(w, { dimension: dim, location: { x: 100, y: 64, z: 0 }, isSneaking: false,
    getEntitiesFromViewDirection: () => dim.getEntities({ location: w.location, maxDistance: 10 }).filter((e) => e.location.z > w.location.z && e.isValid).map((entity) => ({ entity })) });
  fire("playerSpawn", { player: w, initialSpawn: true });
  const d = getDataFor(w);
  const enemy = (dx, dz, hp = 100) => { const e = dim.spawnEntity("ponce:tusk_boar", { x: 100 + dx, y: 64, z: dz }); e.health.currentValue = e.health.effectiveMax = hp; return e; };
  const clear = () => { for (const e of dim.entities) e.isValid = false; };
  const hit = (target, dmg) => { target.health.currentValue -= dmg; fire("entityHurt", { hurtEntity: target, damage: dmg, damageSource: { cause: "entityAttack", damagingEntity: w } }); };
  system.tick(40);
  w.teleport = (loc) => { w.location = { ...loc }; w.teleported = true; }; // real movement for Shadow Step, after the first-login trip

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
  const realRand = Math.random; Math.random = () => 0.99; // no crits, so the comparison isn't random
  const facingAway = enemy(0, 2); // faces +z, away from the player
  hit(facingAway, 5); const back = 100 - facingAway.health.currentValue;
  system.tick(20);
  const facingMe = enemy(1, 2); facingMe.view = { x: 0, y: 0, z: -1 };
  hit(facingMe, 5); const front = 100 - facingMe.health.currentValue;
  assert(back > front * 1.4, `Backstab: ${back.toFixed(1)} from behind vs ${front.toFixed(1)} from the front`);
  Math.random = realRand;

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

// ================= Phase 3: jobs =================
{
  const { sessions } = await import("../behavior_pack/scripts/forging.js");
  const { pots } = await import("../behavior_pack/scripts/cooking.js");
  const { WEAPON_DEFS } = await import("../behavior_pack/scripts/weapon_data.js");
  const { damageMultiplier, effectiveStats } = await import("../behavior_pack/scripts/progression.js");
  const { meetsWeaponReq } = await import("../behavior_pack/scripts/weapons.js");
  // Read tags straight from the generated item files, like the game does
  const fs = await import("node:fs");
  ItemStack.registry = Object.fromEntries(Object.entries(WEAPON_DEFS).map(([id, w]) => {
    const json = JSON.parse(fs.readFileSync(new URL(`../behavior_pack/items/weapons/${id.split(":")[1]}.json`, import.meta.url)));
    return [id, { tags: json["minecraft:item"].components["minecraft:tags"].tags, durability: w.durability }];
  }));
  const fireBefore = (n, e) => { world.beforeEvents[n].h.forEach((f) => f(e)); return e; };
  const flush = () => new Promise((r) => setTimeout(r, 5));

  const j = makePlayer("Crafter"); world.players.push(j);
  Object.assign(j, { dimension: dim, location: { x: 300.5, y: 64, z: 0.5 }, isSneaking: false, getGameMode: () => "Survival" });
  fire("playerSpawn", { player: j, initialSpawn: true });
  const d = getDataFor(j);
  const count = (id) => j.items.filter((i) => i?.typeId === id).reduce((n, i) => n + i.amount, 0);
  const pick = (tier) => new ItemStack(`minecraft:${tier}_pickaxe`, 1, ["minecraft:is_pickaxe", `minecraft:${tier}_tier`]);

  // ---- Mining ----
  const node = dim.setBlock({ x: 300, y: 10, z: 0 }, "ponce:ironheart_node");
  let ev = fireBefore("playerBreakBlock", { block: node, player: j, itemStack: pick("wooden"), cancel: false });
  assert(ev.cancel, "wooden pickaxe can't mine Ironheart");
  ev = fireBefore("playerBreakBlock", { block: node, player: j, itemStack: pick("stone"), cancel: false });
  assert(ev.cancel, "Mining level 1 can't mine Ironheart (needs 5)");
  system.tick(2);
  assert(j.msgs.some((m) => m.includes("needs Mining level")), "player told which Mining level is needed");
  d.jobs.mining.level = 5;
  ev = fireBefore("playerBreakBlock", { block: node, player: j, itemStack: pick("stone"), cancel: false });
  assert(!ev.cancel, "Mining 5 with a stone pickaxe can mine Ironheart");
  const xp0 = d.jobs.mining.xp;
  fire("playerBreakBlock", { block: node, brokenBlockPermutation: { type: { id: "ponce:ironheart_node" } }, player: j, dimension: dim });
  assert(node.typeId === "ponce:depleted_node", "mined node becomes a Depleted Node");
  assert(dim.drops.some((x) => x.stack.typeId === "ponce:raw_ironheart"), "drops Raw Ironheart");
  assert(d.jobs.mining.xp > xp0 || d.jobs.mining.level > 5, "Mining XP gained");
  assert(world.getDynamicProperty("ponce:depleted_nodes").includes("ponce:ironheart_node"), "regrow timer saved in the world");
  system.tick(20 * 30);
  assert(node.typeId === "ponce:depleted_node", "still depleted after 30s (Ironheart regrows in 60s)");
  system.tick(20 * 31);
  assert(node.typeId === "ponce:ironheart_node", "node regrows after 60s");

  const copper = dim.setBlock({ x: 301, y: 10, z: 0 }, "ponce:ember_copper_node");
  j.getGameMode = () => "Creative";
  fire("playerBreakBlock", { block: copper, brokenBlockPermutation: { type: { id: "ponce:ember_copper_node" } }, player: j, dimension: dim });
  assert(copper.typeId === "ponce:ember_copper_node", "creative mode breaks nodes normally (for building)");
  j.getGameMode = () => "Survival";

  // ---- Forging ----
  const forge = dim.setBlock({ x: 300, y: 64, z: 1 }, "ponce:smithing_forge");
  const order = Object.entries(WEAPON_DEFS).filter(([, x]) => x.forge).sort(([, a], [, b]) => a.tier - b.tier || a.type.localeCompare(b.type)).map(([id]) => id);
  const giveMats = (id) => { for (const m of WEAPON_DEFS[id].forge.materials) j.items[j.items.indexOf(undefined)] = new ItemStack(m.item, m.count); };
  const startForge = async (id) => {
    giveMats(id);
    globalThis.nextFormResponse = [{ canceled: false, selection: order.indexOf(id) }, { canceled: false, selection: 0 }];
    const e = fireBefore("playerInteractWithBlock", { block: forge, player: j, isFirstEvent: true, cancel: false });
    system.tick(1); await flush();
    return e;
  };
  const punch = () => fire("entityHitBlock", { damagingEntity: j, hitBlock: forge });
  const forged = (id) => j.items.filter((i) => i?.typeId === id);

  const e1 = await startForge("ponce:iron_longsword");
  assert(e1.cancel, "using the forge doesn't place blocks on it");
  assert(sessions.has(j.id), "forging session started");
  assert(count("ponce:ironheart_ingot") === 0 && count("ponce:ember_copper_ingot") === 0, "materials consumed");
  for (let i = 0; i < 10 && sessions.has(j.id); i++) { const s = sessions.get(j.id); s.pos = s.zone; punch(); system.tick(5); }
  let sword = forged("ponce:iron_longsword")[0];
  assert(sword?.getDynamicProperty("ponce:quality") === "masterwork", "all-perfect strikes forge a Masterwork: " + sword?.getDynamicProperty("ponce:quality"));
  assert(sword.nameTag.includes("Masterwork") && sword.lore.some((l) => l.includes("Masterwork")), "quality shown in name and tooltip");
  assert(d.jobs.smithing.xp > 0 || d.jobs.smithing.level > 1, "Smithing XP gained");

  await startForge("ponce:iron_dagger");
  for (let i = 0; i < 20 && sessions.has(j.id); i++) { const s = sessions.get(j.id); s.pos = s.zone > 12 ? 0 : 24; punch(); system.tick(5); }
  assert(forged("ponce:iron_dagger")[0]?.getDynamicProperty("ponce:quality") === "crude", "sloppy strikes make a Crude weapon");
  assert(forged("ponce:iron_dagger")[0].dur.damage > 0, "Crude weapons start worn");

  await startForge("ponce:iron_spear");
  system.tick(401);
  assert(!sessions.has(j.id) && forged("ponce:iron_spear")[0]?.getDynamicProperty("ponce:quality") === "crude", "metal cooling ends the job as Crude");

  await startForge("ponce:iron_rapier");
  j.location = { x: 320, y: 64, z: 0 }; system.tick(1);
  assert(!sessions.has(j.id) && forged("ponce:iron_rapier").length === 0, "walking away ruins the job");
  j.location = { x: 300.5, y: 64, z: 0.5 };

  d.jobs.smithing.level = 1;
  giveMats("ponce:tuskfang_blade");
  globalThis.nextFormResponse = [{ canceled: false, selection: order.indexOf("ponce:tuskfang_blade") }, { canceled: false, selection: 0 }];
  fireBefore("playerInteractWithBlock", { block: forge, player: j, isFirstEvent: true, cancel: false });
  system.tick(1); await flush();
  assert(!sessions.has(j.id) && count("ponce:glimmer_silver_ingot") === 1, "Tier II needs Smithing 8: no session, materials kept");

  // Quality changes damage
  Object.assign(d, { level: 10 }); Object.assign(d.stats, { str: 5, dex: 5 });
  const dummy = () => { const e = dim.spawnEntity("ponce:tusk_boar", { x: 300.5, y: 64, z: 2.5 }); e.health.currentValue = e.health.effectiveMax = 500; return e; };
  const std = new ItemStack("ponce:iron_longsword", 1, ["ponce:sword", "ponce:weapon", "ponce:tier_iron"], 450);
  const strike = (item) => { j.setHeld(item); system.tick(20); const t = dummy(); t.health.currentValue -= 7; fire("entityHurt", { hurtEntity: t, damage: 7, damageSource: { cause: "entityAttack", damagingEntity: j } }); return 500 - t.health.currentValue; };
  const realRandom = Math.random; Math.random = () => 0.99; // no crits for this comparison
  const lossStd = strike(std), lossMw = strike(sword);
  Math.random = realRandom;
  const ratio = lossMw / lossStd;
  assert(ratio > 1.15 && ratio < 1.25, `Masterwork hits ~20% harder (ratio ${ratio.toFixed(2)})`);

  // ---- Cooking ----
  const pot = dim.setBlock({ x: 301, y: 64, z: 1 }, "ponce:cooking_pot");
  const startCook = async (idx, mats) => {
    for (const [id, n] of mats) j.items[j.items.indexOf(undefined)] = new ItemStack(id, n);
    globalThis.nextFormResponse = [{ canceled: false, selection: idx }];
    fireBefore("playerInteractWithBlock", { block: pot, player: j, isFirstEvent: true, cancel: false });
    system.tick(1); await flush();
  };
  const punchPot = () => fire("entityHitBlock", { damagingEntity: j, hitBlock: pot });

  await startCook(0, [["ponce:raw_boar", 1], ["minecraft:stick", 1]]);
  assert(pots.has(j.id) && count("ponce:raw_boar") === 0, "cooking started, ingredients used");
  punchPot();
  assert(pots.has(j.id), "punching too early does nothing");
  while (pots.has(j.id) && pots.get(j.id).progress < (pots.get(j.id).perfect[0] + pots.get(j.id).perfect[1]) / 2) system.tick(1);
  punchPot();
  assert(count("ponce:boar_skewer") === 2, "perfect timing gives 2 servings");
  assert(d.jobs.cooking.xp > 0, "Cooking XP gained");

  await startCook(0, [["ponce:raw_boar", 1], ["minecraft:stick", 1]]);
  system.tick(200);
  assert(!pots.has(j.id) && count("ponce:burnt_mess") === 1, "waiting too long burns it");

  await startCook(3, [["ponce:raw_boar", 2], ["minecraft:potato", 2]]);
  assert(!pots.has(j.id) && count("ponce:raw_boar") === 2, "Hearty Roast needs Cooking 8: refused, ingredients kept");

  // ---- Eating ----
  const strBefore = effectiveStats(d).str, multBefore = damageMultiplier(d);
  fire("itemCompleteUse", { source: j, itemStack: new ItemStack("ponce:boar_skewer") });
  assert(effectiveStats(d).str === strBefore + 3 && damageMultiplier(d) > multBefore, "Boar Skewer: +3 STR in combat");
  d.stats.str = 1; d.stats.dex = 2;
  assert(!meetsWeaponReq(d, WEAPON_DEFS["ponce:iron_longsword"]), "meal buffs don't count toward weapon requirements");
  system.tick(20 * 181);
  assert(d.foodBuff === null && j.msgs.some((m) => m.includes("wore off")), "buff wears off after 3 minutes");
}

// ================= Starter weapons and infusions =================
{
  const { WEAPON_DEFS, INFUSIONS } = await import("../behavior_pack/scripts/weapon_data.js");
  const { ORDER, sessions } = await import("../behavior_pack/scripts/forging.js");
  const { effectiveDamage, wearWeapon, infusionsOf } = await import("../behavior_pack/scripts/weapons.js");
  const { isDecentWeapon } = await import("../behavior_pack/scripts/bosses.js");
  const { useSkill } = await import("../behavior_pack/scripts/abilities.js");
  const { STARTERS } = await import("../behavior_pack/scripts/starter.js");
  const flush = () => new Promise((r) => setTimeout(r, 5));
  const fireBefore = (n, e) => { world.beforeEvents[n].h.forEach((f) => f(e)); return e; };

  // ---- Starter choice on first login ----
  const n = makePlayer("Newcomer"); world.players.push(n);
  Object.assign(n, { dimension: dim, location: { x: 500.5, y: 64, z: 0.5 }, isSneaking: false, getGameMode: () => "Survival" });
  const hammerIdx = STARTERS.findIndex(([id]) => id === "ponce:wayfarers_hammer");
  globalThis.starterResponse = { Newcomer: { canceled: false, selection: hammerIdx } };
  fire("playerSpawn", { player: n, initialSpawn: true });
  system.tick(119); await flush();
  assert(!n.items.some((i) => i?.typeId === "ponce:wayfarers_hammer"), "picker waits until after the welcome");
  system.tick(2); await flush();
  const nd = getDataFor(n);
  const starter = n.items.find((i) => i?.typeId === "ponce:wayfarers_hammer");
  assert(starter && nd.starter === "ponce:wayfarers_hammer", "first login: chosen starter weapon is given");
  assert(starter.lore.some((l) => l.includes("Can't be forged")), "starter tooltip says it can't be forged");
  fire("playerSpawn", { player: n, initialSpawn: false });
  system.tick(130); await flush();
  assert(n.items.filter((i) => i?.typeId?.startsWith("ponce:wayfarers_")).length === 1, "starter is only ever given once");

  const forged = Object.values(WEAPON_DEFS).filter((d) => d.tier === 1 || d.tier === 2);
  const minForged = Math.min(...forged.map((d) => d.damage));
  const starters = Object.values(WEAPON_DEFS).filter((d) => d.tier === 0);
  assert(starters.length === 8 && starters.every((d) => d.damage < minForged), `all 8 starters are weaker than every forged weapon (max ${Math.max(...starters.map((d) => d.damage))} < ${minForged})`);
  assert(starters.every((d) => d.durability === null), "starters are unbreakable");
  const hammerItem = n.items.find((i) => i?.typeId === "ponce:wayfarers_hammer");
  n.setHeld(hammerItem); for (let i = 0; i < 50; i++) (await import("../behavior_pack/scripts/weapons.js")).wearWeapon(n);
  assert(hammerItem.dur === undefined && n.items.includes(hammerItem) && hammerItem.lore.some((l) => l.includes("Unbreakable")), "starter never wears down, tooltip says Unbreakable");
  assert(starters.every((d) => !d.forge) && ORDER.every(([id]) => WEAPON_DEFS[id].tier > 0), "starters can't be forged and aren't in the forge menu");
  assert(!isDecentWeapon(new ItemStack("ponce:wayfarers_greatsword")), "starters don't count as iron-tier against Ironhide");

  // Starter can use skills (it's a Ponce weapon)
  const s2 = makePlayer("Swordling"); world.players.push(s2);
  Object.assign(s2, { dimension: dim, location: { x: 520.5, y: 64, z: 0.5 }, isSneaking: false });
  fire("playerSpawn", { player: s2, initialSpawn: true });
  const sd = getDataFor(s2); sd.starter = "ponce:wayfarers_sword"; sd.skills.push("sword_dash");
  const ws = new ItemStack("ponce:wayfarers_sword"); s2.setHeld(ws);
  const dummy = dim.spawnEntity("ponce:tusk_boar", { x: 520.5, y: 64, z: 2.5 }); dummy.health.currentValue = dummy.health.effectiveMax = 100;
  useSkill(s2, ws); system.tick(6);
  assert(dummy.health.currentValue < 100, "starter weapon can use skills");

  // ---- Infusions ----
  const c = makePlayer("Infuser"); world.players.push(c);
  Object.assign(c, { dimension: dim, location: { x: 540.5, y: 64, z: 0.5 }, isSneaking: false, getGameMode: () => "Survival" });
  fire("playerSpawn", { player: c, initialSpawn: true });
  const cd = getDataFor(c); cd.starter = "ponce:wayfarers_sword";
  const forge = dim.setBlock({ x: 540, y: 64, z: 1 }, "ponce:smithing_forge");
  const put = (id, k) => { c.items[c.items.indexOf(undefined)] = new ItemStack(id, k); };
  const count = (id) => c.items.filter((i) => i?.typeId === id).reduce((a, i) => a + i.amount, 0);
  const forgeWith = async (id, picks) => {
    globalThis.nextFormResponse = [{ canceled: false, selection: ORDER.findIndex(([x]) => x === id) }, { canceled: false, selection: 0 }, { canceled: false, formValues: picks }];
    fireBefore("playerInteractWithBlock", { block: forge, player: c, isFirstEvent: true, cancel: false });
    system.tick(1); await flush();
    for (let i = 0; i < 12 && sessions.has(c.id); i++) { const s = sessions.get(c.id); s.pos = s.zone; fire("entityHitBlock", { damagingEntity: c, hitBlock: forge }); system.tick(5); }
    return c.items.filter((i) => i?.typeId === id).pop();
  };

  for (const m of WEAPON_DEFS["ponce:iron_longsword"].forge.materials) put(m.item, m.count);
  put("ponce:boar_tusk", 1);
  const tuskSword = await forgeWith("ponce:iron_longsword", [1]); // option 1 = the only affordable infusion
  assert(JSON.stringify(infusionsOf(tuskSword)) === '["ponce:boar_tusk"]' && count("ponce:boar_tusk") === 0, "Tier I: one infusion slot, Boar Tusk used up");
  assert(tuskSword.lore.some((l) => l.includes("Tusk Edge")) && tuskSword.nameTag.includes("+1"), "infusion shown in tooltip and name");
  const plain = new ItemStack("ponce:iron_longsword"); plain.setDynamicProperty("ponce:quality", "masterwork");
  assert(Math.abs(effectiveDamage(tuskSword) - effectiveDamage(plain) * 8 / 7) < 0.01, `Tusk Edge adds +1 base damage (${effectiveDamage(plain).toFixed(1)} -> ${effectiveDamage(tuskSword).toFixed(1)})`);

  // Tier II: two slots, recipe materials and infusion costs add up
  cd.jobs.smithing.level = 8;
  for (const m of WEAPON_DEFS["ponce:tuskfang_blade"].forge.materials) put(m.item, m.count);
  put("ponce:boar_hide", 2); put("ponce:golemite_core", 1);
  const opts = Object.keys(INFUSIONS).filter((id) => ["ponce:boar_hide", "ponce:golemite_core"].includes(id));
  const blade = await forgeWith("ponce:tuskfang_blade", [1 + Object.keys(INFUSIONS).filter((id) => id === "ponce:boar_hide" || id === "ponce:golemite_core").indexOf("ponce:boar_hide"), 1 + opts.indexOf("ponce:golemite_core")]);
  const inf = infusionsOf(blade);
  assert(inf.length === 2 && inf.includes("ponce:boar_hide") && inf.includes("ponce:golemite_core"), "Tier II: two infusion slots: " + JSON.stringify(inf));
  assert(count("ponce:boar_hide") === 0 && count("ponce:golemite_core") === 0 && count("ponce:boar_tusk") === 0, "recipe hide + infusion hide both consumed");

  // No infusion materials: no picker, plain weapon
  for (const m of WEAPON_DEFS["ponce:iron_dagger"].forge.materials) put(m.item, m.count);
  const plainDagger = await forgeWith("ponce:iron_dagger", []);
  assert(plainDagger && infusionsOf(plainDagger).length === 0, "infusions are optional");

  // Durability: Hide Grip (+30%) lasts longer, Tusk Edge (-10%) wears faster
  const wearTest = (infs) => {
    const it = new ItemStack("ponce:iron_longsword", 1, [], 1e6);
    if (infs.length) it.setDynamicProperty("ponce:infusions", JSON.stringify(infs));
    c.setHeld(it);
    for (let i = 0; i < 3000; i++) wearWeapon(c);
    return it.dur.damage;
  };
  const base = wearTest([]), hide = wearTest(["ponce:boar_hide"]), tusk = wearTest(["ponce:boar_tusk"]);
  assert(base === 3000 && Math.abs(hide - 3000 / 1.3) < 120 && Math.abs(tusk - 3000 / 0.9) < 120, `durability: base ${base}, Hide Grip ${hide} (~2308), Tusk Edge ${tusk} (~3333)`);
}

// ================= Phase 4: quests =================
{
  const Q = await import("../behavior_pack/scripts/quests.js");
  const { QUESTS, QUESTS_BY_ID, NPCS } = await import("../behavior_pack/scripts/quests_data.js");
  const { WEAPON_DEFS } = await import("../behavior_pack/scripts/weapon_data.js");
  const { WEAPON_KEYS } = await import("../behavior_pack/scripts/config.js");
  const { effectiveDamage, infusionsOf } = await import("../behavior_pack/scripts/weapons.js");
  const { isTarget } = await import("../behavior_pack/scripts/combat.js");
  const flush = () => new Promise((r) => setTimeout(r, 5));
  const fireBefore = (n, e) => { world.beforeEvents[n].h.forEach((f) => f(e)); return e; };

  const q = makePlayer("Quester"); world.players.push(q);
  Object.assign(q, { dimension: dim, location: { x: 700.5, y: 64, z: 0.5 }, isSneaking: false, getGameMode: () => "Survival" });
  fire("playerSpawn", { player: q, initialSpawn: true });
  const d = getDataFor(q); d.starter = "ponce:wayfarers_sword";
  const count = (id) => q.items.filter((i) => i?.typeId === id).reduce((a, i) => a + i.amount, 0);
  const put = (id, k) => { q.items[q.items.indexOf(undefined)] = new ItemStack(id, k); };
  const kill = (typeId, n) => { for (let i = 0; i < n; i++) { const e = makeEntity(typeId, 10); fire("entityDie", { deadEntity: e, damageSource: { cause: "entityAttack", damagingEntity: q } }); } };

  // NPC: named on spawn, can't be hit by skills, talking opens its menu
  const marla = dim.spawnEntity("ponce:npc_guild", { x: 701, y: 64, z: 2 });
  fire("entitySpawn", { entity: marla });
  assert(marla.nameTag === "Marla, the Guildmistress", "NPC gets its name tag on spawn");
  assert(!isTarget(marla), "skills and splash damage never target NPCs");

  // Accept through the dialogue: first button is the first available Easy quest (Jelly Cull)
  globalThis.nextFormResponse = [{ canceled: false, selection: 0 }, { canceled: false, selection: 0 }];
  const iev = fireBefore("playerInteractWithEntity", { player: q, target: marla, cancel: false });
  system.tick(1); await flush();
  assert(iev.cancel && d.quests.active.jelly_cull, "talking to Marla and choosing Accept starts Jelly Cull");
  assert(Q.questStatus(q, QUESTS_BY_ID.boar_trouble) === "locked", "Boar Trouble is locked until Lv 3 and Jelly Cull");

  kill("ponce:meadow_jelly", 9);
  assert(Q.questStatus(q, QUESTS_BY_ID.jelly_cull) === "active" && Q.objectiveProgress(q, QUESTS_BY_ID.jelly_cull, 0) === 9, "kills count toward the quest");
  kill("ponce:tusk_boar", 2);
  assert(Q.objectiveProgress(q, QUESTS_BY_ID.jelly_cull, 0) === 9, "other mobs don't count");
  kill("ponce:meadow_jelly", 3);
  assert(Q.questStatus(q, QUESTS_BY_ID.jelly_cull) === "ready" && q.msgs.some((m) => m.includes("ready to turn in")), "quest becomes ready, player is told");

  const col0 = d.col;
  globalThis.nextFormResponse = [{ canceled: false, selection: 0 }, { canceled: false, selection: 0 }];
  fireBefore("playerInteractWithEntity", { player: q, target: marla, cancel: false });
  system.tick(1); await flush();
  assert(d.quests.done.jelly_cull === 1 && d.col === col0 + 25 && count("ponce:boar_skewer") === 2, "turn in: Col, EXP and item rewards");
  assert(Q.questStatus(q, QUESTS_BY_ID.jelly_cull) === "done", "non-repeatable quest is done for good");

  // Collect objectives hand items over at turn-in
  d.level = 3;
  Q.accept(q, QUESTS_BY_ID.wasp_nest);
  kill("ponce:field_wasp", 10);
  put("ponce:wasp_stinger", 7);
  assert(Q.questStatus(q, QUESTS_BY_ID.wasp_nest) === "ready", "collect objective counts items in the inventory");
  await Q.turnIn(q, QUESTS_BY_ID.wasp_nest);
  assert(count("ponce:wasp_stinger") === 2 && count("ponce:wasp_wing") === 2, "turn-in takes 5 stingers, gives wings");

  // Hard: Fine Tier I weapon of the player's choice
  d.level = 5; d.quests.done.boar_trouble = 1;
  Q.accept(q, QUESTS_BY_ID.mole_menace);
  kill("ponce:burrow_mole", 8); put("ponce:mole_claw", 3);
  globalThis.nextFormResponse = [{ canceled: true }];
  await Q.turnIn(q, QUESTS_BY_ID.mole_menace);
  assert(Q.questStatus(q, QUESTS_BY_ID.mole_menace) === "ready" && count("ponce:mole_claw") === 3, "closing the reward picker keeps the quest ready, nothing taken");
  globalThis.nextFormResponse = [{ canceled: false, selection: WEAPON_KEYS.indexOf("katana") }];
  await Q.turnIn(q, QUESTS_BY_ID.mole_menace);
  const katana = q.items.find((i) => i?.typeId === "ponce:iron_katana");
  assert(katana?.getDynamicProperty("ponce:quality") === "fine", "Hard reward: Fine Iron Katana (chosen type)");

  // Elite: Masterwork Tier II with 2 infusions
  d.level = 6; d.quests.done.mole_menace = 1;
  Q.accept(q, QUESTS_BY_ID.king_of_boars);
  Q.notify(q, "boss", "ponce:ironhide");
  globalThis.nextFormResponse = [{ canceled: false, selection: WEAPON_KEYS.indexOf("greatsword") }];
  await Q.turnIn(q, QUESTS_BY_ID.king_of_boars);
  const elite = q.items.find((i) => i?.typeId === "ponce:ironhide_greatsword");
  assert(elite?.getDynamicProperty("ponce:quality") === "masterwork" && infusionsOf(elite).length === 2, "Elite reward: Masterwork Tier II with 2 infusions");

  // Legendary: Relic, unbreakable, 3 infusions, best stats
  d.level = 12; d.quests.done.stone_hearts = 1;
  Q.accept(q, QUESTS_BY_ID.boarbane);
  kill("ponce:tusk_boar", 30);
  for (let i = 0; i < 3; i++) Q.notify(q, "boss", "ponce:ironhide");
  put("ponce:boar_king_crest", 2);
  assert(Q.questStatus(q, QUESTS_BY_ID.boarbane) === "ready", "Boarbane: all four objectives done");
  globalThis.nextFormResponse = [{ canceled: false, selection: WEAPON_KEYS.indexOf("greatsword") }];
  await Q.turnIn(q, QUESTS_BY_ID.boarbane);
  const relic = q.items.find((i) => i?.typeId === "ponce:kingsfall");
  assert(relic && relic.dur === undefined && infusionsOf(relic).length === 3, "Legendary reward: Kingsfall, unbreakable, 3 infusions");
  assert(effectiveDamage(relic) > effectiveDamage(elite), `Relic out-hits the Elite reward (${effectiveDamage(relic).toFixed(1)} vs ${effectiveDamage(elite).toFixed(1)})`);
  for (const type of WEAPON_KEYS) {
    const [rid] = Object.entries(WEAPON_DEFS).find(([, w]) => w.tier === 3 && w.type === type);
    const [tid] = Object.entries(WEAPON_DEFS).find(([, w]) => w.tier === 2 && w.type === type);
    const r = new ItemStack(rid), t = new ItemStack(tid); t.setDynamicProperty("ponce:quality", "masterwork");
    if (!(effectiveDamage(r) > effectiveDamage(t))) assert(false, `${type} relic beats a plain Masterwork Tier II`);
  }
  assert(true, "every Relic beats a Masterwork Tier II of its type");
  assert(Object.values(WEAPON_DEFS).filter((w) => w.tier === 3).every((w) => !w.durability && w.infusions.length === 3 && !w.forge), "all 8 Relics: unbreakable, 3 infusions, not forgeable");

  // Rewards scale with difficulty
  const avg = (diff, k) => { const qs = QUESTS.filter((x) => x.difficulty === diff && !x.repeatable); return qs.reduce((a, x) => a + x.rewards[k], 0) / qs.length; };
  const scaled = [1, 2, 3, 4, 5].every((n, i, arr) => i === 0 || (avg(n, "xp") > avg(arr[i - 1], "xp") && avg(n, "col") > avg(arr[i - 1], "col")));
  assert(scaled, "average EXP and Col rise with every difficulty tier");
  assert(QUESTS.filter((x) => x.rewards.weapon?.kind === "relic").every((x) => x.difficulty === 5), "only Legendary quests give Relics");

  // Repeatable, cap, abandon
  Q.accept(q, QUESTS_BY_ID.pest_control); kill("ponce:thornback_hare", 20);
  await Q.turnIn(q, QUESTS_BY_ID.pest_control);
  assert(Q.questStatus(q, QUESTS_BY_ID.pest_control) === "available", "repeatable quest can be taken again");
  Q.accept(q, QUESTS_BY_ID.hare_hunt);
  Q.abandon(q, QUESTS_BY_ID.hare_hunt);
  assert(!d.quests.active.hare_hunt && Q.questStatus(q, QUESTS_BY_ID.hare_hunt) === "available", "abandoning frees the quest");

  // Hooks from other systems
  Q.accept(q, QUESTS_BY_ID.first_ore);
  const node = dim.setBlock({ x: 710, y: 10, z: 0 }, "ponce:ember_copper_node");
  fire("playerBreakBlock", { block: node, brokenBlockPermutation: { type: { id: "ponce:ember_copper_node" } }, player: q, dimension: dim });
  assert(Q.objectiveProgress(q, QUESTS_BY_ID.first_ore, 0) === 1, "mining a node advances mining quests");
  d.quests.done.first_ore = 1; d.quests.done.first_blade = 1;
  Q.accept(q, QUESTS_BY_ID.fine_work);
  Q.notify(q, "forge", "standard"); Q.notify(q, "forge", "fine"); Q.notify(q, "forge", "masterwork");
  assert(Q.objectiveProgress(q, QUESTS_BY_ID.fine_work, 0) === 2, "Fine Work counts only Fine-or-better forges");

  // Shop
  d.col = 5;
  const smithShop = async (sel) => { globalThis.nextFormResponse = [{ canceled: false, selection: sel }]; await Q.openShop(q, "smith"); };
  await smithShop(1);
  assert(count("ponce:ironheart_ingot") === 0 && q.msgs.some((m) => m.includes("Not enough Col")), "can't buy without enough Col");
  d.col = 100; await smithShop(1);
  assert(count("ponce:ironheart_ingot") === 1 && d.col === 75, "buying an Ironheart Ingot costs 25 Col");
  put("ponce:raw_ironheart", 6);
  const { SHOPS } = await import("../behavior_pack/scripts/quests_data.js");
  await smithShop(SHOPS.smith.buy.length + 0); // first sellable row the player holds
  assert(count("ponce:raw_ironheart") === 0 && d.col === 75 + 60, "selling 6 Raw Ironheart pays 60 Col");
}

// ================= Floor 1: Wayfarer's Rest =================
{
  const g = await import("../behavior_pack/scripts/floor1_gen.js");
  const f1 = await import("../behavior_pack/scripts/floor1.js");
  const { BlockTypes } = await import("@minecraft/server");
  const { FLOOR1, ARRIVAL, NPC_SPOTS } = g;
  const C = FLOOR1.center, BASE = FLOOR1.base;
  dim.allLoaded = true;
  dim.factory = (id, loc) => { const e = makeEntity(id, 20); e.location = { ...loc }; return e; };
  const typeAt = (x, y, z) => dim.blocks.get(`${x},${y},${z}`)?.typeId;

  // Generator sanity
  let total = 0, outside = 0;
  for (let cx = g.CHUNK_BOUNDS.min.x; cx <= g.CHUNK_BOUNDS.max.x; cx++) for (let cz = g.CHUNK_BOUNDS.min.z; cz <= g.CHUNK_BOUNDS.max.z; cz++) {
    if (!g.chunkHasIsland(cx, cz)) continue;
    for (const op of g.chunkOps(cx, cz)) { total++; if ((op[2] >> 4) !== cx || ((op[0] === "f" ? op[5] : op[4]) >> 4) !== cz) outside++; }
  }
  assert(total > 500000 && outside === 0, `generator: ${total} block ops, every one inside its own chunk`);
  assert(g.chunkOps(C.x >> 4, C.z >> 4).length === g.chunkOps(C.x >> 4, C.z >> 4).length, "generation is deterministic");
  assert(g.inTown(C.x + 10, C.z) && !g.inTown(C.x + 60, C.z) && g.onIsland(C.x + 200, C.z) && !g.onIsland(C.x + 300, C.z), "town and island bounds");

  // New player arrives in town
  const v = makePlayer("Arrival"); world.players.push(v);
  Object.assign(v, { dimension: dim, location: { x: 0, y: 70, z: 0 }, isSneaking: false, getGameMode: () => "Survival" });
  fire("playerSpawn", { player: v, initialSpawn: true });
  system.tick(12);
  assert(v.teleportedTo && Math.abs(v.teleportedTo.x - ARRIVAL.x) < 1 && Math.abs(v.teleportedTo.z - ARRIVAL.z) < 1, "first login: sent to Wayfarer's Rest");
  assert(v.spawnPoint && v.effects.slow_falling, "spawn point set in town, slow falling while the town loads");

  // The island builds around the player
  v.location = { ...ARRIVAL };
  system.tick(400);
  const centerChunk = [C.x >> 4, C.z >> 4];
  assert(f1.isChunkBuilt(...centerChunk), "the town chunk gets built");
  assert(typeAt(C.x, BASE + 5, C.z) === "minecraft:water" && typeAt(C.x, BASE + 2, C.z) === "minecraft:chiseled_stone_bricks", "Fountain of Youth: pillar with water on top");
  assert(typeAt(C.x + 17, BASE + 1, C.z + 15) === "ponce:smithing_forge" && typeAt(C.x - 18, BASE + 1, C.z - 21) === "ponce:cooking_pot", "the smithy has a forge, the kitchen a cooking pot");
  assert(typeAt(C.x, BASE, C.z + 20) === "minecraft:dirt_path", "fallback block ids: grass_path missing -> dirt_path used");
  const leaf = [...dim.blocks.values()].find((b) => b.typeId.endsWith("_leaves"));
  assert(leaf?.states?.persistent_bit === true, "tree leaves are placed persistent (never decay)");
  const saved = world.getDynamicProperty("ponce:floor1_chunks");
  assert(saved.split("").filter((c) => c === "1").length >= 40, "built chunks are saved in the world");

  // Quest givers move in, once
  const npcs = dim.entities.filter((e) => e.isValid && e.typeId.startsWith("ponce:npc_") && g.isOnFloor1(e.location));
  assert(npcs.length === 3 && npcs.every((n) => n.nameTag && Math.hypot(n.location.x - NPC_SPOTS[n.typeId].x, n.location.z - NPC_SPOTS[n.typeId].z) < 1), "Marla, Bram and Pip appear at their buildings");
  for (const n of npcs) {
    const x = Math.floor(n.location.x), z = Math.floor(n.location.z);
    if (typeAt(x, BASE + 1, z) !== "minecraft:air" || typeAt(x, BASE + 2, z) !== "minecraft:air") assert(false, `${n.typeId} has room to stand`);
  }
  assert(true, "every quest giver has two blocks of headroom");

  // A chunk that unloads mid-build is retried, not marked done
  const testChunk = [(C.x + 160) >> 4, C.z >> 4];
  dim.unloaded.add(testChunk.join(","));
  v.location = { x: C.x + 160, y: BASE + 2, z: C.z };
  system.tick(300);
  assert(!f1.isChunkBuilt(...testChunk), "unloaded chunk is not marked built");
  dim.unloaded.clear(); system.tick(300);
  assert(f1.isChunkBuilt(...testChunk), "built once it loads");

  // Forest spawning: Floor 1 mobs only, outside town, capped
  system.tick(40 * 12);
  const floorMobs = () => dim.entities.filter((e) => e.isValid && e.families?.includes("ponce_mob") && g.isOnFloor1(e.location));
  const near = floorMobs().filter((e) => Math.hypot(e.location.x - v.location.x, e.location.z - v.location.z) <= 40);
  assert(near.length >= 4 && near.length <= f1.SPAWN.cap + 1, `forest spawns Floor 1 mobs near the player (${near.length} nearby, cap ${f1.SPAWN.cap}, +1 for a boar herd)`);
  assert(floorMobs().every((e) => !g.inTown(e.location.x, e.location.z)), "nothing spawns inside town");
  const kinds = new Set(floorMobs().map((e) => e.typeId));
  assert([...kinds].every((k) => ["ponce:meadow_jelly", "ponce:thornback_hare", "ponce:tusk_boar", "ponce:field_wasp", "ponce:burrow_mole", "ponce:moss_golemite"].includes(k)), "only Floor 1 mobs: " + [...kinds].join(", "));
  v.location = { ...ARRIVAL };
  const inTownBefore = dim.entities.filter((e) => e.isValid && e.families?.includes("ponce_mob") && g.inTown(e.location.x, e.location.z)).length;
  system.tick(40 * 5);
  assert(dim.entities.filter((e) => e.isValid && e.families?.includes("ponce_mob") && g.inTown(e.location.x, e.location.z)).length === inTownBefore, "standing in town spawns nothing");

  // No Minecraft mobs on the floor
  const zombie = makeEntity("minecraft:zombie", 20); zombie.location = { x: C.x + 100, y: BASE + 1, z: C.z };
  const groundZombie = makeEntity("minecraft:zombie", 20); groundZombie.location = { x: 50, y: 64, z: 50 };
  const jelly = makeEntity("ponce:meadow_jelly", 12); jelly.location = { x: C.x + 100, y: BASE + 1, z: C.z };
  for (const e of [zombie, groundZombie, jelly]) { e.remove = () => { e.isValid = false; }; fire("entitySpawn", { entity: e }); }
  assert(!zombie.isValid && groundZombie.isValid && jelly.isValid, "vanilla mobs are removed on Floor 1 only; tower mobs stay");

  // Falling off the edge
  v.teleportedTo = undefined;
  v.location = { x: C.x + 240, y: BASE - 90, z: C.z }; v.velocity = { x: 0, y: -1.5, z: 0 };
  system.tick(10);
  assert(v.teleportedTo && Math.abs(v.teleportedTo.z - ARRIVAL.z) < 1, "falling off the island returns you to town");
  v.velocity = { x: 0, y: 0, z: 0 };
}
