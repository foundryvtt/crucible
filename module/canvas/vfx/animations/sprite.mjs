/**
 * Crucible sprite animators: registered VFX animations that drive a display object (the projectile
 * container) over a phase's timeline. Each exposes the timeline-animator contract: an optional
 * `setup(state, params)` run once, then `animate(t, state, params)` called each frame against a
 * linear progress tween. See `animations/_module.mjs` for the naming convention.
 */

/**
 * Fade the projectile container's alpha 0 -> 1 over the charge phase.
 * @type {import("@client/canvas/vfx/_types.mjs").VFXComponentAnimation}
 */
const chargeSpriteFadeIn = {
  setup(state, params) {
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "inQuad");
  },
  animate(t, state, params) {
    const container = state.projectile?.container;
    if ( container ) container.alpha = params.ease(t);
  }
};

/* -------------------------------------------- */

/**
 * Drive the projectile container along its precomputed flight path during the projectile phase.
 * Mirrors upstream `followPath` minus the `mesh.anchor.x` lerp that continues the bow `drawBack`
 * charge animation - spell projectiles have no drawback so the trailing-anchor jump is incorrect.
 * @type {import("@client/canvas/vfx/_types.mjs").VFXComponentAnimation}
 */
const projectileSpriteFlight = {
  setup(state, params) {
    state.lastPathIndex = 0;
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "linear", params.easingParams);
  },
  animate(t, state, params) {
    const target = params.target || state.projectile?.container;
    if ( !target ) return;
    const w = params.ease(t);
    const point = state.flightPath.interpolatedPoint(w, state.lastPathIndex);
    state.lastPathIndex = point.index;
    target.x = point.x;
    target.y = point.y;
    target.rotation = point.rotation;
    target.elevation = point.elevation;
    target.sort = point.sort;
  }
};

/* -------------------------------------------- */

/**
 * Crucible sprite animators, keyed by registry name.
 * @type {Record<string, import("@client/canvas/vfx/_types.mjs").VFXComponentAnimation>}
 */
export const SPRITE_ANIMATIONS = {
  chargeSpriteFadeIn,
  projectileSpriteFlight
};
