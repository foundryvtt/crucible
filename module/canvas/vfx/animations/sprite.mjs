/**
 * Registered VFX animation functions used for sprites during animation.
 */

/**
 * @import {default as CrucibleVFXComponent} from "../components/vfx-component.mjs";
 */

/**
 * A Crucible VFX component animation configuration and callbacks
 * @typedef CrucibleVFXComponentAnimation
 * @property {(this: CrucibleVFXComponent, phase: object, params: object) => void} [setup]
 * @property {(this: CrucibleVFXComponent, t: number, phase: object, params: object) => void} [animate]
 * @property {(this: CrucibleVFXComponent, phase: object, params: object) => void} [schedule]
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
 * Animate delivery of a single projectile along its configured flight path.
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
 * Build an impact animator that recoils `state.targetMesh` along origin->destination, heavier on a critical hit.
 * Displaces via mesh `anchor` (an uncontended channel) not `position`, so the recoil composes with concurrent token
 * movement and never strands the mesh.
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
      params._target = this.state.targetMesh; // Capture per-target so multi-target dispatch stays correct
      params._baseAnchor = params._target ? {x: params._target.anchor.x, y: params._target.anchor.y} : null;
    },
    animate(t, phase, params) {
      const target = params._target;
      const tex = target?.texture;
      if ( !target || target.destroyed || !params._baseAnchor || !tex ) return;
      const rp = (t * phase.duration) / (params.duration ?? 320);
      if ( rp >= 1 ) return; // Recoil settled; tearDown restores the resting anchor
      const offset = (params.distance ?? 12) * _recoilMagnitude(rp, params.oscillations ?? defaultOscillations);

      // Convert px displacement to a normalized anchor delta over the mesh display size; anchor offsets the sprite
      // opposite to its sign, so subtract to recoil along origin->destination
      const w = (Math.abs(target.scale.x) * tex.width) || 1;
      const h = (Math.abs(target.scale.y) * tex.height) || 1;
      target.anchor.set(
        params._baseAnchor.x - ((params._dx * offset) / w),
        params._baseAnchor.y - ((params._dy * offset) / h)
      );
    },
    tearDown(phase, params) {
      // Restore the resting anchor; safe to set absolutely because nothing else animates the mesh anchor
      const target = params._target;
      if ( params._baseAnchor && target && !target.destroyed ) {
        target.anchor.set(params._baseAnchor.x, params._baseAnchor.y);
      }
    }
  };
}

/* -------------------------------------------- */

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
 * as soft impact feedback. Often used as an alternative to recoil for restoration actions.
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
