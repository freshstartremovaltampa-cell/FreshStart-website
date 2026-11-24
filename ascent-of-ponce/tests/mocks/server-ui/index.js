export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const log = [];
class Base { constructor() { this.parts = []; } title(t) { this.parts.push(["title", t]); return this; } body(t) { this.parts.push(["body", t]); return this; }
  button(t, i) { this.parts.push(["button", t, i]); return this; } slider(...a) { this.parts.push(["slider", ...a]); return this; }
  toggle(...a) { this.parts.push(["toggle", ...a]); return this; } submitButton() { return this; }
  async show(p) { log.push(this.parts); const r = globalThis.nextFormResponse?.shift(); return r ?? { canceled: true, cancelationReason: "UserClosed" }; } }
export class ActionFormData extends Base {}
export class ModalFormData extends Base {}
