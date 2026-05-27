/**
 * Crucible particle behaviors: registered VFX animations that configure a {@link ParticleGenerator}.
 * Like sprite animations, each behavior's hooks are bound to the owning {@link CrucibleVFXComponent} and
 * receive `(phase, layer)`. `setup` returns the behavior's generator config contribution (area, velocity,
 * rotation, blend, drift, onSpawn, onTick) merged over the component-owned material; the optional
 * `schedule` adds bespoke timeline work and the optional `tearDown` undoes side effects on stop. The
 * resolved spawn anchor is `this.state.anchors[layer.anchor]`. See `animations/_module.mjs` for naming.
 *
 * @import {default as CrucibleVFXComponent} from "../components/vfx-component.mjs";
 */

/**
 * @typedef CrucibleParticleBehavior
 * @property {(this: CrucibleVFXComponent, phase: object, layer: object) => object} [setup]
 * @property {(this: CrucibleVFXComponent, phase: object, layer: object) => void} [schedule]
 * @property {(this: CrucibleVFXComponent, phase: object, layer: object) => void} [tearDown]
 */

/**
 * Inward convergence: particles spawn on a ring around the anchor and travel straight to its center
 * over their lifetime, dying at the manifest point.
 * Tuning (`params`): `chargeRadius` (px, required).
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleGather = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const chargeRadius = params.chargeRadius;
    const radiusPx = chargeRadius * this.state.gridScale;
    const lt = params.lifetime ?? 1000;
    const lifetime = (typeof lt === "object") ? lt.max : lt; // Resolved max lifetime (ms)
    const speed = (radiusPx / lifetime) * 1000; // Px/sec to traverse the radius within one lifetime
    const bandWidth = Math.max(2, chargeRadius * 0.05); // RingShapeData throws on a zero-thickness band
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
 * Imploding vortex: ring-spawned motes orbit the anchor while their radius collapses to the center
 * over their lifetime, spinning on their own axis and fading as they arrive. Position/rotation are
 * parametric (functions of age), driven from `onUpdate` not `onTick` so they keep moving after the
 * generator soft-stops rather than freezing mid-spin. An outward-bursting variant belongs in a separate
 * `chargeParticleVortexBurst`, not a branch here.
 * Tuning (`params`): `chargeRadius` (px, required), `swirlSpeed` (rad/sec orbit), `spinSpeed` (rad/sec
 * self-rotation, default = swirl), `fade` ({in, out} of lifetime).
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleVortex = {
  setup(phase, layer) {
    const params = layer.params;
    const anchor = this.state.anchors[layer.anchor] ?? this.state.anchors.origin;
    const chargeRadius = params.chargeRadius;
    const bandWidth = Math.max(2, chargeRadius * 0.15); // Thicker band for a fuller ring
    const swirl = params.swirlSpeed ?? 3;               // Rad/sec orbital velocity; slow reads as ominous
    const spin = params.spinSpeed ?? swirl;             // Rad/sec self-rotation, same direction as the orbit

    // Place a particle for its current age: collapse its radius toward the center, advance its orbit,
    // and spin it on its own axis. Shared by onSpawn (first frame) and onUpdate (every frame after).
    const place = (p, generator) => {
      const ox = anchor.x - generator.bounds.x; // Anchor expressed in generator-local space
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
      velocity: {speed: [0, 0], angle: [0, 360]}, // Held at 0; onSpawn/onUpdate drive position parametrically
      fade: params.fade ?? {in: 0.15, out: 0.45},  // Fade in on spawn, fade out as it collapses to center
      onSpawn: (p, {generator}) => {
        const sx = p.x + generator.bounds.x;
        const sy = p.y + generator.bounds.y;
        p._vortexAngle = Math.atan2(sy - anchor.y, sx - anchor.x);
        p._vortexRadius = Math.hypot(sx - anchor.x, sy - anchor.y);
        p._vortexSpin = Math.random() * Math.PI * 2; // Random initial orientation, then a steady spin
        place(p, generator);
      },
      onUpdate: (p, {generator}) => place(p, generator)
    };
  }
};

/* -------------------------------------------- */

/**
 * Trailing stream that follows the projectile container each frame.
 * Tuning (`params`): `align` (bool), `flipX` (bool), `rotationSpread` (number), `speed` ({min, max}).
 * @type {CrucibleParticleBehavior}
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
      area: {type: "circle", x: 0, y: 0, radius: 4}, // Placeholder; onTick relocates it each frame
      // Align mode keeps particles where they spawn (the projectile moves on); scatter sprays outward
      rotation: align ? {spread: rotationSpread} : {alignVelocity: false, spread: Math.PI},
      velocity: align ? {speed: [0, 0], angle: [0, 360]} : {speed: [speed.min, speed.max], angle: [0, 360]},
      onTick: (_dt, generator) => {
        const container = state.projectile?.container;
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
    // Align mode locks each particle's rotation to the projectile heading for directional streaks
    if ( align ) {
      config.onSpawn = p => {
        const container = state.projectile?.container;
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
 * Lingering atmospheric haze drifting outward from the anchor, left behind after the charge.
 * Defaults to ADD blend (glowing haze); pass `blend: PIXI.BLEND_MODES.NORMAL` (with a dark tint) for
 * sooty smoke instead.
 * Tuning (`params`): `radius` (px, required), `speed` ({min, max}), `blend`.
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleResidue = {
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
 * Blooming growth: particles spawn scattered within a radius and stay put, fading in while scaling up
 * from tiny to full (little flowers springing up) then fading out. Lazy and gentle.
 * Tuning (`params`): `chargeRadius` (px, required); `growFraction` (0..1 of life spent growing).
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleBloom = {
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
 * Outward burst: particles spawn at a point and fly out radially, drifting and fading - an impact
 * "pop" (e.g. a shower of leaves and bubbles). Pair with `initial: 1` for an instantaneous spray.
 * Tuning (`params`): `radius` (px spawn spread); `speed` ({min, max} px/sec); `blend`.
 * @type {CrucibleParticleBehavior}
 */
const impactParticleBurst = {
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
 * Crucible particle behaviors, keyed by registry name.
 * @type {Record<string, CrucibleParticleBehavior>}
 */
export const PARTICLE_ANIMATIONS = {
  chargeParticleGather,
  chargeParticleVortex,
  chargeParticleBloom,
  projectileParticleTrail,
  chargeParticleResidue,
  impactParticleBurst
};
