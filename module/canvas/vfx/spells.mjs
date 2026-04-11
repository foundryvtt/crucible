import {getRandomSprite, getVFXTexturePaths} from "./sprites.mjs";
import {particleGenerator, mergeAnimationBlocks, getParticleScaleFactor,
  rayBeam, castoffFlare, linearCascade, coneSweepEmitter, expandingCascade,
  airResidue, groundResidue, groundImpacts, implodeExplode, fallingDebris} from "./animations.mjs";

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
 * A single generator emits streak particles from the cone origin. An onTick callback sweeps the
 * emission direction across the cone arc over time, while onSpawn overrides each particle's velocity
 * and rotation to follow the current arm angle. This replaces the earlier N-generator approach with
 * a single animated emitter.
 * Particle color is determined by the spell's rune.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureFanVFXEffect(action) {
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "cone") ) return null;

  const {x, y, radius, angle, rotation} = shape;
  const origin = {x, y};
  const {runeColors, particleElevation, textures} = resolveSpellVFXContext(action);
  const MASK_RADIUS_FACTOR = 1.5;
  const references = {
    tokenMesh: "^token.object.mesh",

    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};
  const coverageArea = action.region?.area;
  const shared = {pointSourceMask, coverageArea};
  const SWEEP_DURATION = 400;

  // Layer 1 - Sweep streaks
  const sweepInnerRadius = Math.round(action.token.getSize().width / 3);
  const sweep = coneSweepEmitter.configure({prefix: "fanSweep", origin, radius, angle, rotation,
    textures: textures.streak, duration: SWEEP_DURATION,
    innerRadius: sweepInnerRadius, outerRadius: Math.round(sweepInnerRadius * 1.3),
    elevation: particleElevation, position: 0, ...shared});

  // Layer 2 - Ground cascade
  const cascade = expandingCascade.configure({prefix: "fanCascade", origin, radius,
    textures: getVFXTexturePaths(action.rune.id, "impact"),
    coneAngle: angle, coneRotation: rotation,
    elevation: 0, position: 0, ...shared});

  // Layer 3 - Overhead residue
  const residueTextures = textures.residue.filter(t => t.includes("Spray") || t.includes("Snow"));
  const residue = airResidue.configure({prefix: "fanResidue", origin,
    radius: Math.round(radius * 0.7), textures: residueTextures,
    elevation: particleElevation, position: 200, ...shared});

  const result = mergeAnimationBlocks(sweep, cascade, residue);
  Object.assign(result.references, references);

  // Impact timing: fire when the sweeping arm crosses the target's angular position.
  const sweepConfig = sweep.components.fanSweep.config.coneSweep;
  const sweepRangeRad = sweepConfig.endAngleRad - sweepConfig.startAngleRad;
  const gridSize = canvas.dimensions.size;
  const fanGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    let bearing = Math.atan2(cy - y, cx - x);
    const lo = Math.min(sweepConfig.startAngleRad, sweepConfig.endAngleRad);
    const hi = Math.max(sweepConfig.startAngleRad, sweepConfig.endAngleRad);
    while ( bearing < lo ) bearing += Math.PI * 2;
    while ( bearing > hi ) bearing -= Math.PI * 2;
    const t = Math.clamp((bearing - sweepConfig.startAngleRad) / sweepRangeRad, 0, 1);
    return Math.round(t * SWEEP_DURATION);
  };
  addImpactComponents(action, result.components, result.timeline, result.references,
    fanGetImpactPosition, textures.impact, origin);
  return result;
}

/* -------------------------------------------- */

/**
 * Finalize the VFX for a Fan gesture at play-time.
 * Delegates to animation block finalize hooks for sweep, cascade, and residue.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
function finalizeFanVFXEffect(action, vfxEffect, references) {
  coneSweepEmitter.finalize(vfxEffect, references);
  expandingCascade.finalize(vfxEffect, references);
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
  const origin = {x, y};
  const {runeColors, particleElevation, textures} = resolveSpellVFXContext(action);
  const MASK_RADIUS_FACTOR = 1.5;
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(length * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};
  const beamElevation = (action.token?.elevation ?? 0) + 1;
  const shared = {elevation: beamElevation, pointSourceMask};
  const spawnRadius = Math.max(8, width / 2);
  const BEAM_SPEED = 2500;
  const CASCADE_DURATION = 2000;
  const BEAM_DURATION = CASCADE_DURATION + 500;

  // Offset the beam origin slightly in front of the caster
  const tokenRadius = action.token.getSize().width / 2;
  const rotRad = Math.toRadians(rotation);
  const beamOffset = Math.round(tokenRadius / 3);
  const beamOrigin = {x: x + (Math.cos(rotRad) * beamOffset), y: y + (Math.sin(rotRad) * beamOffset)};
  const beamLength = length - beamOffset;

  const beam = rayBeam.configure({prefix: "rayBeam", origin: beamOrigin, rotation, length: beamLength,
    textures: textures.streak, spawnRadius, speed: BEAM_SPEED,
    duration: BEAM_DURATION, blend: PIXI.BLEND_MODES.ADD, position: 0, ...shared});
  const spillage = castoffFlare.configure({prefix: "castoffFlare", origin: beamOrigin, rotation, length: beamLength,
    textures: textures.spray, spawnRadius, speed: BEAM_SPEED,
    duration: BEAM_DURATION, blend: PIXI.BLEND_MODES.ADD, position: 0, ...shared});

  // Ground cascade: impact particles marching along the ray path
  const cascadeTextures = getVFXTexturePaths(action.rune.id, "impact");
  const cascade = linearCascade.configure({prefix: "rayCascade", origin, rotation, length,
    textures: cascadeTextures, width: width * 0.8, duration: CASCADE_DURATION,
    elevation: 0, position: 0, pointSourceMask: shared.pointSourceMask});

  const result = mergeAnimationBlocks(beam, spillage, cascade);
  Object.assign(result.references, references);

  // Impact timing: fire when the beam front arrives at the target.
  const gridScale = getParticleScaleFactor();
  const beamSpeed = BEAM_SPEED * gridScale;
  const gridSize = canvas.dimensions.size;
  const rayGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(cx - x, cy - y);
    return Math.round(dist / beamSpeed * 1000);
  };
  addImpactComponents(action, result.components, result.timeline, result.references,
    rayGetImpactPosition, textures.impact, origin);
  return result;
}

/* -------------------------------------------- */

/**
 * Finalize the VFX for a Ray gesture at play-time.
 * Delegates to the linearCascade block to inject marching spawn callbacks.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
function finalizeRayVFXEffect(action, vfxEffect, references) {
  linearCascade.finalize(vfxEffect, references);
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a Blast gesture composed spell.
 * Dispatches to a blast variant based on the desired visual style. Currently uses falling debris
 * (ice storm / hail) as the default. The implode-explode variant (crystal formation and detonation)
 * is available via {@link _configureBlastImplodeExplode}.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureBlastVFXEffect(action) {
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "circle") ) return null;

  const {x, y, radius} = shape;
  const origin = {x, y};
  const {runeColors, particleElevation, textures} = resolveSpellVFXContext(action);

  const MASK_RADIUS_FACTOR = 1.5;
  const references = {
    tokenMesh: "^token.object.mesh",

    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};
  const coverageArea = action.region?.area;
  const shared = {elevation: particleElevation, pointSourceMask, coverageArea};

  return _configureBlastFallingDebris(action, origin, radius, textures, references, shared);
}

/* -------------------------------------------- */

/**
 * Blast variant: implode-explode crystal. Particles converge inward, hold with shake, then
 * explode outward. Ground cracks and air residue follow the explosion.
 * @param {CrucibleSpellAction} action
 * @param {{x: number, y: number}} origin
 * @param {number} radius
 * @param {object} textures
 * @param {object} references
 * @param {object} shared
 * @returns {SpellVFXData}
 */
function _configureBlastImplodeExplode(action, origin, radius, textures, references, shared) {
  const EXPLODE_START = 1300;

  const blastTextures = [...textures.projectile, ...textures.spray];
  const blast = implodeExplode.configure({prefix: "blast", origin, radius, textures: blastTextures,
    position: 0, elevation: shared.elevation});

  const groundTextures = textures.residue.filter(t => t.includes("Blast") || t.includes("Cracks"));
  const ground = groundResidue.configure({prefix: "blastGround", origin,
    radius: Math.round(radius * 0.7), textures: groundTextures,
    position: EXPLODE_START, ...shared});

  const overheadTextures = textures.residue.filter(t => t.includes("Spray") || t.includes("Snow"));
  const overhead = airResidue.configure({prefix: "blastOverhead", origin,
    radius: Math.round(radius * 1.2), textures: overheadTextures,
    position: EXPLODE_START + 200, ...shared});

  const result = mergeAnimationBlocks(blast, ground, overhead);
  Object.assign(result.references, references);

  const explodeSpeed = blast.components.blast.config.implodeExplode.explodeSpeed;
  const gridSize = canvas.dimensions.size;
  const blastGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(origin.x - cx, origin.y - cy);
    return EXPLODE_START + Math.round(dist / explodeSpeed * 1000);
  };
  addImpactComponents(action, result.components, result.timeline, result.references,
    blastGetImpactPosition, textures.impact, origin);
  return result;
}

/* -------------------------------------------- */

/**
 * Blast variant: falling debris storm. Shards fall from overhead across the blast area,
 * accumulating ground cracks and a fog/cloud layer.
 * @param {CrucibleSpellAction} action
 * @param {{x: number, y: number}} origin
 * @param {number} radius
 * @param {object} textures
 * @param {object} references
 * @param {object} shared
 * @returns {SpellVFXData}
 */
function _configureBlastFallingDebris(action, origin, radius, textures, references, shared) {
  const STORM_DURATION = 4000;

  // Layer 1 - Falling shards
  const shards = fallingDebris.configure({prefix: "fallingShards", origin, radius,
    textures: textures.spray, duration: STORM_DURATION,
    position: 0, ...shared});

  // Layer 2 - Ground impacts: spawned in sync with falling debris landings via finalizer
  const groundTextures = textures.residue.filter(t => t.includes("Blast") || t.includes("Cracks"));
  const ground = groundImpacts.configure({prefix: "blastGround", origin, radius,
    textures: groundTextures, duration: STORM_DURATION + 2000,
    position: 0, ...shared, elevation: 0});

  // Layer 3 - Wintry blizzard haze
  const cloudTextures = textures.residue.filter(t => t.includes("Snow"));
  const clouds = airResidue.configure({prefix: "blastClouds", origin,
    radius: Math.round(radius * 1.3), textures: cloudTextures,
    duration: STORM_DURATION,
    position: 0, ...shared, elevation: shared.elevation + 1});

  const result = mergeAnimationBlocks(shards, ground, clouds);
  Object.assign(result.references, references);

  // Impact timing: stagger across the storm duration based on distance from center
  const gridSize = canvas.dimensions.size;
  const blastGetImpactPosition = token => {
    const cx = token.x + (token.width * gridSize / 2);
    const cy = token.y + (token.height * gridSize / 2);
    const dist = Math.hypot(origin.x - cx, origin.y - cy);
    const t = Math.clamp(dist / radius, 0, 1);
    return Math.round(t * STORM_DURATION * 0.5);
  };
  addImpactComponents(action, result.components, result.timeline, result.references,
    blastGetImpactPosition, textures.impact, origin);
  return result;
}

/* -------------------------------------------- */

/**
 * Finalize the VFX for a Blast gesture at play-time.
 * Delegates to animation block finalize hooks and injects falling debris callbacks.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
function finalizeBlastVFXEffect(action, vfxEffect, references) {
  implodeExplode.finalize(vfxEffect, references);
  fallingDebris.finalize(vfxEffect, references);

  // Wire up synchronized ground impacts: when a falling shard lands, spawn an impact at its position
  const debrisComp = vfxEffect.components.fallingShards;
  const impactComp = vfxEffect.components.blastGround;
  if ( debrisComp?.config?.fallingDebris && impactComp ) {
    const shared = {impactGenerator: null};

    // Capture the impacts generator reference on its first tick and switch to manual spawning
    const originalImpactTick = impactComp.config.onTick;
    impactComp.config.onTick = (dt, generator) => {
      shared.impactGenerator = generator;
      generator.manualSpawning = true;
      impactComp.config.onTick = originalImpactTick || null;
      if ( originalImpactTick ) originalImpactTick(dt, generator);
    };

    // Extend the debris onUpdate to spawn an impact when a shard lands
    const originalDebrisUpdate = debrisComp.config.onUpdate;
    debrisComp.config.onUpdate = (p, ctx) => {
      const wasLanded = p._landed;
      if ( originalDebrisUpdate ) originalDebrisUpdate(p, ctx);
      if ( !wasLanded && p._landed && shared.impactGenerator ) {
        const sceneX = p.x + ctx.generator.bounds.x;
        const sceneY = p.y + ctx.generator.bounds.y;
        shared.impactGenerator.spawnParticles(1, {position: {x: sceneX, y: sceneY}});
      }
    };
  }
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
 * Add singleImpact components to an in-progress spell VFX configuration for each struck target.
 * Only events with a HIT or GLANCE result produce an impact. Other results are silently skipped.
 * Each impact is positioned at the target token mesh with a small random offset toward the token
 * center. The impact sprite is rotated to face the effect origin.
 * @param {CrucibleSpellAction} action       The spell action being animated.
 * @param {object} components                Component map to add impact entries into.
 * @param {object[]} timeline                Timeline array to push impact entries onto.
 * @param {Record<string, string>} references  References map to register token UUIDs into.
 * @param {function(CrucibleToken): number} getImpactPosition
 *   A function that receives the target token and returns the timeline position (ms) at which
 *   its impact should fire. Called once per HIT/GLANCE target.
 * @param {string[]} impactTextures          An array of #-prefixed scene texture paths for impact
 *                                           sprites. One is chosen at random per target.
 * @param {{x: number, y: number}} origin    The effect origin point. Impact sprites are rotated
 *                                           to face this point.
 */
function addImpactComponents(action, components, timeline, references, getImpactPosition, impactTextures, origin) {
  const useSpritesheetImpact = impactTextures.length > 0;
  const gridSize = canvas.dimensions.size;
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
      const w = token.width * gridSize;
      const h = token.height * gridSize;
      const dx = Math.mix(-w * 0.1, w * 0.1, Math.random());
      const dy = Math.mix(-h * 0.1, h * 0.1, Math.random());
      const impactName = `spellImpact_${j}`;
      const texture = useSpritesheetImpact
        ? impactTextures[Math.floor(Math.random() * impactTextures.length)]
        : getRandomSprite("impacts", "blood");
      components[impactName] = {
        type: "singleImpact",
        position: {reference: targetMeshRef, deltas: {x: dx, y: dy, sort: 1}},
        origin,
        texture,
        duration: 1000,
        size: 2
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
  blast: {configure: configureBlastVFXEffect, finalize: finalizeBlastVFXEffect},
  cone: {},
  conjure: {},
  create: {},
  fan: {configure: configureFanVFXEffect, finalize: finalizeFanVFXEffect},
  influence: {},
  pulse: {},
  ray: {configure: configureRayVFXEffect, finalize: finalizeRayVFXEffect},
  sense: {},
  step: {},
  strike: {},
  surge: {},
  touch: {},
  ward: {}
};
