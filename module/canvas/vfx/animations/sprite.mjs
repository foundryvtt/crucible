/**
 * Registered VFX animation functions used for sprites during animation.
 */

/**
 * @import {VFXComponentAnimation} from "@client/canvas/vfx/_types.mjs";
 */

/**
 * Fade the projectile container's alpha 0 -> 1 over the charge phase.
 * @type {VFXComponentAnimation}
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
 * @type {VFXComponentAnimation}
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
/*  Impact Recoil                               */
/* -------------------------------------------- */

/**
 * Build an impact animator that displaces `state.recoilTarget` along the origin->destination direction
 * with a kick and damped settle (`params`: `distance`, `duration`, `oscillations`).
 * @param {number} defaultOscillations
 * @returns {VFXComponentAnimation}
 */
function impactRecoilAnimation(defaultOscillations) {
  return {
    setup(state, params) {
      const dir = Math.atan2(state.destination.y - state.origin.y, state.destination.x - state.origin.x);
      params._dx = Math.cos(dir);
      params._dy = Math.sin(dir);
      params._base = null;
    },
    animate(t, state, params, phaseDuration) {
      const target = state.recoilTarget;
      if ( !target || target.destroyed ) return;
      const rp = (t * phaseDuration) / (params.duration ?? 320);
      if ( rp >= 1 ) return; // Recoil done; leave the token at rest
      if ( !params._base ) params._base = {x: target.position.x, y: target.position.y};
      const offset = (params.distance ?? 12) * _recoilMagnitude(rp, params.oscillations ?? defaultOscillations);
      target.position.set(params._base.x + (params._dx * offset), params._base.y + (params._dy * offset));
    }
  };
}

/**
 * Recoil displacement magnitude (0..1 of peak) at recoil progress `rp` in [0, 1]: a fast ease-out kick
 * to peak, then a decaying settle that bounces through rest when `oscillations > 0`.
 * @param {number} rp             Recoil progress in [0, 1].
 * @param {number} oscillations   Damped bounce count after the kick (0 = monotonic settle).
 * @returns {number}
 */
function _recoilMagnitude(rp, oscillations) {
  const rise = 0.22; // Fraction of the recoil spent kicking out to peak displacement
  if ( rp < rise ) return 1 - Math.pow(1 - (rp / rise), 3);
  const tau = (rp - rise) / (1 - rise);
  const envelope = 1 - tau;
  const oscillation = (oscillations > 0) ? Math.cos(Math.PI * oscillations * tau) : 1;
  return envelope * oscillation;
}

/* -------------------------------------------- */

/**
 * Light directional recoil for a standard hit: the struck token rocks back and returns to rest.
 * @type {VFXComponentAnimation}
 */
const impactRecoil = impactRecoilAnimation(0);

/**
 * Heavier recoil for a critical hit: a stronger kick that overshoots and bounces (damped reverb).
 * @type {VFXComponentAnimation}
 */
const impactShake = impactRecoilAnimation(3);

/* -------------------------------------------- */
/*  Impact Sprite                               */
/* -------------------------------------------- */

/**
 * Spawn a sized burst sprite at the impact point facing the incoming direction and play the impact
 * treatment (`params`: `texture`, `size`, `duration`, `scaleStart`, `scaleSettle`, `flash`, `flashDuration`).
 * @type {VFXComponentAnimation}
 */
const impactBurst = {
  schedule(component, state, params, start) {
    if ( !params.texture ) return;
    const container = component.addManagedDisplayObject(
      component._createSprite(params.texture, params.size ?? 3, state.destination));
    // Face the burst along the incoming direction (rotation 0 when the origin is due west).
    container.rotation = Math.atan2(state.destination.y - state.origin.y, state.destination.x - state.origin.x);
    component._animateImpactSprite(container, start, params.duration ?? 1000, {
      scaleStart: params.scaleStart, scaleSettle: params.scaleSettle,
      flash: params.flash, flashDuration: params.flashDuration
    });
  }
};

/* -------------------------------------------- */

/**
 * Crucible sprite animators, keyed by registry name.
 * @type {Record<string, VFXComponentAnimation>}
 */
export const SPRITE_ANIMATIONS = {
  chargeSpriteFadeIn,
  projectileSpriteFlight,
  impactBurst,
  impactRecoil,
  impactShake
};
