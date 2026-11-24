const ev = () => { const h = []; return { h, subscribe: (f) => (h.push(f), f) }; };
export const world = { afterEvents: { playerSpawn: ev(), itemUse: ev(), playerLeave: ev(), entityHurt: ev(), entityDie: ev() }, players: [], getAllPlayers() { return this.players; } };
export const system = { currentTick: 0, intervals: [], timeouts: [],
  runInterval(f, n) { this.intervals.push({ f, n }); }, runTimeout(f, n) { this.timeouts.push({ f, at: this.currentTick + n }); },
  tick(n = 1) { for (let i = 0; i < n; i++) { this.currentTick++; for (const it of this.intervals) if (this.currentTick % it.n === 0) it.f();
    const due = this.timeouts.filter((t) => t.at <= this.currentTick); this.timeouts = this.timeouts.filter((t) => t.at > this.currentTick); due.forEach((t) => t.f()); } } };
export const EquipmentSlot = { Mainhand: "Mainhand" };
export class ItemStack { constructor(typeId, amount = 1, tags = []) { this.typeId = typeId; this.amount = amount; this.tags = tags; } hasTag(t) { return this.tags.includes(t); } }
