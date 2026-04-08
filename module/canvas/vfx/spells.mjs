import {getRandomSprite} from "./sprites.mjs";

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
  const configurator = SPELL_VFX_GESTURES[action.gesture.id];
  if ( !configurator ) return null;

  const result = configurator(action);
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
 * Resolve spell VFX references that require client-side computation.
 * Computes PointSourcePolygon instances from serialized polygon configs stored in the references map.
 * @param {CrucibleSpellAction} action    The spell action being animated.
 * @param {Record<string, any>} references  The references map, modified in place.
 */
export function resolveSpellVFXReferences(action, references) {
  if ( references.wallMask && !(references.wallMask instanceof foundry.canvas.geometry.PointSourcePolygon) ) {
    const {x, y, type, radius} = references.wallMask;
    references.wallMask = CONFIG.Canvas.polygonBackends[type].create({x, y}, {type, radius});
  }
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
  const {runeColors, particleElevation} = resolveSpellVFXContext(action);
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

  for ( let i = 0; i < N_SLICES; i++ ) {
    const t = (N_SLICES > 1) ? (i / (N_SLICES - 1)) : 0;
    const armAngle = startEdge + (t * (endEdge - startEdge));
    const armRad = Math.toRadians(armAngle);

    // The arm is a line from the cone origin to the far edge at this angular position.
    const armEnd = {
      x: x + (Math.cos(armRad) * radius),
      y: y + (Math.sin(armRad) * radius)
    };

    // Particles spray perpendicular to the arm, in the direction the arm is moving into.
    // For a CW sweep, the arm moves from left to right (positive angle), so the perpendicular
    // forward direction is 90 degrees clockwise from the arm (armAngle + 90).
    const perpAngle = armAngle + (sweepCW ? 90 : -90);

    const beamName = `fanArm_${i}`;
    const spillName = `fanSpill_${i}`;

    // Primary primary: tight perpendicular spray along the arm line.
    components[beamName] = particleGenerator({
      area: {from: {x, y}, to: armEnd},
      count: 200,
      duration: SLICE_EMIT_DURATION,
      lifetime: {min: Math.round(PARTICLE_LIFETIME * 0.75), max: PARTICLE_LIFETIME},
      fade: {in: 40, out: Math.round(PARTICLE_LIFETIME * 0.45)},
      alpha: {min: 0.5, max: 1.0},
      scale: {min: 0.4, max: 1.0},
      initial: 0.9,
      perFrame: 18,
      elevation: particleElevation,
      sort: 1,
      pointSourceMask,
      config: {
        velocity: {speed: [PERP_SPEED * 0.6, PERP_SPEED * 1.4], angle: [perpAngle - 10, perpAngle + 10]},
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    });

    // Spillage halo: wider angular spread, more drift, lower opacity - cascades off the arm edges.
    components[spillName] = particleGenerator({
      area: {from: {x, y}, to: armEnd},
      count: 80,
      duration: SLICE_EMIT_DURATION,
      lifetime: {min: Math.round(PARTICLE_LIFETIME * 0.35), max: Math.round(PARTICLE_LIFETIME * 0.6)},
      fade: {in: 20, out: Math.round(PARTICLE_LIFETIME * 0.3)},
      alpha: {min: 0.15, max: 0.45},
      scale: {min: 0.2, max: 0.55},
      initial: 0.5,
      perFrame: 8,
      elevation: particleElevation,
      sort: 0,
      pointSourceMask,
      config: {
        velocity: {speed: [PERP_SPEED * 0.2, PERP_SPEED * 2.0], angle: [perpAngle - 40, perpAngle + 40]},
        drift: {enabled: true, intensity: 0.35},
        debug: {tint: {mode: "palette", palette: runeColors.secondary}}
      }
    });

    timeline.push({component: beamName, position: i * sliceDelay});
    timeline.push({component: spillName, position: i * sliceDelay});
  }

  // Afterimage: a slow-moving haze that accumulates across the cone during the sweep and then
  // lingers long after the arm particles have faded. Particles are emitted for the full sweep
  // window so they build up across the whole cone area, then drift lazily and dissolve over
  // several seconds, reading as a residual glow burned into the air.
  const AFTERIMAGE_LIFETIME = PARTICLE_LIFETIME * 3;
  components.fanAfterimage = particleGenerator({
    area: {x, y, radius: Math.round(radius * 0.6)},
    count: 120,
    duration: SWEEP_DURATION + SLICE_EMIT_DURATION,
    lifetime: {min: Math.round(AFTERIMAGE_LIFETIME * 0.75), max: AFTERIMAGE_LIFETIME},
    fade: {in: Math.round(AFTERIMAGE_LIFETIME * 0.1), out: Math.round(AFTERIMAGE_LIFETIME * 0.65)},
    alpha: {min: 0.04, max: 0.14},
    scale: {min: 1.2, max: 2.8},
    initial: 0.6,
    perFrame: 5,
    elevation: particleElevation,
    sort: 0,
    pointSourceMask,
    config: {
      velocity: {speed: [25, 60], angle: [rotation - (angle / 2), rotation + (angle / 2)]},
      drift: {enabled: true, intensity: 0.6},
      debug: {tint: {mode: "palette", palette: runeColors.residue}}
    }
  });
  timeline.push({component: "fanAfterimage", position: 0});

  // Impact timing: fire when the sweeping arm crosses the target's angular position.
  // Normalize the target's bearing into the sweep arc [startEdge, endEdge] and multiply by
  // SWEEP_DURATION. The normalization loop handles cases where atan2 and the sweep arc disagree
  // on which 360-degree cycle the angle falls in.
  const sweepRange = endEdge - startEdge;
  const gridSize = canvas.dimensions.size;
  const fanGetImpactPosition = outcome => {
    const token = outcome.token;
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
  addImpactComponents(action, components, timeline, references, fanGetImpactPosition);
  return {components, timeline, references};
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
  const {runeColors, particleElevation} = resolveSpellVFXContext(action);
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
        debug: {tint: {mode: "palette", palette: runeColors.primary}}
      }
    }),
    raySpillage: particleGenerator({
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
  const rayGetImpactPosition = outcome => {
    const token = outcome.token;
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(cx - x, cy - y);
    return Math.round(dist / BEAM_SPEED * 1000);
  };
  addImpactComponents(action, components, timeline, references, rayGetImpactPosition);
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
  const {runeColors, particleElevation} = resolveSpellVFXContext(action);

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
  const blastGetImpactPosition = outcome => {
    const token = outcome.token;
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(cx - x, cy - y);
    return 60 + Math.round(dist / wave1Speed * 1000);
  };
  addImpactComponents(action, components, timeline, references, blastGetImpactPosition);
  return {components, timeline, references};
}

/* -------------------------------------------- */
/*  Shared Helpers                              */
/* -------------------------------------------- */

/**
 * Resolve shared VFX context common to all spell particle generators for this action.
 * Extracts the rune color palette and particle elevation, which are identical across every
 * component in a given configurator.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXContext}
 */
function resolveSpellVFXContext(action) {
  return {
    runeColors: RUNE_COLORS[action.rune.id] ?? RUNE_COLORS._default,
    particleElevation: action.region.elevation.top ?? 0
  };
}

/* -------------------------------------------- */

/**
 * Construct a particleGenerator component definition with spell-wide defaults applied.
 * All spell particle generators use additive blending (PIXI.BLEND_MODES.ADD) and the shared
 * virtual white particle texture registered on the canvas at initialization.
 * @param {object} overrides   Component fields that override or extend the defaults.
 * @returns {object}
 */
function particleGenerator(overrides) {
  return {
    type: "particleGenerator",
    textures: ["#crucible.particle.white"],
    blend: 1,
    ...overrides
  };
}

/* -------------------------------------------- */

/**
 * Add singleImpact components to an in-progress spell VFX configuration for each struck target.
 * Only outcomes with a HIT or GLANCE result produce an impact. RESIST and other outcomes are
 * silently skipped. Each impact is positioned at the target token mesh with a small random offset
 * toward the token center, mirroring the projectile strike pattern.
 * @param {CrucibleSpellAction} action       The spell action being animated.
 * @param {object} components                Component map to add impact entries into.
 * @param {object[]} timeline                Timeline array to push impact entries onto.
 * @param {Record<string, string>} references  References map to register token UUIDs into.
 * @param {function(CrucibleActionOutcome): number} getImpactPosition
 *   A function that receives each struck outcome and returns the timeline position (ms) at which
 *   its impact should fire. Called once per HIT/GLANCE outcome.
 */
function addImpactComponents(action, components, timeline, references, getImpactPosition) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let j = 1;
  for ( const outcome of action.outcomes.values() ) {
    if ( outcome.target === action.actor ) continue;
    const roll = outcome.rolls[0];
    const result = roll?.data.result;
    if ( (result === T.HIT) || (result === T.GLANCE) ) {
      const token = outcome.token;
      const targetTokenRef = `outcome_${j}_token`;
      const targetMeshRef = `outcome_${j}_tokenMesh`;
      Object.assign(references, {
        [targetTokenRef]: `@${token.uuid}`,
        [targetMeshRef]: `^${targetTokenRef}.object.mesh`
      });
      const w = token.width * canvas.dimensions.size;
      const h = token.height * canvas.dimensions.size;
      const dx = Math.mix(-w * 0.1, w * 0.1, Math.random());
      const dy = Math.mix(-h * 0.1, h * 0.1, Math.random());
      const impactName = `spellImpact_${j}`;
      components[impactName] = {
        type: "singleImpact",
        position: {reference: targetMeshRef, deltas: {x: dx, y: dy, sort: 1}},
        texture: getRandomSprite("impacts", "blood"),
        duration: 2000,
        size: 3
      };
      timeline.push({component: impactName, position: getImpactPosition(outcome)});
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
 * A registry of gesture-specific VFX configurator functions, keyed by gesture ID.
 * Each function receives the full CrucibleSpellAction and returns a SpellVFXData object
 * whose components and timeline describe the visual effect, or null if no VFX applies.
 * Within each configurator, action.rune.id is used to select textures, sounds, and tints
 * that express the element of the spell.
 * @type {Record<string, SpellVFXGestureConfigurator|null>}
 */
const SPELL_VFX_GESTURES = {
  arrow: null,
  aspect: null,
  aura: null,
  blast: configureBlastVFXEffect,
  cone: null,
  conjure: null,
  create: null,
  fan: configureFanVFXEffect,
  influence: null,
  pulse: null,
  ray: configureRayVFXEffect,
  sense: null,
  step: null,
  strike: null,
  surge: null,
  touch: null,
  ward: null
};
