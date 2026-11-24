// Inventory helpers for recipes.

export function container(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

export function countItem(player, id) {
  const inv = container(player);
  let n = 0;
  for (let i = 0; i < (inv?.size ?? 0); i++) {
    const it = inv.getItem(i);
    if (it?.typeId === id) n += it.amount;
  }
  return n;
}

export function hasAll(player, materials) {
  return materials.every((m) => countItem(player, m.item) >= m.count);
}

/** Removes the materials. Call hasAll() first. */
export function takeAll(player, materials) {
  const inv = container(player);
  for (const m of materials) {
    let left = m.count;
    for (let i = 0; i < inv.size && left > 0; i++) {
      const it = inv.getItem(i);
      if (it?.typeId !== m.item) continue;
      const use = Math.min(left, it.amount);
      left -= use;
      if (use === it.amount) inv.setItem(i, undefined);
      else { it.amount -= use; inv.setItem(i, it); }
    }
  }
}

/** Gives an item, dropping it at the player's feet if the inventory is full. */
export function give(player, stack) {
  const leftover = container(player)?.addItem(stack);
  if (leftover) player.dimension.spawnItem(leftover, player.location);
}

const NAMES = {
  "ponce:boar_kings_call": "Boar King's Call", "ponce:boar_king_crest": "Boar King's Crest",
  "ponce:ironhide": "Ironhide", "ponce:raw_boar": "Raw Boar Meat",
  "ponce:ember_copper_node": "Ember Copper", "ponce:ironheart_node": "Ironheart", "ponce:glimmer_silver_node": "Glimmer Silver",
};

export function itemName(id) {
  if (NAMES[id]) return NAMES[id];
  const raw = id.split(":")[1] ?? id;
  return raw.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
