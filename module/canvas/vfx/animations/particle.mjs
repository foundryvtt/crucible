/**
 * Crucible particle behaviors: registered VFX animations that configure a {@link ParticleGenerator}.
 * Each exposes the behavior contract `setup(context) -> object`, returning the behavior-specific raw
 * generator config (area, velocity, rotation, blend, drift, onSpawn, onTick) merged over the
 * component-owned material (textures, lifetime, scale, alpha, density). See `animations/_module.mjs`
 * for the naming convention.
 */

/**
 * @typedef CrucibleParticleContext
 * @property {{x: number, y: number}} anchor   Resolved spawn origin for the layer.
 * @property {number} gridScale                Particle scale factor (the system's getParticleScaleFactor()).
 * @property {number} lifetime                 Resolved particle lifetime in ms.
 * @property {object} params                   Behavior-specific tuning from the layer's `params`.
 * @property {object} state                    Phase state, e.g. `state.projectile.container`.
 */

/**
 * @typedef CrucibleParticleBehavior
 * @property {(context: CrucibleParticleContext) => object} setup
 *   Returns behavior-specific raw ParticleGenerator config keys to merge into the layer's config.
 */

/**
 * Inward convergence: particles spawn on a ring around the anchor and travel straight to its center
 * over their lifetime, dying at the manifest point.
 * Tuning (`params`): `gatherRadius` (px, required).
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleGather = {
  setup({anchor, gridScale, lifetime, params}) {
    const gatherRadius = params.gatherRadius;
    const radiusPx = gatherRadius * gridScale;
    const speed = (radiusPx / lifetime) * 1000; // Px/sec to traverse the radius within one lifetime
    const bandWidth = Math.max(2, gatherRadius * 0.05); // RingShapeData throws on a zero-thickness band
    return {
      area: {type: "ring", x: anchor.x, y: anchor.y, radius: gatherRadius,
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
 * Tuning (`params`): `gatherRadius` (px, required), `swirlSpeed` (rad/sec orbit), `spinSpeed` (rad/sec
 * self-rotation, default = swirl), `fade` ({in, out} of lifetime).
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleVortex = {
  setup({anchor, params}) {
    const gatherRadius = params.gatherRadius;
    const bandWidth = Math.max(2, gatherRadius * 0.15); // Thicker band than gather for a fuller ring
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
      area: {type: "ring", x: anchor.x, y: anchor.y, radius: gatherRadius,
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
  setup({state, params}) {
    const {align = false, flipX = false, rotationSpread = 0.15, speed = {min: 5, max: 25}} = params;
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
 * Lingering atmospheric haze drifting outward from the anchor, left behind after a charge gather.
 * Defaults to ADD blend (glowing haze); pass `blend: PIXI.BLEND_MODES.NORMAL` (with a dark tint) for
 * sooty smoke instead.
 * Tuning (`params`): `radius` (px, required), `speed` ({min, max}), `blend`.
 * @type {CrucibleParticleBehavior}
 */
const chargeParticleResidue = {
  setup({anchor, params}) {
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
 * Crucible particle behaviors, keyed by registry name.
 * @type {Record<string, CrucibleParticleBehavior>}
 */
export const PARTICLE_ANIMATIONS = {
  chargeParticleGather,
  chargeParticleVortex,
  projectileParticleTrail,
  chargeParticleResidue
};
