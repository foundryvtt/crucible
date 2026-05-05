/**
 * Crucible-defined VFX component animations, registered into `CONFIG.Canvas.vfx.animations` for
 * use in `singleAttack`/`singleImpact` component animation arrays.
 */

/**
 * Fade the projectile container's alpha 0 -> 1 over the bound timeline range.
 */
const projectileFadeIn = {
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
 * Drive the projectile container along its precomputed flight path.
 * Mirrors upstream `followPath` minus the `mesh.anchor.x` lerp that continues the bow `drawBack`
 * charge animation - spell projectiles have no drawback so the trailing-anchor jump is incorrect.
 */
const projectileFlight = {
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
 * The full set of Crucible-defined VFX component animations, keyed by registry name.
 * @type {Record<string, import("@client/canvas/vfx/_types.mjs").VFXComponentAnimation>}
 */
export const COMPONENT_ANIMATIONS = {
  projectileFadeIn,
  projectileFlight
};

/* -------------------------------------------- */

/**
 * Register all Crucible component animations into the global VFX animation registry.
 */
export function registerComponentAnimations() {
  for ( const [name, animation] of Object.entries(COMPONENT_ANIMATIONS) ) {
    CONFIG.Canvas.vfx.animations[name] = animation;
  }
}
