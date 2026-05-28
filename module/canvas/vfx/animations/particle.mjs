/**
 * Registered VFX animation functions used for particle generators during animation.
 * @import {default as CrucibleVFXComponent} from "../components/vfx-component.mjs";
 */

/**
 * A particle generator layer config. The optional generic parameter describes the shape of `params`.
 * @template [TParams=object]
 * @typedef {object} CrucibleParticleLayer
 * @property {TParams} params
 * @property {string} animation
 * @property {string} [anchor]
 * @property {string[]} textures
 * @property {number} [duration]
 * @property {number} [offset]
 * @property {boolean} [mask]
 */

/**
 * Behavior contract for a particle generator layer. The optional generic forwards into the layer so
 * `setup()` sees strongly-typed `layer.params`.
 * @template [TParams=object]
 * @typedef CrucibleParticleBehavior
 * @property {(this: CrucibleVFXComponent, phase: object, layer: CrucibleParticleLayer<TParams>) => object} [setup]
 * @property {(this: CrucibleVFXComponent, phase: object, layer: CrucibleParticleLayer<TParams>) => void} [schedule]
 * @property {(this: CrucibleVFXComponent, phase: object, layer: CrucibleParticleLayer<TParams>) => void} [tearDown]
 */

/* -------------------------------------------- */

/**
 * @typedef CircleParticleGatherParams
 * @property {number} chargeRadius
 * @property {number|{min: number, max: number}} [lifetime]
 */

/**
 * Inward convergence. Motes appear on a ring around the anchor and travel straight in to its center,
 * dying at the manifest point. Iron filings drawn to a magnet.
 * @type {CrucibleParticleBehavior<CircleParticleGatherParams>}
 */
const circleParticleGather = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const chargeRadius = params.chargeRadius;
    const radiusPx = chargeRadius * this.state.gridScale;
    const lt = params.lifetime ?? 1000;
    const lifetime = (typeof lt === "object") ? lt.max : lt;
    const speed = (radiusPx / lifetime) * 1000;
    const bandWidth = Math.max(2, chargeRadius * 0.05); // RingShapeData rejects zero-width bands
    return {
      area: {type: "ring", x: anchor.x, y: anchor.y, radius: chargeRadius,
        innerWidth: bandWidth, outerWidth: bandWidth},
      rotation: {alignVelocity: true, spread: 0.2},
      velocity: {speed: [0, 0], angle: [0, 360]},
      onSpawn: (p, {generator}) => {
        const sceneX = p.x + generator.bounds.x;
        const sceneY = p.y + generator.bounds.y;
        const angle = Math.atan2(sceneY - anchor.y, sceneX - anchor.x);
        p.movementSpeed.x = -Math.cos(angle) * speed;
        p.movementSpeed.y = -Math.sin(angle) * speed;
        p.rotation = angle + Math.PI;
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef CircleParticleVortexParams
 * @property {number} chargeRadius
 * @property {number} [swirlSpeed]  Orbital angular velocity (rad/sec); default 3.
 * @property {number} [spinSpeed]   Self-rotation angular velocity (rad/sec); defaults to swirl.
 * @property {{in: number, out: number}} [fade]
 */

/**
 * Imploding spiral. Motes orbit the anchor while their radius collapses toward center, spinning on
 * their own axis and fading as they arrive. A small whirlpool drawing energy to a focal point.
 * @type {CrucibleParticleBehavior<CircleParticleVortexParams>}
 */
const circleParticleVortex = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const chargeRadius = params.chargeRadius;
    const bandWidth = Math.max(2, chargeRadius * 0.15);
    const swirl = params.swirlSpeed ?? 3;
    const spin = params.spinSpeed ?? swirl;

    // Drive position/rotation parametrically from age so motion continues after the generator soft-stops
    const place = (p, generator) => {
      const ox = anchor.x - generator.bounds.x;
      const oy = anchor.y - generator.bounds.y;
      const age = p.lifetime > 0 ? Math.min(p.elapsedTime / p.lifetime, 1) : 1;
      const r = p._vortexRadius * (1 - age);
      const a = p._vortexAngle + (swirl * p.elapsedTime * 0.001);
      p.x = ox + (Math.cos(a) * r);
      p.y = oy + (Math.sin(a) * r);
      p.rotation = p._vortexSpin + (spin * p.elapsedTime * 0.001);
    };
    return {
      area: {type: "ring", x: anchor.x, y: anchor.y, radius: chargeRadius,
        innerWidth: bandWidth, outerWidth: bandWidth},
      velocity: {speed: [0, 0], angle: [0, 360]},
      fade: params.fade ?? {in: 0.15, out: 0.45},
      onSpawn: (p, {generator}) => {
        const sx = p.x + generator.bounds.x;
        const sy = p.y + generator.bounds.y;
        p._vortexAngle = Math.atan2(sy - anchor.y, sx - anchor.x);
        p._vortexRadius = Math.hypot(sx - anchor.x, sy - anchor.y);
        p._vortexSpin = Math.random() * Math.PI * 2;
        place(p, generator);
      },
      onUpdate: (p, {generator}) => place(p, generator)
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef ProjectileParticleTrailParams
 * @property {boolean} [align]  Lock streaks to projectile heading (directional wake) vs scatter outward.
 * @property {boolean} [flipX]  Mirror sprite horizontally for asymmetric streak textures.
 * @property {number} [rotationSpread]
 * @property {{min: number, max: number}} [speed]
 */

/**
 * Trailing stream chasing the projectile through space. Aligned streaks read as a directional wake of
 * sparks, embers, or vapor; scattered mode disperses outward in a trail of drifting debris.
 * @type {CrucibleParticleBehavior<ProjectileParticleTrailParams>}
 */
const projectileParticleTrail = {
  setup(phase, layer) {
    const {state} = this;
    const {align = false, flipX = false, rotationSpread = 0.15, speed = {min: 5, max: 25}} = layer.params;
    const POSITION_STEP = 4; // Quantize spawn-area moves to throttle updateSource calls
    let shape = null;
    let lastX = -Infinity;
    let lastY = -Infinity;
    const config = {
      area: {type: "circle", x: 0, y: 0, radius: 4},
      rotation: align ? {spread: rotationSpread} : {alignVelocity: false, spread: Math.PI},
      velocity: align ? {speed: [0, 0], angle: [0, 360]} : {speed: [speed.min, speed.max], angle: [0, 360]},
      onTick: (_dt, generator) => {
        const container = state.delivery?.container;
        if ( !container ) return;
        const x = Math.round(container.x / POSITION_STEP) * POSITION_STEP;
        const y = Math.round(container.y / POSITION_STEP) * POSITION_STEP;
        if ( !shape ) {
          shape = new foundry.data.CircleShapeData({type: "circle", x, y, radius: 4});
          generator.spawnArea = shape;
          lastX = x;
          lastY = y;
        }
        else if ( (x !== lastX) || (y !== lastY) ) {
          shape.updateSource({x, y});
          lastX = x;
          lastY = y;
        }
      }
    };
    if ( align ) {
      config.onSpawn = p => {
        const container = state.delivery?.container;
        if ( !container ) return;
        const variance = (Math.random() - 0.5) * rotationSpread * 2;
        p.rotation = container.rotation + variance;
        p.movementSpeed.x = 0;
        p.movementSpeed.y = 0;
        if ( flipX ) p.scale.x = -Math.abs(p.scale.x);
      };
    }
    return config;
  }
};

/* -------------------------------------------- */

/**
 * @typedef CircleParticleResidueParams
 * @property {number} radius
 * @property {{min: number, max: number}} [speed]
 * @property {number} [blend]  Defaults to ADD (glowing haze); use NORMAL with a dark tint for sooty smoke.
 */

/**
 * Lingering haze drifting outward from the anchor. The leftover atmosphere of a charge, a glowing
 * exhalation or a sooty breath when blended NORMAL with a dark tint.
 * @type {CrucibleParticleBehavior<CircleParticleResidueParams>}
 */
const circleParticleResidue = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const {radius, speed = {min: 12, max: 55}} = params;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius},
      velocity: {speed: [speed.min, speed.max], angle: [0, 360]},
      blend: params.blend ?? PIXI.BLEND_MODES.ADD,
      drift: {enabled: true, intensity: 0.5}
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef CircleParticleBloomParams
 * @property {number} chargeRadius
 * @property {number} [growFraction]  Fraction of lifetime spent scaling up (default 0.4).
 * @property {{in: number, out: number}} [fade]
 */

/**
 * Blooming growth. Motes scatter within a radius and stay put, fading in while scaling from a speck
 * to full size. Little flowers springing up, then quietly fading. Lazy and gentle.
 * @type {CrucibleParticleBehavior<CircleParticleBloomParams>}
 */
const circleParticleBloom = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const grow = params.growFraction ?? 0.4;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius: params.chargeRadius},
      velocity: {speed: [0, 0], angle: [0, 360]},
      rotation: {spread: Math.PI},
      fade: params.fade ?? {in: 0.3, out: 0.4},
      onSpawn: p => {
        p._bloom = p.scale.x;
        p.scale.set(p._bloom * 0.1);
      },
      onUpdate: p => {
        const age = p.lifetime > 0 ? Math.min(p.elapsedTime / p.lifetime, 1) : 1;
        const g = Math.min(age / grow, 1);
        p.scale.set(p._bloom * (0.1 + (0.9 * (1 - Math.pow(1 - g, 2)))));
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef CircleParticleBurstParams
 * @property {number} [radius]
 * @property {{min: number, max: number}} [speed]
 * @property {number} [blend]
 */

/**
 * Outward burst at impact. A shower of bits flying radially out and tumbling away. The pop of
 * leaves, embers, bubbles, or shards from a hit.
 * @type {CrucibleParticleBehavior<CircleParticleBurstParams>}
 */
const circleParticleBurst = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const {radius = 8, speed = {min: 60, max: 180}} = params;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius},
      velocity: {speed: [speed.min, speed.max], angle: [0, 360]},
      rotation: {alignVelocity: false, spread: Math.PI},
      drift: {enabled: true, intensity: 0.5},
      blend: params.blend ?? 0
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef RayParticleBeamParams
 * @property {number} [speed]        Px/sec base, grid-scaled; default 2500.
 * @property {number} [angleSpread]  Degree variance around the heading.
 * @property {number} [radius]       Half-width of the rectangular spawn line.
 * @property {number} [rotationSpread]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * Forward beam streaming from the anchor along the ray heading. A tight rectangular column of motion
 * tearing through air. Widen `angleSpread` for a halo of spillage around the beam.
 * @type {CrucibleParticleBehavior<RayParticleBeamParams>}
 */
const rayParticleBeam = {
  setup(phase, layer) {
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const params = layer.params;
    const speed = (params.speed ?? 2500) * this.state.gridScale;
    const headingDeg = Math.toDegrees(this.state.rotation);
    const angleSpread = params.angleSpread ?? 0.5;

    // Spawn along a line perpendicular to the heading for a rectangular beam profile (not a cone)
    const perpRad = this.state.rotation + (Math.PI / 2);
    const halfWidth = Math.max(8, params.radius ?? 8);

    // Lifetime ensures particles reach the beam's end at the scaled speed
    const reach = Math.max(300, Math.round((this.state.length / speed) * 1000));
    return {
      area: {
        from: {x: anchor.x + (Math.cos(perpRad) * halfWidth), y: anchor.y + (Math.sin(perpRad) * halfWidth)},
        to: {x: anchor.x - (Math.cos(perpRad) * halfWidth), y: anchor.y - (Math.sin(perpRad) * halfWidth)}
      },
      velocity: {speed: [speed * 0.9, speed * 1.1], angle: [headingDeg - angleSpread, headingDeg + angleSpread]},
      rotation: {alignVelocity: true, spread: params.rotationSpread ?? 0.05},
      lifetime: {min: Math.round(reach * 0.85), max: reach},
      fade: params.fade ?? {in: 30, out: 150},
      blend: params.blend ?? PIXI.BLEND_MODES.ADD
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef RayParticleCastoffParams
 * @property {number} [speed]
 * @property {number} [coneDeg]
 * @property {number} [radius]
 * @property {number} [rotationSpread]
 * @property {{min: number, max: number}} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * Wide flare at the beam's root. A short-lived spray fanning around the heading near the source,
 * softening where the beam emerges from the caster. Local to the origin - does not travel the beam.
 * @type {CrucibleParticleBehavior<RayParticleCastoffParams>}
 */
const rayParticleCastoff = {
  setup(phase, layer) {
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const params = layer.params;
    const speed = (params.speed ?? 2500) * this.state.gridScale;
    const headingDeg = Math.toDegrees(this.state.rotation);
    const coneDeg = params.coneDeg ?? 60;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius: Math.max(8, params.radius ?? 8)},
      velocity: {speed: [speed * 0.05, speed * 0.15], angle: [headingDeg - coneDeg, headingDeg + coneDeg]},
      rotation: {alignVelocity: true, spread: params.rotationSpread ?? 0.3},
      lifetime: params.lifetime ? {min: params.lifetime.min, max: params.lifetime.max} : {min: 200, max: 400},
      fade: params.fade ?? {in: 0, out: 150},
      blend: params.blend ?? PIXI.BLEND_MODES.ADD
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef RayParticleGroundCascadeParams
 * @property {number} [width]            Half lateral spread of deposits in px (default 20).
 * @property {number} [spacing]          Spacing between deposits in px (default 20).
 * @property {boolean} [burnToEnd]       Deposits stay lit until the front reaches the end then fade together.
 * @property {number} [burnTail]         Ms past completion before burnToEnd extinction (default 400).
 * @property {{min: number, max: number}|number} [lifetime]  Lifetime when not burnToEnd.
 * @property {number} [fadeOutMs]        Cap on burnToEnd fade-out duration (default 250).
 * @property {object} [velocity]         Override the static {0,0} velocity (rising smoke instead of pinned deposits).
 * @property {number} [rotationSpread]   Radians of jitter around the beam axis (default 0.3).
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * A trail laid down along the beam's path as a front sweeps from origin to end. Scorched earth,
 * frosted ground, a fuse being lit. `burnToEnd` keeps the whole line lit through completion and
 * extinguishes together; `velocity` lets the deposits drift instead of staying static.
 * @type {CrucibleParticleBehavior<RayParticleGroundCascadeParams>}
 */
const rayParticleGroundCascade = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const {origin, rotation, length, gridScale} = this.state;
    const duration = layer.duration ?? phase.duration;
    const halfWidth = (params.width ?? 20) * gridScale;
    const spacing = (params.spacing ?? 20) * gridScale;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const perpCos = Math.cos(rotation + (Math.PI / 2));
    const perpSin = Math.sin(rotation + (Math.PI / 2));
    const burnToEnd = !!params.burnToEnd;
    const burnTail = params.burnTail ?? 400;
    const drift = !!params.velocity;
    let elapsed = 0;
    let frontDist = 0;

    // Lifetime is positional per-particle in burnToEnd mode; otherwise honor params.lifetime or default generously
    let lifetime;
    if ( burnToEnd ) lifetime = {min: duration + burnTail, max: duration + burnTail};
    else if ( params.lifetime ) {
      lifetime = (typeof params.lifetime === "object")
        ? params.lifetime
        : {min: Math.round(params.lifetime * 0.85), max: params.lifetime};
    }
    else lifetime = {min: duration + 1000, max: duration + 2000};

    return {
      // One particle per `spacing` over the sweep duration
      spawnRate: Math.max(1, Math.round((length / spacing) * (1000 / duration))),
      area: {type: "circle", x: origin.x, y: origin.y, radius: 4},
      velocity: params.velocity ?? {speed: [0, 0], angle: [0, 360]},
      rotation: {initial: rotation, spread: params.rotationSpread ?? 0.3},
      lifetime,
      fade: params.fade ?? {in: 0, out: 800},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL,
      onTick: dt => {
        elapsed += dt;
        frontDist = Math.clamp(elapsed / duration, 0, 1) * length;
      },
      onSpawn: (p, {generator}) => {
        // Place at the current front (slightly behind, jittered) with lateral spread
        const dist = frontDist * (0.85 + (Math.random() * 0.15));
        const lateral = ((Math.random() * 2) - 1) * halfWidth;
        p.x = (origin.x + (cosR * dist) + (perpCos * lateral)) - generator.bounds.x;
        p.y = (origin.y + (sinR * dist) + (perpSin * lateral)) - generator.bounds.y;
        if ( !drift ) {
          p.movementSpeed.x = 0;
          p.movementSpeed.y = 0;
        }
        // Positional lifetime: later spawns live shorter so all extinguish together at sweep end;
        // fadeOutDuration is recomputed because _setupParticleBase used the config lifetime
        if ( burnToEnd ) {
          const remaining = Math.max(60, (duration - elapsed) + burnTail);
          p.lifetime = remaining;
          p.fadeInDuration = Math.min(60, remaining * 0.2);
          p.fadeOutDuration = Math.min(params.fadeOutMs ?? 250, remaining * 0.5);
        }
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef ShapeParticleCombustionParams
 * @property {number} [count]
 * @property {number} [initial]
 * @property {{min: number, max: number}} [speed]       Radial outward drift (small by design).
 * @property {number} [rotationSpread]
 * @property {{min: number, max: number}} [scale]       Per-particle base random range.
 * @property {Array<{time: number, value: number}>} [scaleCurve]  Over-lifetime multiplier.
 * @property {{min: number, max: number}} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 * @property {object} [area]        Override the component-supplied deliveryArea.
 */

/**
 * Region-wide ignition. The whole delivery area erupts simultaneously in a single intense flash.
 * Top-down view - the upward billow reads as scale growth over each particle's lifetime, with a gentle
 * radial drift suggesting the fireball expanding outward in plan view. Geometry-agnostic; reads the
 * emission area from `state.deliveryArea` (line for a ray, circle for a blast, polygon for a cone).
 * @type {CrucibleParticleBehavior<ShapeParticleCombustionParams>}
 */
const shapeParticleCombustion = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const area = params.area ?? this.state.deliveryArea;
    const gridScale = this.state.gridScale;
    const baseScale = params.scale ?? {min: 0.7, max: 1.2};
    const scaleCurve = params.scaleCurve ?? [
      {time: 0, value: 0.5},
      {time: 0.4, value: 1.4},
      {time: 1.0, value: 1.8}
    ];
    return {
      spawnRate: 0,
      area,
      velocity: {speed: [params.speed?.min ?? 20, params.speed?.max ?? 70], angle: [0, 360]},
      rotation: {alignVelocity: false, initial: 0, spread: params.rotationSpread ?? Math.PI},
      scale: {min: baseScale.min * gridScale, max: baseScale.max * gridScale, curve: scaleCurve},
      lifetime: params.lifetime ?? {min: 600, max: 1100},
      fade: params.fade ?? {in: 30, out: 350},
      blend: params.blend ?? PIXI.BLEND_MODES.ADD
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef ShapeParticleResidueParams
 * @property {number} [count]
 * @property {number} [initial]
 * @property {{min: number, max: number}} [speed]
 * @property {number} [rotationSpread]
 * @property {{min: number, max: number}} [scale]
 * @property {Array<{time: number, value: number}>} [scaleCurve]
 * @property {{min: number, max: number}} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [tint]
 * @property {number} [blend]
 * @property {object} [area]
 */

/**
 * Lingering haze drifting across the delivery region after a combustion. Smoke or dust settling and
 * dissipating slowly over a few seconds. Same geometry-agnostic billow as combustion, tuned for long,
 * low-alpha drift rather than an intense flash.
 * @type {CrucibleParticleBehavior<ShapeParticleResidueParams>}
 */
const shapeParticleResidue = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const area = params.area ?? this.state.deliveryArea;
    const gridScale = this.state.gridScale;
    const baseScale = params.scale ?? {min: 1.2, max: 2.0};
    const scaleCurve = params.scaleCurve ?? [
      {time: 0, value: 0.7},
      {time: 0.4, value: 1.4},
      {time: 1.0, value: 2.0}
    ];
    return {
      spawnRate: 0,
      area,
      velocity: {speed: [params.speed?.min ?? 5, params.speed?.max ?? 25], angle: [0, 360]},
      rotation: {alignVelocity: false, initial: 0, spread: params.rotationSpread ?? Math.PI},
      scale: {min: baseScale.min * gridScale, max: baseScale.max * gridScale, curve: scaleCurve},
      lifetime: params.lifetime ?? {min: 1800, max: 3000},
      fade: params.fade ?? {in: 200, out: 1200},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL
    };
  }
};

/* -------------------------------------------- */

/**
 * Crucible particle behaviors, keyed by registry name.
 * @type {Record<string, CrucibleParticleBehavior>}
 */
export const PARTICLE_ANIMATIONS = {
  circleParticleGather,
  circleParticleVortex,
  circleParticleBloom,
  projectileParticleTrail,
  circleParticleResidue,
  circleParticleBurst,
  rayParticleBeam,
  rayParticleCastoff,
  rayParticleGroundCascade,
  shapeParticleCombustion,
  shapeParticleResidue
};
