const ev = () => { const h = []; return { h, subscribe: (f) => (h.push(f), f) }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dim = { entities: [], sounds: [], particles: [], factory: null,
  getPlayers(o = {}) { return world.players.filter((p) => !o.location || dist(p.location, o.location) <= (o.maxDistance ?? Infinity)); },
  getEntities(o = {}) { return this.entities.filter((e) => e.isValid && (!o.type || e.typeId === o.type) && (!o.tags || o.tags.every((t) => e.tagList.includes(t))) && (!o.location || dist(e.location, o.location) <= (o.maxDistance ?? Infinity))); },
  spawnEntity(id, loc) { const e = this.factory(id, loc); this.entities.push(e); return e; },
  playSound(id) { this.sounds.push(id); }, spawnParticle(id) { this.particles.push(id); } };
export const world = { getDimension: () => dim, afterEvents: { playerSpawn: ev(), itemUse: ev(), playerLeave: ev(), entityHurt: ev(), entityDie: ev() }, players: [], getAllPlayers() { return this.players; } };
export const system = { currentTick: 0, intervals: [], timeouts: [],
  runInterval(f, n) { this.intervals.push({ f, n }); }, runTimeout(f, n) { this.timeouts.push({ f, at: this.currentTick + n }); },
  tick(n = 1) { for (let i = 0; i < n; i++) { this.currentTick++; for (const it of this.intervals) if (this.currentTick % it.n === 0) it.f();
    const due = this.timeouts.filter((t) => t.at <= this.currentTick); this.timeouts = this.timeouts.filter((t) => t.at > this.currentTick); due.forEach((t) => t.f()); } } };
export const GameMode = { Creative: "Creative", Spectator: "Spectator", Survival: "Survival" };
export const EntityDamageCause = { entityAttack: "entityAttack" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
export class ItemStack { constructor(typeId, amount = 1, tags = []) { this.typeId = typeId; this.amount = amount; this.tags = tags; } hasTag(t) { return this.tags.includes(t); } }
