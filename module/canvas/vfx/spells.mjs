import {getRandomSprite, getVFXTexturePaths} from "./sprites.mjs";

/**
 * @typedef SpellVFXData
 * @property {Record<string, object>} components   VFXEffect component definitions keyed by component name.
 * @property {object[]} timeline                   VFXEffect timeline entries.
 * @property {Record<string, string>} references   Named reference strings for playVFXEffect resolution.
 */

/**
 * Resolved context shared across all components within a single spell VFX configuration.
 * @typedef SpellVFXContext
 * @property {{primary: number[], secondary: number[], residue: number[]}} runeColors  Color palettes for the action's rune.
 * @property {number} particleElevation                       Elevation at which particle containers render.
 * @property {SpellVFXTextures} textures                      Resolved texture paths for the action's rune.
 */

/**
 * Per-rune texture path arrays for each particle category, resolved from VFX_TEXTURES.
 * Each array contains #-prefixed scene texture paths. Arrays may be empty if no art exists
 * for that rune/category; the fallback white particle is used in that case.
 * @typedef SpellVFXTextures
 * @property {string[]} impact       Impact burst textures for singleImpact components.
 * @property {string[]} projectile   Directional projectile textures for singleAttack or large scatter.
 * @property {string[]} residue      Lingering afterimage/debris textures.
 * @property {string[]} spray        Small mote textures for scatter and halo generators.
 * @property {string[]} streak       Elongated directional textures for beam/ray generators.
 */

/**
 * A function that configures VFX data for a specific somatic gesture.
 * @callback SpellVFXGestureConfigurator
 * @param {CrucibleSpellAction} action   The spell action being animated.
 * @returns {SpellVFXData|null}          VFX component/timeline/reference data, or null if no VFX applies.
 */

/* -------------------------------------------- */

/**
 * Configure the data for a VFXEffect for a composed spell action.
 * Dispatches to a gesture-specific configurator from SPELL_VFX_GESTURES, using the rune
 * to determine visual style within that gesture's animation.
 * @param {CrucibleSpellAction} action
 * @param {object|null} vfxConfig       The current VFX configuration from prior hooks, if any.
 * @returns {object|null}
 */
export function configureSpellVFXEffect(action, vfxConfig) {
  if ( !action.tags.has("composed") ) throw new Error(`The Action ${action.id} does not use the composed tag.`);
  const hooks = SPELL_VFX_GESTURES[action.gesture.id];
  if ( hooks?.configure === null ) return null;
  if ( hooks?.configure === undefined ) return vfxConfig;

  const result = hooks.configure(action);
  if ( !result ) return null;
  const {components, timeline, references} = result;

  // Validate that the effect data parses correctly
  try {
    const effect = new foundry.canvas.vfx.VFXEffect({name: action.id, components, timeline});
    vfxConfig = effect.toObject(); // TODO replace for now, rather than merge
    vfxConfig.references = references;
  } catch(cause) {
    console.error(new Error(`Spell VFX configuration failed for Action "${action.id}"`, {cause}));
    return null;
  }
  return vfxConfig;
}

/* -------------------------------------------- */

/**
 * Resolve spell VFX references and inject play-time configuration that cannot survive JSON
 * serialization (e.g., callback functions). Called on every client at play time, after the
 * VFXEffect has been constructed from deserialized config but before it plays.
 * @param {CrucibleSpellAction} action              The spell action being animated.
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect  The constructed VFXEffect instance.
 * @param {Record<string, any>} references           The references map, modified in place.
 */
/**
 * Resolve spell VFX references before VFXReferenceField resolution. Computes reference values
 * that components depend on, such as the shared wall mask polygon.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
export function resolveSpellVFXReferences(action, vfxEffect, references) {

  // Pre-compute a shared PointSourcePolygon for wall masking. Components reference this by name
  // via pointSourceMask: {reference: "wallMask"} to avoid redundant polygon computation.
  if ( references.wallMask && !(references.wallMask instanceof foundry.canvas.geometry.PointSourcePolygon) ) {
    const {x, y, type, radius} = references.wallMask;
    references.wallMask = CONFIG.Canvas.polygonBackends[type].create({x, y}, {type, radius});
  }

  // Delegate to gesture-specific resolver
  const hooks = SPELL_VFX_GESTURES[action.gesture.id];
  if ( hooks?.resolve ) hooks.resolve(action, vfxEffect, references);
}

/**
 * Apply play-time finalization to a composed spell VFXEffect immediately before playback.
 * Dispatches to gesture-specific finalizers for injecting runtime callbacks.
 * References are frozen at this point and must not be modified.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
export function finalizeSpellVFXEffect(action, vfxEffect, references) {
  const hooks = SPELL_VFX_GESTURES[action.gesture.id];
  if ( hooks?.finalize ) hooks.finalize(action, vfxEffect, references);
}

/* -------------------------------------------- */
/*  Gesture Configurators                       */
/* -------------------------------------------- */

/**
 * Configure the VFX for a Fan gesture composed spell.
 * The fan is animated as a sweeping arm that rotates across the cone from one edge to the other,
 * like a garden hose spraying perpendicular to its length as it sweeps. Each arm position is a
 * line-area generator spanning the cone's full radius; particles fly perpendicular to the arm in
 * the direction of the sweep, creating a wall of particles that fans outward. Arm positions are
 * staggered in time so the emission front sweeps continuously across the cone angle.
 * Particle color is determined by the spell's rune.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureFanVFXEffect(action) {
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "cone") ) return null;

  const {x, y, radius, angle, rotation} = shape;
  const {runeColors, particleElevation, textures} = resolveSpellVFXContext(action);
  const MASK_RADIUS_FACTOR = 1.25;
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};

  // PARTICLE_LIFETIME determines how long particles linger after the burst.
  // PERP_SPEED is the primary velocity perpendicular to the arm (forward in the sweep direction).
  // Particles spread outward from the arm line rather than radially from the origin.
  const PARTICLE_LIFETIME = 1800;
  const PERP_SPEED = 120;  // px/s perpendicular drift (forward spray from the arm)

  // SWEEP_DURATION controls how long the arm takes to cross the full cone angle.
  // SLICE_EMIT_DURATION is how long each arm position actively emits; kept short for a crisp burst.
  // The visual sustain comes from the long particle lifetime, not from extended emission.
  const SWEEP_DURATION = 400;  // ms for the arm to sweep from one edge of the cone to the other
  const SLICE_EMIT_DURATION = 120;  // ms each arm position emits

  // Divide the sweep into discrete arm positions. Each arm is a line spanning the cone radius,
  // anchored at the cone origin and pointing outward at the arm's angle.
  const N_SLICES = Math.max(5, Math.ceil(angle / 12));
  const sliceDelay = (N_SLICES > 1) ? Math.round(SWEEP_DURATION / (N_SLICES - 1)) : 0;

  // Randomly choose sweep direction each cast: clockwise or counter-clockwise.
  const sweepCW = Math.random() > 0.5;
  const startEdge = rotation + (sweepCW ? -(angle / 2) : (angle / 2));
  const endEdge = rotation + (sweepCW ? (angle / 2) : -(angle / 2));

  const components = {};
  const timeline = [];

  // Layer 1 - Primary streaks: emit from the cone origin, fly radially outward along each arm
  // direction. Velocity follows the arm vector so streaks naturally point away from the caster.
  const RADIAL_SPEED = 180;
  for ( let i = 0; i < N_SLICES; i++ ) {
    const t = (N_SLICES > 1) ? (i / (N_SLICES - 1)) : 0;
    const armAngle = startEdge + (t * (endEdge - startEdge));
    const armName = `fanArm_${i}`;
    components[armName] = particleGenerator({
      textures: textures.streak,
      area: {x, y, radius: 8},
      count: 12,
      duration: SLICE_EMIT_DURATION,
      lifetime: {min: Math.round(PARTICLE_LIFETIME * 0.4), max: Math.round(PARTICLE_LIFETIME * 0.7)},
      fade: {in: 30, out: Math.round(PARTICLE_LIFETIME * 0.3)},
      alpha: {min: 0.7, max: 1.0},
      scale: {min: 0.75, max: 1.2},
      initial: 0.9,
      perFrame: 4,
      elevation: particleElevation,
      sort: 1,
      pointSourceMask,
      rotation: {alignVelocity: true, spread: 0.1},
      config: {
        velocity: {speed: [RADIAL_SPEED * 0.7, RADIAL_SPEED * 1.3], angle: [armAngle - 5, armAngle + 5]},
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    });
    // timeline.push({component: armName, position: i * sliceDelay}); // Temporarily disabled
  }

  // Layer 2 - Ground cascade: a single generator whose spawn ring expands outward over the sweep
  // duration via an onTick callback injected at play-time. Particles spawn in a full ring but are
  // reflected into the cone by an onSpawn callback. Both callbacks are injected by finalizeFanVFXEffect.
  const CASCADE_LIFETIME = 1400;
  const CASCADE_DURATION = 1000;
  const tokenElevation = action.token?.elevation ?? 0;
  const tokenSort = action.token?.sort ?? 0;
  const impactTextures = getVFXTexturePaths(action.rune.id, "impact");
  const rotationRad = Math.toRadians(rotation);
  components.fanCascade = particleGenerator({
    textures: impactTextures,
    area: {x, y, radius: [0, Math.round(radius * 0.17)]},
    count: null,
    duration: CASCADE_DURATION,
    lifetime: {min: 400, max: 700},
    fade: {in: 20, out: 400},
    alpha: {min: 0.5, max: 0.8},
    scale: {min: 0.8, max: 1.2},
    initial: 0.0,
    perFrame: 4,
    elevation: tokenElevation,
    sort: tokenSort - 1,
    pointSourceMask,
    rotation: {initial: rotationRad, spread: 0.2},
    config: {
      fanCascade: {originX: x, originY: y, rotationRad, halfAngleRad: Math.toRadians(angle / 2),
        maxRadius: Math.round(radius * 0.85), duration: CASCADE_DURATION},
      velocity: {speed: [2, 5], angle: [rotation - 1, rotation + 1]},
      debug: {tint: {mode: "palette", palette: runeColors.primary}}
    }
  });
  timeline.push({component: "fanCascade", position: 0});

  // Impact timing: fire when the sweeping arm crosses the target's angular position.
  // Normalize the target's bearing into the sweep arc [startEdge, endEdge] and multiply by
  // SWEEP_DURATION. The normalization loop handles cases where atan2 and the sweep arc disagree
  // on which 360-degree cycle the angle falls in.
  const sweepRange = endEdge - startEdge;
  const gridSize = canvas.dimensions.size;
  const fanGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    let bearing = Math.toDegrees(Math.atan2(cy - y, cx - x));
    const lo = Math.min(startEdge, endEdge);
    const hi = Math.max(startEdge, endEdge);
    while ( bearing < lo ) bearing += 360;
    while ( bearing > hi ) bearing -= 360;
    const t = Math.clamp((bearing - startEdge) / sweepRange, 0, 1);
    return Math.round(t * SWEEP_DURATION);
  };
  addImpactComponents(action, components, timeline, references, fanGetImpactPosition, textures.impact);
  return {components, timeline, references};
}

/* -------------------------------------------- */

/**
 * Finalize the VFX for a Fan gesture at play-time. Injects onSpawn callbacks into cascade
 * components to reflect particles spawned outside the cone back into the cone's angular range.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
function finalizeFanVFXEffect(action, vfxEffect, references) {
  for ( const component of Object.values(vfxEffect.components) ) {
    if ( component.type !== "particleGenerator" ) continue;
    const cfg = component.config?.fanCascade;
    if ( !cfg ) continue;
    const {originX, originY, rotationRad, halfAngleRad, maxRadius, duration} = cfg;
    let elapsed = 0;

    // Animate the spawn ring outward over the cascade duration
    let lastLog = 0;
    component.config.onTick = (dt, generator) => {
      elapsed += dt;
      const t = Math.clamp(elapsed / duration, 0, 1);
      const ringWidth = maxRadius * 0.2;
      const centerRadius = t * maxRadius;
      const inner = Math.max(0, centerRadius - (ringWidth / 2));
      const outer = centerRadius + (ringWidth / 2);
      generator._spawnArea = {x: originX, y: originY, radius: [inner, outer]};
      if ( CONFIG.debug.vfx && ((elapsed - lastLog) >= 100) ) {
        lastLog = elapsed;
        console.debug("fanCascade", {t: t.toFixed(2), alive: generator.particles.length, max: generator.adjustedMaxParticles, inner: Math.round(inner), outer: Math.round(outer)});
      }
    };

    // Reflect out-of-cone particles and set rotation to point outward
    component.config.onSpawn = (p, {generator}) => {
      const sceneX = p.x + generator._bounds.x;
      const sceneY = p.y + generator._bounds.y;
      const dist = Math.hypot(sceneX - originX, sceneY - originY);

      let particleAngle = Math.atan2(sceneY - originY, sceneX - originX);
      let delta = particleAngle - rotationRad;
      while ( delta > Math.PI ) delta -= Math.PI * 2;
      while ( delta < -Math.PI ) delta += Math.PI * 2;

      if ( Math.abs(delta) > halfAngleRad ) {
        particleAngle = rotationRad + ((Math.random() * 2 - 1) * halfAngleRad);
        p.x = originX + (Math.cos(particleAngle) * dist) - generator._bounds.x;
        p.y = originY + (Math.sin(particleAngle) * dist) - generator._bounds.y;
      }
      p.rotation = particleAngle + ((Math.random() - 0.5) * 0.3);
    };
  }
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a Ray gesture composed spell.
 * The ray is represented as two particle generators anchored at the origin of the line-shaped region:
 * a tight forward beam and a wider spillage halo that cascades off the beam's edges.
 * Particle color is determined by the spell's rune.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureRayVFXEffect(action) {
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "line") ) return null;

  const {x, y, length, width, rotation} = shape;
  const {runeColors, particleElevation, textures} = resolveSpellVFXContext(action);
  const MASK_RADIUS_FACTOR = 1.25;
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(length * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};

  // Derive beam traversal time from the ray length and a fixed speed.
  // Particles are seeded at full count immediately (initial: 1.0) so the beam appears
  // instantly at full length, then is continuously replenished until the generator stops.
  const BEAM_SPEED = 2500;  // pixels per second along the ray axis
  const beamLifetime = Math.max(300, Math.round(length / BEAM_SPEED * 1000));
  const BEAM_DURATION = 3500;  // ms the generator actively emits before soft-stopping

  const spawnRadius = Math.max(8, width / 2);

  const components = {
    rayBeam: particleGenerator({
      textures: textures.streak,
      area: {x, y, radius: spawnRadius},
      count: 600,
      duration: BEAM_DURATION,
      lifetime: {min: Math.round(beamLifetime * 0.85), max: beamLifetime},
      fade: {in: 30, out: 150},
      alpha: {min: 0.5, max: 0.9},
      scale: {min: 0.5, max: 1.1},
      initial: 1.0,
      perFrame: 20,
      elevation: particleElevation,
      sort: 1,
      pointSourceMask,
      config: {
        velocity: {speed: [BEAM_SPEED * 0.9, BEAM_SPEED * 1.1], angle: [rotation - 2, rotation + 2]},
        alignRotation: {jitter: 0.15},
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    }),
    raySpillage: particleGenerator({
      textures: textures.spray,
      area: {x, y, radius: Math.round(spawnRadius * 1.3)},
      count: 150,
      duration: BEAM_DURATION,
      lifetime: {min: Math.round(beamLifetime * 0.2), max: Math.round(beamLifetime * 0.4)},
      fade: {in: 0, out: 100},
      alpha: {min: 0.2, max: 0.6},
      scale: {min: 0.2, max: 0.5},
      initial: 0.4,
      perFrame: 10,
      elevation: particleElevation,
      sort: 0,
      pointSourceMask,
      config: {
        velocity: {speed: [BEAM_SPEED * 0.1, BEAM_SPEED * 0.4], angle: [rotation - 35, rotation + 35]},
        drift: {enabled: true, intensity: 0.3},
        debug: {tint: {mode: "palette", palette: runeColors.secondary}}
      }
    })
  };

  const timeline = [
    {component: "rayBeam", position: 0},
    {component: "raySpillage", position: 0}
  ];

  // Impact timing: fire when the beam front arrives at the target. BEAM_SPEED is in px/s so
  // distance / BEAM_SPEED * 1000 converts to ms.
  const gridSize = canvas.dimensions.size;
  const rayGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(cx - x, cy - y);
    return Math.round(dist / BEAM_SPEED * 1000);
  };
  addImpactComponents(action, components, timeline, references, rayGetImpactPosition, textures.impact);
  return {components, timeline, references};
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a Blast gesture composed spell.
 * The blast is represented as three staggered radial particle waves that expand from the impact
 * point to the boundary of the circular region, conveying a rapid multi-step detonation. A slow
 * debris layer underlies the burst and lingers afterward as settling energy.
 * All wave generators are calibrated so that particles reach the blast perimeter just as their
 * fade-out begins, keeping them naturally contained within the region boundary.
 * Particle color is determined by the spell's rune.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureBlastVFXEffect(action) {
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "circle") ) return null;

  const {x, y, radius} = shape;
  const {runeColors, particleElevation, textures} = resolveSpellVFXContext(action);

  // Clip particles to wall-occluded area from the blast origin. The mask radius is intentionally
  // larger than the blast radius so particles that naturally reach the perimeter are not clipped,
  // while particles that would penetrate walls are cut off.
  const MASK_RADIUS_FACTOR = 1.25;
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};

  // Each wave is calibrated so its fastest particles reach the blast perimeter just as fade-out
  // begins. visibleFraction is the proportion of lifetime before fade-out starts.
  // maxSpeed = radius / visibleTime (in px/s), ensuring natural containment within the circle.
  const WAVE1_LIFETIME = 500;
  const WAVE1_VISIBLE = 0.55;
  const wave1Speed = Math.round(radius * 1000 / (WAVE1_LIFETIME * WAVE1_VISIBLE));

  // Wave 2 is calibrated to reach ~85% of the radius, staying visually behind wave 1.
  const WAVE2_LIFETIME = 700;
  const WAVE2_VISIBLE = 0.5;
  const wave2Speed = Math.round(radius * 0.85 * 1000 / (WAVE2_LIFETIME * WAVE2_VISIBLE));

  const components = {
    // Impact flash: a brief radial burst at the origin that precedes the expansion waves.
    blastFlash: particleGenerator({
      textures: textures.spray,
      area: {x, y, radius: 6},
      count: 300,
      duration: 50,
      lifetime: {min: 140, max: 200},
      fade: {in: 10, out: 130},
      alpha: {min: 0.7, max: 1.0},
      scale: {min: 0.3, max: 0.7},
      initial: 1.0,
      perFrame: 25,
      elevation: particleElevation,
      sort: 2,
      pointSourceMask,
      config: {
        velocity: {speed: [100, 280], angle: [0, 360]},
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    }),
    // Wave 1: fast tight ring that expands to the blast perimeter.
    blastWave1: particleGenerator({
      textures: textures.spray,
      area: {x, y, radius: 5},
      count: 800,
      duration: 80,
      lifetime: {min: Math.round(WAVE1_LIFETIME * 0.85), max: WAVE1_LIFETIME},
      fade: {in: 20, out: Math.round(WAVE1_LIFETIME * (1 - WAVE1_VISIBLE))},
      alpha: {min: 0.55, max: 1.0},
      scale: {min: 0.4, max: 1.0},
      initial: 1.0,
      perFrame: 40,
      elevation: particleElevation,
      sort: 1,
      pointSourceMask,
      config: {
        velocity: {speed: [wave1Speed * 0.88, wave1Speed * 1.12], angle: [0, 360]},
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    }),
    // Wave 2: slower echo that trails behind, adding depth and the cascading multi-step feel.
    blastWave2: particleGenerator({
      textures: textures.spray,
      area: {x, y, radius: 8},
      count: 500,
      duration: 100,
      lifetime: {min: Math.round(WAVE2_LIFETIME * 0.85), max: WAVE2_LIFETIME},
      fade: {in: 30, out: Math.round(WAVE2_LIFETIME * (1 - WAVE2_VISIBLE))},
      alpha: {min: 0.3, max: 0.75},
      scale: {min: 0.5, max: 1.3},
      initial: 0.9,
      perFrame: 25,
      elevation: particleElevation,
      sort: 1,
      pointSourceMask,
      config: {
        velocity: {speed: [wave2Speed * 0.8, wave2Speed * 1.2], angle: [0, 360]},
        drift: {enabled: true, intensity: 0.2},
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    }),
    // Debris: slow drifting haze seeded across the blast area that outlasts the expansion waves.
    blastDebris: particleGenerator({
      textures: textures.residue,
      area: {x, y, radius: Math.round(radius * 0.3)},
      count: 100,
      duration: 200,
      lifetime: {min: 2000, max: 2800},
      fade: {in: 150, out: 1800},
      alpha: {min: 0.05, max: 0.18},
      scale: {min: 1.0, max: 2.5},
      initial: 0.3,
      perFrame: 6,
      elevation: particleElevation,
      sort: 0,
      pointSourceMask,
      config: {
        velocity: {speed: [12, 55], angle: [0, 360]},
        drift: {enabled: true, intensity: 0.5},
        debug: {tint: {mode: "palette", palette: runeColors.residue}}
      }
    })
  };

  const timeline = [
    {component: "blastFlash", position: 0},
    {component: "blastDebris", position: 0},
    {component: "blastWave1", position: 60},
    {component: "blastWave2", position: 200}
  ];

  // Impact timing: fire when wave 1 arrives at the target. wave1Speed is in px/s so
  // distance / wave1Speed * 1000 converts to ms. The 60ms wave1 timeline offset is added so
  // the impact coincides with the expansion front rather than the detonation point.
  const gridSize = canvas.dimensions.size;
  const blastGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(cx - x, cy - y);
    return 60 + Math.round(dist / wave1Speed * 1000);
  };
  addImpactComponents(action, components, timeline, references, blastGetImpactPosition, textures.impact);
  return {components, timeline, references};
}

/* -------------------------------------------- */
/*  Shared Helpers                              */
/* -------------------------------------------- */

/**
 * Resolve shared VFX context common to all spell particle generators for this action.
 * Extracts the rune color palette, particle elevation, and per-category texture paths,
 * which are identical across every component in a given configurator.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXContext}
 */
function resolveSpellVFXContext(action) {
  const runeId = action.rune.id;
  return {
    runeColors: RUNE_COLORS[runeId] ?? RUNE_COLORS._default,
    particleElevation: action.region.elevation.top ?? 0,
    textures: {
      impact: getVFXTexturePaths(runeId, "impact"),
      projectile: getVFXTexturePaths(runeId, "projectile"),
      residue: getVFXTexturePaths(runeId, "residue"),
      spray: getVFXTexturePaths(runeId, "spray"),
      streak: getVFXTexturePaths(runeId, "streak")
    }
  };
}

/* -------------------------------------------- */

/**
 * The fallback texture array used when no rune-specific art is available.
 * @type {string[]}
 */
const FALLBACK_TEXTURES = ["#crucible.particle.white"];

/**
 * Construct a particleGenerator component definition with spell-wide defaults applied.
 * All spell particle generators use additive blending (PIXI.BLEND_MODES.ADD). If the provided
 * overrides include a non-empty textures array (typically rune-specific art from the VFX
 * spritesheet), those textures are used; otherwise, the fallback white particle is applied.
 * @param {object} overrides   Component fields that override or extend the defaults.
 * @returns {object}
 */
function particleGenerator(overrides) {
  const textures = overrides.textures?.length ? overrides.textures : FALLBACK_TEXTURES;
  return {
    type: "particleGenerator",
    blend: 1,
    ...overrides,
    textures
  };
}

/* -------------------------------------------- */

/**
 * Add singleImpact components to an in-progress spell VFX configuration for each struck target.
 * Only events with a HIT or GLANCE result produce an impact. Other results are silently skipped.
 * Each impact is positioned at the target token mesh with a small random offset toward the token
 * center, mirroring the projectile strike pattern.
 * @param {CrucibleSpellAction} action       The spell action being animated.
 * @param {object} components                Component map to add impact entries into.
 * @param {object[]} timeline                Timeline array to push impact entries onto.
 * @param {Record<string, string>} references  References map to register token UUIDs into.
 * @param {function(CrucibleToken): number} getImpactPosition
 *   A function that receives the target token and returns the timeline position (ms) at which
 *   its impact should fire. Called once per HIT/GLANCE target.
 * @param {string[]} impactTextures          An array of #-prefixed scene texture paths for impact
 *                                           sprites. One is chosen at random per target.
 */
function addImpactComponents(action, components, timeline, references, getImpactPosition, impactTextures) {
  const useSpritesheetImpact = impactTextures.length > 0;
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const roll = group.roll[0]?.roll;
    const result = roll?.data.result;
    if ( (result === T.HIT) || (result === T.GLANCE) ) {
      const token = action.targets.get(actor)?.token;
      if ( !token ) continue;
      const targetTokenRef = `target_${j}_token`;
      const targetMeshRef = `target_${j}_tokenMesh`;
      Object.assign(references, {
        [targetTokenRef]: `@${token.uuid}`,
        [targetMeshRef]: `^${targetTokenRef}.object.mesh`
      });
      const w = token.width * canvas.dimensions.size;
      const h = token.height * canvas.dimensions.size;
      const dx = Math.mix(-w * 0.1, w * 0.1, Math.random());
      const dy = Math.mix(-h * 0.1, h * 0.1, Math.random());
      const impactName = `spellImpact_${j}`;
      const texture = useSpritesheetImpact
        ? impactTextures[Math.floor(Math.random() * impactTextures.length)]
        : getRandomSprite("impacts", "blood");
      components[impactName] = {
        type: "singleImpact",
        position: {reference: targetMeshRef, deltas: {x: dx, y: dy, sort: 1}},
        texture,
        duration: 2000,
        size: 3
      };
      timeline.push({component: impactName, position: getImpactPosition(token)});
    }
    j++;
  }
}

/* -------------------------------------------- */
/*  Color Palettes                              */
/* -------------------------------------------- */

/**
 * Per-rune color palettes for spell particle tinting.
 * Each entry has three palettes: beam (main directional stream), spillage (cascading halo), and
 * afterimage (lingering residue that outlasts the primary effect). Colors are plain hex numbers
 * passed to ParticleGenerator's debug.tint palette, which randomly assigns one color per particle.
 * Uses raw hex literals rather than Color instances to avoid PIXI tint coercion issues with
 * Number subclasses. Chosen to work with PIXI.BLEND_MODES.ADD against a dark scene background.
 * @type {Record<string, {primary: number[], secondary: number[], residue: number[]}>}
 */
const RUNE_COLORS = {
  control: {
    // Psychic control and coercion: red-pink spectrum
    primary: [0xFF1133, 0xFF3366, 0xFF5588],
    secondary: [0x8B0022, 0x660022],
    residue: [0x3A0011, 0x220011]  // Dark crimson: the grip of control lingers as dread
  },
  death: {
    // Corruption and necromancy: spectral bright greens over dark depths
    primary: [0x39FF14, 0x00FF7F, 0xAAFF44],
    secondary: [0x004D1A, 0x003311],
    residue: [0x1A3300, 0x0F1F00]  // Murky swamp-dark: corruption leaves a stain
  },
  earth: {
    // Physical rock and corrosive acid: acid yellow-green with grey-brown
    primary: [0xAAFF00, 0xCCFF44, 0x88DD00],
    secondary: [0x776600, 0x554400],
    residue: [0x3D2800, 0x261A00]  // Dark brown: burnt rock and acid residue
  },
  flame: {
    // Fire damage: reds and oranges
    primary: [0xFF4500, 0xFF7700, 0xFFCC00],
    secondary: [0xCC2200, 0x881100],
    residue: [0x661100, 0x3D0A00]  // Charcoal-red: embers and ash
  },
  frost: {
    // Cold damage: blues towards white
    primary: [0x60A5FA, 0x93C5FD, 0xBFE8FF],
    secondary: [0x1D4ED8, 0x1E3A8A],
    residue: [0x0C1A3A, 0x080F26]  // Deep night blue: the cold persists in darkness
  },
  illumination: {
    // Sun magic, radiant damage: bright yellow and white
    primary: [0xFFFFFF, 0xFFFF99, 0xFFDD00],
    secondary: [0xFFAA00, 0xFF8800],
    residue: [0xFF6600, 0xCC4400]  // Warm amber-orange: light fading to a dying glow
  },
  illusion: {
    // Psychic trickery: pinks and magenta with purple
    primary: [0xFF00AA, 0xFF44CC, 0xCC00FF],
    secondary: [0x8B0055, 0x660088],
    residue: [0x330066, 0x1A0033]  // Deep indigo: the illusion dissolves into shadow
  },
  kinesis: {
    // Telekinetic force: silver and grey-blue
    primary: [0xBBCCDD, 0x99AABB, 0xDDEEFF],
    secondary: [0x556677, 0x3D5066],
    residue: [0x1A2433, 0x111A26]  // Dark steel-grey: force dissipated into still air
  },
  life: {
    // Growth and restoration, poison damage: fresh greens with ember pink
    primary: [0x22CC44, 0x44FF66, 0x88FF88],
    secondary: [0x116622, 0x0A4A18],
    residue: [0xFF3399, 0xFF66AA]  // Heart-of-ember pink: the life force leaves warmth
  },
  lightning: {
    // Storm, electric damage: dark blues and bright yellow-white
    primary: [0xFFFF00, 0xFFFF88, 0xFFFFCC],
    secondary: [0x1E3A8A, 0x1E40AF],
    residue: [0x312E81, 0x1E1B4B]  // Deep indigo: ozone and static electricity linger
  },
  oblivion: {
    // Void and eldritch, void damage: dark purples and reds
    primary: [0x8B00FF, 0xDC1414, 0x7C3AED],
    secondary: [0x4C1D95, 0x7F1D1D],
    residue: [0x1A0533, 0x1F0808]  // Near-void: the abyss echoes in darkness
  },
  soul: {
    // Spiritual healing: turquoise and aquamarine
    primary: [0x00FFCC, 0x40E0D0, 0x7FFFD4],
    secondary: [0x008B8B, 0x006655],
    residue: [0x004455, 0x002233]  // Deep peaceful teal: the spirit fades to still water
  },
  _default: {
    primary: [0xA78BFA, 0xC4B5FD, 0xDDD6FE],
    secondary: [0x7C3AED, 0x6D28D9],
    residue: [0x4C1D95, 0x2E1065]
  }
};

/* -------------------------------------------- */
/*  Gesture Registry                            */
/* -------------------------------------------- */

/**
 * A registry of gesture-specific VFX hooks, keyed by gesture ID.
 * Each entry may define:
 * - `configure` - called at configure-time to produce the serializable VFXEffect config.
 *    `null` explicitly suppresses VFX; absent defers to existing config.
 * - `resolve` - called at play-time to compute reference values before VFXReferenceField resolution.
 * - `finalize` - called at play-time after resolution to inject runtime callbacks.
 * @type {Record<string, {configure?: SpellVFXGestureConfigurator, resolve?: function, finalize?: function}>}
 */
const SPELL_VFX_GESTURES = {
  arrow: {},
  aspect: {},
  aura: {},
  blast: {configure: configureBlastVFXEffect},
  cone: {},
  conjure: {},
  create: {},
  fan: {configure: configureFanVFXEffect, finalize: finalizeFanVFXEffect},
  influence: {},
  pulse: {},
  ray: {configure: configureRayVFXEffect},
  sense: {},
  step: {},
  strike: {},
  surge: {},
  touch: {},
  ward: {}
};
