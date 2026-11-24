// Shared form helper.

import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";

/** Show a form, retrying while the player has chat or another screen open. */
export async function show(player, form, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const res = await form.show(player);
    if (res.cancelationReason !== FormCancelationReason.UserBusy) return res;
    await new Promise((r) => system.runTimeout(r, 5));
  }
  return { canceled: true };
}
