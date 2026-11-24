const ev = () => { const h = []; return { h, subscribe: (f) => (h.push(f), f) }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const blocks = new Map(); // "x,y,z" -> block
export const dim = { id: "minecraft:overworld", entities: [], sounds: [], particles: [], drops: [], factory: null,
  getBlock(l) { const k = `${l.x},${l.y},${l.z}`; return blocks.get(k) ?? null; },
  setBlock(l, typeId) { const b = { typeId, location: { ...l }, dimension: dim, setType(t) { this.typeId = t; } }; blocks.set(`${l.x},${l.y},${l.z}`, b); return b; },
  spawnItem(stack, loc) { this.drops.push({ stack, loc }); },
  getPlayers(o = {}) { return world.players.filter((p) => !o.location || dist(p.location, o.location) <= (o.maxDistance ?? Infinity)); },
  getEntities(o = {}) { return this.entities.filter((e) => e.isValid && (!o.type || e.typeId === o.type) && (!o.tags || o.tags.every((t) => e.tagList.includes(t))) && (!o.location || dist(e.location, o.location) <= (o.maxDistance ?? Infinity))); },
  spawnEntity(id, loc) { const e = this.factory(id, loc); this.entities.push(e); return e; },
  playSound(id) { this.sounds.push(id); }, spawnParticle(id) { this.particles.push(id); } };
const worldProps = {};
export const world = { getDimension: () => dim, getAbsoluteTime: () => system.currentTick + (world.timeOffset ?? 0),
  getDynamicProperty: (k) => worldProps[k], setDynamicProperty: (k, v) => (worldProps[k] = v),
  beforeEvents: { playerBreakBlock: ev(), playerInteractWithBlock: ev() }, getEntity: (id) => dim.entities.find((e) => e.id === id) ?? world.players.find((p) => p.id === id), afterEvents: { playerSpawn: ev(), itemUse: ev(), playerLeave: ev(), entityHurt: ev(), entityDie: ev(), playerBreakBlock: ev(), entityHitBlock: ev(), itemCompleteUse: ev() }, players: [], getAllPlayers() { return this.players; } };
export const system = { currentTick: 0, intervals: [], timeouts: [],
  runInterval(f, n) { this.intervals.push({ f, n }); }, run(f) { this.timeouts.push({ f, at: this.currentTick + 1 }); }, runTimeout(f, n) { this.timeouts.push({ f, at: this.currentTick + n }); },
  tick(n = 1) { for (let i = 0; i < n; i++) { this.currentTick++; for (const it of this.intervals) if (this.currentTick % it.n === 0) it.f();
    const due = this.timeouts.filter((t) => t.at <= this.currentTick); this.timeouts = this.timeouts.filter((t) => t.at > this.currentTick); due.forEach((t) => t.f()); } } };
export const GameMode = { Creative: "Creative", Spectator: "Spectator", Survival: "Survival" };
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand" };
export class ItemStack {
  // ItemStack.registry mimics item JSON: id -> { tags, durability }
  constructor(typeId, amount = 1, tags = [], maxDurability = 0) {
    const reg = ItemStack.registry?.[typeId];
    this.typeId = typeId; this.amount = amount; this.tags = tags.length ? tags : reg?.tags ?? []; this.lore = [];
    const max = maxDurability || reg?.durability || 0;
    this.dur = max ? { damage: 0, maxDurability: max } : undefined;
  }
  hasTag(t) { return this.tags.includes(t); }
  getComponent(n) { return n === "minecraft:durability" ? this.dur : undefined; }
  getDynamicProperty(k) { return this.props?.[k]; } setDynamicProperty(k, v) { (this.props ??= {})[k] = v; }
  getLore() { return this.lore; } setLore(l) { this.lore = l; }
}
