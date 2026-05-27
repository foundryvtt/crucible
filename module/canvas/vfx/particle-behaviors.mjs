/**
 * Crucible particle behaviors, registered into `CONFIG.Canvas.vfx.animations` alongside the timeline
 * animators. A particle behavior is referenced by name from a particle layer's `animation` field and,
 * unlike a timeline animator (which exposes `animate`), exposes `setup(context)` that RETURNS the
 * behavior-specific raw ParticleGenerator config (area, velocity, rotation, blend, drift, onSpawn,
 * onTick). The component supplies the generic material (textures, lifetime, scale, alpha, density) and
 * merges the behavior's contribution over it. Names are `particle*` prefixed so registry entries
 * self-identify as behaviors rather than timeline animators.
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
 * Inward convergence: particles spawn on a ring around the anchor and travel to its center over their
 * lifetime, dying at the manifest point. Ported from the former `manifestProjectile` block.
 * Tuning (`params`): `gatherRadius` (px, required).
 * @type {CrucibleParticleBehavior}
 */
const particleGather = {
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
 * Trailing stream that follows the projectile container each frame. Ported from the former
 * `projectileTrail` block; the container is now read directly from phase state rather than a sibling.
 * Tuning (`params`): `align` (bool), `flipX` (bool), `rotationSpread` (number), `speed` ({min, max}).
 * @type {CrucibleParticleBehavior}
 */
const particleTrail = {
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
 * Lingering atmospheric haze drifting outward from the anchor in ADD blend. Ported from the former
 * `airResidue` block. Tuning (`params`): `radius` (px, required), `speed` ({min, max}).
 * @type {CrucibleParticleBehavior}
 */
const particleResidue = {
  setup({anchor, params}) {
    const {radius, speed = {min: 12, max: 55}} = params;
    return {
      area: {type: "circle", x: anchor.x, y: anchor.y, radius},
      velocity: {speed: [speed.min, speed.max], angle: [0, 360]},
      blend: PIXI.BLEND_MODES.ADD,
      drift: {enabled: true, intensity: 0.5}
    };
  }
};

/* -------------------------------------------- */

/**
 * The full set of Crucible particle behaviors, keyed by registry name.
 * @type {Record<string, CrucibleParticleBehavior>}
 */
export const PARTICLE_BEHAVIORS = {
  particleGather,
  particleTrail,
  particleResidue
};
