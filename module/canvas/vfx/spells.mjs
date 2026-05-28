import {getRandomSprite, getVFXTexturePaths, getVFXTexturePath, getVFXFrames} from "./sprites.mjs";
import {mergeAnimationBlocks, coneSweepEmitter, expandingCascade,
  airResidue, groundResidue, groundImpacts, implodeExplode, fallingDebris} from "./blocks.mjs";
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
 * caster and target token centers. Per-rune visual overrides come from {@link RUNE_VFX_PROPS}.
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

  const runeProps = RUNE_VFX_PROPS.arrow?.[action.rune.id] ?? {};
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
      // Optional impact particle pop, e.g. a shower of leaves and bubbles for life
      if ( runeProps.impactSpray ) {
        const sprayTextures = getVFXFrames(action.rune.id, ...runeProps.impactSpray.frames);
        if ( sprayTextures.length ) impactParticles.push({
          animation: "circleParticleBurst", anchor: "destination", textures: sprayTextures, duration: 200,
          params: {radius: Math.round(gridSize * 0.12), speed: {min: 70, max: 210}, count: 50, initial: 1,
            lifetime: {min: 650, max: 1100}, alpha: {min: 0.6, max: 1.0}, scale: {min: 0.5, max: 1.1},
            elevation: (token.elevation ?? 0) + 1, ...runeProps.impactSpray.params}
        });
      }
    }
    else {
      impactSound = sound(getVFXSound(action.rune.id, "miss"));
      if ( (result === T.RESIST) && (runeProps.impactSprite !== false) ) {
        const puff = pickRandom(textures.air);
        // A resisted spell fizzles: a dissipating puff, no flash
        if ( puff ) impactAnimations.push({function: "impactSpriteBurst",
          params: {texture: puff, size: 4, duration: 1500, flash: false}});
      }
    }

    // Charge particles: one or more charge layers, an optional atmospheric smoke layer, and an optional
    // lingering residue. Per-rune overrides come from runeProps (see RUNE_VFX_PROPS).
    const chargeBehavior = runeProps.chargeBehavior ?? "circleParticleGather";
    const chargeAnchor = runeProps.chargeAnchor ?? "origin";
    // A layer drawn "above" sits over the token (elevation is the primary sort key and the particle
    // container has no sortLayer, so a same-elevation layer can never out-sort the token); otherwise a
    // source-anchored layer sits at the token's ground level and an origin-anchored one at the region.
    const elevationFor = above => above ? (casterElevation + 1)
      : ((chargeAnchor === "source") ? casterElevation : particleElevation);
    const chargeElevation = elevationFor(runeProps.chargeAbove);
    const residueElevation = runeProps.residueUnder ? casterElevation : (casterElevation + 1);

    // Either an explicit list of charge layers (per-layer elevation/radius/density) or a single default
    // spray layer.
    const chargeParticles = [];
    if ( runeProps.chargeLayers ) {
      for ( const layer of runeProps.chargeLayers ) {
        const layerTextures = layer.categories.flatMap(c => textures[c] ?? []);
        if ( !layerTextures.length ) continue;
        chargeParticles.push({
          animation: chargeBehavior, anchor: chargeAnchor, textures: layerTextures, duration: CHARGE_EMIT_DURATION,
          params: {chargeRadius: casterRadiusPx * (layer.radiusFactor ?? 2.0),
            elevation: elevationFor(layer.above), ...layer.params}
        });
      }
    }
    else {
      const chargeTextures = textures.spray.length ? textures.spray : textures.impact;
      chargeParticles.push({
        animation: chargeBehavior, anchor: chargeAnchor, textures: chargeTextures, duration: CHARGE_EMIT_DURATION,
        params: {chargeRadius: casterRadiusPx * 2.0, lifetime: 350,
          spawnRate: 480, elevation: chargeElevation, ...runeProps.sprayParams}
      });
    }
    if ( textures.air.length ) {
      if ( runeProps.smoke !== false ) chargeParticles.push({
        animation: chargeBehavior, anchor: chargeAnchor, textures: textures.air, duration: CHARGE_EMIT_DURATION,
        params: {chargeRadius: casterRadiusPx * 2.5, lifetime: 500, spawnRate: 60,
          alpha: {min: 0.3, max: 0.6}, scale: {min: 0.7, max: 1.2}, elevation: chargeElevation}
      });
      if ( runeProps.residue !== false ) chargeParticles.push({
        animation: "circleParticleResidue", anchor: chargeAnchor, textures: textures.air,
        offset: runeProps.residueOffset ?? 0, duration: runeProps.residueDuration ?? 300,
        params: {radius: Math.round(casterRadiusPx * 1.5), lifetime: {min: 1500, max: 2200},
          spawnRate: 120, count: 30, initial: 0.3, alpha: {min: 0.05, max: 0.18},
          elevation: residueElevation, ...runeProps.residueParams}
      });
    }

    // Optional per-rune flight trail (follows the projectile). `trail` is `true` for the default
    // directional streaks, or {frames|categories, params} to customize the textures and behavior.
    const projectileParticles = [];
    if ( runeProps.trail ) {
      const trail = runeProps.trail;
      const trailTextures = trail.frames ? getVFXFrames(action.rune.id, ...trail.frames)
        : (trail.categories ? trail.categories.flatMap(c => textures[c] ?? []) : textures.streak);
      if ( trailTextures.length ) projectileParticles.push({
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
  const shape = action.region?.shapes[0];
  if ( !shape || (shape.type !== "line") ) return null;
  const {textures} = resolveSpellVFXContext(action);
  const {x, y, length, width, rotation} = shape.toObject();
  const rotRad = Math.toRadians(rotation);
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const gridSize = canvas.dimensions.size;
  const casterToken = action.token;
  const casterMeshSort = casterToken.object?.mesh?.sort ?? 0;
  const casterElevation = casterToken.elevation ?? 0;
  const beamElevation = casterElevation + 1;
  const casterRadiusPx = (casterToken.width * gridSize) / 2;
  const beamOffset = Math.round(casterRadiusPx / 3);
  const beamLength = length - beamOffset;
  const spawnRadius = Math.max(8, width / 2);
  const CHARGE_DURATION = 700;

  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1} : null;
  const isFire = action.rune.id === "flame";
  const isLife = action.rune.id === "life";

  // Shared references: the caster mesh (used by finalize for the `source` anchor), the ray's
  // forward-offset origin point, and a move-polygon mask keeping the delivery from crossing walls.
  const references = {
    tokenMesh: "^token.object.mesh",
    rayOrigin: {x: x + (Math.cos(rotRad) * beamOffset), y: y + (Math.sin(rotRad) * beamOffset),
      elevation: beamElevation, sort: casterMeshSort + 1, sortLayer: SL.TOKENS},
    wallMask: {x, y, type: "move", radius: Math.round(length * 1.5)}
  };

  // Per-target impacts (rune-driven visuals). Each impact is self-contained: target reference + result +
  // sound + animations + particles. The component decides timing via _impactStart according to
  // delivery.eruptive (frost: staggered per-target; fire: all simultaneous at line completion).
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const impacts = [];
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
    // For eruptive fire delivery the per-target impacts fire simultaneously at line completion; using
    // impactHeavy positions a chord of heavy thuds at the targets, reading as one global eruption.
    const impactType = isFire ? "impactHeavy" : "impact";

    // Hit composition is rune-flavored: life skips recoil + impact flash (a gentle restorative arrival,
    // not a strike) and uses a leaf/bubble shower matching the Life Arrow's impactSpray.
    let hitAnimations;
    let hitParticles;
    if ( isLife ) {
      hitAnimations = [];
      const sprayTextures = getVFXFrames(action.rune.id, "SprayLeaf", "SprayBubble");
      hitParticles = sprayTextures.length ? [{
        animation: "circleParticleBurst", anchor: "target", textures: sprayTextures, duration: 200,
        params: {radius: Math.round(gridSize * 0.12), speed: {min: 70, max: 210}, count: 50, initial: 1,
          lifetime: {min: 650, max: 1100}, alpha: {min: 0.6, max: 1.0}, scale: {min: 0.5, max: 1.1},
          elevation: beamElevation}
      }] : [];
    }
    else {
      hitAnimations = [
        {function: "impactSpriteRecoil", params: {distance: 12, duration: 320}},
        ...(textures.impact.length
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.impact), size: 2, duration: 800, flash: true}}]
          : [])
      ];
      hitParticles = textures.spray.length ? [{
        animation: "circleParticleBurst", anchor: "target", textures: textures.spray, duration: 200,
        params: {radius: Math.round(gridSize * 0.1), speed: {min: 50, max: 150}, count: 24, initial: 1,
          lifetime: {min: 400, max: 800}, alpha: {min: 0.4, max: 0.9}, scale: {min: 0.4, max: 0.9},
          elevation: beamElevation}
      }] : [];
    }

    impacts.push(isHit
      ? {result, id: token.id, sound: sound(getVFXSound(action.rune.id, impactType)),
        animations: hitAnimations, particles: hitParticles}
      : {
        // Resisting target: a softer, flashless dissipating puff and a distinct sound
        result, id: token.id, sound: sound(getVFXSound(action.rune.id, "miss")),
        animations: textures.air.length
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}]
          : [],
        particles: []
      });
    j++;
  }
  if ( !impacts.length ) return null;

  // Rune-branched charge + delivery construction
  const buildContext = {textures, beamLength, beamElevation, spawnRadius, width, casterRadiusPx,
    casterElevation, CHARGE_DURATION, action, sound};
  let buildResult;
  if ( isFire ) buildResult = _buildFireRayChargeAndDelivery(buildContext);
  else if ( isLife ) buildResult = _buildLifeRayChargeAndDelivery(buildContext);
  else buildResult = _buildFrostRayChargeAndDelivery(buildContext);
  const {chargeParticles, delivery} = buildResult;

  const components = {
    ray: {
      type: "crucibleRay",
      origin: {reference: "rayOrigin", deltas: {}},
      rotation: rotRad,
      length: beamLength,
      charge: {duration: CHARGE_DURATION, sound: sound(getVFXSound(action.rune.id, "charge")),
        animations: [], particles: chargeParticles},
      delivery,
      impacts
    }
  };
  return {components, timeline: [{component: "ray", position: 0}], references};
}

/* -------------------------------------------- */

/**
 * Frost ray: a generic source gather charge plus a fast, sustained particle beam with cast-off flare and
 * ground cascade. Impacts are staggered per-target by beam-front arrival (`eruptive: false`).
 * @param {object} ctx
 * @returns {{chargeParticles: object[], delivery: object}}
 */
function _buildFrostRayChargeAndDelivery(ctx) {
  const {textures, beamElevation, spawnRadius, width, casterRadiusPx, CHARGE_DURATION, action, sound} = ctx;
  const BEAM_SPEED = 3000;
  const DELIVERY_DURATION = 3000;
  const deliverySound = sound(getVFXSound(action.rune.id, "damage"));
  if ( deliverySound ) Object.assign(deliverySound, {loop: true, fade: 700, offset: -500, release: 600});

  const chargeParticles = textures.spray.length ? [{
    animation: "circleParticleGather", anchor: "origin", textures: textures.spray, duration: CHARGE_DURATION,
    params: {chargeRadius: casterRadiusPx * 2, lifetime: 350, spawnRate: 360, elevation: beamElevation}
  }] : [];

  const delivery = {speed: BEAM_SPEED, duration: DELIVERY_DURATION, eruptive: false,
    sound: deliverySound, animations: [],
    particles: [
      // Concentrated forward beam: a tight rectangular profile fired along the heading
      ...(textures.streak.length ? [{
        animation: "rayParticleBeam", anchor: "origin", textures: textures.streak,
        duration: DELIVERY_DURATION, mask: true,
        params: {speed: BEAM_SPEED, angleSpread: 0.5, radius: spawnRadius, spawnRate: 1200,
          rotationSpread: 0.05, alpha: {min: 0.5, max: 0.9}, scale: {min: 0.5, max: 1.1},
          fade: {in: 30, out: 150}, blend: PIXI.BLEND_MODES.ADD, elevation: beamElevation}
      }] : []),
      // Cast-off flare: a slow, wide, short-lived spray softening the beam's root
      ...(textures.spray.length ? [{
        animation: "rayParticleRootCastoff", anchor: "origin", textures: textures.spray,
        duration: DELIVERY_DURATION, mask: true,
        params: {speed: BEAM_SPEED, coneDeg: 60, radius: spawnRadius, spawnRate: 240,
          rotationSpread: 0.3, lifetime: {min: 200, max: 400}, alpha: {min: 0.75, max: 1.0},
          scale: {min: 0.6, max: 1.2}, fade: {in: 0, out: 150}, blend: PIXI.BLEND_MODES.ADD,
          elevation: beamElevation}
      }] : []),
      // Ground cascade: static shards deposited along the beam path as the front sweeps through
      ...(textures.impact.length ? [{
        animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.impact,
        duration: DELIVERY_DURATION, mask: true,
        params: {width: Math.round(width * 0.8), spacing: 20, alpha: {min: 0.6, max: 0.9},
          scale: {min: 0.6, max: 1.0}, elevation: 0}
      }] : [])
    ]};
  return {chargeParticles, delivery};
}

/* -------------------------------------------- */

/**
 * Fire ray: the flame arrow's charge (caster-anchored fire vortex + dark smoke beneath) followed by a
 * slow flame line that progressively ignites origin -> end, a lingering scorch + low smoke trail, and a
 * simultaneous eruption at completion. Impacts fire together at line completion (`eruptive: true`).
 * @param {object} ctx
 * @returns {{chargeParticles: object[], delivery: object}}
 */
function _buildFireRayChargeAndDelivery(ctx) {
  const {textures, beamElevation, width, casterRadiusPx, casterElevation, CHARGE_DURATION, action,
    sound} = ctx;
  const LINE_DURATION = 1200;       // Ms for the flame line to traverse origin -> end (moderate suspense)
  const ERUPTION_DURATION = 500;    // Ms the gout of flame persists
  const CHARGE_EMIT_DURATION = CHARGE_DURATION - 100; // Charge particles stop 100ms early (chargeTail)

  // Charge: ported from RUNE_VFX_PROPS.arrow.flame - a fire vortex above the caster source-anchor plus a
  // dark smoke residue beneath. flameProps' sprayParams / residueParams override the shared defaults.
  const flameProps = RUNE_VFX_PROPS.arrow.flame;
  const chargeParticles = [];
  if ( textures.spray.length ) chargeParticles.push({
    animation: "circleParticleVortex", anchor: "source", textures: textures.spray,
    duration: CHARGE_EMIT_DURATION,
    params: {chargeRadius: casterRadiusPx * 2.0, lifetime: 350, spawnRate: 480,
      elevation: casterElevation + 1, ...flameProps.sprayParams}
  });
  if ( textures.air.length ) chargeParticles.push({
    animation: "circleParticleResidue", anchor: "source", textures: textures.air,
    offset: 350, duration: 300,
    params: {radius: Math.round(casterRadiusPx * 1.5), lifetime: {min: 1500, max: 2200},
      spawnRate: 120, count: 30, initial: 0.3, alpha: {min: 0.05, max: 0.18},
      elevation: casterElevation, ...flameProps.residueParams}
  });

  // The flame loop crackles in during the charge and lingers briefly past the eruption.
  const deliverySound = sound(getVFXSound(action.rune.id, "damage"));
  if ( deliverySound ) Object.assign(deliverySound, {loop: true, fade: 600, offset: -400, release: 500});

  const delivery = {
    speed: 2500, // Schema-required; not used for impact timing when eruptive is true
    duration: LINE_DURATION,
    eruptive: true,
    sound: deliverySound,
    animations: [],
    particles: [
      // Flame line: streak particles igniting at the marching front, each with a positional lifetime so
      // the whole line is ablaze together at completion and all extinguish into the eruption. Streaks are
      // small and densely packed with low rotation jitter so the line reads as a tight fuse rather than a
      // scatter of flame.
      ...(textures.streak.length ? [{
        animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.streak,
        duration: LINE_DURATION, mask: true,
        params: {width: Math.round(width * 0.35), spacing: 10, burnToEnd: true, burnTail: 400,
          rotationSpread: 0.08,
          scale: {min: 0.45, max: 0.85}, alpha: {min: 0.75, max: 1.0},
          fade: {in: 20, out: 200}, fadeOutMs: 200,
          blend: PIXI.BLEND_MODES.ADD, elevation: 1}
      }] : []),
      // Ground scorch: static dark deposits along the line, lingering past the eruption as scorch marks.
      ...(textures.ground.length ? [{
        animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.ground,
        duration: LINE_DURATION, mask: true,
        params: {width: Math.round(width * 0.7), spacing: 28,
          lifetime: {min: LINE_DURATION + 3500, max: LINE_DURATION + 5000},
          scale: {min: 0.9, max: 1.6}, alpha: {min: 0.45, max: 0.8},
          fade: {in: 100, out: 1500}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
      }] : []),
      // Ground smoke: low haze rising slowly along the line, drifting up and dissipating.
      ...(textures.air.length ? [{
        animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.air,
        duration: LINE_DURATION, mask: true,
        params: {width: Math.round(width * 0.4), spacing: 38,
          lifetime: {min: 1600, max: 2600},
          velocity: {speed: [12, 32], angle: [258, 282]}, // Slow upward drift (270deg up)
          scale: {min: 1.2, max: 2.0}, alpha: {min: 0.12, max: 0.35},
          fade: {in: 200, out: 700}, tint: 0x6B5A48,
          blend: PIXI.BLEND_MODES.NORMAL, elevation: casterElevation + 1}
      }] : []),
      // Combustion: at LINE_DURATION the whole line bursts in a single intense gout of spray particles.
      // Geometry-agnostic - reads the line shape from the component's state.deliveryArea. Top-down view:
      // particles billow upward via the over-lifetime scale curve, with only gentle radial drift in xy.
      ...(textures.spray.length ? [{
        animation: "shapeParticleCombustion", anchor: "origin", textures: textures.spray,
        offset: LINE_DURATION, duration: ERUPTION_DURATION, mask: true,
        params: {count: 220, initial: 220,
          speed: {min: 30, max: 90},
          lifetime: {min: 650, max: 1100},
          scale: {min: 0.8, max: 1.4},
          scaleCurve: [{time: 0, value: 0.5}, {time: 0.35, value: 1.6}, {time: 1, value: 2.2}],
          alpha: {min: 0.75, max: 1.0},
          fade: {in: 30, out: 400}, blend: PIXI.BLEND_MODES.ADD, elevation: beamElevation}
      }] : []),
      // Residue: drifting smoke trail left behind by the eruption, fading slowly over the next few
      // seconds. Starts ~250ms into the eruption so the combustion gout reads clearly first, then the
      // smoke billows in behind it. Sparser, smaller, and dimmer than the combustion so it suggests a
      // lingering haze rather than a wall of soot.
      ...(textures.air.length ? [{
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
      }] : [])
    ]
  };
  return {chargeParticles, delivery};
}

/* -------------------------------------------- */

/**
 * Life ray: a Life Arrow charge sustained at the caster across the full delivery duration, plus a
 * directional jet of leaves down the ray heading - StreakLeafy streaks driving forward with a wider
 * SprayLeaf cloud tumbling alongside, all rendered above the tokens. A magical leaf-blower of healing.
 * Impacts fire per-target as the beam reaches each (`eruptive: false`).
 * @param {object} ctx
 * @returns {{chargeParticles: object[], delivery: object}}
 */
function _buildLifeRayChargeAndDelivery(ctx) {
  const {textures, spawnRadius, casterRadiusPx, casterElevation, CHARGE_DURATION, action, sound} = ctx;
  const BEAM_SPEED = 750;            // Px/sec base; gentle healing breeze, not a spew
  const DELIVERY_DURATION = 3000;    // Ms of sustained jet emission

  // Port the Life Arrow's charge layers (ground bloom + overhead spray motes). The same layers are
  // duplicated into the delivery phase so the channel keeps "charging" at the caster across the ray.
  const lifeProps = RUNE_VFX_PROPS.arrow.life;
  const buildLifeChargeLayers = duration => {
    const layers = [];
    for ( const layer of lifeProps.chargeLayers ) {
      const layerTextures = layer.categories.flatMap(c => textures[c] ?? []);
      if ( !layerTextures.length ) continue;
      layers.push({
        animation: lifeProps.chargeBehavior, anchor: "source", textures: layerTextures, duration,
        params: {chargeRadius: casterRadiusPx * (layer.radiusFactor ?? 2.0),
          elevation: layer.above ? (casterElevation + 1) : casterElevation, ...layer.params}
      });
    }
    return layers;
  };
  const chargeParticles = buildLifeChargeLayers(CHARGE_DURATION);
  const sustainedChargeLayers = buildLifeChargeLayers(DELIVERY_DURATION);

  // Leaf jet textures: tight directional streaks + wider tumbling spray, both leaf-themed.
  const streakLeafyTextures = getVFXFrames(action.rune.id, "StreakLeafy");
  const sprayLeafTextures = getVFXFrames(action.rune.id, "SprayLeaf");

  // No life sounds shipped yet; sound() returns null and the helpers handle it gracefully.
  const deliverySound = sound(getVFXSound(action.rune.id, "damage"));
  if ( deliverySound ) Object.assign(deliverySound, {loop: true, fade: 500, offset: -300, release: 600});

  const delivery = {
    speed: BEAM_SPEED,
    duration: DELIVERY_DURATION,
    eruptive: false,
    sound: deliverySound,
    animations: [],
    particles: [
      ...sustainedChargeLayers,
      // Main jet: StreakLeafy streaks tearing down the ray heading - the visible "beam" of the jet.
      // Sparse, full-alpha, full-scale so individual leaves read rather than blending into a streak.
      ...(streakLeafyTextures.length ? [{
        animation: "rayParticleBeam", anchor: "origin", textures: sprayLeafTextures,
        duration: DELIVERY_DURATION, mask: true,
        params: {speed: BEAM_SPEED, angleSpread: 1, radius: spawnRadius, spawnRate: 100,
          rotationSpread: 0.1, rotationSpeed: {min: -2.5, max: 2.5},
          scale: {min: 1.0, max: 1.15}, fade: {in: 30, out: 200},
          blend: PIXI.BLEND_MODES.NORMAL, elevation: casterElevation + 1}
      }] : []),
      // Cast-off leaves: spawn at the advancing head of the leaf jet and fly off at angles within +/-
      // 45 degrees of the heading. headSpeed = BEAM_SPEED locks the spawn point to the jet's leading
      // edge so leaves shed alongside the front rather than uniformly along the rectangle.
      ...(sprayLeafTextures.length ? [{
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
      }] : [])
    ]
  };
  return {chargeParticles, delivery};
}

/* -------------------------------------------- */

/**
 * Finalize the Ray VFX at play-time: inject the resolved struck-token meshes (parallel to `impacts`) and
 * the resolved beam wall-mask into the ray component.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
function finalizeRayVFXEffect(action, vfxEffect, references) {
  for ( const component of Object.values(vfxEffect.components) ) {
    if ( component.type !== "crucibleRay" ) continue;
    const meshes = [];
    for ( let i = 1; (`rayTarget_${i}_tokenMesh` in references); i++ ) {
      meshes.push(references[`rayTarget_${i}_tokenMesh`]);
    }
    component._targetMeshes = meshes;
    component._mask = references.wallMask ?? null;
    component._originMesh = references.tokenMesh ?? null;
  }
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

  const ground = groundResidue.configure({prefix: "blastGround", origin,
    radius: Math.round(radius * 0.7), textures: textures.ground,
    position: EXPLODE_START, ...shared});

  const overhead = airResidue.configure({prefix: "blastOverhead", origin,
    radius: Math.round(radius * 1.2), textures: textures.air,
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

/**
 * Per-gesture, per-rune VFX behavior overrides.
 * Outer key is gesture ID, inner key is rune ID, value is the gesture-specific property bag.
 * Runes opt in to specific behaviors; absent entries fall back to gesture configurator defaults.
 *
 * Arrow gesture properties:
 * - `stickDuration` (number): ms the projectile sprite stays at the impact location after a
 *   HIT/GLANCE before fading out. Omit or 0 for no stick. Best for "physical" runes whose
 *   projectile reads as a tangible object embedded in the target.
 * - `projectileSize` (number): override the projectile sprite size in feet (default 3).
 * - `projectileFrame` (string): a specific projectile texture frame (e.g. "life/ProjectileBubble");
 *   defaults to a random `projectile`-category texture.
 * - `projectileSpeed` (number): flight speed in feet/sec (default 150).
 * - `whoosh` (string|null): generic launch-whoosh sound key (default "whooshFast"); null for silence.
 * - `chargeDuration` (number): charge phase length in ms (default 700).
 * - `trail` (boolean|{frames|categories, params}): emit a particle trail behind the projectile; `true`
 *   uses directional streak textures, or pass texture frames/categories and behavior params to customize.
 * - `chargeBehavior` (string): the registered charge-phase particle behavior (default
 *   `circleParticleGather`); e.g. `circleParticleVortex` (swirl) or `circleParticleBloom` (growth).
 * - `chargeAnchor` (string): where the charge particles center - `origin` (the forward manifest point,
 *   default) or `source` (the launching token center).
 * - `chargeAbove` (boolean): draw the charge particles above the token rather than at its ground level.
 * - `chargeCategories` (string[]): texture categories combined for the single default charge layer (["spray"]).
 * - `chargeRadiusFactor` (number): charge radius as a multiple of the source token radius (default 2.0).
 * - `chargeLayers` ([{categories, above, radiusFactor, params}]): replaces the single default charge layer with
 *   explicit layers, each with its own elevation (`above`), radius, and material params.
 * - `impactSprite` (boolean): show the impact burst sprite on a hit (default true).
 * - `recoil` (boolean): rock/shake the struck token on a hit (default true).
 * - `impactSpray` ({frames, params}): an impact particle pop from the named frames (e.g. SprayLeaf,
 *   SprayBubble) with optional material overrides.
 * - `chargeTail` (number): ms the charge particles keep emitting past the projectile-release label
 *   (default 200, overlapping the launch); negative ends emission before release.
 * - `smoke` (boolean): emit the soft atmospheric (air) smoke layer during charge (default true;
 *   set false for a fire-only charge).
 * - `residue` (boolean): emit the lingering atmospheric residue after the charge (default true; set
 *   false to leave nothing behind).
 * - `residueUnder` (boolean): draw the residue beneath the caster token rather than just overhead.
 * - `residueOffset` / `residueDuration` (number): ms the residue layer waits before emitting and how
 *   long it emits (defaults 0 / 300).
 * - `residueParams` (object): residue material overrides (alpha, scale, tint, blend, lifetime, fade,
 *   spawnRate, count, ...); pass `blend: PIXI.BLEND_MODES.NORMAL` with a dark tint for sooty smoke.
 * - `sprayParams` / `smokeParams` (object): per-layer material overrides merged into the spray (mote)
 *   and air (smoke) charge layers respectively - `tint`, `scale`, `alpha`, `spawnRate`, `spawnRateEnd`
 *   (an emission ramp end value), etc.
 * - `path` ({type, params}): a `CONFIG.Canvas.vfx.paths` generator for the flight trajectory
 *   (default linear); e.g. `{type: "weave", params: {arcCount, amplitude}}` for a serpentine bolt.
 *
 * @type {Record<string, Record<string, object>>}
 */
const RUNE_VFX_PROPS = {
  arrow: {
    frost: {stickDuration: 1500, projectileSize: 2, trail: true},
    // Life is slow and gentle: a lazy bloom of growth around the caster, a drifting bubble, and a
    // soothing leaf/bubble shower on impact. No stick, recoil, impact sprite, whoosh, or trail.
    life: {projectileSize: 3, projectileFrame: "life/ProjectileBubble", projectileSpeed: 30,
      whoosh: null, chargeDuration: 1500, impactSprite: false, recoil: false,
      // A lazy bubble trail: slow, long-lived SprayBubble motes drifting behind the projectile.
      trail: {frames: ["SprayBubble"], params: {align: false, speed: {min: 2, max: 12},
        lifetime: {min: 800, max: 1400}, spawnRate: 40, scale: {min: 0.4, max: 0.9},
        alpha: {min: 0.4, max: 0.85}, blend: PIXI.BLEND_MODES.NORMAL}},
      chargeBehavior: "circleParticleBloom", chargeAnchor: "source", smoke: false, residue: false,
      // Ground growth spreads at the caster's feet (below the token); leaf/mote spray clusters tighter
      // and overhead (above the token), denser than the ground.
      chargeLayers: [
        {categories: ["ground"], above: false, radiusFactor: 3.0,
          params: {lifetime: {min: 900, max: 1500}, spawnRate: 10, scale: {min: 0.5, max: 1.0}}},
        {categories: ["spray"], above: true, radiusFactor: 1.6,
          params: {lifetime: {min: 900, max: 1500}, spawnRate: 110, scale: {min: 0.5, max: 1.0}}}
      ],
      impactSpray: {frames: ["SprayLeaf", "SprayBubble"]}},
    flame: {projectileSize: 3, trail: true, chargeBehavior: "circleParticleVortex", chargeAnchor: "source",
      chargeAbove: true, chargeTail: -100, smoke: false,
      // Fire vortex above the caster; its motes ramp down as it collapses, with a wide alpha range for
      // varied transparency.
      sprayParams: {spawnRate: 560, spawnRateEnd: 160, scale: {min: 1.25, max: 2.0},
        alpha: {min: 0.4, max: 0.9}},
      // A subtle dark smoke beneath the caster: starts halfway through the charge and lingers ~0.5s
      // past release (NORMAL blend + dark tint rather than the default glowing ADD haze).
      residueUnder: true, residueOffset: 350, residueDuration: 300, // Offset is ~half the 700ms charge
      residueParams: {spawnRate: 70, count: null, initial: 0.2, lifetime: {min: 500, max: 800},
        alpha: {min: 0.2, max: 0.45}, scale: {min: 0.7, max: 1.2}, tint: 0x6B5A48,
        blend: PIXI.BLEND_MODES.NORMAL, fade: {in: 0.2, out: 0.4}},
      path: {type: "weave", params: {arcCount: 2, amplitude: 0.1}}}
  }
};

/* -------------------------------------------- */
/*  Color Palettes                              */
/* -------------------------------------------- */

/**
 * Per-rune particle tint palettes (primary / secondary / residue), as raw hex literals.
 * Not currently wired to any configurator; retained for future rune-tinted particle effects.
 * @type {Record<string, {primary: number[], secondary: number[], residue: number[]}>}
 */
export const RUNE_COLORS = {
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
  arrow: {configure: configureArrowVFXEffect, finalize: finalizeArrowVFXEffect},
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
