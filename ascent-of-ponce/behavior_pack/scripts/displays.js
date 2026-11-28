// Work displays: small models that sit on the forge or the pot while you work (see tools/gen_displays.py).
// The forging and cooking scripts spawn one per job, push its state into synced entity properties,
// and remove it when the job ends. A sweep clears any that outlive their job (e.g. after a crash).

import { world } from "@minecraft/server";

export function spawnDisplay(dim, type, loc, yaw = 0) {
  try {
    const e = dim.spawnEntity(type, loc);
    try { e.setRotation?.({ x: 0, y: yaw }); } catch { /* ignore */ }
    return e;
  } catch { return undefined; }
}

/** Sets only the properties that changed since last time (cache holds what was sent). */
export function setDisplay(e, cache, props) {
  if (!e?.isValid) return;
  for (const [k, v] of Object.entries(props)) {
    if (cache[k] === v) continue;
    cache[k] = v;
    try { e.setProperty(`ponce:${k}`, v); } catch { /* ignore */ }
  }
}

export function removeDisplay(e) {
  try { if (e?.isValid) e.remove(); } catch { /* ignore */ }
}

/** Removes displays of this type that no live job owns. */
export function sweepDisplays(type, liveIds) {
  for (const id of ["overworld", "nether", "the_end"]) {
    let list = [];
    try { list = world.getDimension(id).getEntities({ type }); } catch { continue; }
    for (const e of list) if (!liveIds.has(e.id)) removeDisplay(e);
  }
}
