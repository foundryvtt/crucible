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
 * @property {number} [blend]  Defaults to ADD.
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
      blend: params.blend ?? PIXI.BLEND_MODES.ADD,
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
 * @property {number} [swirlSpeed]    Orbital angular velocity (rad/sec); default 3.
 * @property {number} [spinSpeed]     Self-rotation angular velocity (rad/sec); defaults to swirl.
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]  Defaults to ADD.
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
      blend: params.blend ?? PIXI.BLEND_MODES.ADD,
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
    const gridScale = state.gridScale;
    const {align = false, flipX = false, rotationSpread = 0.15, speed = {min: 5, max: 25}} = layer.params;
    const POSITION_STEP = 4; // Quantize spawn-area moves to throttle updateSource calls
    let shape = null;
    let lastX = -Infinity;
    let lastY = -Infinity;
    const config = {
      area: {type: "circle", x: 0, y: 0, radius: 4},
      rotation: align ? {spread: rotationSpread} : {alignVelocity: false, spread: Math.PI},
      velocity: align ? {speed: [0, 0], angle: [0, 360]}
        : {speed: [speed.min * gridScale, speed.max * gridScale], angle: [0, 360]},
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
    const gridScale = this.state.gridScale;
    const {radius, speed = {min: 12, max: 55}} = params;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius},
      velocity: {speed: [speed.min * gridScale, speed.max * gridScale], angle: [0, 360]},
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
    const gridScale = this.state.gridScale;
    const {radius = 8, speed = {min: 60, max: 180}} = params;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius},
      velocity: {speed: [speed.min * gridScale, speed.max * gridScale], angle: [0, 360]},
      rotation: {alignVelocity: false, spread: Math.PI},
      drift: {enabled: true, intensity: 0.5},
      blend: params.blend ?? 0
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef RayParticleBeamParams
 * @property {number} [speed]              Px/sec base, grid-scaled; default 2500.
 * @property {number} [angleSpread]        Degree variance around the heading.
 * @property {number} [radius]             Half-width of the rectangular spawn line.
 * @property {number} [rotationSpread]
 * @property {boolean} [alignVelocity]     Default true (streaks point along motion); false to free-rotate.
 * @property {{min: number, max: number}} [rotationSpeed]  Per-particle tumbling (rad/sec).
 * @property {{min: number, max: number}} [lifetime]       Override the reach-derived lifetime.
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]           Defaults to ADD.
 */

/**
 * Forward beam streaming from the anchor along the ray heading. A tight rectangular column of motion
 * tearing through air. Widen `angleSpread` for a halo of spillage around the beam, override `lifetime`
 * + `rotationSpeed` + `alignVelocity:false` for in-place tumbling debris carried by the beam.
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

    // Reach-derived lifetime keeps particles alive across the beam at speed; overridable for in-place
    // debris that should die well before crossing the full length.
    const reach = Math.max(300, Math.round((this.state.length / speed) * 1000));
    return {
      area: {
        from: {x: anchor.x + (Math.cos(perpRad) * halfWidth), y: anchor.y + (Math.sin(perpRad) * halfWidth)},
        to: {x: anchor.x - (Math.cos(perpRad) * halfWidth), y: anchor.y - (Math.sin(perpRad) * halfWidth)}
      },
      velocity: {speed: [speed * 0.9, speed * 1.1], angle: [headingDeg - angleSpread, headingDeg + angleSpread]},
      rotation: {
        alignVelocity: params.alignVelocity ?? true,
        spread: params.rotationSpread ?? 0.05,
        speed: params.rotationSpeed
      },
      lifetime: params.lifetime ?? {min: Math.round(reach * 0.85), max: reach},
      fade: params.fade ?? {in: 30, out: 150},
      blend: params.blend ?? PIXI.BLEND_MODES.ADD
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef RayParticleHeadCastoffParams
 * @property {number} [speed]              Cast-off particle velocity (px/sec base, grid-scaled).
 * @property {number} [headSpeed]          Rate the head advances along the ray (px/sec base, grid-scaled).
 *                                          Defaults to `length / (layer.duration ?? phase.duration)`.
 * @property {number} [headJitter]         Spawn jitter radius around the head (px base, grid-scaled).
 * @property {number} [angleSpread]        Degrees +/- around the ray heading (default 45).
 * @property {boolean} [alignVelocity]     Default false (free-tumbling); true to lock rotation to motion.
 * @property {number} [rotationSpread]     Initial rotation spread in radians (default Math.PI).
 * @property {{min: number, max: number}} [rotationSpeed]  Per-particle tumbling (rad/sec).
 * @property {{min: number, max: number}} [lifetime]
 * @property {number} [lifetimeOriginBoost]  Extra ms added to per-particle lifetime, scaled by `(1 - t)`
 *                                          where `t` is the head's normalized progress in `[0, 1]`.
 *                                          Maximum at the origin, zero at the end. Regularizes
 *                                          absolute death times so that particles spawned across the
 *                                          head's march dissipate around the same moment, rather than
 *                                          late-spawning particles outliving early-spawning ones.
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * Cast-off shed at the advancing head of the beam: particles spawn at the leading edge as it sweeps
 * origin -> end, then fly off at angles within `angleSpread` of the heading. Reads as leaves shed by a
 * passing jet, sparks falling off the front of a beam, or debris jettisoned from a charging line of
 * force. The head position is `origin + heading * headDist`, where `headDist` advances at `headSpeed`
 * (defaulting to "traverse `length` over the layer duration"). Pair with the main beam's BEAM_SPEED to
 * keep the cast-off head visually locked to the jet's leading edge.
 * @type {CrucibleParticleBehavior<RayParticleHeadCastoffParams>}
 */
const rayParticleHeadCastoff = {
  setup(phase, layer) {
    const params = layer.params;
    const {origin, rotation, length, gridScale} = this.state;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const speed = (params.speed ?? 400) * gridScale;
    const duration = layer.duration ?? phase.duration;
    const headSpeed = params.headSpeed != null
      ? (params.headSpeed * gridScale)
      : (length / (duration / 1000));
    const headingDeg = Math.toDegrees(rotation);
    const angleSpread = params.angleSpread ?? 45;
    const headJitter = (params.headJitter ?? 20) * gridScale;
    const rotationCfg = {alignVelocity: params.alignVelocity ?? false,
      spread: params.rotationSpread ?? Math.PI};
    if ( params.rotationSpeed ) rotationCfg.speed = params.rotationSpeed;

    let elapsed = 0;
    let headDist = 0;
    return {
      // Placeholder spawn area; onSpawn places each particle relative to the advancing head
      area: {type: "circle", x: origin.x, y: origin.y, radius: 4},
      velocity: {speed: [speed * 0.7, speed],
        angle: [headingDeg - angleSpread, headingDeg + angleSpread]},
      rotation: rotationCfg,
      ...(params.lifetime ? {lifetime: params.lifetime} : {}),
      fade: params.fade ?? {in: 40, out: 250},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL,
      onTick: (dt, generator) => {
        if ( headDist >= length ) return;
        elapsed += dt;
        headDist = Math.min((elapsed / 1000) * headSpeed, length);
        if ( headDist >= length ) generator.spawnRate = 0;
      },
      onSpawn: (p, {generator}) => {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * headJitter;
        const sceneX = origin.x + (cosR * headDist) + (Math.cos(angle) * r);
        const sceneY = origin.y + (sinR * headDist) + (Math.sin(angle) * r);
        p.x = sceneX - generator.bounds.x;
        p.y = sceneY - generator.bounds.y;
        if ( params.lifetimeOriginBoost ) {
          const t = length > 0 ? Math.min(headDist / length, 1) : 0;
          p.lifetime += params.lifetimeOriginBoost * (1 - t);
        }
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef RayParticleRootCastoffParams
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
 * @type {CrucibleParticleBehavior<RayParticleRootCastoffParams>}
 */
const rayParticleRootCastoff = {
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

    const velocity = params.velocity
      ? {speed: [params.velocity.speed[0] * gridScale, params.velocity.speed[1] * gridScale],
        angle: params.velocity.angle}
      : {speed: [0, 0], angle: [0, 360]};
    return {
      // One particle per `spacing` over the sweep duration
      spawnRate: Math.max(1, Math.round((length / spacing) * (1000 / duration))),
      area: {type: "circle", x: origin.x, y: origin.y, radius: 4},
      velocity,
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
    const speedMin = (params.speed?.min ?? 20) * gridScale;
    const speedMax = (params.speed?.max ?? 70) * gridScale;
    return {
      spawnRate: params.spawnRate ?? 0,
      area,
      velocity: {speed: [speedMin, speedMax], angle: [0, 360]},
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
 * @property {number} [rotationSpread]                    Initial rotation jitter (rad). Default Math.PI.
 * @property {{min: number, max: number}} [rotationSpeed] Per-particle angular velocity (rad/sec).
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
    const rotation = {alignVelocity: false, initial: 0, spread: params.rotationSpread ?? Math.PI};
    if ( params.rotationSpeed ) rotation.speed = params.rotationSpeed;
    const speedMin = (params.speed?.min ?? 5) * gridScale;
    const speedMax = (params.speed?.max ?? 25) * gridScale;
    return {
      spawnRate: params.spawnRate ?? 0,
      area,
      velocity: {speed: [speedMin, speedMax], angle: [0, 360]},
      rotation,
      scale: {min: baseScale.min * gridScale, max: baseScale.max * gridScale, curve: scaleCurve},
      lifetime: params.lifetime ?? {min: 1800, max: 3000},
      fade: params.fade ?? {in: 200, out: 1200},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef FanParticleSweepParams
 * @property {number} startAngleRad                        Initial sweep arm angle (rad). REQUIRED.
 * @property {number} endAngleRad                          Final sweep arm angle (rad). REQUIRED.
 * @property {number} [radialSpeed]                        Px/sec base, grid-scaled (default 800).
 * @property {number} [innerRadius]                        Ring inner radius (px, default radius * 0.15).
 * @property {number} [outerRadius]                        Ring outer radius (px, default innerRadius * 1.3).
 * @property {number} [armSpread]                          Angular jitter (rad) around the sweep arm (default 0.15).
 * @property {{min: number, max: number}|number} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * A rotating arm emitter that sweeps across the cone arc from `startAngleRad` to `endAngleRad`,
 * spawning particles in a narrow band radial to the current arm angle and propelling them outward.
 * Angles are baked at configure-time so impact timing and the rendered sweep stay in lockstep.
 * @type {CrucibleParticleBehavior<FanParticleSweepParams>}
 */
const fanParticleSweep = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const {origin, rotation, radius, gridScale} = this.state;
    const speed = (params.radialSpeed ?? 800) * gridScale;
    const innerRadius = params.innerRadius ?? Math.round(radius * 0.15);
    const outerRadius = params.outerRadius ?? Math.round(innerRadius * 1.3);
    const armSpread = params.armSpread ?? 0.15;
    const startAngleRad = params.startAngleRad;
    const endAngleRad = params.endAngleRad;
    const duration = layer.duration ?? phase.duration;
    const reach = Math.max(200, Math.round((radius / speed) * 1000 * 1.2));
    const lifetime = params.lifetime ?? {min: Math.round(reach * 0.5), max: reach};
    const ringRadius = (innerRadius + outerRadius) / 2;
    const ringHalfWidth = (outerRadius - innerRadius) / 2;
    const headingDeg = Math.toDegrees(rotation);

    let elapsed = 0;
    let currentAngleRad = startAngleRad;

    return {
      area: {type: "ring", x: origin.x, y: origin.y, radius: ringRadius,
        innerWidth: ringHalfWidth, outerWidth: ringHalfWidth},
      velocity: {speed: [speed * 0.7, speed * 1.3], angle: [headingDeg - 5, headingDeg + 5]},
      rotation: {alignVelocity: true, spread: 0.1},
      lifetime: (typeof lifetime === "object") ? lifetime : {min: Math.round(lifetime * 0.5), max: lifetime},
      fade: params.fade ?? {in: 30, out: Math.round(reach * 0.4)},
      blend: params.blend ?? PIXI.BLEND_MODES.ADD,
      onTick: dt => {
        elapsed += dt;
        const t = Math.clamp(elapsed / duration, 0, 1);
        currentAngleRad = startAngleRad + (t * (endAngleRad - startAngleRad));
      },
      onSpawn: (p, {generator}) => {
        const sceneX = p.x + generator.bounds.x;
        const sceneY = p.y + generator.bounds.y;
        const dist = Math.hypot(sceneX - origin.x, sceneY - origin.y);
        const particleAngle = currentAngleRad + (((Math.random() * 2) - 1) * armSpread);
        p.x = (origin.x + (Math.cos(particleAngle) * dist)) - generator.bounds.x;
        p.y = (origin.y + (Math.sin(particleAngle) * dist)) - generator.bounds.y;
        const spd = speed * (0.7 + (Math.random() * 0.6));
        p.movementSpeed.x = Math.cos(particleAngle) * spd;
        p.movementSpeed.y = Math.sin(particleAngle) * spd;
        p.rotation = particleAngle + ((Math.random() - 0.5) * 0.2);
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef FanParticleCascadeParams
 * @property {number} [maxRadiusFactor]   Fraction of cone radius reached at sweep end (default 0.85).
 * @property {number} [initialFactor]     Starting outer radius as fraction of cone radius (default 0.17).
 * @property {{min: number, max: number}} [velocity]
 * @property {{min: number, max: number}} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * An expanding ring that grows outward from the origin, constrained to the cone wedge. Out-of-cone
 * spawns are kicked back inside. Reads as a wave of ground deposit expanding under the swept arm.
 * @type {CrucibleParticleBehavior<FanParticleCascadeParams>}
 */
const fanParticleCascade = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const {origin, rotation, halfAngle, radius, gridScale} = this.state;
    const maxRadius = Math.round(radius * (params.maxRadiusFactor ?? 0.85));
    const initialOuter = Math.round(radius * (params.initialFactor ?? 0.17));
    const initialHalfWidth = initialOuter / 2;
    const duration = layer.duration ?? phase.duration;
    const headingDeg = Math.toDegrees(rotation);
    const RADIUS_STEP = 4;

    let elapsed = 0;
    let shape = null;
    let lastRadius = -1;

    const defaultVelocity = {speed: [2 * gridScale, 5 * gridScale], angle: [headingDeg - 1, headingDeg + 1]};
    return {
      area: {type: "ring", x: origin.x, y: origin.y, radius: initialHalfWidth,
        innerWidth: initialHalfWidth, outerWidth: initialHalfWidth},
      velocity: params.velocity ?? defaultVelocity,
      rotation: {initial: rotation, spread: 0.2},
      lifetime: params.lifetime ?? {min: 400, max: 700},
      fade: params.fade ?? {in: 20, out: 400},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL,
      onTick: (dt, generator) => {
        elapsed += dt;
        const t = Math.clamp(elapsed / duration, 0, 1);
        const centerRadius = Math.round((t * maxRadius) / RADIUS_STEP) * RADIUS_STEP;
        if ( !shape ) {
          shape = new foundry.data.RingShapeData({type: "ring", x: origin.x, y: origin.y,
            radius: centerRadius, innerWidth: initialHalfWidth, outerWidth: initialHalfWidth});
          generator.spawnArea = shape;
          lastRadius = centerRadius;
        }
        else if ( centerRadius !== lastRadius ) {
          shape.updateSource({radius: centerRadius});
          lastRadius = centerRadius;
        }
      },
      onSpawn: (p, {generator}) => {
        const sceneX = p.x + generator.bounds.x;
        const sceneY = p.y + generator.bounds.y;
        const dist = Math.hypot(sceneX - origin.x, sceneY - origin.y);
        let particleAngle = Math.atan2(sceneY - origin.y, sceneX - origin.x);
        let delta = particleAngle - rotation;
        while ( delta > Math.PI ) delta -= Math.PI * 2;
        while ( delta < -Math.PI ) delta += Math.PI * 2;
        if ( Math.abs(delta) > halfAngle ) {
          particleAngle = rotation + (((Math.random() * 2) - 1) * halfAngle);
          p.x = (origin.x + (Math.cos(particleAngle) * dist)) - generator.bounds.x;
          p.y = (origin.y + (Math.sin(particleAngle) * dist)) - generator.bounds.y;
        }
        p.rotation = particleAngle + ((Math.random() - 0.5) * 0.3);
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef FanParticleArcDepositParams
 * @property {number} startAngleRad        REQUIRED. Initial sweep arm angle (rad).
 * @property {number} endAngleRad          REQUIRED. Final sweep arm angle (rad).
 * @property {number} [radiusFactor]       Fraction of cone radius where deposits land (default 0.9).
 * @property {number} [radialJitter]       Radial jitter range in px around the deposit radius (default 25).
 * @property {number} [arcSpread]          Angular jitter (rad) around the current sweep arm (default 0.08).
 * @property {{min: number, max: number}|number} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 */

/**
 * Static deposits painted along the cone perimeter as the sweep arm crosses each bearing. No
 * velocity - particles stay exactly where they appear, leaving a swept-arc residue (scorch, frost,
 * etc.) at the cone's outer edge.
 * @type {CrucibleParticleBehavior<FanParticleArcDepositParams>}
 */
const fanParticleArcDeposit = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const {origin, radius, gridScale} = this.state;
    const startAngleRad = params.startAngleRad;
    const endAngleRad = params.endAngleRad;
    const depositRadius = Math.round(radius * (params.radiusFactor ?? 0.9));
    const radialJitter = (params.radialJitter ?? 25) * gridScale;
    const arcSpread = params.arcSpread ?? 0.08;
    const duration = layer.duration ?? phase.duration;
    let elapsed = 0;
    let currentAngleRad = startAngleRad;
    return {
      area: {type: "circle", x: origin.x, y: origin.y, radius: 4},
      velocity: {speed: [0, 0], angle: [0, 360]},
      rotation: {alignVelocity: false, spread: Math.PI},
      fade: params.fade ?? {in: 0, out: 2000},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL,
      onTick: dt => {
        elapsed += dt;
        const t = Math.clamp(elapsed / duration, 0, 1);
        currentAngleRad = startAngleRad + (t * (endAngleRad - startAngleRad));
      },
      onSpawn: (p, {generator}) => {
        const a = currentAngleRad + (((Math.random() * 2) - 1) * arcSpread);
        const r = depositRadius + (((Math.random() * 2) - 1) * radialJitter);
        p.x = (origin.x + (Math.cos(a) * r)) - generator.bounds.x;
        p.y = (origin.y + (Math.sin(a) * r)) - generator.bounds.y;
        p.movementSpeed.x = 0;
        p.movementSpeed.y = 0;
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef FanParticleYoyoParams
 * @property {number} [count]           Number of wisps (default 5).
 * @property {number} [reach]           Peak radial extension in px (default state.radius).
 * @property {number} [armSpread]       Per-wisp angular jitter (rad) around its assigned angle (default 0).
 * @property {number} [rotationSpeed]   Per-particle spin (rad/sec); 0 to disable (default 0).
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]           Defaults to ADD.
 */

/**
 * N wisps fire from the origin out to the cone perimeter and bounce back to the origin in unison.
 * Angles are evenly distributed across the cone arc; each particle's radial distance follows
 * `reach * sin(PI * age)`, so all wisps reach peak extension at mid-life and return at end-of-life.
 * Pair with `count: N` + `initial: 1` + `spawnRate: 0` + a fixed `lifetime` to fire one volley with
 * no follow-on spawns. Optional `rotationSpeed` spins each wisp on its own axis.
 * @type {CrucibleParticleBehavior<FanParticleYoyoParams>}
 */
const fanParticleYoyo = {
  setup(phase, layer) {
    const {origin, rotation, halfAngle, radius} = this.state;
    const params = layer.params ?? {};
    const count = params.count ?? 5;
    const reach = params.reach ?? radius;
    const armSpread = params.armSpread ?? 0;
    const rotationSpeed = params.rotationSpeed ?? 0;
    const angles = [];
    for ( let i = 0; i < count; i++ ) {
      const t = (count === 1) ? 0.5 : (i / (count - 1));
      angles.push((rotation - halfAngle) + (t * 2 * halfAngle));
    }
    let nextIndex = 0;
    return {
      area: {type: "circle", x: origin.x, y: origin.y, radius: 2},
      velocity: {speed: [0, 0], angle: [0, 360]},
      rotation: {alignVelocity: false, spread: 0},
      fade: params.fade ?? {in: 0.1, out: 0.2},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL,
      onSpawn: (p, {generator}) => {
        const base = angles[nextIndex % angles.length];
        nextIndex++;
        const jitter = armSpread ? (((Math.random() - 0.5) * 2) * armSpread) : 0;
        p._yoyoAngle = base + jitter;
        p._yoyoSpin = Math.random() * Math.PI * 2;
        p.x = origin.x - generator.bounds.x;
        p.y = origin.y - generator.bounds.y;
      },
      onUpdate: (p, {generator}) => {
        const age = (p.lifetime > 0) ? Math.min(p.elapsedTime / p.lifetime, 1) : 1;
        const r = reach * Math.sin(Math.PI * age);
        p.x = (origin.x + (Math.cos(p._yoyoAngle) * r)) - generator.bounds.x;
        p.y = (origin.y + (Math.sin(p._yoyoAngle) * r)) - generator.bounds.y;
        p.rotation = p._yoyoSpin + ((rotationSpeed * p.elapsedTime) / 1000);
      }
    };
  }
};

/* -------------------------------------------- */

/**
 * @typedef BlastParticleFallingDebrisParams
 * @property {number} [fallDuration]   Ms each particle spends "falling" before landing (default 350).
 * @property {number} [startScale]     Per-particle scale multiplier at spawn (default 4.0) - large to
 *                                      read as close to the camera in a top-down perspective.
 * @property {number} [endScale]       Per-particle scale multiplier at landing (default 1.0).
 * @property {number} [darkening]      Tint darkening at landing (0..1, default 0.4).
 * @property {{min: number, max: number}} [speed]   Lateral drift while falling (default 10-30 px/s).
 * @property {{min: number, max: number}} [scale]   Per-particle base random range (default 0.3-0.6).
 * @property {{min: number, max: number}} [alpha]
 * @property {{min: number, max: number}} [lifetime]
 * @property {{in: number, out: number}} [fade]
 * @property {number} [blend]
 * @property {object} [area]           Override the component-supplied deliveryArea.
 */

/**
 * Debris particles falling from overhead toward the ground in a top-down perspective. Particles spawn
 * large (close to camera) and shrink + darken as they fall; upon landing they freeze in place and
 * linger before fading. Suitable for hail, falling rocks, shattered crystal, etc. Geometry-agnostic;
 * reads the spawn area from `state.deliveryArea` (typically a blast circle).
 * @type {CrucibleParticleBehavior<BlastParticleFallingDebrisParams>}
 */
const blastParticleFallingDebris = {
  setup(phase, layer) {
    const params = layer.params ?? {};
    const area = params.area ?? this.state.deliveryArea;
    const gridScale = this.state.gridScale;
    const fallDuration = params.fallDuration ?? 350;
    const startScale = params.startScale ?? 4.0;
    const endScale = params.endScale ?? 1.0;
    const darkening = params.darkening ?? 0.4;
    const speed = params.speed ?? {min: 10, max: 30};
    return {
      area,
      velocity: {speed: [speed.min * gridScale, speed.max * gridScale], angle: [0, 360]},
      rotation: {spread: params.rotationSpread ?? Math.PI},
      lifetime: params.lifetime ?? {min: 2500, max: 3100},
      fade: params.fade ?? {in: 30, out: 600},
      blend: params.blend ?? PIXI.BLEND_MODES.NORMAL,
      onSpawn: p => {
        p._baseScale = p.scale.x;
        p.scale.set(p._baseScale * startScale, p._baseScale * startScale);
        p.tint = 0xFFFFFF;
        p._landed = false;
      },
      onUpdate: p => {
        if ( p._landed ) return;
        if ( p.elapsedTime >= fallDuration ) {
          p._landed = true;
          p.movementSpeed.x = 0;
          p.movementSpeed.y = 0;
          p.scale.set(p._baseScale * endScale, p._baseScale * endScale);
          const b = Math.round(255 * (1.0 - darkening));
          p.tint = (b << 16) | (b << 8) | b;
          return;
        }
        const t = Math.clamp(p.elapsedTime / fallDuration, 0, 1);
        const s = p._baseScale * (startScale + (t * (endScale - startScale)));
        p.scale.set(s, s);
        const b = Math.round(255 * (1.0 - (t * darkening)));
        p.tint = (b << 16) | (b << 8) | b;
      }
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
  rayParticleRootCastoff,
  rayParticleHeadCastoff,
  rayParticleGroundCascade,
  shapeParticleCombustion,
  shapeParticleResidue,
  fanParticleSweep,
  fanParticleCascade,
  fanParticleArcDeposit,
  fanParticleYoyo,
  blastParticleFallingDebris
};
