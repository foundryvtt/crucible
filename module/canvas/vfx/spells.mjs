import {getRandomSprite, getVFXTexturePaths, getVFXTexturePath, getVFXFrames} from "./sprites.mjs";
import {mergeAnimationBlocks, coneSweepEmitter, expandingCascade,
  airResidue, groundImpacts, fallingDebris, getParticleScaleFactor} from "./blocks.mjs";
import {computeAttackOffset, pickRandom, tokenCenter} from "./helpers.mjs";
import {getVFXSound} from "./sounds.mjs";

/**
 * @typedef SpellVFXData
 * @property {Record<string, object>} components   VFXEffect component definitions keyed by component name.
 * @property {object[]} timeline                   VFXEffect timeline entries.
 * @property {Record<string, string>} references   Named reference strings for playVFXEffect resolution.
 */

/**
 * Resolved context shared across all components within a single spell VFX configuration.
 * @typedef SpellVFXContext
 * @property {number} particleElevation   Elevation at which particle containers render.
 * @property {SpellVFXTextures} textures   Resolved texture paths for the action's rune.
 */

/**
 * Per-rune texture path arrays for each particle category, resolved from VFX_TEXTURES.
 * Each array contains #-prefixed scene texture paths. Arrays may be empty if no art exists
 * for that rune/category; the fallback white particle is used in that case.
 * @typedef SpellVFXTextures
 * @property {string[]} air          Foreground atmospheric residue drifting overhead (haze, mist).
 * @property {string[]} falling      Top-down sprites for elevation drops (e.g., hail, blast debris from above).
 * @property {string[]} ground       Background debris residue settling underfoot (marks, cracks).
 * @property {string[]} impact       Impact burst textures for singleImpact components.
 * @property {string[]} projectile   Side-view directional sprites for x/y travel (e.g., arrow shafts).
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
 * Configure the VFX for an Arrow gesture composed spell.
 * Arrow has `target.type: "single"` and no region shape, so the trajectory is computed from the
 * caster and target token centers. Per-rune visual overrides come from {@link ARROW_VFX_PROPS}.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureArrowVFXEffect(action) {
  if ( action.target.type !== "single" ) return null;
  const {textures, particleElevation} = resolveSpellVFXContext(action);
  const components = {};
  const timeline = [];
  const references = {tokenMesh: "^token.object.mesh"};

  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const gridSize = canvas.dimensions.size;
  const casterToken = action.token;
  const {x: casterCenterX, y: casterCenterY} = tokenCenter(casterToken);
  const casterRadiusPx = (casterToken.width * gridSize) / 2;
  const casterElevation = casterToken.elevation ?? 0;
  const casterMeshSort = casterToken.object?.mesh?.sort ?? 0;

  const runeProps = SPELL_VFX_GESTURES.arrow.runes?.[action.rune.id] ?? {};
  const CHARGE_DURATION = runeProps.chargeDuration ?? 700;
  const chargeTail = runeProps.chargeTail ?? 200; // Ms the charge particles keep emitting past the projectile-release label
  const CHARGE_EMIT_DURATION = CHARGE_DURATION + chargeTail;

  // Resolve sounds once; the component plays each on its phase. Variant choice is baked here so all
  // clients hear the same sequence. align START fires each sound at its phase start.
  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1} : null;
  const chargeSound = sound(getVFXSound(action.rune.id, "charge"));
  // Whoosh on launch; runes may pick a longer cue or opt out (whoosh: null) for a silent drift.
  const whooshKey = ("whoosh" in runeProps) ? runeProps.whoosh : "whooshFast";
  const whooshSound = whooshKey ? sound(getVFXSound("generic", whooshKey)) : null;

  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const roll = group.roll[0]?.roll;
    const result = roll?.data.result;
    if ( !result ) continue;

    const targetTokenRef = `target_${j}_token`;
    const targetMeshRef = `target_${j}_tokenMesh`;
    Object.assign(references, {
      [targetTokenRef]: `@${token.uuid}`,
      [targetMeshRef]: `^${targetTokenRef}.object.mesh`
    });

    // Manifest point: one caster radius forward toward the target, so the projectile materializes
    // in front of the caster rather than at their center.
    const {x: tcx, y: tcy} = tokenCenter(token);
    const dirDist = Math.max(1, Math.hypot(tcx - casterCenterX, tcy - casterCenterY));
    const manifestX = casterCenterX + (((tcx - casterCenterX) / dirDist) * casterRadiusPx);
    const manifestY = casterCenterY + (((tcy - casterCenterY) / dirDist) * casterRadiusPx);
    const offset = computeAttackOffset(token, result);

    // Register the manifest point as a reference. Every element of a VFXReferenceObjectField array
    // must be a reference: resolveReferences builds a partial array update of only the resolved
    // (reference) elements, so a literal sibling would be dropped to a hole by updateSource.
    const manifestRef = `arrow_${j}_manifest`;
    references[manifestRef] = {x: manifestX, y: manifestY, elevation: casterElevation,
      sort: casterMeshSort + 1, sortLayer: SL.TOKENS};

    const isHit = (result === T.HIT) || (result === T.GLANCE);
    const stickDuration = (isHit && runeProps.stickDuration) ? runeProps.stickDuration : 0;
    let impactSound = null;
    const impactAnimations = [];
    const impactParticles = [];
    if ( isHit ) {
      impactSound = sound(getVFXSound(action.rune.id, "impact"));
      if ( runeProps.impactSprite !== false ) {
        const burstTexture = pickRandom(textures.impact) ?? getRandomSprite("impacts", "blood");
        impactAnimations.push({function: "impactSpriteBurst", // Match the burst to the stick so both exit together
          params: {texture: burstTexture, size: 3, duration: stickDuration || 1000}});
      }
      if ( runeProps.recoil !== false ) {
        impactAnimations.push(roll?.isCriticalSuccess
          ? {function: "impactSpriteShake", params: {distance: Math.round(gridSize * 0.3), oscillations: 3, duration: 480}}
          : {function: "impactSpriteRecoil", params: {distance: Math.round(gridSize * 0.15), duration: 320}});
      }
      // Optional impact particle pop, e.g. a shower of leaves and bubbles for life. The rune declares
      // the frame prefixes; if they don't resolve to assets ParticleGenerator surfaces a warning.
      if ( runeProps.impactSpray ) {
        impactParticles.push({
          animation: "circleParticleBurst", anchor: "destination", duration: 200,
          textures: getVFXFrames(action.rune.id, ...runeProps.impactSpray.frames),
          params: {radius: Math.round(gridSize * 0.12), speed: {min: 70, max: 210}, count: 50, initial: 1,
            lifetime: {min: 650, max: 1100}, alpha: {min: 0.6, max: 1.0}, scale: {min: 0.5, max: 1.1},
            elevation: (token.elevation ?? 0) + 1, ...runeProps.impactSpray.params}
        });
      }
    }
    else {
      impactSound = sound(getVFXSound(action.rune.id, "miss"));
      // A resisted spell fizzles: a dissipating puff, no flash
      if ( (result === T.RESIST) && (runeProps.impactSprite !== false) ) {
        impactAnimations.push({function: "impactSpriteBurst",
          params: {texture: pickRandom(textures.air), size: 4, duration: 1500, flash: false}});
      }
    }

    // Charge particles: rune-driven charge layers + optional smoke + lingering residue, all from
    // runeProps via _resolveChargeLayers.
    const chargeParticles = _resolveChargeLayers(runeProps,
      {textures, casterRadiusPx, casterElevation, particleElevation},
      {duration: CHARGE_EMIT_DURATION});

    // Optional per-rune flight trail (follows the projectile). `trail` is `true` for the default
    // directional streaks, or {frames|categories, params} to customize the textures and behavior.
    const projectileParticles = [];
    if ( runeProps.trail ) {
      const trail = runeProps.trail;
      const trailTextures = trail.frames ? getVFXFrames(action.rune.id, ...trail.frames)
        : (trail.categories ? trail.categories.flatMap(c => textures[c]) : textures.streak);
      projectileParticles.push({
        animation: "projectileParticleTrail", anchor: "delivery", textures: trailTextures,
        params: {align: true, flipX: true, lifetime: 250, spawnRate: 240,
          alpha: {min: 0.4, max: 0.8}, scale: {min: 0.3, max: 0.6},
          blend: PIXI.BLEND_MODES.ADD, elevation: casterElevation + 1, ...(trail.params ?? {})}
      });
    }

    components[`arrow_${j}`] = {
      type: "crucibleProjectile",
      path: [
        {reference: manifestRef, deltas: {}},
        {reference: targetMeshRef, deltas: {x: offset.x, y: offset.y, sort: 1}}
      ],
      pathType: runeProps.path ?? {type: "linear", params: {}},
      charge: {duration: CHARGE_DURATION, sound: chargeSound,
        animations: [{function: "chargeProjectileFadeIn"}], particles: chargeParticles},
      delivery: {
        texture: runeProps.projectileFrame
          ? getVFXTexturePath(runeProps.projectileFrame)
          : (pickRandom(textures.projectile) ?? getRandomSprite("projectiles", "arrow")),
        size: runeProps.projectileSize ?? 3, speed: runeProps.projectileSpeed ?? 150, sound: whooshSound,
        animations: [{function: "deliveryProjectileFlight"}], particles: projectileParticles},
      impacts: [{
        result, id: token.id, stick: stickDuration,
        sound: impactSound, animations: impactAnimations, particles: impactParticles
      }]
    };
    timeline.push({component: `arrow_${j}`, position: 0});
    j++;
  }

  if ( !timeline.length ) return null;
  return {components, timeline, references};
}

/* -------------------------------------------- */

/**
 * Enact final runtime configurations of an arrow animation before it is played.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
function finalizeArrowVFXEffect(action, vfxEffect, references) {
  for ( const [name, component] of Object.entries(vfxEffect.components) ) {
    const match = name.match(/^arrow_(\d+)$/);
    if ( !match ) continue;
    component._originMesh = references.tokenMesh ?? null;
    component._targetMeshes = [references[`target_${match[1]}_tokenMesh`] ?? null];
  }
}

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

  const {x, y, radius, angle, rotation} = shape.toObject();
  const origin = {x, y};
  const {particleElevation, textures} = resolveSpellVFXContext(action);
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
  const residue = airResidue.configure({prefix: "fanResidue", origin,
    radius: Math.round(radius * 0.7), textures: textures.air,
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
 * Configure the VFX for a Ray gesture composed spell as a single {@link CrucibleRayComponent}: a charge
 * at the source, a delivery along the line region, and per-target impacts. The charge and delivery looks
 * are rune-specific: the frost ray fires a fast beam with impacts staggered as the front passes each
 * target; the fire ray builds a slow flame line that erupts when it reaches the end, striking all
 * targets simultaneously.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureRayVFXEffect(action) {
  const regionShape = action.region?.shapes[0];
  if ( !regionShape || (regionShape.type !== "line") ) return null;
  const runeProps = SPELL_VFX_GESTURES.ray.runes?.[action.rune.id];
  if ( !runeProps ) return null; // No ray-gesture config for this rune; skip VFX
  const {textures} = resolveSpellVFXContext(action);
  // Snapshot the region shape into the persisted component data. The action.region document is deleted
  // on action confirmation, so the VFXEffect must carry its own geometry; cf. {@link CrucibleProjectileComponent}'s
  // persisted `path` for the analogous case.
  const shapeData = regionShape.toObject();
  const {x, y, length, width, rotation} = shapeData;
  const rotRad = Math.toRadians(rotation);
  const gridSize = canvas.dimensions.size;
  const casterToken = action.token;
  const casterElevation = casterToken.elevation ?? 0;
  const beamElevation = casterElevation + 1;
  const casterRadiusPx = (casterToken.width * gridSize) / 2;
  const chargeDistance = casterRadiusPx;       // Half the caster token width: pulls the charge to the token's front edge
  const beamLength = length - chargeDistance;  // Effective beam reach from the charge point to the shape's end
  const spawnRadius = Math.max(8, width / 2);
  const CHARGE_DURATION = 700;

  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1} : null;

  // References resolved at play-time: the caster's mesh (backs the `source` anchor) and a move-polygon
  // mask for wall-aware particles. The shape itself is persisted directly on the component.
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(length * 1.5)}
  };

  // Per-target impacts (rune-driven visuals + configurator-baked timing). Each impact carries the
  // target's mesh reference + result + sound + animations + particles + `start` ms baked from the
  // rune's impactTiming strategy. The component just reads impact.start.
  const impactType = runeProps.impactSound ?? "impact";
  const hitTreatment = _resolveRayHitTreatment(action, {textures, beamElevation}, runeProps);
  const timingFn = RAY_IMPACT_TIMINGS[runeProps.impactTiming] ?? RAY_IMPACT_TIMINGS.beamFront;
  // Charge-point origin used by impact timing: shape origin shifted forward by chargeDistance, parallel
  // to what the component derives in _draw - so beam-front math agrees with the visual emission point.
  const chargeOrigin = {x: x + (Math.cos(rotRad) * chargeDistance), y: y + (Math.sin(rotRad) * chargeDistance)};
  const timingCtx = {origin: chargeOrigin, beamSpeed: runeProps.beamSpeed,
    gridScale: getParticleScaleFactor(), deliveryStart: CHARGE_DURATION,
    deliveryDuration: runeProps.deliveryDuration};
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const impacts = [];
  const targetMeshRefs = [];
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const result = group.roll[0]?.roll?.data.result ?? null;
    const isHit = (result === T.HIT) || (result === T.GLANCE);
    const tokenRef = `rayTarget_${j}_token`;
    const meshRef = `rayTarget_${j}_tokenMesh`;
    references[tokenRef] = `@${token.uuid}`;
    references[meshRef] = `^${tokenRef}.object.mesh`;
    targetMeshRefs.push({reference: meshRef});
    const start = timingFn(tokenCenter(token), timingCtx);

    impacts.push(isHit
      ? {result, id: token.id, start, sound: sound(getVFXSound(action.rune.id, impactType)),
        animations: hitTreatment.animations, particles: hitTreatment.particles}
      : {
        // Resisting target: a softer, flashless dissipating puff and a distinct sound
        result, id: token.id, start, sound: sound(getVFXSound(action.rune.id, "miss")),
        animations: textures.air.length
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}]
          : [],
        particles: []
      });
    j++;
  }
  if ( !impacts.length ) return null;

  // Dispatch via SPELL_VFX_GESTURES.ray.runes - the interpreter handles charge + sustained charge + delivery
  // sound + the rune's buildDelivery(ctx) layer composition.
  const buildContext = {textures, beamLength, beamElevation, spawnRadius, width, casterRadiusPx,
    casterElevation, CHARGE_DURATION, action, sound};
  const {chargeParticles, delivery} = _buildRayChargeAndDelivery(action, buildContext);

  const components = {
    ray: {
      type: "crucibleRay",
      shape: shapeData,
      originMesh: {reference: "tokenMesh"},
      targetMeshes: targetMeshRefs,
      mask: {reference: "wallMask"},
      charge: {duration: CHARGE_DURATION, distance: chargeDistance,
        sound: sound(getVFXSound(action.rune.id, "charge")),
        animations: [], particles: chargeParticles},
      delivery,
      impacts
    }
  };
  return {components, timeline: [{component: "ray", position: 0}], references};
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a Blast gesture composed spell. Currently dispatches to the falling-debris
 * variant (ice storm / hail) regardless of rune.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureBlastVFXEffect(action) {
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "circle") ) return null;

  const shapeSource = shape.toObject();
  const {x, y, radius} = shapeSource;
  const origin = {x, y};
  const {particleElevation, textures} = resolveSpellVFXContext(action);

  const MASK_RADIUS_FACTOR = 1.5;
  const references = {
    tokenMesh: "^token.object.mesh",

    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };
  const pointSourceMask = {reference: "wallMask"};
  const coverageArea = action.region?.area;
  const shared = {elevation: particleElevation, pointSourceMask, coverageArea};

  return _configureBlastFallingDebris(action, shapeSource, origin, radius, textures, references, shared);
}

/* -------------------------------------------- */

/**
 * Blast variant: falling debris storm. Shards fall from overhead across the blast area,
 * accumulating ground cracks and a fog/cloud layer.
 * The blast region's circle shape source data drives both the visible region and the spawn
 * areas of the falling debris and ground impact generators - one source of truth.
 * @param {CrucibleSpellAction} action
 * @param {object} regionShape   Region shape source data (CircleShapeData.toObject()).
 * @param {{x: number, y: number}} origin
 * @param {number} radius
 * @param {object} textures
 * @param {object} references
 * @param {object} shared
 * @returns {SpellVFXData}
 */
function _configureBlastFallingDebris(action, regionShape, origin, radius, textures, references, shared) {
  const STORM_DURATION = 4000;

  // Layer 1 - Falling shards across the full region circle
  const shards = fallingDebris.configure({prefix: "fallingShards", origin, radius,
    area: regionShape, textures: textures.spray, duration: STORM_DURATION,
    position: 0, ...shared});

  // Layer 2 - Ground impacts spawned in sync with falling debris landings via finalizer
  const ground = groundImpacts.configure({prefix: "blastGround", origin, radius,
    area: regionShape, textures: textures.ground, duration: STORM_DURATION + 2000,
    position: 0, ...shared, elevation: 0});

  // Layer 3 - Wintry blizzard haze
  const clouds = airResidue.configure({prefix: "blastClouds", origin,
    radius: Math.round(radius * 1.3), textures: textures.air,
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

  // PLACEHOLDER - blast sound, not yet wired. Two gaps to resolve with the team before this works
  // as positionalSound components:
  //  - Sustained damage loop (S3) wants a looping positionalSound, but core positionalSound is
  //    one-shot. Needs an upstream loop option or a Crucible component subclass.
  //  - Per-shard impacts are spawned at play time by the groundImpacts finalizer, so they cannot be
  //    enumerated as static components at configure time. Either precompute deterministic landing
  //    cues, or add a play-time component-spawn hook the finalizer can call.
  // See configureArrowVFXEffect for the fully-declarative positionalSound pattern.
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
 * Extracts the particle elevation and per-category texture paths, identical across every component.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXContext}
 */
function resolveSpellVFXContext(action) {
  const runeId = action.rune.id;
  return {
    particleElevation: action.region?.elevation.top ?? 0,
    textures: {
      air: getVFXTexturePaths(runeId, "air"),
      falling: getVFXTexturePaths(runeId, "falling"),
      ground: getVFXTexturePaths(runeId, "ground"),
      impact: getVFXTexturePaths(runeId, "impact"),
      projectile: getVFXTexturePaths(runeId, "projectile"),
      spray: getVFXTexturePaths(runeId, "spray"),
      streak: getVFXTexturePaths(runeId, "streak")
    }
  };
}

/* -------------------------------------------- */

/**
 * Resolve the full set of charge particle layers for a rune from its per-gesture props entry. Produces:
 * (1) the explicit `chargeLayers` array (each with per-layer categories/radius/elevation/material) OR
 * a single default spray-anchored layer; (2) an optional atmospheric smoke layer (suppressed when
 * runeProps.smoke is false); (3) an optional lingering residue layer (suppressed when
 * runeProps.residue is false). Same shape works for arrow-style charges and ray-style sustained
 * channels - the caller picks the anchor and emission duration.
 * @param {object} runeProps     Per-rune VFX overrides (see ARROW_VFX_PROPS / RAY_VFX_PROPS).
 * @param {object} ctx           Resolution context.
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.casterRadiusPx
 * @param {number} ctx.casterElevation
 * @param {number} [ctx.particleElevation]  Defaults to casterElevation when omitted.
 * @param {object} opts
 * @param {string} [opts.anchor]  Layer anchor override (defaults to runeProps.chargeAnchor ?? "origin").
 * @param {number} opts.duration  Emission duration (ms) for each layer.
 * @returns {object[]}
 */
function _resolveChargeLayers(runeProps, ctx, {anchor, duration}) {
  const {textures, casterRadiusPx, casterElevation, particleElevation = casterElevation} = ctx;
  const behavior = runeProps.chargeBehavior ?? "circleParticleGather";
  const a = anchor ?? runeProps.chargeAnchor ?? "origin";
  const elevationFor = above => above ? (casterElevation + 1)
    : ((a === "source") ? casterElevation : particleElevation);
  const chargeElevation = elevationFor(runeProps.chargeAbove);
  const residueElevation = runeProps.residueUnder ? casterElevation : (casterElevation + 1);
  const layers = [];

  // Primary charge content: explicit chargeLayers (each declaring its texture categories) or a single
  // default spray-mote layer. Categories are declared by the rune - if the asset set is missing them,
  // ParticleGenerator surfaces a console warning at runtime.
  if ( runeProps.chargeLayers ) {
    for ( const layer of runeProps.chargeLayers ) {
      layers.push({
        animation: behavior, anchor: a, textures: layer.categories.flatMap(c => textures[c]), duration,
        params: {chargeRadius: casterRadiusPx * (layer.radiusFactor ?? 2.0),
          elevation: elevationFor(layer.above), ...layer.params}
      });
    }
  }
  else {
    layers.push({
      animation: behavior, anchor: a, textures: textures.spray, duration,
      params: {chargeRadius: casterRadiusPx * 2.0, lifetime: 350, spawnRate: 480,
        elevation: chargeElevation, ...runeProps.sprayParams}
    });
  }

  // Optional atmospheric smoke + lingering residue. Runes opt out with `smoke: false` / `residue: false`;
  // there is no defensive guard on textures.air - if a rune wants smoke/residue, it must ship air assets.
  if ( runeProps.smoke !== false ) layers.push({
    animation: behavior, anchor: a, textures: textures.air, duration,
    params: {chargeRadius: casterRadiusPx * 2.5, lifetime: 500, spawnRate: 60,
      alpha: {min: 0.3, max: 0.6}, scale: {min: 0.7, max: 1.2}, elevation: chargeElevation}
  });
  if ( runeProps.residue !== false ) layers.push({
    animation: "circleParticleResidue", anchor: a, textures: textures.air,
    offset: runeProps.residueOffset ?? 0, duration: runeProps.residueDuration ?? 300,
    params: {radius: Math.round(casterRadiusPx * 1.5), lifetime: {min: 1500, max: 2200},
      spawnRate: 120, count: 30, initial: 0.3, alpha: {min: 0.05, max: 0.18},
      elevation: residueElevation, ...runeProps.residueParams}
  });

  return layers;
}

/* -------------------------------------------- */

/**
 * Resolve the looping damage sound for a ray (or other sustained-delivery) builder. Returns a sound
 * descriptor with `loop: true` plus the provided envelope params (fade/offset/release), or null if no
 * sound exists for the rune.
 * @param {object} ctx              Builder context.
 * @param {CrucibleSpellAction} ctx.action
 * @param {function} ctx.sound      The sound-descriptor builder closure used by the configurator.
 * @param {object} params           Envelope params (fade, offset, release).
 * @returns {object|null}
 */
function _resolveDeliverySound(ctx, params) {
  const {action, sound} = ctx;
  const descriptor = sound(getVFXSound(action.rune.id, "damage"));
  if ( descriptor ) Object.assign(descriptor, {loop: true, ...params});
  return descriptor;
}

/* -------------------------------------------- */

/**
 * Resolve the per-target hit treatment for a ray (animations + particles to apply at each struck
 * target). The treatment is computed once and reused across all hit targets. Runes with `softImpact`
 * (e.g. life) skip the recoil + flash burst (a gentle restorative arrival rather than a strike) and
 * emit a particle spray from `softImpactFrames`; the default treatment is recoil + impact-sprite
 * burst + a small rune-spray. New per-rune impact styles go in RAY_VFX_PROPS.{rune}, not here.
 * @param {CrucibleSpellAction} action
 * @param {object} ctx
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.beamElevation
 * @param {object} runeProps  Per-rune RAY_VFX_PROPS entry.
 * @returns {{animations: object[], particles: object[]}}
 */
function _resolveRayHitTreatment(action, ctx, runeProps) {
  const {textures, beamElevation} = ctx;
  const gridSize = canvas.dimensions.size;
  if ( runeProps?.softImpact ) {
    const sprayTextures = getVFXFrames(action.rune.id, ...(runeProps.softImpactFrames ?? ["SprayLeaf"]));
    return {
      animations: [],
      particles: [{
        animation: "circleParticleBurst", anchor: "target", textures: sprayTextures, duration: 200,
        params: {radius: Math.round(gridSize * 0.12), speed: {min: 70, max: 210}, count: 50, initial: 1,
          lifetime: {min: 650, max: 1100}, alpha: {min: 0.6, max: 1.0}, scale: {min: 0.5, max: 1.1},
          elevation: beamElevation}
      }]
    };
  }
  return {
    animations: [
      {function: "impactSpriteRecoil", params: {distance: 12, duration: 320}},
      {function: "impactSpriteBurst",
        params: {texture: pickRandom(textures.impact), size: 2, duration: 800, flash: true}}
    ],
    particles: [{
      animation: "circleParticleBurst", anchor: "target", textures: textures.spray, duration: 200,
      params: {radius: Math.round(gridSize * 0.1), speed: {min: 50, max: 150}, count: 24, initial: 1,
        lifetime: {min: 400, max: 800}, alpha: {min: 0.4, max: 0.9}, scale: {min: 0.4, max: 0.9},
        elevation: beamElevation}
    }]
  };
}

/* -------------------------------------------- */

/**
 * Build the charge particles + delivery configuration for a ray, dispatching entirely through
 * RAY_VFX_PROPS[runeId]: charge layers (from the rune's chargeXxx fields via {@link
 * _resolveChargeLayers}), an optional sustained-charge layer set in delivery (when the rune sets
 * `sustainedChargeAnchor`), the looping delivery sound, and the rune's `buildDelivery(ctx)` returning
 * the layered particle composition.
 * @param {CrucibleSpellAction} action
 * @param {object} ctx  Builder context produced by configureRayVFXEffect.
 * @returns {{chargeParticles: object[], delivery: object}|null}
 */
function _buildRayChargeAndDelivery(action, ctx) {
  const runeProps = SPELL_VFX_GESTURES.ray.runes?.[action.rune.id];
  if ( !runeProps ) return null;
  const chargeCtx = {textures: ctx.textures, casterRadiusPx: ctx.casterRadiusPx,
    casterElevation: ctx.casterElevation, particleElevation: ctx.beamElevation};
  const chargeEmitDuration = ctx.CHARGE_DURATION + (runeProps.chargeTail ?? 0);
  const chargeParticles = _resolveChargeLayers(runeProps, chargeCtx,
    {anchor: runeProps.chargeAnchor, duration: chargeEmitDuration});
  const sustainedLayers = runeProps.sustainedChargeAnchor
    ? _resolveChargeLayers(runeProps, chargeCtx,
      {anchor: runeProps.sustainedChargeAnchor, duration: runeProps.deliveryDuration})
    : [];
  const deliverySound = _resolveDeliverySound(ctx, runeProps.deliverySound);
  const deliveryLayers = runeProps.buildDelivery(ctx);
  return {
    chargeParticles,
    delivery: {
      duration: runeProps.deliveryDuration,
      sound: deliverySound,
      animations: [],
      particles: [...sustainedLayers, ...deliveryLayers]
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
/*  Per-Rune VFX Properties                     */
/* -------------------------------------------- */

/* Shared charge configurations factored out to keep arrow + ray entries DRY when they share a charge
 * visual (e.g. fire arrow and fire ray both use the vortex-above + dark-smoke-below charge). */

const _CHARGE_FLAME = {
  chargeBehavior: "circleParticleVortex", chargeAnchor: "source",
  chargeAbove: true, chargeTail: -100, smoke: false,
  sprayParams: {spawnRate: 560, spawnRateEnd: 160, scale: {min: 1.25, max: 2.0},
    alpha: {min: 0.4, max: 0.9}},
  residueUnder: true, residueOffset: 350, residueDuration: 300,
  residueParams: {spawnRate: 70, count: null, initial: 0.2, lifetime: {min: 500, max: 800},
    alpha: {min: 0.2, max: 0.45}, scale: {min: 0.7, max: 1.2}, tint: 0x6B5A48,
    blend: PIXI.BLEND_MODES.NORMAL, fade: {in: 0.2, out: 0.4}}
};

const _CHARGE_LIFE = {
  chargeBehavior: "circleParticleBloom", chargeAnchor: "source", smoke: false, residue: false,
  chargeLayers: [
    {categories: ["ground"], above: false, radiusFactor: 3.0,
      params: {lifetime: {min: 900, max: 1500}, spawnRate: 10, scale: {min: 0.5, max: 1.0}}},
    {categories: ["spray"], above: true, radiusFactor: 1.6,
      params: {lifetime: {min: 900, max: 1500}, spawnRate: 110, scale: {min: 0.5, max: 1.0}}}
  ]
};

/**
 * Per-rune VFX overrides for the Arrow gesture.
 *
 * Projectile:
 * - `projectileSize` (number): override the projectile sprite size in feet (default 3).
 * - `projectileFrame` (string): a specific projectile texture frame (e.g. "life/ProjectileBubble");
 *   defaults to a random `projectile`-category texture.
 * - `projectileSpeed` (number): flight speed in feet/sec (default 150).
 * - `path` ({type, params}): a `CONFIG.Canvas.vfx.paths` generator for the flight trajectory
 *   (default linear); e.g. `{type: "weave", params: {arcCount, amplitude}}` for a serpentine bolt.
 * - `whoosh` (string|null): generic launch-whoosh sound key (default "whooshFast"); null for silence.
 * - `trail` (boolean|{frames|categories, params}): emit a particle trail behind the projectile;
 *   `true` uses directional streak textures, or pass texture frames/categories + behavior params.
 *
 * Charge phase (shape shared with Ray gesture, see {@link _resolveChargeLayers}):
 * - `chargeDuration` (number): charge phase length in ms (default 700).
 * - `chargeBehavior` (string): registered charge-phase particle behavior (default
 *   `circleParticleGather`); e.g. `circleParticleVortex`, `circleParticleBloom`.
 * - `chargeAnchor` (string): `origin` (the forward manifest point, default) or `source`
 *   (the launching token center).
 * - `chargeAbove` (boolean): draw the charge particles above the token rather than at ground level.
 * - `chargeLayers` ([{categories, above, radiusFactor, params}]): replaces the single default spray
 *   layer with explicit layers, each with its own elevation, radius, and material params.
 * - `chargeTail` (number): ms the charge particles keep emitting past the projectile-release label
 *   (default 200; negative ends emission before release).
 * - `smoke` (boolean): emit the soft atmospheric (air) smoke layer during charge (default true).
 * - `sprayParams` (object): per-layer material overrides for the default spray (mote) charge layer.
 * - `residue` (boolean): emit the lingering atmospheric residue after the charge (default true).
 * - `residueUnder` (boolean): draw the residue beneath the caster token rather than overhead.
 * - `residueOffset` / `residueDuration` (number): ms the residue waits / emits (defaults 0 / 300).
 * - `residueParams` (object): residue material overrides (alpha, scale, tint, blend, lifetime, fade,
 *   spawnRate, count, ...); pass `blend: PIXI.BLEND_MODES.NORMAL` + dark tint for sooty smoke.
 *
 * Impact:
 * - `stickDuration` (number): ms the projectile sprite stays at the impact location after a
 *   HIT/GLANCE before fading. Omit or 0 for no stick.
 * - `impactSprite` (boolean): show the impact burst sprite on a hit (default true).
 * - `recoil` (boolean): rock/shake the struck token on a hit (default true).
 * - `impactSpray` ({frames, params}): an impact particle pop from the named frames (e.g. SprayLeaf,
 *   SprayBubble) with optional material overrides.
 *
 * @type {Record<string, object>}
 */
const ARROW_VFX_PROPS = {
  frost: {stickDuration: 1500, projectileSize: 2, trail: true},
  // Life is slow and gentle: a lazy bloom of growth around the caster, a drifting bubble, and a
  // soothing leaf/bubble shower on impact. No stick, recoil, impact sprite, whoosh, or trail.
  life: {
    ..._CHARGE_LIFE,
    projectileSize: 3, projectileFrame: "life/ProjectileBubble", projectileSpeed: 30,
    whoosh: null, chargeDuration: 1500, impactSprite: false, recoil: false,
    // A lazy bubble trail: slow, long-lived SprayBubble motes drifting behind the projectile.
    trail: {frames: ["SprayBubble"], params: {align: false, speed: {min: 2, max: 12},
      lifetime: {min: 800, max: 1400}, spawnRate: 40, scale: {min: 0.4, max: 0.9},
      alpha: {min: 0.4, max: 0.85}, blend: PIXI.BLEND_MODES.NORMAL}},
    impactSpray: {frames: ["SprayLeaf", "SprayBubble"]}
  },
  flame: {
    ..._CHARGE_FLAME,
    projectileSize: 3, trail: true,
    path: {type: "weave", params: {arcCount: 2, amplitude: 0.1}}
  }
};

/* -------------------------------------------- */

/**
 * Per-target impact timing strategies for Ray spells. Each function returns an absolute timeline ms
 * for a single impact. Strategies are referenced by name from a rune's `impactTiming` field; the
 * configurator dispatches via {@link RAY_IMPACT_TIMINGS} and bakes the result into each impact entry's
 * `start` field, so the runtime CrucibleRayComponent has no timing policy of its own.
 * @type {Record<string, (target: {x: number, y: number}, ctx: object) => number>}
 */
const RAY_IMPACT_TIMINGS = {
  beamFront(target, {origin, beamSpeed, gridScale, deliveryStart}) {
    const dist = Math.hypot(target.x - origin.x, target.y - origin.y);
    return deliveryStart + ((dist / (beamSpeed * gridScale)) * 1000);
  },
  atEnd(target, {deliveryStart, deliveryDuration}) {
    return deliveryStart + deliveryDuration;
  }
};

/* -------------------------------------------- */

/**
 * Per-rune VFX overrides for the Ray gesture. Each rune defines its own delivery composition via
 * `buildDelivery(ctx)`; the charge phase uses the same chargeXxx / sprayParams / residueXxx / smoke
 * fields documented on {@link ARROW_VFX_PROPS}.
 *
 * Delivery:
 * - `beamSpeed` (number): px/sec base for `beamFront` impact timing and (often) particle velocity.
 *   Configurator-side value; not on the persisted ray-component schema.
 * - `deliveryDuration` (number): ms the delivery phase emits.
 * - `deliverySound` ({fade, offset, release}): looping damage-sound envelope for the delivery phase.
 * - `sustainedChargeAnchor` (string): if set, duplicate the charge layers into the delivery phase at
 *   this anchor (e.g. life ray "channels" the charge across the full delivery).
 * - `buildDelivery(ctx)` (function): rune-specific delivery layer composition. Receives the builder
 *   context and returns an array of particle-layer configs for `delivery.particles`.
 *
 * Impact:
 * - `impactTiming` (string): named strategy from {@link RAY_IMPACT_TIMINGS} that computes per-target
 *   impact start times (e.g. `"beamFront"` for staggered, `"atEnd"` for simultaneous-at-completion).
 * - `impactSound` (string): per-target impact sound type (default "impact"); "impactHeavy" for
 *   runes like fire whose impacts should hit harder.
 * - `softImpact` (boolean): if true, skip recoil + flash-burst at the target and just emit a
 *   particle spray (gentle restorative arrival, used by life).
 * - `softImpactFrames` (string[]): frame prefixes for the softImpact spray textures.
 *
 * @type {Record<string, object>}
 */
const RAY_VFX_PROPS = {
  // Frost ray: a generic source gather charge plus a fast, sustained particle beam with cast-off
  // flare and ground cascade. Impacts are staggered per-target by beam-front arrival.
  frost: {
    beamSpeed: 3000, deliveryDuration: 3000,
    impactTiming: "beamFront",
    deliverySound: {fade: 700, offset: -500, release: 600},
    sprayParams: {spawnRate: 360}, smoke: false, residue: false,

    buildDelivery(ctx) {
      const {textures, beamElevation, spawnRadius, width} = ctx;
      const BEAM_SPEED = this.beamSpeed;
      const DELIVERY_DURATION = this.deliveryDuration;
      return [
        // Concentrated forward beam: a tight rectangular profile fired along the heading
        {
          animation: "rayParticleBeam", anchor: "origin", textures: textures.streak,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: BEAM_SPEED, angleSpread: 0.5, radius: spawnRadius, spawnRate: 1200,
            rotationSpread: 0.05, alpha: {min: 0.5, max: 0.9}, scale: {min: 0.5, max: 1.1},
            fade: {in: 30, out: 150}, blend: PIXI.BLEND_MODES.ADD, elevation: beamElevation}
        },
        // Cast-off flare: a slow, wide, short-lived spray softening the beam's root
        {
          animation: "rayParticleRootCastoff", anchor: "origin", textures: textures.spray,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: BEAM_SPEED, coneDeg: 60, radius: spawnRadius, spawnRate: 240,
            rotationSpread: 0.3, lifetime: {min: 200, max: 400}, alpha: {min: 0.75, max: 1.0},
            scale: {min: 0.6, max: 1.2}, fade: {in: 0, out: 150}, blend: PIXI.BLEND_MODES.ADD,
            elevation: beamElevation}
        },
        // Ground cascade: static shards deposited along the beam path as the front sweeps through
        {
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.impact,
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.8), spacing: 20, alpha: {min: 0.6, max: 0.9},
            scale: {min: 0.6, max: 1.0}, elevation: 0}
        }
      ];
    }
  },

  // Fire ray: the flame arrow's charge (vortex above caster + dark smoke beneath) followed by a slow
  // flame line that progressively ignites origin -> end, then a simultaneous eruption at completion
  // with scorch + smoke residue. Impacts fire together at line completion (impactTiming: "atEnd")
  // using a heavier impact sound to read as a global eruption.
  flame: {
    ..._CHARGE_FLAME,
    deliveryDuration: 1200, // LINE_DURATION - ms for the flame line to traverse origin -> end
    impactTiming: "atEnd",
    deliverySound: {fade: 600, offset: -400, release: 500},
    impactSound: "impactHeavy",

    buildDelivery(ctx) {
      const {textures, beamElevation, width, casterElevation} = ctx;
      const LINE_DURATION = this.deliveryDuration;
      const ERUPTION_DURATION = 500;
      return [
        // Flame line: streak particles igniting at the marching front, each with a positional lifetime
        // so the whole line is ablaze together at completion and all extinguish into the eruption.
        {
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.streak,
          duration: LINE_DURATION, mask: true,
          params: {width: Math.round(width * 0.35), spacing: 10, burnToEnd: true, burnTail: 400,
            rotationSpread: 0.08,
            scale: {min: 0.45, max: 0.85}, alpha: {min: 0.75, max: 1.0},
            fade: {in: 20, out: 200}, fadeOutMs: 200,
            blend: PIXI.BLEND_MODES.ADD, elevation: 1}
        },
        // Ground scorch: static dark deposits along the line, lingering past the eruption as scorch.
        {
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.ground,
          duration: LINE_DURATION, mask: true,
          params: {width: Math.round(width * 0.7), spacing: 28,
            lifetime: {min: LINE_DURATION + 3500, max: LINE_DURATION + 5000},
            scale: {min: 0.9, max: 1.6}, alpha: {min: 0.45, max: 0.8},
            fade: {in: 100, out: 1500}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        // Ground smoke: low haze rising slowly along the line, drifting up and dissipating.
        {
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.air,
          duration: LINE_DURATION, mask: true,
          params: {width: Math.round(width * 0.4), spacing: 38,
            lifetime: {min: 1600, max: 2600},
            velocity: {speed: [12, 32], angle: [258, 282]},
            scale: {min: 1.2, max: 2.0}, alpha: {min: 0.12, max: 0.35},
            fade: {in: 200, out: 700}, tint: 0x6B5A48,
            blend: PIXI.BLEND_MODES.NORMAL, elevation: casterElevation + 1}
        },
        // Combustion: at LINE_DURATION the whole line bursts in a single intense gout.
        {
          animation: "shapeParticleCombustion", anchor: "origin", textures: textures.spray,
          offset: LINE_DURATION, duration: ERUPTION_DURATION, mask: true,
          params: {count: 220, initial: 220,
            speed: {min: 30, max: 90},
            lifetime: {min: 650, max: 1100},
            scale: {min: 0.8, max: 1.4},
            scaleCurve: [{time: 0, value: 0.5}, {time: 0.35, value: 1.6}, {time: 1, value: 2.2}],
            alpha: {min: 0.75, max: 1.0},
            fade: {in: 30, out: 400}, blend: PIXI.BLEND_MODES.ADD, elevation: beamElevation}
        },
        // Residue: drifting smoke trail left behind by the eruption.
        {
          animation: "shapeParticleResidue", anchor: "origin", textures: textures.air,
          offset: LINE_DURATION + 250, duration: ERUPTION_DURATION, mask: true,
          params: {count: 32, initial: 32,
            speed: {min: 6, max: 22},
            lifetime: {min: 2000, max: 3200},
            scale: {min: 1.0, max: 1.7},
            scaleCurve: [{time: 0, value: 0.6}, {time: 0.5, value: 1.4}, {time: 1, value: 2.0}],
            alpha: {min: 0.06, max: 0.18},
            fade: {in: 300, out: 1400}, tint: 0x6B5A48,
            blend: PIXI.BLEND_MODES.NORMAL, elevation: beamElevation}
        }
      ];
    }
  },

  // Life ray: the Life Arrow charge sustained at the caster across the full delivery, plus a leaf
  // jet down the heading - StreakLeafy streaks driving forward with a SprayLeaf cloud tumbling
  // alongside. A magical leaf-blower of healing. Impacts fire per-target as the beam reaches each.
  life: {
    ..._CHARGE_LIFE,
    beamSpeed: 750, // Px/sec base; gentle healing breeze, not a spew
    deliveryDuration: 3000,
    impactTiming: "beamFront",
    deliverySound: {fade: 500, offset: -300, release: 600},
    sustainedChargeAnchor: "source",
    softImpact: true,
    softImpactFrames: ["SprayLeaf", "SprayBubble"],

    buildDelivery(ctx) {
      const {action, spawnRadius, casterElevation} = ctx;
      const BEAM_SPEED = this.beamSpeed;
      const DELIVERY_DURATION = this.deliveryDuration;
      const sprayLeafTextures = getVFXFrames(action.rune.id, "SprayLeaf");
      return [
        // Main jet: tight directional streaks driving forward, full-alpha, full-scale so individual
        // leaves read rather than blending into a streak. (Currently uses SprayLeaf textures.)
        {
          animation: "rayParticleBeam", anchor: "origin", textures: sprayLeafTextures,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: BEAM_SPEED, angleSpread: 1, radius: spawnRadius, spawnRate: 100,
            rotationSpread: 0.1, rotationSpeed: {min: -2.5, max: 2.5},
            scale: {min: 1.0, max: 1.15}, fade: {in: 30, out: 200},
            blend: PIXI.BLEND_MODES.NORMAL, elevation: casterElevation + 1}
        },
        // Cast-off leaves: spawn at the advancing head of the jet and fly off at +/-45 degrees of
        // the heading. headSpeed = BEAM_SPEED locks the spawn point to the leading edge so leaves
        // shed alongside the front rather than uniformly along the rectangle.
        {
          animation: "rayParticleHeadCastoff", anchor: "origin", textures: sprayLeafTextures,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: 150, headSpeed: BEAM_SPEED, headJitter: 25, angleSpread: 45, spawnRate: 50,
            alignVelocity: false, rotationSpread: Math.PI, rotationSpeed: {min: -2.5, max: 2.5},
            lifetime: {min: 800, max: 1400},
            scale: {min: 0.8, max: 1.0},
            fade: {in: 40, out: 250},
            blend: {curve: [
              {time: 0, value: PIXI.BLEND_MODES.ADD},
              {time: 0.4, value: PIXI.BLEND_MODES.NORMAL},
              {time: 1, value: PIXI.BLEND_MODES.NORMAL}
            ]},
            elevation: casterElevation + 1}
        }
      ];
    }
  }
};

/* -------------------------------------------- */
/*  Gesture Registry                            */
/* -------------------------------------------- */

/**
 * A registry of gesture-specific VFX hooks and per-rune overrides, keyed by gesture ID.
 * Each entry may define:
 * - `configure` - called at configure-time to produce the serializable VFXEffect config.
 *    `null` explicitly suppresses VFX; absent defers to existing config.
 * - `resolve` - called at play-time to compute reference values before VFXReferenceField resolution.
 * - `finalize` - called at play-time after resolution to inject runtime callbacks.
 * - `runes` - per-rune VFX overrides for this gesture (see {@link ARROW_VFX_PROPS} / {@link RAY_VFX_PROPS}).
 * @type {Record<string, {configure?: SpellVFXGestureConfigurator, resolve?: function,
 *   finalize?: function, runes?: Record<string, object>}>}
 */
const SPELL_VFX_GESTURES = {
  arrow: {configure: configureArrowVFXEffect, finalize: finalizeArrowVFXEffect, runes: ARROW_VFX_PROPS},
  aspect: {},
  aura: {},
  blast: {configure: configureBlastVFXEffect, finalize: finalizeBlastVFXEffect},
  cone: {},
  conjure: {},
  create: {},
  fan: {configure: configureFanVFXEffect, finalize: finalizeFanVFXEffect},
  influence: {},
  pulse: {},
  ray: {configure: configureRayVFXEffect, runes: RAY_VFX_PROPS},
  sense: {},
  step: {},
  strike: {},
  surge: {},
  touch: {},
  ward: {}
};
