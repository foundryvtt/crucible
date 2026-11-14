/**
 * Registered VFX animation functions used for sprites during animation.
 */

import CrucibleElectrocutionFilter from "../../filters/electrocution-filter.mjs";
import CrucibleFlipbookMesh from "../flipbook-mesh.mjs";
import {pickRandom, scheduleTimelineClock} from "../helpers.mjs";
import CrucibleFacingComponent from "../components/vfx-facing-component.mjs";

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

/* -------------------------------------------- */

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
 * Snap the projectile container into view at release, for a projectile which has no presence during the charge.
 * Tuning (`params`): `duration`.
 * @type {CrucibleVFXComponentAnimation}
 */
const deliveryProjectileReveal = {
  schedule(phase, params) {
    const container = this.state.delivery?.container;
    if ( !container ) return;
    this.timeline.add(container, {alpha: {from: 0, to: 1, duration: params.duration ?? 30}}, phase.start);
  }
};

/* -------------------------------------------- */

/**
 * Rearward anchor-x offset applied to a projectile sprite while drawn back, relative to its configured anchor.
 * @type {number}
 */
const DRAW_BACK_ANCHOR = 0.75;

/**
 * Draw a charged projectile back before release: the sprite anchor slides rearward from its configured value by
 * {@link DRAW_BACK_ANCHOR} with an outBack overshoot while fading in. Pairs with {@link deliveryProjectileFlight}
 * `returnAnchor`, which settles the anchor back to its configured value across the flight.
 * @type {CrucibleVFXComponentAnimation}
 */
const chargeDrawBack = {
  setup(phase, params) {
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "outBack", params.easingParams ?? 0.8);
    const container = this.state.delivery?.container;
    if ( !container ) return;
    container.alpha = 1.0;
    const mesh = container.getChildByName?.("mesh");
    if ( !mesh ) return;
    params.mesh = mesh;
    params.baseAnchorX = mesh.anchor.x;
    this.state.drawBackAnchorX = mesh.anchor.x;
  },
  animate(t, phase, params) {
    const mesh = params.mesh;
    if ( !mesh ) return;
    mesh.anchor.x = Math.mix(params.baseAnchorX, params.baseAnchorX + DRAW_BACK_ANCHOR, params.ease(t));
    mesh.alpha = Math.min(t * 4, 1);
  }
};

/* -------------------------------------------- */

/**
 * Animate delivery of a single projectile along its configured flight path. When `params.returnAnchor` is set, the
 * sprite anchor settles from the drawn-back offset back to its configured value across the flight, releasing a
 * {@link chargeDrawBack} draw.
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
    if ( params.returnAnchor ) {
      const base = this.state.drawBackAnchorX;
      const mesh = target.getChildByName?.("mesh");
      if ( mesh && (base != null) ) mesh.anchor.x = Math.mix(base + DRAW_BACK_ANCHOR, base, w);
    }
  }
};

/* -------------------------------------------- */
/*  Melee Strike                                */
/* -------------------------------------------- */

/**
 * Pull a melee strike sprite back from its origin along the attack line while fading it in, then hold it still.
 * Tuning (`params`): `distance` (caster radii), `easing`, `hold` (milliseconds held still at the end of the phase).
 * @type {CrucibleVFXComponentAnimation}
 */
const strikeSpriteDrawBack = {
  setup(phase, params) {
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "outQuad");
    params.distancePx = (params.distance ?? 0.3) * this.state.casterRadiusPx;
    params.drawFraction = phase.duration ? Math.max(1 - ((params.hold ?? 0) / phase.duration), 0.01) : 1;
    this.state.drawBackPx = params.distancePx;
  },
  animate(t, phase, params) {
    const container = this.state.delivery?.container;
    if ( !container ) return;
    const {origin, direction} = this.state;
    const d = params.distancePx * params.ease(Math.min(t / params.drawFraction, 1));
    container.position.set(origin.x - (direction.x * d), origin.y - (direction.y * d));
    container.alpha = Math.min(t * 3, 1);
  }
};

/* -------------------------------------------- */

/**
 * Flash a gleam at the leading tip of a drawn-back melee strike sprite during its held pause.
 * Pairs with a {@link strikeSpriteDrawBack} `hold`, listed after it so the drawn-back frame is already shown.
 * Tuning (`params`): `texture` (required), `hold`, `size`, `tint`, `linger` (milliseconds past the hold).
 * @type {CrucibleVFXComponentAnimation}
 */
const strikeSpriteGleam = {
  schedule(phase, params) {
    const mesh = this.state.delivery?.container?.getChildByName("mesh");
    if ( !params.texture || !mesh ) return;
    const hold = params.hold ?? 120;
    const linger = params.linger ?? 150;
    const at = phase.start + phase.duration - hold;

    // The tip is the leading edge of the shown frame's art, ahead of its drawn-back anchor along the art's own heading
    const {origin, direction} = this.state;
    const tex = mesh.texture;
    const leading = tex.trim ? (tex.trim.x + tex.trim.width) : tex.orig.width;
    const tipPx = (leading - (mesh.anchor.x * tex.orig.width)) * Math.abs(mesh.scale.x);
    const back = this.state.drawBackPx ?? 0;
    const heading = this.state.delivery.container.rotation;
    const point = {x: origin.x - (direction.x * back) + (Math.cos(heading) * tipPx),
      y: origin.y - (direction.y * back) + (Math.sin(heading) * tipPx),
      elevation: origin.elevation, sort: origin.sort + 1, sortLayer: origin.sortLayer};
    const container = this.addManagedDisplayObject(this._createSprite(params.texture, params.size ?? 3, point,
      {blend: PIXI.BLEND_MODES.ADD}));
    const gleam = container.getChildByName("mesh");
    if ( gleam && (params.tint != null) ) gleam.tint = params.tint;

    // Pop in, turn slightly while held, then fade as the strike releases
    const pop = Math.min(60, hold / 2);
    container.scale.set(0.2);
    this.timeline.add(container, {alpha: {from: 0, to: 1, duration: pop}}, at)
      .add(container.scale, {x: {from: 0.2, to: 1}, y: {from: 0.2, to: 1}, duration: pop, ease: "outQuad"}, at)
      .add(container, {rotation: {from: 0, to: Math.PI / 4, duration: hold + linger}}, at)
      .add(container, {alpha: {from: 1, to: 0, duration: hold + linger - pop}}, at + pop);
  }
};

/* -------------------------------------------- */

/**
 * Wind up, lean, and twist an attacking token into a melee strike, display only.
 * The twist adds to the token's facing, which a {@link CrucibleFacingComponent} turns toward the target;
 * lean displaces the mesh anchor so it never contends for position.
 * Each motion follows a drive: the charge winds up to a negative fraction (coiling or rearing back), complete by
 * `windupBy` of the charge and held after, the delivery drives to full, and the recovery settles back to rest. The
 * lean peaks at the impact; `follow` delays the twist's unwinding toward a follow-through which peaks as the delivery
 * ends (0 keeps it with the lean, 1 fully late).
 * Tuning (`params`): `hand`, `lean` (fraction of token width), `twist` (degrees), `windup` (default -0.3),
 * `windupBy` (default 1), `follow` (default 0), `recover` (milliseconds).
 * @type {CrucibleVFXComponentAnimation}
 */
const strikeSpriteLunge = {
  setup(phase, params) {
    const mesh = this.originMesh;
    if ( !mesh?.texture ) return;
    const {source, destination} = this.state;
    const angle = Math.atan2(destination.y - source.y, destination.x - source.x);
    const locked = !!mesh.object?.document?.lockRotation;
    params._mesh = mesh;
    params._dx = Math.cos(angle);
    params._dy = Math.sin(angle);
    params._baseAnchor = {x: mesh.anchor.x, y: mesh.anchor.y};
    params._twist = locked ? 0 : (Math.toRadians(params.twist ?? 12) * ((params.hand === "left") ? 1 : -1));
  },
  schedule(phase, params) {
    const mesh = params._mesh;
    if ( !mesh ) return;
    const {chargeStart, deliveryStart, deliveryEnd, impactStart} = this.timings;
    const recover = params.recover ?? 300;
    const windup = params.windup ?? -0.3;
    const follow = params.follow ?? 0;
    const leanPx = (params.lean ?? 0.15) * Math.abs(mesh.width);
    const io = t => ((t < 0.5) ? (2 * t * t) : (1 - (Math.pow((-2 * t) + 2, 2) / 2)));
    const progress = (t, from, to) => io(Math.clamp((t - from) / Math.max(to - from, 1), 0, 1));
    const woundAt = Math.mix(chargeStart, deliveryStart, params.windupBy ?? 1);

    // Wind up and hold, drive to full between `from` and `peak`, hold, then settle
    const drive = (t, from, peak) => {
      if ( t < from ) return windup * progress(t, chargeStart, woundAt);
      if ( t < peak ) return Math.mix(windup, 1, progress(t, from, peak));
      if ( t < deliveryEnd ) return 1;
      return 1 - progress(t, deliveryEnd, deliveryEnd + recover);
    };
    const twistFrom = Math.mix(deliveryStart, impactStart, follow);
    const twistPeak = Math.mix(impactStart, deliveryEnd, follow);
    scheduleTimelineClock(this.timeline, chargeStart, (deliveryEnd + recover) - chargeStart, ms => {
      if ( mesh.destroyed || (ms <= 0) ) return; // Timeline init renders at 0 before the component begins
      const t = chargeStart + ms;
      CrucibleFacingComponent.setMeshRotation(mesh, {twist: params._twist * drive(t, twistFrom, twistPeak)});
      _displaceAnchor(mesh, params._baseAnchor, params._dx, params._dy, leanPx * drive(t, deliveryStart, impactStart));
    });
  },
  tearDown(phase, params) {
    const mesh = params._mesh;
    if ( !mesh || mesh.destroyed ) return;
    CrucibleFacingComponent.restoreMeshRotation(mesh);
    mesh.anchor.set(params._baseAnchor.x, params._baseAnchor.y);
  }
};

/* -------------------------------------------- */

/**
 * Drive a melee strike sprite forward along the attack line from any drawn-back position, past its origin, or with
 * `contact` (a fraction across the art) until that point of the art lands on the strike point.
 * Tuning (`params`): `distance` (caster radii of travel beyond the origin), `contact`, `easing`.
 * @type {CrucibleVFXComponentAnimation}
 */
const strikeSpriteThrust = {
  setup(phase, params) {
    params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "outCubic");
    params.fromPx = -(this.state.drawBackPx ?? 0);
    const mesh = this.state.delivery?.container?.getChildByName("mesh");
    if ( (params.contact != null) && mesh ) {
      const contactPx = (params.contact - mesh.anchor.x) * mesh.texture.orig.width * Math.abs(mesh.scale.x);
      params.toPx = this.state.reachPx - contactPx;
    }
    else params.toPx = (params.distance ?? 0.5) * this.state.casterRadiusPx;
  },
  animate(t, phase, params) {
    const container = this.state.delivery?.container;
    if ( !container || (t <= 0) ) return; // Timeline init renders at t=0 before the phase begins
    const {origin, direction} = this.state;
    const d = Math.mix(params.fromPx, params.toPx, params.ease(t));
    container.position.set(origin.x + (direction.x * d), origin.y + (direction.y * d));
    container.alpha = 1;
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
function _impactRecoilAnimation(defaultOscillations) {
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
      _displaceAnchor(target, params._baseAnchor, params._dx, params._dy, offset);
    },
    tearDown(phase, params) {
      // Restore the resting anchor
      const target = params._target;
      if ( params._baseAnchor && target && !target.destroyed ) {
        target.anchor.set(params._baseAnchor.x, params._baseAnchor.y);
      }
    }
  };
}

/* -------------------------------------------- */

/**
 * Displace a mesh from its resting anchor by a canvas-space distance, so it moves without contending for position.
 * @param {PrimarySpriteMesh} target         The displaced mesh.
 * @param {{x: number, y: number}} base      Its resting anchor.
 * @param {number} dx                        Unit canvas-space x direction of the displacement.
 * @param {number} dy                        Unit canvas-space y direction of the displacement.
 * @param {number} px                        Displacement in canvas pixels.
 */
function _displaceAnchor(target, base, dx, dy, px) {
  // Rotate the displacement into the mesh's local frame
  const r = target.rotation || 0;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const localDx = (dx * cos) + (dy * sin);
  const localDy = (dy * cos) - (dx * sin);

  // Convert px displacement to an anchor delta, normalized for mesh size
  const w = (Math.abs(target.scale.x) * target.texture.width) || 1;
  const h = (Math.abs(target.scale.y) * target.texture.height) || 1;
  target.anchor.set(base.x - ((localDx * px) / w), base.y - ((localDy * px) / h));
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
const impactSpriteRecoil = _impactRecoilAnimation(0);

/**
 * Heavier recoil for a critical hit: a stronger kick that overshoots and bounces (damped reverb).
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteShake = _impactRecoilAnimation(3);

/* -------------------------------------------- */

/**
 * A dodge: the struck token steps across the attacker-to-target line away from the side the attack was aimed at,
 * optionally also backing away, holds, then slides back to rest.
 * Tuning (`params`): `duration`, `distance` (fraction of the token's width), `retreat` (backward share of the step
 * relative to its sideways share).
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteDodge = {
  setup(phase, params) {
    const from = this.state.source ?? this.state.origin;
    const to = this.state.targetMesh ?? this.state.destination;
    const dir = Math.atan2(to.y - from.y, to.x - from.x);

    // Step to the side opposite the aim point, or a random side for an attack aimed dead center
    const aim = this.state.destination;
    const aimSide = (-Math.sin(dir) * (aim.x - to.x)) + (Math.cos(dir) * (aim.y - to.y));
    const side = aimSide ? -Math.sign(aimSide) : ((this.rng() < 0.5) ? -1 : 1);
    const retreat = params.retreat ?? 0;
    const dx = (-Math.sin(dir) * side) + (Math.cos(dir) * retreat);
    const dy = (Math.cos(dir) * side) + (Math.sin(dir) * retreat);
    const length = Math.hypot(dx, dy);
    params._dx = dx / length;
    params._dy = dy / length;
    params._target = this.state.targetMesh;
    params._baseAnchor = params._target ? {x: params._target.anchor.x, y: params._target.anchor.y} : null;
  },
  animate(t, phase, params) {
    const target = params._target;
    if ( !target || target.destroyed || !params._baseAnchor || !target.texture ) return;
    const p = Math.min((t * phase.duration) / (params.duration ?? 450), 1);

    // Quick sidestep out, a brief hold, then a smooth return
    let magnitude;
    if ( p < 0.25 ) magnitude = 1 - Math.pow(1 - (p / 0.25), 3);
    else if ( p < 0.5 ) magnitude = 1;
    else magnitude = 1 - (0.5 - (Math.cos(Math.PI * ((p - 0.5) / 0.5)) / 2));
    const px = (params.distance ?? 0.25) * target.width * magnitude;
    _displaceAnchor(target, params._baseAnchor, params._dx, params._dy, px);
  },
  tearDown(phase, params) {
    const target = params._target;
    if ( params._baseAnchor && target && !target.destroyed ) {
      target.anchor.set(params._baseAnchor.x, params._baseAnchor.y);
    }
  }
};

/* -------------------------------------------- */
/*  Impact Sprite                               */
/* -------------------------------------------- */

/**
 * Spawn an impact sprite at the point of impact, oriented along the incoming direction, then pop it in
 * with a scale-up and ADD-blend flash before settling smaller and fading out over the rest of the hold.
 * Tuning (`params`): `texture` (required), `size`, `duration`, `scaleStart`, `scaleSettle`, `flash`,
 * `flashDuration`, `rotation` (radians turned away from the incoming direction), `tint`, `fps` (flipbook textures),
 * `textureAnchor` (false to center a standalone image file, whose default anchor is its top-left corner).
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteBurst = {
  schedule(phase, params) {
    if ( !params.texture ) return;
    const {origin, destination} = this.state;
    const container = this.addManagedDisplayObject(this._createSprite(params.texture, params.size ?? 3, destination,
      {useTextureAnchor: params.textureAnchor ?? true}));
    container.rotation = Math.atan2(destination.y - origin.y, destination.x - origin.x) + (params.rotation ?? 0);

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
    const mesh = container.getChildByName?.("mesh");
    if ( !mesh ) return;
    if ( flash ) {
      this.timeline.call(() => mesh.blendMode = PIXI.BLEND_MODES.ADD, start);
      this.timeline.call(() => mesh.blendMode = PIXI.BLEND_MODES.NORMAL, start + flashDuration);
    }
    if ( params.tint != null ) mesh.tint = params.tint;

    // Play a flipbook once at its frame rate, holding the last frame through the settle
    if ( mesh instanceof CrucibleFlipbookMesh ) {
      const duration = Math.min(hold, (mesh.frames.length * 1000) / (params.fps ?? 16));
      mesh.animate(this.timeline, {start, duration, mode: CrucibleFlipbookMesh.MODES.ONCE});
    }
  }
};

/* -------------------------------------------- */

/**
 * Remove one filter from a display object, leaving any others it carries in place.
 * @param {PIXI.DisplayObject} target
 * @param {PIXI.Filter} filter
 */
function _detachFilter(target, filter) {
  if ( !target || target.destroyed || !target.filters?.includes(filter) ) return;
  const filters = target.filters.filter(f => f !== filter);
  target.filters = filters.length ? filters : null;
}

/* -------------------------------------------- */

/**
 * Apply a {@link foundry.canvas.rendering.filters.GlowOverlayFilter} to the target mesh as impact feedback. The
 * glow strength ramps gradually to peak over `dur - fadeOut`, then eases back down over `fadeOut`, so the target
 * is progressively overtaken rather than flashed at full intensity. An alternative to recoil for restoration.
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
      alpha = 1, duration, fadeOut = 300
    } = params;
    const dur = duration ?? phase.duration ?? 1000;
    const color = Array.isArray(glowColor) ? glowColor : [
      ((glowColor >> 16) & 0xff) / 255,
      ((glowColor >> 8) & 0xff) / 255,
      (glowColor & 0xff) / 255,
      1
    ];

    const filter = FilterClass.create({distance, glowColor: color, quality, knockout, alpha});
    filter.padding = padding;
    filter.innerStrength = 0;
    filter.outerStrength = 0;
    filter.animated = false;

    // Defer attachment to phase.start. Attaching the filter at draw-time runs its shader against the
    // mesh for the entire spell preamble even at zero strength (the shader does not fully zero out), so the
    // filter must be joined to the mesh only at the impact moment and detached when the glow ends.
    const start = phase.start;
    this.timeline.call(() => {
      if ( target.destroyed ) return;
      target.filters = target.filters ? [...target.filters, filter] : [filter];
    }, start);

    // Gradually build glow intensity by ramping the strength uniforms to peak, then ease them back down on fade-out
    const buildDur = Math.max(0, dur - fadeOut);
    this.timeline
      .add(filter, {outerStrength: {to: outerStrength}, innerStrength: {to: innerStrength}, duration: buildDur}, start)
      .add(filter, {outerStrength: {to: 0}, innerStrength: {to: 0}, duration: fadeOut}, start + buildDur);

    this.timeline.call(() => _detachFilter(target, filter), start + dur);
  }
};

/* -------------------------------------------- */

/**
 * Electrocute the target mesh: a {@link CrucibleElectrocutionFilter} strobing between its two polarities, then
 * easing back to the target's own colors. Under photosensitive mode the strobe is replaced by one steady hold.
 * Tuning (`params`): `duration`, `rate` (strobes/sec), `fadeOut`, `strength`, and the filter's `light`, `dark`,
 * `threshold`, and `softness` uniforms.
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteShock = {
  schedule(phase, params) {
    const target = this.state.targetMesh;
    if ( !target || target.destroyed ) return;
    const {duration = 450, rate = 14, fadeOut = 120, strength = 1, light, dark, threshold, softness} = params;
    const uniforms = Object.fromEntries(Object.entries({light, dark, threshold, softness})
      .filter(([_key, value]) => value !== undefined));
    const filter = CrucibleElectrocutionFilter.create({...uniforms, strength: 0, polarity: 0});
    params._target = target;
    params._filter = filter;

    // Attached only for the shock, ahead of any other filter as it recolors every pixel it is given
    const start = phase.start;
    this.timeline.call(() => {
      if ( !target.destroyed ) target.filters = [filter, ...(target.filters ?? [])];
    }, start);
    const steady = canvas.photosensitiveMode;
    const fadeIn = steady ? Math.min(100, duration / 4) : 0;
    scheduleTimelineClock(this.timeline, start, duration, ms => {
      const rise = (fadeIn > 0) ? Math.min(ms / fadeIn, 1) : 1;
      const fall = (fadeOut > 0) ? Math.min((duration - ms) / fadeOut, 1) : 1;
      filter.uniforms.strength = strength * Math.clamp(Math.min(rise, fall), 0, 1);
      filter.uniforms.polarity = steady ? 0 : (Math.floor((ms * rate) / 1000) % 2);
    });
    this.timeline.call(() => _detachFilter(target, filter), start + duration);
  },
  tearDown(phase, params) {
    _detachFilter(params._target, params._filter);
  }
};

/* -------------------------------------------- */

/**
 * Hold sprites in view for a span, re-rolling each at irregular intervals which photosensitive mode slows.
 * @this {CrucibleVFXComponent}
 * @param {{container: PIXI.Container, mesh: PIXI.Mesh}[]} sprites
 * @param {(sprite: object) => void} reroll   Re-randomize one sprite.
 * @param {object} timing
 * @param {number} timing.start
 * @param {number} timing.duration
 * @param {{min: number, max: number}} timing.interval   Ms between re-rolls of one sprite.
 * @param {number} timing.fadeIn
 * @param {number} timing.fadeOut
 */
function _scheduleRerolls(sprites, reroll, {start, duration, interval, fadeIn, fadeOut}) {
  const pace = canvas.photosensitiveMode ? 5 : 1;
  const roll = (sprite, ms) => {
    reroll(sprite);
    sprite.next = ms + ((interval.min + (Math.random() * (interval.max - interval.min))) * pace);
  };
  for ( const sprite of sprites ) {
    roll(sprite, 0);
    this.timeline.add(sprite.container, {alpha: {from: 0, to: 1, duration: fadeIn}}, start)
      .add(sprite.container, {alpha: {to: 0, duration: fadeOut}}, start + Math.max(duration - fadeOut, 0));
  }
  scheduleTimelineClock(this.timeline, start, duration, ms => {
    for ( const sprite of sprites ) {
      if ( ms >= sprite.next ) roll(sprite, ms);
    }
  });
}

/* -------------------------------------------- */

/**
 * Arc from an anchor on the caster to the target: copies of a directional sprite spanning the gap from its tail,
 * each re-rolled in where on the target it lands, handedness, and brightness.
 * Tuning (`params`): `textures` (required), `from`, `copies`, `scatter`, `interval`, `offset`, `duration`, `fadeOut`,
 * `elevation`, `blend`.
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteArcs = {
  schedule(phase, params) {
    const {textures, from = "forward", copies = 3, scatter = 0, interval = {min: 40, max: 80}, fadeOut = 100,
      offset = 0, elevation, blend = PIXI.BLEND_MODES.ADD} = params;
    const tail = this.state.anchors[from];
    const head = this.state.destination;
    if ( !textures?.length || !tail || !head ) return;
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const gap = Math.max(Math.hypot(head.x - tail.x, head.y - tail.y), 1);
    const arcs = [];
    for ( let i = 0; i < copies; i++ ) {
      const container = this.addManagedDisplayObject(this._createSprite(
        pickRandom(textures), gap / canvas.dimensions.distancePixels,
        {x: tail.x, y: tail.y, elevation: elevation ?? tail.elevation ?? 0, sort: tail.sort ?? 0,
          sortLayer: tail.sortLayer ?? SL.TOKENS}, {useTextureAnchor: true, blend}));
      const mesh = container.getChildByName("mesh");
      if ( mesh ) arcs.push({container, mesh});
    }

    // Each arc is sized to the gap, then scaled to reach wherever on the target it lands this time
    const reroll = arc => {
      const r = scatter * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const dx = (head.x + (Math.cos(a) * r)) - tail.x;
      const dy = (head.y + (Math.sin(a) * r)) - tail.y;
      arc.container.rotation = Math.atan2(dy, dx);
      arc.container.scale.set(Math.hypot(dx, dy) / gap);
      arc.mesh.alpha = 0.6 + (Math.random() * 0.4);
      if ( Math.random() < 0.5 ) arc.mesh.scale.y *= -1;
    };
    _scheduleRerolls.call(this, arcs, reroll, {start: phase.start + offset,
      duration: params.duration ?? phase.duration, interval, fadeIn: 20, fadeOut});
  }
};

/* -------------------------------------------- */

/**
 * Pour a torrent across a fan: copies of a sprite rooted out from the caster, each keeping to its own slice of the
 * arc while re-rolled in heading, distance, handedness, size and brightness.
 * Tuning (`params`): `textures` (required), `copies`, `size`, `inset` (pixels, or a `{min, max}` range), `spray`
 * (degrees of half-width kept within the fan), `turn` (radians, PI for art which converges on its anchor), `skew`
 * (degrees), `interval`, `duration`, `fadeOut`, `elevation`, `blend`.
 * @type {CrucibleVFXComponentAnimation}
 */
const fanSpriteArcs = {
  schedule(phase, params) {
    const {textures, copies = 5, size = 8, spray = 40, interval = {min: 60, max: 120}, fadeOut = 180,
      turn = Math.PI, elevation = 0, blend = PIXI.BLEND_MODES.ADD} = params;
    const skew = Math.toRadians(params.skew ?? 0);
    const inset = (typeof params.inset === "object") ? params.inset
      : {min: params.inset ?? 0, max: params.inset ?? 0};
    const {origin, rotation, halfAngle} = this.state;
    if ( !textures?.length ) return;
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const range = Math.max(halfAngle - Math.toRadians(spray), 0);
    const slice = (range * 2) / copies;
    const arcs = [];
    for ( let i = 0; i < copies; i++ ) {
      const container = this.addManagedDisplayObject(this._createSprite(pickRandom(textures), size,
        {x: origin.x, y: origin.y, elevation, sort: 0, sortLayer: SL.TOKENS}, {useTextureAnchor: true, blend}));
      const mesh = container.getChildByName("mesh");
      if ( mesh ) arcs.push({container, mesh, from: (rotation - range) + (slice * i)});
    }
    const reroll = arc => {
      const heading = arc.from + (Math.random() * slice);
      const out = inset.min + (Math.random() * (inset.max - inset.min));
      arc.container.position.set(origin.x + (Math.cos(heading) * out), origin.y + (Math.sin(heading) * out));
      arc.container.rotation = heading + turn + (((Math.random() * 2) - 1) * skew);
      arc.container.scale.set(0.8 + (Math.random() * 0.3));
      arc.mesh.alpha = 0.55 + (Math.random() * 0.45);
      if ( Math.random() < 0.5 ) arc.mesh.scale.y *= -1;
    };
    _scheduleRerolls.call(this, arcs, reroll, {start: phase.start, duration: params.duration ?? phase.duration,
      interval, fadeIn: 40, fadeOut});
  }
};

/* -------------------------------------------- */

/**
 * Span the ray with one bolt at once: a directional sprite tiled end to end, revealed in a race outward from the
 * origin, writhing in place, then fading together, either away or to a lingering `afterimage` of its final shape.
 * Tuning (`params`): `texture` (required), `segment` (feet), `sweep`, `hold`, `fadeOut`, `flicker` (mirrors/sec),
 * `afterimage` ({alpha, duration}), `forks` ({textures, size, angle, jitter, chance, crossings}), `from` and `to`
 * (anchor names, in place of the ray's own ends), `inset` (pixels), `elevation`, `blend`.
 * @type {CrucibleVFXComponentAnimation}
 */
const raySpriteBolt = {
  schedule(phase, params) {
    const {texture, segment = 10, sweep = 140, hold = 420, fadeOut = 220, flicker = 16, elevation,
      blend = PIXI.BLEND_MODES.ADD, afterimage, forks, from, to, inset = 0} = params;
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;

    const tail = from ? this.state.anchors[from] : this.state.origin;
    const head = to ? this.state.anchors[to] : this.state.end;
    if ( !tail || !head ) return;
    const reachTotal = Math.hypot(head.x - tail.x, head.y - tail.y);
    const length = reachTotal - inset;
    const anchorX = foundry.canvas.getTexture(texture)?.defaultAnchor.x;
    if ( !anchorX || !(length > 0) ) return;
    const direction = {x: (head.x - tail.x) / reachTotal, y: (head.y - tail.y) / reachTotal};
    const rotation = Math.atan2(direction.y, direction.x);
    const origin = {x: tail.x + (direction.x * inset), y: tail.y + (direction.y * inset),
      elevation: tail.elevation ?? 0, sort: tail.sort ?? 0, sortLayer: tail.sortLayer ?? SL.TOKENS};
    const distancePixels = canvas.dimensions.distancePixels;
    const count = Math.max(1, Math.round(length / (segment * distancePixels)));
    const span = length / count;
    const start = phase.start;
    const end = start + sweep + hold;

    // Each piece appears as the race outward reaches it, then fades with the rest
    const place =(path, size, reach, heading, progress) => {
      const container = this.addManagedDisplayObject(this._createSprite(path, size, {
        x: origin.x + (direction.x * reach), y: origin.y + (direction.y * reach),
        elevation: elevation ?? origin.elevation, sort: origin.sort, sortLayer: origin.sortLayer
      }, {useTextureAnchor: true, blend}));
      container.rotation = heading;
      const mesh = container.getChildByName("mesh");
      if ( !mesh ) return null;
      const revealed = start + (sweep * progress);
      this.timeline.add(container, {alpha: {from: 0, to: 1, duration: 20}}, revealed)
        .add(container, {alpha: {to: afterimage?.alpha ?? 0, duration: fadeOut}}, end);
      if ( afterimage ) {
        this.timeline.add(container, {alpha: {to: 0, duration: afterimage.duration ?? 1500, ease: "outQuad"}},
          end + fadeOut);
      }
      return {mesh, revealed};
    };

    // Forks leave from where the bolt is on its axis: segment joints, and the crossings its art makes of mid-height
    const forkPaths = forks?.textures ?? [];
    const sites = [];
    for ( let i = 0; (i < count) && forkPaths.length; i++ ) {
      if ( i > 0 ) sites.push(i);
      for ( const crossing of forks.crossings ?? [] ) sites.push(i + crossing);
    }
    for ( const site of sites ) {
      if ( Math.random() >= (forks.chance ?? 0.85) ) continue;
      const side = (Math.random() < 0.5) ? -1 : 1;
      const angle = Math.toRadians((forks.angle ?? 45) + (((Math.random() * 2) - 1) * (forks.jitter ?? 10)));
      const fork = place(pickRandom(forkPaths), forks.size ?? 5, span * site, rotation + (side * angle),
        site / count);
      if ( fork && (Math.random() < 0.5) ) fork.mesh.scale.y *= -1;
    }
    for ( let i = 0; i < count; i++ ) {

      // The art runs from the far edge of its canvas to its anchor, so sized by that share of its width and pinned
      // at the end of its span it leaves no gap between segments
      const placed = place(texture, span / distancePixels / anchorX, span * (i + 1), rotation, i / count);
      if ( !placed ) continue;
      const {mesh, revealed} = placed;

      // Both ends of the art sit at mid-height, so a mirrored segment still meets its neighbors
      if ( Math.random() < 0.5 ) mesh.scale.y *= -1;
      if ( canvas.photosensitiveMode || !(flicker > 0) ) continue;
      let lastStep = 0;
      scheduleTimelineClock(this.timeline, revealed, end - revealed, ms => {
        const step = Math.floor((ms * flicker) / 1000);
        if ( step === lastStep ) return;
        lastStep = step;
        if ( Math.random() < 0.5 ) mesh.scale.y *= -1;
      });
    }
  }
};

/* -------------------------------------------- */

/**
 * Strike a point from overhead: an upright sprite pinned there by its own anchor, flickering between its variant
 * textures before fading. It strikes an explicit `point`, else the impact destination, displaced by any `delta`.
 * Tuning (`params`): `textures` (required), `point`, `delta`, `offset`, `size`, `duration`, `fps`, `fadeOut`,
 * `elevation`, `blend`, `flash` ({texture, size, duration}, a ground decal which bursts), `scorch` ({texture, size,
 * duration, alpha}, one which lingers), `cloud` ({textures, size, rise, gather, disperse, alpha}, gathered at its top).
 * @type {CrucibleVFXComponentAnimation}
 */
const impactSpriteStrike = {
  schedule(phase, params) {
    const {textures, point, delta, offset = 0, size = 12, duration = 260, fps = 18, fadeOut = 110,
      elevation, blend = PIXI.BLEND_MODES.ADD, flash, scorch, cloud} = params;
    const at = point ?? this.state.destination;
    if ( !textures?.length || !at ) return;
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const position = {x: at.x + (delta?.x ?? 0), y: at.y + (delta?.y ?? 0), sort: at.sort ?? 0,
      sortLayer: at.sortLayer ?? SL.TOKENS};
    const start = phase.start + offset;
    const hold = Math.max(duration - fadeOut, 0);

    // Ground decals lie beneath tokens, turned at random as they have no heading of their own
    const decal = ({texture, size: decalSize = 2, blend: decalBlend = PIXI.BLEND_MODES.NORMAL}) => {
      const container = this.addManagedDisplayObject(this._createSprite(texture, decalSize,
        {...position, elevation: 0}, {blend: decalBlend}));
      container.rotation = Math.random() * Math.PI * 2;
      return container;
    };
    if ( scorch?.texture ) {
      const container = decal(scorch);
      const linger = scorch.duration ?? 3500;
      this.timeline.add(container, {alpha: {from: 0, to: scorch.alpha ?? 0.75, duration: 60}}, start)
        .add(container, {alpha: {to: 0, duration: linger * 0.5}}, start + (linger * 0.5));
    }
    if ( flash?.texture ) {
      const container = decal({blend: PIXI.BLEND_MODES.ADD, ...flash});
      const burst = flash.duration ?? 320;
      container.scale.set(0.5);
      this.timeline.add(container, {alpha: {from: 0, to: 1, duration: 30}}, start)
        .add(container.scale, {x: {from: 0.5, to: 1}, y: {from: 0.5, to: 1}, duration: burst, ease: "outQuad"}, start)
        .add(container, {alpha: {to: 0, duration: burst * 0.6}}, start + (burst * 0.4));
    }

    // The bolt itself, whose anchor sits on the vertical axis of the art so a mirrored strike still lands true
    const bolt = this.addManagedDisplayObject(this._createSprite(textures, size,
      {...position, elevation: elevation ?? at.elevation ?? 0}, {useTextureAnchor: true, blend}));
    const mesh = bolt.getChildByName("mesh");
    if ( !mesh ) return;
    if ( Math.random() < 0.5 ) mesh.scale.x *= -1;
    this.timeline.add(bolt, {alpha: {from: 0, to: 1, duration: 20}}, start)
      .add(bolt, {alpha: {to: 0, duration: fadeOut}}, start + hold);

    // The top of the art may lie beyond any cover over the area struck, so the bolt brings a cloud of its own
    if ( cloud?.textures?.length ) {
      const top = position.y - (size * canvas.dimensions.distancePixels * (cloud.rise ?? 0.9));
      const cover = this.addManagedDisplayObject(this._createSprite(cloud.textures, cloud.size ?? (size * 1.3),
        {...position, y: top, elevation: (elevation ?? at.elevation ?? 0) + 1}));
      const body = cover.getChildByName("mesh");
      if ( body instanceof CrucibleFlipbookMesh ) body.frame = Math.floor(Math.random() * body.frames.length);
      const from = Math.max(start - (cloud.gather ?? 350), 0);
      const gather = Math.max(start - from, 1);
      cover.scale.set(0.7);
      this.timeline.add(cover, {alpha: {from: 0, to: cloud.alpha ?? 0.9, duration: gather}}, from)
        .add(cover.scale, {x: {from: 0.7, to: 1}, y: {from: 0.7, to: 1}, duration: gather, ease: "outQuad"}, from)
        .add(cover, {alpha: {to: 0, duration: cloud.disperse ?? 700}}, start + duration);
    }
    if ( !(mesh instanceof CrucibleFlipbookMesh) ) return;
    mesh.frame = Math.floor(Math.random() * mesh.frames.length);
    if ( canvas.photosensitiveMode ) return;
    mesh.animate(this.timeline, {start, duration: hold, fps, mode: CrucibleFlipbookMesh.MODES.SHUFFLE});
  }
};

/* -------------------------------------------- */

/**
 * Crucible sprite animators, keyed by registry name.
 * @type {Record<string, CrucibleVFXComponentAnimation>}
 */
export const SPRITE_ANIMATIONS = {
  chargeProjectileFadeIn,
  chargeDrawBack,
  deliveryProjectileFlight,
  deliveryProjectileReveal,
  impactSpriteBurst,
  impactSpriteRecoil,
  impactSpriteShake,
  impactSpriteDodge,
  impactSpriteGlow,
  impactSpriteShock,
  impactSpriteStrike,
  impactSpriteArcs,
  fanSpriteArcs,
  raySpriteBolt,
  strikeSpriteDrawBack,
  strikeSpriteGleam,
  strikeSpriteLunge,
  strikeSpriteThrust
};
