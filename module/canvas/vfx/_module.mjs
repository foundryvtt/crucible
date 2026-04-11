export * as spells from "./spells.mjs";
export * as sprites from "./sprites.mjs";
export * as strikes from "./strikes.mjs";

/**
 * Set the VFX playback rate for debugging. Controls both the animejs engine speed and the
 * canvas ticker speed so animations play in synchronized slow motion.
 * @param {number} rate    Playback rate multiplier (e.g., 0.25 for quarter speed, 1.0 for normal)
 * @example crucible.api.canvas.vfx.setPlaybackRate(0.25);
 */
export function setPlaybackRate(rate) {
  globalThis.animejs.engine.speed = rate;
  if ( globalThis.canvas?.app?.ticker ) globalThis.canvas.app.ticker.speed = rate;
}
