/**
 * Registered VFX animation functions used for sprites during animation.
 */

/**
 * @import {default as CrucibleVFXComponent} from "../components/vfx-component.mjs";
 */

/**
 * @callback CrucibleVFXAnimationScheduler
 * @this {CrucibleVFXComponent}             The component this animation is attached to
 * @param {object} phase                    The phase of the effect timeline this animation belongs to
 * @param {object} params                   Animation parameters established at configure-time
 */

/**
 * A Crucible VFX component animation: optional lifecycle hooks bound to the owning component, each given
 * the current `phase`. `setup` prepares `this.state`/`params` once; `animate` runs each frame with
 * normalized phase progress `t`; `schedule` adds bespoke timeline entries or managed display objects.
 * @typedef CrucibleVFXComponentAnimation
 * @property {(this: CrucibleVFXComponent, phase: object, params: object) => void} [setup]
 * @property {(this: CrucibleVFXComponent, t: number, phase: object, params: object) => void} [animate]
 * @property {CrucibleVFXAnimationScheduler} [schedule]
 * @property {(this: CrucibleVFXComponent, phase: object, params: object) => void} [tearDown]
 */

/**
 * Fade the projectile container's alpha 0 -> 1 over the charge phase.
 * @type {CrucibleVFXComponentAnimation}
 */
const chargeProjectileFadeIn = {
  setup(phase, params) {
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "inQuad");
  },
  animate(t, phase, params) {
    const container = this.state.delivery?.container;
    if ( container ) container.alpha = params.ease(t);
  }
};

/* -------------------------------------------- */

/**
 * Drive the projectile container along its precomputed flight path during the delivery phase.
 * Mirrors upstream `followPath` minus the `mesh.anchor.x` lerp that continues the bow `drawBack`
 * charge animation - spell projectiles have no drawback so the trailing-anchor jump is incorrect.
 * @type {CrucibleVFXComponentAnimation}
 */
const deliveryProjectileFlight = {
  setup(phase, params) {
    this.state.lastPathIndex = 0;
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "linear", params.easingParams);
  },
  animate(t, phase, params) {
    const target = params.target || this.state.delivery?.container;
    if ( !target ) return;
    const w = params.ease(t);
    const point = this.state.flightPath.interpolatedPoint(w, this.state.lastPathIndex);
    this.state.lastPathIndex = point.index;
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
 * Build an impact animator that displaces `state.targetMesh` along the origin->destination direction
 * with a kick and damped settle (`params`: `distance`, `duration`, `oscillations`).
 * @param {number} defaultOscillations
 * @returns {CrucibleVFXComponentAnimation}
 */
function impactRecoilAnimation(defaultOscillations) {
  return {
    setup(phase, params) {
      const {origin, destination} = this.state;
      const dir = Math.atan2(destination.y - origin.y, destination.x - origin.x);
      params._dx = Math.cos(dir);
      params._dy = Math.sin(dir);
      params._base = null;
      params._target = this.state.targetMesh; // Capture per-target so multi-target dispatch stays correct
    },
    animate(t, phase, params) {
      const target = params._target;
      if ( !target || target.destroyed ) return;
      const rp = (t * phase.duration) / (params.duration ?? 320);
      if ( rp >= 1 ) return; // Recoil done; leave the token at rest
      if ( !params._base ) params._base = {x: target.position.x, y: target.position.y};
      const offset = (params.distance ?? 12) * _recoilMagnitude(rp, params.oscillations ?? defaultOscillations);
      target.position.set(params._base.x + (params._dx * offset), params._base.y + (params._dy * offset));
    },
    tearDown(phase, params) {
      // Restore the token to rest if the recoil was interrupted mid-displacement.
      const target = params._target;
      if ( params._base && target && !target.destroyed ) target.position.set(params._base.x, params._base.y);
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
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteRecoil = impactRecoilAnimation(0);

/**
 * Heavier recoil for a critical hit: a stronger kick that overshoots and bounces (damped reverb).
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteShake = impactRecoilAnimation(3);

/* -------------------------------------------- */
/*  Impact Sprite                               */
/* -------------------------------------------- */

/**
 * Spawn an impact sprite at the point of impact, oriented along the incoming direction, then pop it in
 * with a scale-up and ADD-blend flash before settling smaller and fading out over the rest of the hold.
 * Tuning (`params`): `texture` (required), `size`, `duration`, `scaleStart`, `scaleSettle`, `flash`,
 * `flashDuration`.
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteBurst = {
  schedule(phase, params) {
    if ( !params.texture ) return;
    const {origin, destination} = this.state;
    const container = this.addManagedDisplayObject(this._createSprite(params.texture, params.size ?? 3, destination));
    container.rotation = Math.atan2(destination.y - origin.y, destination.x - origin.x);

    // A quick arrival pop, then a gradual settle + fade-out over the remainder of the hold.
    const start = phase.start;
    const hold = params.duration ?? phase.duration;
    if ( hold <= 0 ) return;
    const rise = Math.min(hold / 10, 120);
    const settle = hold - rise;
    const {scaleStart = 0.5, scaleSettle = 0.9, flash = true, flashDuration = 150} = params;

    // Fade in on arrival, then fade out gradually across the settle window (alongside the scale).
    this.timeline.add(container, {alpha: {from: 0, to: 1, duration: rise}}, start)
      .add(container, {alpha: {from: 1, to: 0, duration: settle}}, start + rise);

    // Pop up to full size on arrival, then ease down to the settle scale over the same window.
    container.scale.set(scaleStart);
    this.timeline.add(container.scale, {x: {from: scaleStart, to: 1}, y: {from: scaleStart, to: 1}, duration: rise},
      start)
      .add(container.scale, {x: {to: scaleSettle}, y: {to: scaleSettle}, duration: settle}, start + rise);

    // Flash ADD blend on arrival, then cool to NORMAL.
    const mesh = flash ? container.getChildByName?.("mesh") : null;
    if ( mesh ) {
      this.timeline.call(() => mesh.blendMode = PIXI.BLEND_MODES.ADD, start);
      this.timeline.call(() => mesh.blendMode = PIXI.BLEND_MODES.NORMAL, start + flashDuration);
    }
  }
};

/* -------------------------------------------- */

/**
 * Apply a short-lived {@link foundry.canvas.rendering.filters.GlowOverlayFilter} to the target mesh
 * as soft impact feedback. Useful where no recoil or impact sprite applies (e.g. restorative magic).
 * Accepts every filter knob except `animated` (`padding`, `innerStrength`, `outerStrength`,
 * `distance`, `glowColor`, `quality`, `knockout`, `alpha`) plus the alpha envelope (`duration`,
 * `fadeIn`, `fadeOut`). `animated` is force-disabled: the VFXEffect timeline owns all uniform
 * animation, and the filter's built-in ticker oscillation would run in parallel and fight it.
 * `glowColor` accepts a hex literal (e.g. 0xffaadd) or an [r,g,b,a] float array.
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteGlow = {
  schedule(phase, params) {
    const target = this.state.targetMesh;
    if ( !target || target.destroyed ) return;
    const FilterClass = foundry.canvas.rendering.filters.GlowOverlayFilter;
    if ( !FilterClass ) {
      console.warn("Crucible VFX: GlowOverlayFilter unavailable; impactSpriteGlow has no effect.");
      return;
    }

    const {
      padding = 6, innerStrength = 3, outerStrength = 3,
      distance = 10, glowColor = 0xffffff, quality = 0.5, knockout = false,
      alpha = 1, duration, fadeIn = 150, fadeOut = 300
    } = params;
    const dur = duration ?? phase.duration ?? 1000;
    const color = Array.isArray(glowColor) ? glowColor : [
      ((glowColor >> 16) & 0xff) / 255,
      ((glowColor >> 8) & 0xff) / 255,
      (glowColor & 0xff) / 255,
      1
    ];

    const filter = FilterClass.create({distance, glowColor: color, quality, knockout, alpha: 0});
    filter.padding = padding;
    filter.innerStrength = innerStrength;
    filter.outerStrength = outerStrength;
    filter.animated = false;

    // Defer attachment to phase.start. Attaching the filter at draw-time runs its shader against the
    // mesh for the entire spell preamble even at alpha 0 (the shader does not fully zero out), so the
    // filter must be joined to the mesh only at the impact moment and detached when the glow ends.
    const start = phase.start;
    this.timeline.call(() => {
      if ( target.destroyed ) return;
      target.filters = target.filters ? [...target.filters, filter] : [filter];
    }, start);

    this.timeline
      .add(filter.uniforms, {alpha: {from: 0, to: alpha, duration: fadeIn}}, start)
      .add(filter.uniforms, {alpha: {to: 0, duration: fadeOut}}, (start + dur) - fadeOut);

    this.timeline.call(() => {
      if ( target.destroyed ) return;
      const filters = target.filters;
      if ( !filters ) return;
      const idx = filters.indexOf(filter);
      if ( idx < 0 ) return;
      const next = filters.slice();
      next.splice(idx, 1);
      target.filters = next.length ? next : null;
    }, start + dur);
  }
};

/* -------------------------------------------- */

/**
 * Crucible sprite animators, keyed by registry name.
 * @type {Record<string, CrucibleVFXComponentAnimation>}
 */
export const SPRITE_ANIMATIONS = {
  chargeProjectileFadeIn,
  deliveryProjectileFlight,
  impactSpriteBurst,
  impactSpriteRecoil,
  impactSpriteShake,
  impactSpriteGlow
};
