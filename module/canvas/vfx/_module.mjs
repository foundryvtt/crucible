export * as animations from "./animations.mjs";
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

/**
 * Preview one or more animation blocks immediately on the canvas without the CrucibleAction
 * lifecycle. Pass VFXAnimationResult objects (as returned by block configure methods) and they
 * are merged, constructed as a VFXEffect, and played.
 *
 * @param {...import("./animations.mjs").VFXAnimationResult} blocks
 * @returns {Promise<void>}
 *
 * @example
 * const {radialBurst, driftingHaze, getVFXTexturePaths} = crucible.api.canvas.vfx;
 * const origin = {x: 2700, y: 2400};
 * const textures = crucible.api.canvas.vfx.sprites.getVFXTexturePaths("frost", "spray");
 * await crucible.api.canvas.vfx.preview(
 *   radialBurst.configure({prefix: "wave", origin, count: 500, speed: 800, duration: 80,
 *     lifetime: 500, visibleFraction: 0.5, textures}),
 *   driftingHaze.configure({prefix: "haze", origin, radius: 100,
 *     textures: crucible.api.canvas.vfx.sprites.getVFXTexturePaths("frost", "residue")})
 * );
 */
export async function preview(...blocks) {
  const {mergeAnimationBlocks} = await import("./animations.mjs");
  const {components, timeline, references} = mergeAnimationBlocks(...blocks);
  const vfxEffect = new foundry.canvas.vfx.VFXEffect({name: "preview", components, timeline});
  if ( CONFIG.debug.vfx ) console.debug("VFX preview", {components: Object.keys(components), timeline, references});
  return vfxEffect.play(references);
}
