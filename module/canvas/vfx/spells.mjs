import {getRandomSprite, getVFXTexturePaths, getVFXTexturePath, getVFXFrames} from "./sprites.mjs";
import {getParticleScaleFactor} from "./blocks.mjs";
import {computeAttackOffset, pickRandom, pushActorScrollingText, pushTargetScrollingText,
  tokenCenter} from "./helpers.mjs";
import {getVFXSound} from "./sounds.mjs";
import CrucibleFanComponent from "./components/vfx-fan-component.mjs";
import CrucibleForcedMovementComponent from "./components/vfx-forced-movement-component.mjs";

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
 * @property {string[]} root         Ground-laid directional textures growing outward from an origin (roots, fissures).
 * @property {string[]} spray        Small mote textures for scatter and halo generators.
 * @property {string[]} streak       Mid-air directional textures for beam/ray generators.
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
/*  Shared Configurator Helpers                 */
/* -------------------------------------------- */

/**
 * Build a positional sound descriptor for a spell phase from a {@link getVFXSound} result.
 * @param {{src: string, loop?: boolean}|null} d   A rune sound entry, or null.
 * @returns {object|null}   A phase sound descriptor, or null when no source was provided.
 */
function _spellSound(d) {
  if ( !d ) return null;
  const {START} = foundry.canvas.vfx.constants.SOUND_ALIGNMENT;
  return {src: d.src, align: START, radius: 30, volume: 1, loop: d.loop ?? false};
}

/* -------------------------------------------- */

/**
 * Build the standard resisting-target impact: a soft, flashless air puff that dissipates. Empty when the
 * rune has no air textures.
 * @param {SpellVFXTextures} textures
 * @returns {object[]}
 */
function _buildResistPuff(textures) {
  if ( !textures.air.length ) return [];
  return [{function: "impactSpriteBurst",
    params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}];
}

/* -------------------------------------------- */

/**
 * Register a target's TokenDocument and token-mesh references under a gesture-specific prefix.
 * @param {Record<string, string>} references   The references map, mutated in place.
 * @param {string} prefix   Gesture ref prefix (e.g. "rayTarget").
 * @param {number} j        1-based target index.
 * @param {TokenDocument} token
 * @returns {{tokenRef: string, meshRef: string}}
 */
function _registerTargetRefs(references, prefix, j, token) {
  const tokenRef = `${prefix}_${j}_token`;
  const meshRef = `${prefix}_${j}_tokenMesh`;
  references[tokenRef] = `@${token.uuid}`;
  references[meshRef] = `^${tokenRef}.object.mesh`;
  return {tokenRef, meshRef};
}

/* -------------------------------------------- */

/**
 * Attach accumulated forced movements to a built components/timeline pair and return the {@link SpellVFXData}.
 * The shared tail of every gesture configurator.
 * @param {Record<string, object>} components
 * @param {object[]} timeline
 * @param {Record<string, string>} references
 * @param {object[]} forcedMovements
 * @returns {SpellVFXData}
 */
function _finalizeSpellVFX(components, timeline, references, forcedMovements) {
  CrucibleForcedMovementComponent.applyForcedMovements(components, timeline, forcedMovements);
  return {components, timeline, references};
}

/* -------------------------------------------- */

/**
 * Resolve the caster's token geometry, prepared once for every gesture configurator.
 * @param {CrucibleSpellAction} action
 * @returns {{gridSize: number, token: TokenDocument, elevation: number, radiusPx: number,
 *   center: {x: number, y: number}, meshSort: number}}
 */
function _resolveCasterGeometry(action) {
  const gridSize = canvas.dimensions.size;
  const token = action.token;
  return {
    gridSize, token,
    elevation: token.elevation ?? 0,
    radiusPx: (token.width * gridSize) / 2,
    center: tokenCenter(token),
    meshSort: token.object?.mesh?.sort ?? 0
  };
}

/* -------------------------------------------- */

/**
 * Build the charge-resolution context shared by {@link _resolveChargeLayers} and a rune's `buildCharge`.
 * @param {CrucibleSpellAction} action
 * @param {object} geom
 * @param {SpellVFXTextures} geom.textures
 * @param {number} geom.casterRadiusPx
 * @param {number} geom.casterElevation
 * @param {number} geom.particleElevation
 * @returns {object}
 */
function _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation}) {
  return {runeId: action.rune.id, textures, casterRadiusPx, casterElevation, particleElevation};
}

/* -------------------------------------------- */

/**
 * Build a single target's impact entry for the standard `{start, sound, animations, particles}` shape shared by
 * the region and contact gestures. A hit resolves the shared {@link _resolveHitTreatment} (crit- and
 * knockback-aware); a RESIST shows the standard dissipating puff; other non-hits show nothing.
 * @param {object} opts
 * @param {CrucibleSpellAction} opts.action
 * @param {object} opts.group             The target's event group.
 * @param {TokenDocument} opts.token
 * @param {number} opts.result            The target's {@link AttackRoll} result type.
 * @param {number} opts.start             Component-timeline ms of the impact beat.
 * @param {string} opts.tokenRef          Reference key of the target's TokenDocument (for knockback).
 * @param {object} opts.runeProps
 * @param {SpellVFXTextures} opts.textures
 * @param {number} opts.elevation         Particle elevation for the hit treatment.
 * @param {string} [opts.impactType]      RUNE_SOUNDS key for the hit sound (default "impact").
 * @param {object[]} opts.forcedMovements
 * @param {object} [opts.treatmentCtx]    Per-spell overrides forwarded to {@link _resolveHitTreatment}.
 * @returns {object}
 */
function _buildTargetImpact({action, group, token, result, start, tokenRef, runeProps, textures, elevation,
  impactType="impact", forcedMovements, treatmentCtx={}}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const isHit = (result === T.HIT) || (result === T.GLANCE);
  if ( isHit ) {
    const knockback = CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, start);
    const crit = !!group.roll[0]?.roll?.isCriticalSuccess;
    const treatment = _resolveHitTreatment(action, {textures, elevation, crit, knockback, ...treatmentCtx}, runeProps);
    return {result, id: token.id, start, sound: _spellSound(getVFXSound(action.rune.id, impactType)),
      animations: treatment.animations, particles: treatment.particles};
  }
  return {result, id: token.id, start, sound: _spellSound(getVFXSound(action.rune.id, "miss")),
    animations: (result === T.RESIST) ? _buildResistPuff(textures) : [], particles: []};
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
  const runeProps = SPELL_VFX_GESTURES.arrow.runes?.[action.rune.id];
  if ( !runeProps ) return null; // No arrow-gesture config for this rune; skip VFX
  const {textures, particleElevation} = resolveSpellVFXContext(action);
  const components = {};
  const timeline = [];
  const forcedMovements = [];
  const references = {tokenMesh: "^token.object.mesh"};

  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const {elevation: casterElevation, radiusPx: casterRadiusPx,
    center: {x: casterCenterX, y: casterCenterY}, meshSort: casterMeshSort} = _resolveCasterGeometry(action);

  const CHARGE_DURATION = runeProps.chargeDuration ?? 700;
  const chargeTail = runeProps.chargeTail ?? 200; // Ms the charge particles keep emitting past the projectile-release label
  const CHARGE_EMIT_DURATION = CHARGE_DURATION + chargeTail;

  // Resolve sound choices and configure their playback
  const sound = _spellSound;
  const chargeSound = sound(getVFXSound(action.rune.id, "charge"));
  let flightSound;
  if ( runeProps.flightSound ) {
    const {rune, type, ...envelope} = runeProps.flightSound;
    flightSound = sound(getVFXSound(rune, type));
    if ( flightSound ) Object.assign(flightSound, envelope);
  }
  else {
    const whooshKey = ("whoosh" in runeProps) ? runeProps.whoosh : "whooshFast";
    flightSound = whooshKey ? sound(getVFXSound("generic", whooshKey)) : null;
  }

  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const roll = group.roll[0]?.roll;
    const result = roll?.data.result;
    if ( !result ) continue;

    const {tokenRef: targetTokenRef, meshRef: targetMeshRef} = _registerTargetRefs(references, "target", j, token);

    // Manifest point: one caster radius forward toward the target, so the projectile materializes
    // in front of the caster rather than at their center.
    const {x: tcx, y: tcy} = tokenCenter(token);
    const dirDist = Math.max(1, Math.hypot(tcx - casterCenterX, tcy - casterCenterY));
    const manifestX = casterCenterX + (((tcx - casterCenterX) / dirDist) * casterRadiusPx);
    const manifestY = casterCenterY + (((tcy - casterCenterY) / dirDist) * casterRadiusPx);
    const offset = computeAttackOffset(token, result);

    // Projectile flight timing; the arrival is the impact beat (shared by scrolling text and any knockback)
    const projectileSpeed = runeProps.projectileSpeed ?? 150;
    const distPx = Math.hypot(tcx - manifestX, tcy - manifestY);
    const flightMS = (distPx * 1000) / (projectileSpeed * canvas.dimensions.distancePixels);

    // Register the manifest point as a reference. Every element of a VFXReferenceObjectField array
    // must be a reference: resolveReferences builds a partial array update of only the resolved
    // (reference) elements, so a literal sibling would be dropped to a hole by updateSource.
    const manifestRef = `arrow_${j}_manifest`;
    references[manifestRef] = {x: manifestX, y: manifestY, elevation: casterElevation,
      sort: casterMeshSort + 1, sortLayer: SL.TOKENS};

    const isHit = (result === T.HIT) || (result === T.GLANCE);
    // A force-moved target plays its knockback glide AS the impact animation, replacing the recoil/shake
    const knockback = isHit && CrucibleForcedMovementComponent.pushKnockback(
      forcedMovements, group, targetTokenRef, CHARGE_DURATION + flightMS);
    const stickDuration = (isHit && runeProps.stickDuration) ? runeProps.stickDuration : 0;
    let impactSound = null;
    const animations = [];
    const particles = [];
    if ( isHit ) {
      impactSound = sound(getVFXSound(action.rune.id, "impact"));
      const treatment = _resolveHitTreatment(action, {textures, elevation: (token.elevation ?? 0) + 1,
        crit: !!roll?.isCriticalSuccess, knockback, burstSize: 3, burstDuration: stickDuration || 1000}, runeProps);
      animations.push(...treatment.animations);
      particles.push(...treatment.particles);
    }
    else {
      impactSound = sound(getVFXSound(action.rune.id, "miss"));
      if ( (result === T.RESIST) && (runeProps.impactSprite !== false) ) {
        animations.push(..._buildResistPuff(textures));
      }
    }

    const chargeParticles = _resolveChargeLayers(runeProps,
      _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation}),
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

    const arrowScrollingText = [];
    pushTargetScrollingText(arrowScrollingText, action, actor, group.all, targetMeshRef,
      CHARGE_DURATION + flightMS);

    components[`arrow_${j}`] = {
      type: "crucibleProjectile",
      originMesh: {reference: "tokenMesh"},
      targetMeshes: [{reference: targetMeshRef}],
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
        size: runeProps.projectileSize ?? 3, speed: projectileSpeed, sound: flightSound,
        animations: [{function: "deliveryProjectileFlight"}], particles: projectileParticles},
      impacts: [{
        result, id: token.id, stick: stickDuration,
        sound: impactSound, animations, particles
      }],
      scrollingText: arrowScrollingText
    };
    timeline.push({component: `arrow_${j}`, position: 0});
    j++;
  }

  if ( !timeline.length ) return null;
  if ( components.arrow_1 ) pushActorScrollingText(components.arrow_1.scrollingText, action, "tokenMesh");
  return _finalizeSpellVFX(components, timeline, references, forcedMovements);
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a Fan gesture composed spell as a single {@link CrucibleFanComponent}: an
 * optional charge at the caster, a swept delivery across the cone arc, and per-target impacts whose
 * `start` is the moment the sweep arm crosses each target's bearing. Per-rune visuals come from
 * {@link FAN_VFX_PROPS}.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureFanVFXEffect(action) {
  const regionShape = action.region?.shapes[0];
  if ( !regionShape || (regionShape.type !== "cone") ) return null;
  const runeProps = SPELL_VFX_GESTURES.fan.runes?.[action.rune.id];
  if ( !runeProps ) return null;
  const {textures, particleElevation} = resolveSpellVFXContext(action);
  const shapeData = regionShape.toObject();
  const {x, y, radius, angle, rotation} = shapeData;
  const origin = {x, y};
  const rotRad = Math.toRadians(rotation);
  const halfAngleRad = Math.toRadians(angle / 2);
  const {gridSize, elevation: casterElevation, radiusPx: casterRadiusPx} = _resolveCasterGeometry(action);
  const chargeDuration = runeProps.chargeDuration ?? 0;
  const sweepDuration = runeProps.sweepDuration ?? 400;
  const oscillate = !!runeProps.oscillate;
  const deliveryDuration = oscillate ? (sweepDuration * 2) : sweepDuration;
  const MASK_RADIUS_FACTOR = 1.5;

  const {startAngleRad, endAngleRad} = CrucibleFanComponent.pickSweepDirection(action, origin, rotRad,
    halfAngleRad);
  const sweepRangeRad = endAngleRad - startAngleRad;

  const sound = _spellSound;

  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };

  let chargeParticles = [];
  if ( chargeDuration > 0 ) {
    const chargeCtx = _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation});
    chargeParticles = runeProps.buildCharge?.(chargeCtx)
      ?? _resolveChargeLayers(runeProps, chargeCtx, {duration: chargeDuration});
  }

  const buildCtx = {action, textures, origin, radius, startAngleRad, endAngleRad, sweepDuration,
    particleElevation, casterElevation, casterRadiusPx};
  const deliveryParticles = runeProps.buildDelivery(buildCtx);

  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const impactType = runeProps.impactSound ?? "impact";
  const impacts = [];
  const targetMeshRefs = [];
  const scrollingText = [];
  const forcedMovements = [];
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const result = group.roll[0]?.roll?.data.result ?? null;
    const isHit = (result === T.HIT) || (result === T.GLANCE);
    if ( !isHit && (result !== T.RESIST) ) continue; // Fan only marks targets the sweep hits or that resist
    const cx = token.x + ((token.width * gridSize) / 2);
    const cy = token.y + ((token.height * gridSize) / 2);
    const bearing = Math.atan2(cy - origin.y, cx - origin.x);
    let delta = bearing - startAngleRad;
    while ( delta > Math.PI ) delta -= Math.PI * 2;
    while ( delta < -Math.PI ) delta += Math.PI * 2;
    const tFrac = Math.clamp(delta / sweepRangeRad, 0, 1);
    const defaultStart = chargeDuration + Math.round(tFrac * sweepDuration);
    const start = runeProps.impactStart?.({chargeDuration, sweepDuration, tFrac, token,
      defaultStart}) ?? defaultStart;
    const {tokenRef, meshRef} = _registerTargetRefs(references, "fanTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    impacts.push(_buildTargetImpact({action, group, token, result, start, tokenRef, runeProps, textures,
      elevation: particleElevation, impactType, forcedMovements}));
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  pushActorScrollingText(scrollingText, action, "tokenMesh");

  const deliverySound = runeProps.deliverySoundType
    ? _resolveDeliverySound({action, sound}, runeProps.deliverySound ?? {}, runeProps.deliverySoundType)
    : null;
  const chargeSound = ((chargeDuration > 0) && (runeProps.chargeSound !== false))
    ? sound(getVFXSound(action.rune.id, "charge")) : null;

  const components = {
    fan: {
      type: "crucibleFan",
      shape: shapeData,
      casterRadiusPx,
      originMesh: {reference: "tokenMesh"},
      targetMeshes: targetMeshRefs,
      mask: {reference: "wallMask"},
      charge: {duration: chargeDuration, sound: chargeSound,
        animations: [], particles: chargeParticles},
      delivery: {duration: deliveryDuration, sound: deliverySound, animations: [], particles: deliveryParticles},
      impacts,
      scrollingText
    }
  };
  const timeline = [{component: "fan", position: 0}];
  return _finalizeSpellVFX(components, timeline, references, forcedMovements);
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
  const shapeData = regionShape.toObject();
  const {x, y, length, width, rotation} = shapeData;
  const rotRad = Math.toRadians(rotation);
  const {elevation: casterElevation, radiusPx: casterRadiusPx} = _resolveCasterGeometry(action);
  const beamElevation = casterElevation + 1;
  const chargeDistance = casterRadiusPx;       // Half the caster token width: pulls the charge to the token's front edge
  const beamLength = length - chargeDistance;  // Effective beam reach from the charge point to the shape's end
  const spawnRadius = Math.max(8, width / 2);
  const CHARGE_DURATION = 700;
  const sound = _spellSound;

  // Declare necessary references to resolve at play-time
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(length * 1.5)}
  };

  // Configure beam charge point and progression speed
  const chargeOrigin = {x: x + (Math.cos(rotRad) * chargeDistance), y: y + (Math.sin(rotRad) * chargeDistance)};
  const gridScale = getParticleScaleFactor();
  const effectiveBeamSpeed = runeProps.beamSpeed
    ?? (beamLength / gridScale / (runeProps.deliveryDuration / 1000));

  // Schedule impact for each target when the beam progression reaches it
  const timingCtx = {origin: chargeOrigin, beamSpeed: effectiveBeamSpeed, gridScale,
    deliveryStart: CHARGE_DURATION, deliveryDuration: runeProps.deliveryDuration};
  const impacts = [];
  const targetMeshRefs = [];
  const scrollingText = [];
  const forcedMovements = [];
  const timingFn = RAY_IMPACT_TIMINGS[runeProps.impactTiming] ?? RAY_IMPACT_TIMINGS.beamFront;
  const impactType = runeProps.impactSound ?? "impact";
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const result = group.roll[0]?.roll?.data.result ?? null;
    const {tokenRef, meshRef} = _registerTargetRefs(references, "rayTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    const start = timingFn(tokenCenter(token), timingCtx);
    impacts.push(_buildTargetImpact({action, group, token, result, start, tokenRef, runeProps, textures,
      elevation: beamElevation, impactType, forcedMovements}));
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  pushActorScrollingText(scrollingText, action, "tokenMesh");

  // Build VFXEffect configuration
  const buildContext = {textures, beamLength, beamElevation, spawnRadius, width, casterRadiusPx,
    casterElevation, CHARGE_DURATION, action, sound, beamSpeed: effectiveBeamSpeed};
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
      impacts,
      scrollingText
    }
  };
  const timeline = [{component: "ray", position: 0}];
  return _finalizeSpellVFX(components, timeline, references, forcedMovements);
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a contact gesture (Touch or Influence) as a single {@link CrucibleTouchComponent}: a
 * small charge gathered at the caster's hand, then an impact on the single adjacent target. Both gestures have
 * `target.type: "single"` and no region shape, so the geometry is the caster and target token centers. Per-rune
 * visuals come from the gesture's `runes` table. An optional gesture `channel` descriptor turns the brief
 * charge-then-pop into a sustained melee channel (Influence): the hand keeps channeling through a long delivery
 * while the element crusts onto the target under a saturating glow that lingers past a modest climax.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureContactVFXEffect(action) {
  if ( action.target.type !== "single" ) return null;
  const gesture = SPELL_VFX_GESTURES[action.gesture.id];
  const runeProps = gesture.runes?.[action.rune.id];
  if ( !runeProps ) return null;
  const channel = gesture.channel ?? null;
  const {textures, particleElevation} = resolveSpellVFXContext(action);

  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const {gridSize, elevation: casterElevation, radiusPx: casterRadiusPx} = _resolveCasterGeometry(action);
  const chargeDuration = channel?.chargeDuration ?? runeProps.chargeDuration ?? 450;
  const deliveryDuration = channel?.deliveryDuration ?? runeProps.deliveryDuration ?? 100;
  const lingerDuration = channel?.lingerDuration ?? 0;
  const impactStart = chargeDuration + deliveryDuration;

  const sound = _spellSound;

  // Charge gathers at the caster's palm (halfway out toward the target) so the origin reads as the caster
  const references = {tokenMesh: "^token.object.mesh"};
  const chargeCtx = _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation});
  const chargeParticles = _resolveChargeLayers(runeProps, chargeCtx, {anchor: "palm", duration: chargeDuration});

  const impacts = [];
  const targetMeshRefs = [];
  const scrollingText = [];
  const forcedMovements = [];
  let channelTarget = null;
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const result = group.roll[0]?.roll?.data.result ?? null;
    if ( !result ) continue;
    const isHit = (result === T.HIT) || (result === T.GLANCE);
    const targetElevation = (token.elevation ?? 0) + 1;
    const {tokenRef, meshRef} = _registerTargetRefs(references, "contactTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    channelTarget ??= {hit: isHit, radiusPx: (token.width * gridSize) / 2, elevation: targetElevation};

    // A channel keeps its glow on the delivery phase (suppressGlow) and lingers its burst over the linger window
    const treatmentCtx = channel
      ? {burstSize: channel.burstSize ?? 3, burstDuration: lingerDuration, flashDuration: 200, suppressGlow: true}
      : {};
    impacts.push(_buildTargetImpact({action, group, token, result, start: impactStart, tokenRef, runeProps,
      textures, elevation: targetElevation, forcedMovements, treatmentCtx}));
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, impactStart);
    j++;
  }

  if ( !impacts.length ) return null;
  pushActorScrollingText(scrollingText, action, "tokenMesh");

  // Influence sustains the charge into a melee channel: the hand keeps channeling while the element crusts onto
  // the target and a tinted glow saturates it, lingering past the climax. Touch leaves delivery empty.
  let deliverySound = null;
  let deliveryAnimations = [];
  let deliveryParticles = [];
  if ( channel ) {
    deliverySound = sound(getVFXSound(action.rune.id, "damage"));
    if ( deliverySound ) Object.assign(deliverySound, {loop: true, fade: 250, volume: 0.8});
    ({animations: deliveryAnimations, particles: deliveryParticles} = _buildChannelDelivery(action, runeProps,
      chargeCtx, {channel, deliveryDuration, lingerDuration, target: channelTarget}));
  }

  const chargeSound = (runeProps.chargeSound !== false) ? sound(getVFXSound(action.rune.id, "charge")) : null;
  const components = {
    contact: {
      type: "crucibleTouch",
      casterRadiusPx,
      originMesh: {reference: "tokenMesh"},
      targetMeshes: targetMeshRefs,
      charge: {duration: chargeDuration, sound: chargeSound, animations: [], particles: chargeParticles},
      delivery: {duration: deliveryDuration, sound: deliverySound, animations: deliveryAnimations,
        particles: deliveryParticles},
      impacts,
      scrollingText
    }
  };
  const timeline = [{component: "contact", position: 0}];
  return _finalizeSpellVFX(components, timeline, references, forcedMovements);
}

/* -------------------------------------------- */

/**
 * Per-target impact timing strategies for Blast spells. Each function returns an absolute timeline
 * ms for a single impact. Strategies are referenced by name from a rune's `impactTiming` field; the
 * configurator dispatches via {@link BLAST_IMPACT_TIMINGS} and bakes the result into each impact
 * entry's `start`.
 * @type {Record<string, (target: {x: number, y: number}, ctx: object) => number>}
 */
const BLAST_IMPACT_TIMINGS = {
  atStart(target, {deliveryStart}) {
    return deliveryStart;
  },
  atEnd(target, {deliveryStart, deliveryDuration}) {
    return deliveryStart + deliveryDuration;
  },
  fromCenter(target, {origin, radius, deliveryStart, deliveryDuration}) {
    const dist = Math.hypot(target.x - origin.x, target.y - origin.y);
    const t = Math.clamp(dist / Math.max(radius, 1), 0, 1);
    return deliveryStart + Math.round(t * deliveryDuration * 0.5);
  }
};

/* -------------------------------------------- */

/**
 * Configure the VFX for a Blast gesture composed spell as a {@link CrucibleBlastComponent} for the
 * explosion + per-target impacts, with optional precursor: when the rune declares a `projectile`
 * (e.g. a fireball flying from caster to blast center on a serpentine path), a separate
 * {@link CrucibleProjectileComponent} is built that carries the charge phase and delivers the
 * projectile; the blast's own charge.duration is then 0 and its component position on the parent
 * timeline is shifted to start when the projectile arrives at the blast center.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureBlastVFXEffect(action) {
  const regionShape = action.region?.shapes[0];
  if ( !regionShape || (regionShape.type !== "circle") ) return null;
  const runeProps = SPELL_VFX_GESTURES.blast.runes?.[action.rune.id];
  if ( !runeProps ) return null;
  const {textures} = resolveSpellVFXContext(action);
  const shapeData = regionShape.toObject();
  const {x, y, radius} = shapeData;
  const origin = {x, y};
  const {elevation: casterElevation, radiusPx: casterRadiusPx,
    center: casterCenter, meshSort: casterMeshSort} = _resolveCasterGeometry(action);
  const particleElevation = (action.region?.elevation?.top ?? casterElevation) + 1;
  const CHARGE_DURATION = runeProps.chargeDuration ?? 0;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const distancePixels = canvas.dimensions.distancePixels;

  const sound = _spellSound;

  const MASK_RADIUS_FACTOR = 1.5;
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };

  const projectileSpec = runeProps.projectile;
  let projectileComponent = null;
  let blastStartPosition = 0;
  let blastChargeDuration = CHARGE_DURATION;
  let blastChargeParticles = [];
  let blastChargeSound = null;

  if ( projectileSpec ) {
    const {x: casterCx, y: casterCy} = casterCenter;
    const dirDist = Math.max(1, Math.hypot(origin.x - casterCx, origin.y - casterCy));
    const manifestX = casterCx + (((origin.x - casterCx) / dirDist) * casterRadiusPx);
    const manifestY = casterCy + (((origin.y - casterCy) / dirDist) * casterRadiusPx);
    const manifestRef = "fireballManifest";
    const blastCenterRef = "fireballTarget";
    references[manifestRef] = {x: manifestX, y: manifestY, elevation: casterElevation,
      sort: casterMeshSort + 1, sortLayer: SL.TOKENS};
    references[blastCenterRef] = {x: origin.x, y: origin.y, elevation: particleElevation,
      sort: 0, sortLayer: SL.TOKENS};

    const projectileSpeed = projectileSpec.speed ?? 150;
    const distPx = Math.hypot(origin.x - manifestX, origin.y - manifestY);
    const flightMs = (distPx * 1000) / (projectileSpeed * distancePixels);
    const projectileTexture = projectileSpec.frame
      ? getVFXTexturePath(projectileSpec.frame)
      : (pickRandom(textures.projectile) ?? getRandomSprite("projectiles", "arrow"));

    const projectileChargeCtx = _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation});
    const projectileChargeLayers = runeProps.buildCharge?.(projectileChargeCtx)
      ?? _resolveChargeLayers(runeProps, projectileChargeCtx, {duration: CHARGE_DURATION});
    const projectileChargeSound = ((CHARGE_DURATION > 0) && (runeProps.chargeSound !== false))
      ? sound(getVFXSound(action.rune.id, "charge")) : null;
    const whooshKey = ("whoosh" in projectileSpec) ? projectileSpec.whoosh : "whooshFast";
    const flightSound = whooshKey ? sound(getVFXSound("generic", whooshKey)) : null;

    projectileComponent = {
      type: "crucibleProjectile",
      originMesh: {reference: "tokenMesh"},
      targetMeshes: [],
      path: [
        {reference: manifestRef, deltas: {}},
        {reference: blastCenterRef, deltas: {}}
      ],
      pathType: projectileSpec.path ?? {type: "linear", params: {}},
      charge: {duration: CHARGE_DURATION, sound: projectileChargeSound,
        animations: [{function: "chargeProjectileFadeIn"}], particles: projectileChargeLayers},
      delivery: {texture: projectileTexture, size: projectileSpec.size ?? 3,
        speed: projectileSpeed, sound: flightSound,
        animations: [{function: "deliveryProjectileFlight"}], particles: []},
      impacts: [],
      scrollingText: []
    };
    blastStartPosition = CHARGE_DURATION + flightMs;
    blastChargeDuration = 0;
  }
  else if ( CHARGE_DURATION > 0 ) {
    const chargeCtx = _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation});
    blastChargeParticles = runeProps.buildCharge?.(chargeCtx)
      ?? _resolveChargeLayers(runeProps, chargeCtx, {duration: CHARGE_DURATION});
    if ( runeProps.chargeSound !== false ) {
      blastChargeSound = sound(getVFXSound(action.rune.id, "charge"));
    }
  }

  const timingFn = BLAST_IMPACT_TIMINGS[runeProps.impactTiming] ?? BLAST_IMPACT_TIMINGS.fromCenter;
  const timingCtx = {origin, radius, deliveryStart: blastChargeDuration,
    deliveryDuration: runeProps.deliveryDuration};
  const impactType = runeProps.impactSound ?? "impact";
  const impacts = [];
  const targetMeshRefs = [];
  const scrollingText = [];
  const forcedMovements = [];
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const result = group.roll[0]?.roll?.data.result ?? null;
    const {tokenRef, meshRef} = _registerTargetRefs(references, "blastTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    const start = timingFn(tokenCenter(token), timingCtx);
    impacts.push(_buildTargetImpact({action, group, token, result, start, tokenRef, runeProps, textures,
      elevation: particleElevation, impactType, forcedMovements}));
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  pushActorScrollingText(scrollingText,
    action, projectileComponent ? "fireballManifest" : "tokenMesh");

  const buildCtx = {action, textures, origin, radius, particleElevation, casterElevation,
    casterRadiusPx, sound};
  const deliveryParticles = runeProps.buildDelivery(buildCtx);
  const sustainedLayers = (runeProps.sustainedChargeAnchor && !projectileComponent)
    ? _resolveChargeLayers(runeProps,
      _chargeContext(action, {textures, casterRadiusPx, casterElevation, particleElevation}),
      {anchor: runeProps.sustainedChargeAnchor, duration: runeProps.deliveryDuration})
    : [];
  const deliverySound = runeProps.deliverySoundType
    ? _resolveDeliverySound({action, sound}, runeProps.deliverySound ?? {}, runeProps.deliverySoundType)
    : null;

  const sounds = runeProps.buildSounds?.(buildCtx) ?? [];

  const components = {
    blast: {
      type: "crucibleBlast",
      shape: shapeData,
      casterRadiusPx,
      originMesh: {reference: "tokenMesh"},
      targetMeshes: targetMeshRefs,
      mask: {reference: "wallMask"},
      charge: {duration: blastChargeDuration, sound: blastChargeSound, animations: [],
        particles: blastChargeParticles},
      delivery: {duration: runeProps.deliveryDuration, sound: deliverySound, animations: [],
        particles: [...sustainedLayers, ...deliveryParticles]},
      impacts,
      scrollingText,
      sounds
    }
  };
  const timeline = [{component: "blast", position: blastStartPosition}];
  if ( projectileComponent ) {
    components.fireball = projectileComponent;
    timeline.unshift({component: "fireball", position: 0});
  }
  return _finalizeSpellVFX(components, timeline, references, forcedMovements);
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
      root: getVFXTexturePaths(runeId, "root"),
      spray: getVFXTexturePaths(runeId, "spray"),
      streak: getVFXTexturePaths(runeId, "streak")
    }
  };
}

/* -------------------------------------------- */

/**
 * Resolve the charge particle layers for a rune from its per-gesture props entry. Each `chargeLayers`
 * entry picks textures by `frames` (frame-name prefixes via {@link getVFXFrames}) or `categories`
 * (whole VFX_TEXTURES categories). Runes without `chargeLayers` get a single default spray-mote
 * fallback parameterizable via `sprayParams`. Shape works for arrow-style charges and ray-style
 * sustained channels - the caller picks the anchor and emission duration.
 * @param {object} runeProps     Per-rune VFX overrides (see ARROW_VFX_PROPS / RAY_VFX_PROPS).
 * @param {object} ctx           Resolution context.
 * @param {string} ctx.runeId    Required when any chargeLayers entry uses `frames`.
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.casterRadiusPx
 * @param {number} ctx.casterElevation
 * @param {number} [ctx.particleElevation]  Defaults to casterElevation when omitted.
 * @param {object} opts
 * @param {string} [opts.anchor]  Default layer anchor (defaults to runeProps.chargeAnchor ?? "origin"); an
 *                                individual layer's own `anchor` field wins over it.
 * @param {number} opts.duration  Emission duration (ms) for each layer.
 * @returns {object[]}
 */
function _resolveChargeLayers(runeProps, ctx, {anchor, duration}) {
  const {runeId, textures, casterRadiusPx, casterElevation, particleElevation = casterElevation} = ctx;
  const behavior = runeProps.chargeBehavior ?? "circleParticleGather";
  const a = anchor ?? runeProps.chargeAnchor ?? "origin";
  const elevationFor = (above, anch) => above ? (casterElevation + 1)
    : (((anch === "source") || (anch === "forward")) ? casterElevation : particleElevation);
  if ( runeProps.chargeLayers ) {
    return runeProps.chargeLayers.map(layer => {
      const layerTextures = layer.frames ? getVFXFrames(runeId, ...layer.frames)
        : layer.categories.flatMap(c => textures[c]);
      const rad = casterRadiusPx * (layer.radiusFactor ?? 2.0);
      const layerAnchor = layer.anchor ?? a;
      return {
        animation: layer.animation ?? behavior,
        anchor: layerAnchor, textures: layerTextures,
        offset: layer.offset ?? 0,
        duration: layer.duration ?? duration,
        params: {chargeRadius: rad, radius: rad, elevation: elevationFor(layer.above, layerAnchor),
          ...layer.params}
      };
    });
  }
  return [{
    animation: behavior, anchor: a, textures: textures.spray, duration,
    params: {chargeRadius: casterRadiusPx * 2.0, lifetime: 350, spawnRate: 480,
      elevation: elevationFor(runeProps.chargeAbove, a), ...runeProps.sprayParams}
  }];
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
 * @param {string} [soundType]      RUNE_SOUNDS type key to resolve; defaults to "damage".
 * @returns {object|null}
 */
function _resolveDeliverySound(ctx, params, soundType="damage") {
  const {action, sound} = ctx;
  const descriptor = sound(getVFXSound(action.rune.id, soundType));
  if ( descriptor ) Object.assign(descriptor, {loop: true, ...params});
  return descriptor;
}

/* -------------------------------------------- */

/**
 * Build impact particle layer configs from a rune's `impactParticles` value. Accepts either a single
 * spec or an array of specs; always returns an array (possibly empty), so callers do
 * `particles.push(..._buildImpactParticles(...))` without coercion. Each spec selects textures by
 * `frames` (frame-name prefixes via {@link getVFXFrames}) or `categories` (whole VFX_TEXTURES
 * categories), and supplies optional `params` overrides on top of canonical defaults. Default
 * animation is `circleParticleBurst` (impact spray); override `spec.animation` for other behaviors
 * (e.g. `circleParticleBloom` for growing flora at the target). Default radius is `gridSize * 0.12`;
 * override via `spec.radiusFactor`. Injected as both `radius` and `chargeRadius` so behaviors that
 * read either key are satisfied.
 * @param {CrucibleSpellAction} action
 * @param {SpecOrArray} specs   `SpecOrArray = Spec | Spec[]` where each `Spec` has
 *   `{animation?, duration?, radiusFactor?, frames?, categories?, params?}`.
 * @param {object} ctx
 * @param {string} [ctx.anchor="destination"]   Anchor for the layer (target-side at impact time).
 * @param {number} ctx.elevation                Particle elevation.
 * @param {SpellVFXTextures} [ctx.textures]     Required when any spec uses `categories`.
 * @returns {object[]}
 */
function _buildImpactParticles(action, specs, {anchor = "destination", elevation, textures}) {
  if ( !specs ) return [];
  const specArray = Array.isArray(specs) ? specs : [specs];
  const gridSize = canvas.dimensions.size;
  return specArray.map(spec => {
    const layerTextures = spec.frames
      ? getVFXFrames(action.rune.id, ...spec.frames)
      : spec.categories.flatMap(c => textures[c]);
    const radius = Math.round(gridSize * (spec.radiusFactor ?? 0.12));
    return {
      animation: spec.animation ?? "circleParticleBurst",
      anchor, textures: layerTextures, duration: spec.duration ?? 200,
      params: {radius, chargeRadius: radius, speed: {min: 70, max: 210}, count: 50, initial: 1,
        lifetime: {min: 650, max: 1100}, alpha: {min: 0.6, max: 1.0}, scale: {min: 0.5, max: 1.1},
        elevation, ...spec.params}
    };
  });
}

/* -------------------------------------------- */

/**
 * Resolve the shared per-target hit treatment for every gesture from the runeProps declarative toggles
 * (`impactSprite`, `recoil`, default true), the burst size (`impactSpriteSize`, default 2 feet), and the opt-in
 * fields (`impactParticles`, `impactGlow`). A critical hit rocks harder via `impactSpriteShake`; a force-moved
 * target keeps the burst/glow but drops the recoil (the knockback glide replaces it). A rune that wants a "soft"
 * restorative arrival just disables the burst and recoil and supplies its own particle spec.
 * @param {CrucibleSpellAction} action
 * @param {object} ctx
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.elevation
 * @param {boolean} [ctx.crit=false]          Critical hit: heavier shake instead of recoil.
 * @param {boolean} [ctx.knockback=false]     Target is force-moved: suppress the recoil (glide replaces it).
 * @param {number} [ctx.burstSize]            Override the burst sprite size (feet).
 * @param {number} [ctx.burstDuration=800]    Override the burst hold (ms).
 * @param {number} [ctx.flashDuration=150]    Override the burst ADD-blend flash window (ms).
 * @param {boolean} [ctx.suppressGlow=false]  Skip the rune's impact glow (e.g. when the gesture glows elsewhere).
 * @param {object} runeProps
 * @returns {{animations: object[], particles: object[]}}
 */
function _resolveHitTreatment(action, ctx, runeProps) {
  const {textures, elevation, crit=false, knockback=false, burstSize, burstDuration=800,
    flashDuration=150, suppressGlow=false} = ctx;
  const gridSize = canvas.dimensions.size;
  const animations = [];
  const particles = [];
  if ( !knockback && (runeProps?.recoil !== false) ) {
    animations.push(crit
      ? {function: "impactSpriteShake", params: {distance: Math.round(gridSize * 0.3), oscillations: 3, duration: 480}}
      : {function: "impactSpriteRecoil", params: {distance: Math.round(gridSize * 0.15), duration: 320}});
  }
  if ( (runeProps?.impactSprite !== false) && textures.impact.length ) {
    animations.push({function: "impactSpriteBurst",
      params: {texture: pickRandom(textures.impact), size: burstSize ?? runeProps?.impactSpriteSize ?? 2,
        duration: burstDuration, flash: true, flashDuration}});
  }
  if ( runeProps?.impactParticles ) {
    particles.push(..._buildImpactParticles(action, runeProps.impactParticles,
      {anchor: "destination", elevation, textures}));
  }
  if ( runeProps?.impactGlow && !suppressGlow ) {
    animations.push({function: "impactSpriteGlow", params: runeProps.impactGlow});
  }
  return {animations, particles};
}

/* -------------------------------------------- */

/**
 * Build the sustained-channel delivery for an Influence contact gesture: the rune's charge swirl held at the
 * caster's palm for the full channel, and (on a hit) the element crusting onto the target via lingering bloom
 * motes under a saturating tinted glow that builds through the channel and fades over the linger.
 * @param {CrucibleSpellAction} action
 * @param {object} runeProps
 * @param {object} chargeCtx               The charge resolution context (see {@link _resolveChargeLayers}).
 * @param {object} opts
 * @param {object} opts.channel            The gesture's channel descriptor.
 * @param {number} opts.deliveryDuration   Channel length (ms).
 * @param {number} opts.lingerDuration     Post-climax glow/coat fade (ms).
 * @param {{hit: boolean, radiusPx: number, elevation: number}|null} opts.target
 * @returns {{animations: object[], particles: object[]}}
 */
function _buildChannelDelivery(action, runeProps, chargeCtx, {channel, deliveryDuration, lingerDuration, target}) {
  const runeId = action.rune.id;
  const animations = [];
  const particles = _resolveChargeLayers(runeProps, chargeCtx, {anchor: "palm", duration: deliveryDuration});
  if ( !target?.hit ) return {animations, particles};

  // The element crusts onto the target and holds (bloom motes that appear in place and linger)
  const coatTextures = getVFXTexturePaths(runeId, "spray");
  if ( coatTextures.length ) {
    particles.push({
      animation: "circleParticleBloom", anchor: "destination", textures: coatTextures, duration: deliveryDuration,
      params: {chargeRadius: Math.round(target.radiusPx * (channel.coatRadiusFactor ?? 1.1)), growFraction: 0.5,
        lifetime: {min: 1000, max: 1700}, spawnRate: 70, alpha: {min: 0.5, max: 0.95}, scale: {min: 0.5, max: 1.1},
        elevation: target.elevation, fade: {in: 0.2, out: 0.45}}
    });
  }

  // A tinted glow gradually overtakes the target, its strength building across the channel to a peak at the
  // climax then easing out over the linger
  animations.push({function: "impactSpriteGlow",
    params: {glowColor: channel.glow?.[runeId] ?? 0xffffff, duration: deliveryDuration + lingerDuration,
      fadeOut: lingerDuration, outerStrength: 5, innerStrength: 2,
      distance: 12, padding: 14, quality: 0.5, alpha: 0.9}});
  return {animations, particles};
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
  const chargeCtx = _chargeContext(action, {textures: ctx.textures, casterRadiusPx: ctx.casterRadiusPx,
    casterElevation: ctx.casterElevation, particleElevation: ctx.beamElevation});
  const chargeEmitDuration = ctx.CHARGE_DURATION + (runeProps.chargeTail ?? 0);
  const chargeParticles = _resolveChargeLayers(runeProps, chargeCtx,
    {anchor: runeProps.chargeAnchor, duration: chargeEmitDuration});
  const sustainedLayers = runeProps.sustainedChargeAnchor
    ? _resolveChargeLayers(runeProps, chargeCtx,
      {anchor: runeProps.sustainedChargeAnchor, duration: runeProps.deliveryDuration})
    : [];
  const deliverySound = _resolveDeliverySound(ctx, runeProps.deliverySound, runeProps.deliverySoundType);
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
/*  Configuration Helpers                       */
/* -------------------------------------------- */

/**
 * Build a particle exposure curve that starts hot and settles back to normal.
 * @param {number} t    Normalized time [0, 1] when the particle cools to normal exposure
 * @param {object} [options]
 * @param {boolean} [options.reverse=false]  Start normal and become hot after t
 * @param {number} [options.normal=0]        The normal exposure value
 * @param {number} [options.hot=1]           The hot exposure value
 * @returns {{curve: Array<{time: number, value: number}>}}
 */
function _exposureInHot(t, {reverse=false, normal=0, hot=0.5}={}) {
  const curve = reverse
    ? [{time: 0, value: normal}, {time: t, value: hot}]
    : [{time: 0, value: hot}, {time: t, value: normal}];
  if ( t < 1 ) curve.push({time: 1, value: curve[1].value});
  return {curve};
}

// Reusable vortex charge-up for Flame spells
const _CHARGE_FLAME_VORTEX = {
  chargeBehavior: "circleParticleVortex", chargeAnchor: "source",
  chargeLayers: [
    {categories: ["spray"], above: true, radiusFactor: 2.0,
      params: {spawnRate: 560, spawnRateEnd: 160, scale: {min: 1.25, max: 2.0}, alpha: {min: 0.4, max: 0.9},
        blend: PIXI.BLEND_MODES.ADD}},
    {frames: ["AirSmoke"], above: false, animation: "circleParticleResidue", radiusFactor: 2.0, params: {
      spawnRate: 25, count: null, initial: 0.2, lifetime: {min: 800, max: 1600},
      alpha: {min: 0.25, max: 0.5}, scale: {min: 0.75, max: 1.25}, tint: 0x6B5A48,
      blend: PIXI.BLEND_MODES.NORMAL, fade: {in: 0.25, out: 0.5}
    }}
  ]
};

// Reusable icicles charge-up for Frost spells
const _CHARGE_FROST_ICICLES = {
  chargeBehavior: "circleParticleGather", chargeAnchor: "origin",
  chargeLayers: [
    {categories: ["spray"], above: true, radiusFactor: 2.0,
      params: {lifetime: 350, spawnRate: 480,
        alpha: {min: 0.5, max: 1.0}, scale: {min: 0.5, max: 1.0},
        exposure: _exposureInHot(0.5, {reverse: true})}},
    {categories: ["air"], above: false, animation: "circleParticleResidue", radiusFactor: 1.5,
      params: {lifetime: {min: 1500, max: 2200}, spawnRate: 120, count: 30, initial: 0.3,
        alpha: {min: 0.08, max: 0.22}, scale: {min: 0.8, max: 1.4},
        blend: PIXI.BLEND_MODES.NORMAL, fade: {in: 0.15, out: 0.5}}}
  ]
};

// Reusable bloom charge-up for Life spells
const _CHARGE_LIFE_BLOOMS = {
  chargeBehavior: "circleParticleBloom", chargeAnchor: "source",
  chargeLayers: [
    {frames: ["GroundRoots"], above: false, radiusFactor: 1.5,
      params: {sort: -1, lifetime: {min: 2000, max: 4000}, spawnRate: 2, scale: {min: 1.25, max: 2.0},
        fade: {in: 0.2, out: 0.9}}},
    {frames: ["GroundBlooms"], above: false, radiusFactor: 2,
      params: {sort: 0, lifetime: {min: 2000, max: 4000}, spawnRate: 10, scale: {min: 1.0, max: 1.5}}},
    {categories: ["spray"], above: true, radiusFactor: 2.5,
      params: {lifetime: {min: 900, max: 1500}, spawnRate: 80, scale: {min: 0.5, max: 0.8},
        exposure: _exposureInHot(0.5)}}
  ]
};

// Reusable orbit charge-up for Death spells: the caster tears bone from the ground and holds the fragments
// in a wobbling ring at a fixed radius, under a slow overhead swirl of spectral bone.
const _CHARGE_DEATH_ORBIT = {
  chargeBehavior: "circleParticleOrbit", chargeAnchor: "source",
  sustainedChargeAnchor: "source",
  chargeLayers: [
    {frames: ["GroundBonesDense"], above: false, animation: "circleParticleBloom", radiusFactor: 1.9,
      params: {growFraction: 0.4, spawnRate: 4.5, lifetime: {min: 1200, max: 2200},
        alpha: {min: 0.55, max: 0.9}, scale: {min: 0.8, max: 1.4},
        fade: {in: 0.15, out: 0.4}, blend: PIXI.BLEND_MODES.NORMAL, sort: 0}},
    {frames: ["SprayBone"], above: true, radiusFactor: 1.6,
      params: {orbitSpeed: 2.2, spinSpeed: 3, radiusJitter: 0.12,
        wobbleAmplitude: 0.07, wobbleSpeed: 2.2, speedJitter: 0.15,
        spawnRate: 60, lifetime: {min: 1200, max: 1800},
        alpha: {min: 0.75, max: 1.0}, scale: {min: 0.5, max: 0.9},
        fade: {in: 0.12, out: 0.3}, blend: PIXI.BLEND_MODES.NORMAL}},
    {frames: ["AirBonesSwirling"], above: true, radiusFactor: 1.2,
      params: {orbitSpeed: 1.1, spinSpeed: 2.6, radiusJitter: 0.2,
        wobbleAmplitude: 0.1, wobbleSpeed: 1.4, speedJitter: 0.2,
        spawnRate: 5, lifetime: {min: 1800, max: 2800},
        alpha: {min: 0.08, max: 0.20}, scale: {min: 1.2, max: 2.0},
        fade: {in: 0.2, out: 0.45}, blend: PIXI.BLEND_MODES.ADD}}
  ]
};

// Reusable impact treatment for Frost spells
const _IMPACT_FROST = {
  impactParticles: {
    categories: ["spray"],
    params: {count: 24, speed: {min: 50, max: 150}, lifetime: {min: 400, max: 800},
      alpha: {min: 0.4, max: 0.9}, scale: {min: 0.4, max: 0.9}}
  }
};

// Reusable impact treatment for Flame spells
const _IMPACT_FLAME = {
  impactParticles: {
    categories: ["spray"],
    params: {count: 24, speed: {min: 50, max: 150}, lifetime: {min: 400, max: 800},
      alpha: {min: 0.4, max: 0.9}, scale: {min: 0.4, max: 0.9}}
  }
};

// Reusable impact treatment for Death spells: particle-driven rather than leaning on the rune's single impact
// sprite, with bone shrapnel, dissipating wisps, and spikes erupting at the target's feet.
const _IMPACT_DEATH = {
  impactSpriteSize: 2,
  impactParticles: [
    {
      frames: ["SprayBone"],
      params: {count: 20, speed: {min: 60, max: 200}, lifetime: {min: 500, max: 900},
        alpha: {min: 0.5, max: 1.0}, scale: {min: 0.5, max: 1.0},
        rotationSpread: Math.PI, blend: PIXI.BLEND_MODES.NORMAL}
    },
    {
      frames: ["SprayWisps"],
      params: {count: 24, speed: {min: 40, max: 140}, lifetime: {min: 600, max: 1100},
        alpha: {min: 0.4, max: 0.85}, scale: {min: 0.4, max: 0.9},
        fade: {in: 0.05, out: 0.5}, blend: PIXI.BLEND_MODES.ADD}
    },
    {
      animation: "circleParticleBloom",
      frames: ["GroundBoneSpikes"],
      radiusFactor: 0.3,
      duration: 400,
      params: {count: 3, initial: 3, spawnRate: 0,
        lifetime: {min: 2500, max: 4000},
        scale: {min: 0.8, max: 1.4}, growFraction: 0.35,
        alpha: {min: 0.7, max: 1.0},
        fade: {in: 0.1, out: 0.5},
        blend: PIXI.BLEND_MODES.NORMAL,
        elevation: 0}
    }
  ]
};

// Reusable impact treatment for Life spells: soft restorative arrival (no recoil/burst) + glow +
// leaf/bubble spray + GroundBlooms growing at the target's feet.
const _IMPACT_LIFE = {
  impactSprite: false, recoil: false,
  impactGlow: {
    glowColor: 0xff5dc0, outerStrength: 6, innerStrength: 2, distance: 20, quality: 0.5, padding: 16,
    knockout: false, alpha: 1.0, duration: 1500, fadeOut: 1100
  },
  impactParticles: [
    {frames: ["SprayLeaf", "SprayBubble"]},
    {
      animation: "circleParticleBloom",
      frames: ["GroundBlooms"],
      radiusFactor: 0.3,
      duration: 400,
      params: {count: 3, initial: 3, spawnRate: 0,
        lifetime: {min: 3500, max: 5000},
        scale: {min: 1.0, max: 1.8}, growFraction: 0.35,
        alpha: {min: 0.85, max: 1.0},
        fade: {in: 0.1, out: 0.5},
        blend: PIXI.BLEND_MODES.NORMAL,
        elevation: 0}
    }
  ]
};

/* -------------------------------------------- */
/*  Per-Gesture Configuration                   */
/* -------------------------------------------- */

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
 * - `chargeAbove` (boolean): draw the charge particles above the token rather than at ground level
 *   (only consulted by the default spray-mote fallback when no `chargeLayers` are declared).
 * - `chargeLayers` ([{frames|categories, above, radiusFactor, animation, offset, duration, params}]):
 *   explicit charge layers. `frames` selects by frame-name prefix; `categories` selects whole
 *   VFX_TEXTURES categories. `animation` overrides the rune's chargeBehavior for that one layer
 *   (e.g. `circleParticleResidue` for a lingering mist layer). `offset` and `duration` override the
 *   default timing (caller's phase start + duration). Each layer also receives `chargeRadius` and
 *   `radius` (the same casterRadiusPx-scaled value) plus a derived `elevation` in its params.
 * - `chargeTail` (number): ms the charge particles keep emitting past the projectile-release label
 *   (default 200; negative ends emission before release).
 * - `sprayParams` (object): per-layer material overrides applied when no `chargeLayers` are declared
 *   and the default spray-mote fallback layer is used.
 *
 * Impact:
 * - `stickDuration` (number): ms the projectile sprite stays at the impact location after a
 *   HIT/GLANCE before fading. Omit or 0 for no stick.
 * - `impactSprite` (boolean): show the impact burst sprite on a hit (default true).
 * - `recoil` (boolean): rock/shake the struck token on a hit (default true).
 * - `impactParticles` ({frames|categories, params}): a particle burst at the target on hit. Resolved
 *   by {@link _buildImpactParticles}; selects textures by frame-name prefixes or VFX_TEXTURES
 *   categories, with optional `params` overrides on top of canonical defaults.
 * - `impactGlow` (object): {@link impactSpriteGlow} params for a restorative-magic glow on the target.
 *
 * @type {Record<string, object>}
 */
const ARROW_VFX_PROPS = {

  // Arrow+Frost
  frost: {..._CHARGE_FROST_ICICLES, ..._IMPACT_FROST, stickDuration: 1500, projectileSize: 2, trail: true},

  // Arrow+Death: bones surface around the caster, stream forward, and condense into a bone shard bolt
  death: {
    ..._IMPACT_DEATH,
    chargeBehavior: "circleParticleGather", chargeAnchor: "origin",
    chargeDuration: 1100, chargeTail: 0,
    chargeLayers: [
      { // Bones erupting around the gather point all at once, receding as the shards lift away
        frames: ["GroundBonesDense"], above: false,
        animation: "circleParticleBloom", radiusFactor: 1.8, duration: 200,
        params: {count: 16, initial: 16, spawnRate: 0, growFraction: 0.15,
          lifetime: {min: 1000, max: 1300},
          alpha: {min: 0.55, max: 0.9}, scale: {min: 0.7, max: 1.2},
          fade: {in: 0.4, out: 0.55}, blend: PIXI.BLEND_MODES.NORMAL, sort: 0}},
      { // Shards lifting off and streaming into the manifest point, the last arriving exactly at release
        frames: ["SprayBone"], above: true, radiusFactor: 2.0,
        offset: 300, duration: 400,
        params: {lifetime: 400, spawnRate: 260,
          alpha: {min: 0.7, max: 1.0}, scale: {min: 0.5, max: 0.9},
          blend: PIXI.BLEND_MODES.NORMAL}}
    ],
    projectileFrame: "death/ProjectileBoneArrow", projectileSize: 3,
    path: {type: "weave", params: {arcCount: 2, amplitude: 0.1}},
    stickDuration: 1200, trail: true
  },

  // Arrow+Life
  life: {
    ..._CHARGE_LIFE_BLOOMS,
    ..._IMPACT_LIFE,
    projectileSize: 3, projectileFrame: "life/ProjectileBubble", projectileSpeed: 30,
    flightSound: {rune: "life", type: "passive", offset: -1200, release: 400, fade: 400},
    chargeDuration: 1500,
    trail: {frames: ["SprayBubble"], params: {align: false, speed: {min: 2, max: 12},
      lifetime: {min: 800, max: 1400}, spawnRate: 40, scale: {min: 0.4, max: 0.9},
      alpha: {min: 0.4, max: 0.85}, blend: PIXI.BLEND_MODES.NORMAL}}
  },

  // Arrow+Flame
  flame: {
    ..._CHARGE_FLAME_VORTEX,
    ..._IMPACT_FLAME,
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
 * `buildDelivery(ctx)`; the charge phase uses the same chargeXxx / sprayParams fields documented on
 * {@link ARROW_VFX_PROPS}.
 *
 * Delivery:
 * - `beamSpeed` (number, optional): px/sec base for `beamFront` impact timing and (often) particle
 *   velocity. Configurator-side value; not on the persisted ray-component schema. If omitted, the
 *   configurator auto-derives a speed so the front reaches the end of the beam at exactly
 *   `deliveryDuration`. Declare an explicit value when the beam should arrive early and sustain
 *   (e.g. frost ray: 3000 px/s on a ~1500px beam over 3000ms - arrives in ~500ms, sustains).
 * - `deliveryDuration` (number): ms the delivery phase emits.
 * - `deliverySound` ({fade, offset, release}): looping damage-sound envelope for the delivery phase.
 * - `sustainedChargeAnchor` (string): if set, duplicate the charge layers into the delivery phase at
 *   this anchor (e.g. life ray "channels" the charge across the full delivery).
 * - `buildDelivery(ctx)` (function): rune-specific delivery layer composition. Receives the builder
 *   context (including the resolved `ctx.beamSpeed`) and returns particle-layer configs for
 *   `delivery.particles`. Prefer `ctx.beamSpeed` over `this.beamSpeed` so the auto-derive path works.
 *
 * Impact (shape shared with {@link ARROW_VFX_PROPS}: impactSprite/recoil booleans, impactParticles
 * opt-in spec, impactGlow opt-in filter):
 * - `impactTiming` (string): named strategy from {@link RAY_IMPACT_TIMINGS} that computes per-target
 *   impact start times (e.g. `"beamFront"` for staggered, `"atEnd"` for simultaneous-at-completion).
 * - `impactSound` (string): per-target impact sound type (default "impact"); "impactHeavy" for
 *   runes like fire whose impacts should hit harder.
 *
 * @type {Record<string, object>}
 */
const RAY_VFX_PROPS = {

  // Ray+Death
  death: {
    ..._CHARGE_DEATH_ORBIT,
    ..._IMPACT_DEATH,
    deliveryDuration: 2500,
    impactTiming: "beamFront",
    deliverySoundType: "damage",
    deliverySound: {fade: 700, offset: -500, release: 600},
    buildDelivery(ctx) {
      const {action, width, beamElevation, spawnRadius, beamSpeed} = ctx;
      const runeId = action.rune.id;
      const DELIVERY_DURATION = this.deliveryDuration;
      return [
        { // Tight jet of bone needles streaming down the beam, sparse enough to read as individual shards
          animation: "rayParticleBeam", anchor: "origin",
          textures: getVFXFrames(runeId, "StreakBoneShard"),
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: beamSpeed * 1.5, angleSpread: 0.5, radius: spawnRadius,
            spawnRate: 28, rotationSpread: 0.03,
            alpha: {min: 0.75, max: 1.0}, scale: {min: 0.35, max: 0.6},
            fade: {in: 40, out: 200}, blend: PIXI.BLEND_MODES.NORMAL, elevation: beamElevation}
        },
        { // Bone spikes erupting from the ground as the front marches out along the beam
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundBoneSpikes"),
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.5), spacing: 52,
            rotationSpread: Math.toRadians(15),
            lifetime: {min: DELIVERY_DURATION + 2000, max: DELIVERY_DURATION + 3500},
            alpha: {min: 0.7, max: 1.0}, scale: {min: 0.8, max: 1.3},
            fade: {in: 60, out: 1200}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0, sort: 0}
        },
        { // Spike fans, mirrored along the beam axis so the curl points at the target rather than back
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundSpikesFan"),
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.5), spacing: 52,
            rotationSpread: Math.toRadians(15), flipX: true,
            lifetime: {min: DELIVERY_DURATION + 2000, max: DELIVERY_DURATION + 3500},
            alpha: {min: 0.7, max: 1.0}, scale: {min: 0.8, max: 1.3},
            fade: {in: 60, out: 1200}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0, sort: 0}
        },
        { // Grasping hands layered over the spikes: splayed +/-45 deg off the beam heading, mirrored at
          // random for handedness, each rising and withdrawing as the front passes
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundHandGrasp"),
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.35), spacing: 120,
            rotationSpread: Math.toRadians(45), randomFlipY: true,
            emergeDuration: 180, holdDuration: 700, withdrawDuration: 220,
            alpha: {min: 0.8, max: 1.0}, scale: {min: 0.9, max: 1.4},
            blend: PIXI.BLEND_MODES.NORMAL, elevation: 0, sort: 1}
        }
      ];
    }
  },

  // Ray+Frost
  frost: {
    ..._CHARGE_FROST_ICICLES,
    ..._IMPACT_FROST,
    chargeLayers: [
      {..._CHARGE_FROST_ICICLES.chargeLayers[0],
        params: {..._CHARGE_FROST_ICICLES.chargeLayers[0].params,
          blend: PIXI.BLEND_MODES.NORMAL, exposure: 1.0}},
      _CHARGE_FROST_ICICLES.chargeLayers[1]
    ],
    beamSpeed: 3000, deliveryDuration: 3000,
    impactTiming: "beamFront",
    deliverySound: {fade: 700, offset: -500, release: 600},
    buildDelivery(ctx) {
      const {textures, beamElevation, spawnRadius, width, beamSpeed} = ctx;
      const DELIVERY_DURATION = this.deliveryDuration;
      return [
        { // Concentrated forward beam: a tight rectangular profile fired along the heading
          animation: "rayParticleBeam", anchor: "origin", textures: textures.streak,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: beamSpeed, angleSpread: 0.5, radius: spawnRadius, spawnRate: 1200,
            rotationSpread: 0.05, alpha: {min: 0.5, max: 0.9}, scale: {min: 0.5, max: 1.1},
            fade: {in: 30, out: 150}, blend: PIXI.BLEND_MODES.NORMAL,
            exposure: _exposureInHot(0.5), elevation: beamElevation}
        },
        { // Cast-off flare: a slow, wide, short-lived spray softening the beam's root
          animation: "rayParticleRootCastoff", anchor: "origin", textures: textures.spray,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: beamSpeed, coneDeg: 60, radius: spawnRadius, spawnRate: 240,
            rotationSpread: 0.3, lifetime: {min: 200, max: 400}, alpha: {min: 0.75, max: 1.0},
            scale: {min: 0.6, max: 1.2}, fade: {in: 0, out: 150}, blend: PIXI.BLEND_MODES.NORMAL,
            exposure: _exposureInHot(0.5), elevation: beamElevation}
        },
        { // Ground cascade: static shards deposited along the beam path as the front sweeps through
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.impact,
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.8), spacing: 20, alpha: {min: 0.6, max: 0.9},
            scale: {min: 0.6, max: 1.0}, elevation: 0}
        }
      ];
    }
  },

  // Ray+Flame
  flame: {
    ..._CHARGE_FLAME_VORTEX,
    ..._IMPACT_FLAME,
    deliveryDuration: 1200, // LINE_DURATION - ms for the flame line to traverse origin -> end
    impactTiming: "atEnd",
    deliverySound: {fade: 600, offset: -400, release: 500},
    impactSound: "impactHeavy",
    buildDelivery(ctx) {
      const {textures, beamElevation, width, casterElevation} = ctx;
      const LINE_DURATION = this.deliveryDuration;
      const ERUPTION_DURATION = 500;
      return [
        { // Flame line: streak particles igniting at the marching front
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.streak,
          duration: LINE_DURATION, mask: true,
          params: {width: Math.round(width * 0.35), spacing: 10, burnToEnd: true, burnTail: 400,
            rotationSpread: 0.08,
            scale: {min: 0.45, max: 0.85}, alpha: {min: 0.75, max: 1.0},
            fade: {in: 20, out: 200}, fadeOutMs: 200,
            blend: PIXI.BLEND_MODES.ADD, elevation: 1}
        },
        { // Ground scorch: static dark deposits along the line, lingering past the eruption as scorch
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.ground,
          duration: LINE_DURATION, mask: true,
          params: {width: Math.round(width * 0.7), spacing: 28,
            lifetime: {min: LINE_DURATION + 3500, max: LINE_DURATION + 5000},
            scale: {min: 0.9, max: 1.6}, alpha: {min: 0.45, max: 0.8},
            fade: {in: 100, out: 1500}, blend: PIXI.BLEND_MODES.NORMAL,
            exposure: _exposureInHot(1, {normal: -1, hot: 1}), elevation: 0}
        },
        { // Ground smoke: low haze rising slowly along the line, drifting up and dissipating
          animation: "rayParticleGroundCascade", anchor: "origin", textures: textures.air,
          duration: LINE_DURATION, mask: true,
          params: {width: Math.round(width * 0.4), spacing: 38,
            lifetime: {min: 1600, max: 2600},
            velocity: {speed: [12, 32], angle: [258, 282]},
            scale: {min: 1.2, max: 2.0}, alpha: {min: 0.12, max: 0.35},
            fade: {in: 200, out: 700}, tint: 0x6B5A48,
            blend: PIXI.BLEND_MODES.NORMAL, elevation: casterElevation + 1}
        },
        { // Combustion: at LINE_DURATION the whole line bursts in a single intense gout
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
        { // Residue: drifting smoke trail left behind by the eruption
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

  // Ray+Life
  life: {
    ..._CHARGE_LIFE_BLOOMS,
    ..._IMPACT_LIFE,
    beamSpeed: 750, // TODO needs to be in ft/sec independent of grid size
    deliveryDuration: 3000,
    impactTiming: "beamFront",
    deliverySound: {fade: 500, offset: -300, release: 600},
    deliverySoundType: "damage",
    sustainedChargeAnchor: "source",

    buildDelivery(ctx) {
      const {action, textures, width, casterElevation, beamSpeed} = ctx;
      const runeId = action.rune.id;
      const DELIVERY_DURATION = this.deliveryDuration;
      const LINGER = 5000;
      const rootLifetime = {min: DELIVERY_DURATION + LINGER, max: DELIVERY_DURATION + LINGER + 1500};
      return [
        { // Roots laid along the beam axis with subtle rotation jitter (~+/-10 deg)
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: textures.root,
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.5), spacing: 30,
            rotationSpread: Math.toRadians(10),
            lifetime: rootLifetime,
            scale: {min: 0.9, max: 1.2}, alpha: {min: 0.75, max: 1.0},
            fade: {in: 100, out: 1500}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        { // GroundRoots scattered at random rotations as the front sweeps to the end
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundRoots"),
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.7), spacing: 50,
            rotationSpread: Math.PI,
            lifetime: rootLifetime,
            scale: {min: 0.8, max: 1.4}, alpha: {min: 0.5, max: 0.85},
            fade: {in: 200, out: 1800}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        {
          animation: "rayParticleHeadCastoff", anchor: "origin",
          textures: getVFXFrames(runeId, "Spray"),
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: 60, headSpeed: beamSpeed, headJitter: 30,
            angleSpread: 120, alignVelocity: false,
            rotationSpread: Math.PI, rotationSpeed: {min: -0.3, max: 0.3},
            spawnRate: 30,
            lifetime: {min: 500, max: 1000}, lifetimeOriginBoost: 3000,
            scale: {min: 0.7, max: 1.4}, alpha: {min: 0.35, max: 0.65},
            fade: {in: 250, out: 1800},
            blend: PIXI.BLEND_MODES.ADD,
            elevation: casterElevation + 1}
        }
      ];
    }
  }
};

/* -------------------------------------------- */

/**
 * Per-rune VFX overrides for the Blast gesture. Each entry may declare:
 * - `chargeDuration` (ms): pre-eruption charge phase length (default 0 - skip charge).
 * - `deliveryDuration` (ms): delivery phase length.
 * - `impactTiming` (string): named strategy from {@link BLAST_IMPACT_TIMINGS} that computes per-target
 *   impact start times. Defaults to `"fromCenter"` (staggered outward from blast origin).
 * - `impactSound` ("impact" | "impactHeavy"): RUNE_SOUNDS key for hit cues.
 * - `deliverySoundType` (string): RUNE_SOUNDS key for the looping delivery sound (omit for silent).
 * - `deliverySound` ({fade, offset, release}): envelope params when delivery sound is enabled.
 * - `buildDelivery(ctx)`: returns the delivery particle-layer array. `ctx` carries `{action,
 *   textures, origin, radius, particleElevation, casterElevation, casterRadiusPx, sound}`.
 * - `buildSounds(ctx)` (optional): returns an array of `{sound, time, origin?}` cues scheduled on the
 *   blast component's `sounds` array, e.g. a sequence of impact-sound cracks across a falling-debris
 *   storm in addition to the per-target impact sounds.
 * - `sustainedChargeAnchor` (string): when set, duplicate the charge layers into the delivery phase
 *   at this anchor (e.g. life blast "channels" the charge across the maelstrom). Ignored when a
 *   `projectile` precursor is present (the projectile carries the charge instead).
 * - `projectile` ({speed, size, frame, path, whoosh}): opt-in fireball-style precursor. When set,
 *   the configurator builds a separate {@link CrucibleProjectileComponent} that carries the charge
 *   phase + flies a projectile sprite from the caster to the blast center on `path` (a `pathType`
 *   spec like `{type: "weave", params: {arcCount, amplitude}}`). The blast's own charge.duration
 *   is then 0 and the blast component shifts on the parent timeline to start when the projectile
 *   lands. `whoosh` defaults to "whooshFast"; pass `null` to silence the launch cue.
 * - All the chargeXxx fields consumed by {@link _resolveChargeLayers} (chargeBehavior, chargeAnchor,
 *   chargeAbove, chargeLayers, sprayParams, ...). When `projectile` is declared these apply to the
 *   projectile component's charge phase, not the blast component's.
 * - All the impactXxx fields consumed by {@link _resolveHitTreatment} (impactSprite, recoil,
 *   impactParticles, impactGlow) - matches the arrow/ray declarative impact shape.
 * @type {Record<string, object>}
 */
const BLAST_VFX_PROPS = {

  // Blast+Death
  death: {
    ..._CHARGE_DEATH_ORBIT,
    ..._IMPACT_DEATH,
    chargeDuration: 1000,
    deliveryDuration: 3500,
    deliverySoundType: "damage",
    deliverySound: {fade: 700, offset: -500, release: 600},
    impactTiming: "fromCenter",
    buildDelivery(ctx) {
      const {action, textures, origin, radius, particleElevation} = ctx;
      const runeId = action.rune.id;
      const STORM_DURATION = this.deliveryDuration;
      const SPAWN_RATE = 14;
      const EMERGE_DELAY = 500;
      const area = {type: "circle", x: origin.x, y: origin.y, radius};
      return [
        { // Fissures cracking open across the blast circle, each recording a site for a hand to rise from
          animation: "blastParticleEmergenceSite", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundFissureLarge", "GroundFissureSmall"),
          duration: STORM_DURATION, mask: true,
          params: {spawnRate: SPAWN_RATE, count: null, growDuration: 180,
            lifetime: {min: 2500, max: 4000},
            scale: {min: 0.7, max: 1.2}, alpha: {min: 0.6, max: 0.9},
            fade: {in: 60, out: 1200}, area,
            blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        { // Skeletal hands bursting from each fissure half a second after it opens, then withdrawing
          animation: "blastParticleEmergingSprite", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundBoneHand"),
          duration: STORM_DURATION, mask: true,
          params: {spawnRate: SPAWN_RATE, count: null,
            emergeDelay: EMERGE_DELAY, emergeDuration: 180, holdDuration: 600, withdrawDuration: 220,
            rotationSpread: Math.PI / 3,
            scale: {min: 0.9, max: 1.4}, alpha: {min: 0.85, max: 1.0},
            fade: {in: 0, out: 0}, area,
            blend: PIXI.BLEND_MODES.NORMAL, elevation: 0, sort: 1}
        },
        { // Spectral haze of swirling bones and grave mist hanging over the area
          animation: "shapeParticleResidue", anchor: "origin",
          textures: textures.air, duration: STORM_DURATION, mask: true,
          params: {spawnRate: 25, count: null,
            area: {type: "circle", x: origin.x, y: origin.y, radius: Math.round(radius * 1.15)},
            speed: {min: 8, max: 28}, lifetime: {min: 2200, max: 3200},
            scale: {min: 1.2, max: 2.2}, alpha: {min: 0.10, max: 0.28},
            rotationSpeed: {min: -0.4, max: 0.4},
            scaleCurve: [{time: 0, value: 0.8}, {time: 1, value: 1.5}],
            fade: {in: 200, out: 1400}, blend: PIXI.BLEND_MODES.ADD,
            elevation: particleElevation + 1}
        },
        { // Spiral of spectral wisps winding outward from the center across the area
          animation: "circleParticleSpiral", anchor: "origin",
          textures: getVFXFrames(runeId, "SprayWisps"),
          duration: STORM_DURATION, mask: true,
          params: {chargeRadius: Math.round(radius * 1.2),
            innerRadius: Math.round(radius * 0.18), radiusJitter: 0.3,
            swirlSpeed: 3.0, spinSpeed: 3.5,
            spawnRate: 260, lifetime: {min: 1800, max: 2600},
            scale: {min: 0.5, max: 1.0}, alpha: {min: 0.55, max: 0.95},
            fade: {in: 0.1, out: 0.4}, blend: PIXI.BLEND_MODES.ADD,
            elevation: particleElevation + 1}
        }
      ];
    }
  },

  // Blast+Frost
  frost: {
    ..._CHARGE_FROST_ICICLES,
    ..._IMPACT_FROST,
    chargeAnchor: "forward",
    chargeDuration: 1000,
    deliveryDuration: 4000,
    deliverySoundType: "damage",
    deliverySound: {fade: 700, offset: -500, release: 600},
    impactTiming: "fromCenter",
    buildSounds(ctx) {
      const {action, sound} = ctx;
      const STORM_DURATION = this.deliveryDuration;
      const CHARGE_DURATION = this.chargeDuration;
      const CUES = 6;
      const cues = [];
      for ( let i = 0; i < CUES; i++ ) {
        const cue = sound(getVFXSound(action.rune.id, "impact"));
        if ( !cue ) break;
        const t = (i + (Math.random() * 0.6)) / CUES;
        cues.push({sound: cue, time: CHARGE_DURATION + Math.round(t * STORM_DURATION)});
      }
      return cues;
    },
    buildDelivery(ctx) {
      const {action, textures, origin, radius, particleElevation} = ctx;
      const runeId = action.rune.id;
      const STORM_DURATION = this.deliveryDuration;
      const fallingTextures = getVFXFrames(runeId, "Falling");
      const groundTextures = getVFXTexturePaths(runeId, "ground");
      const airTextures = textures.air;
      return [
        { // Falling shards across the blast circle, shrinking and darkening as they "fall" to the ground
          animation: "blastParticleFallingDebris", anchor: "origin",
          textures: fallingTextures.length ? fallingTextures : textures.spray,
          duration: STORM_DURATION, mask: true,
          params: {fallDuration: 350, startScale: 2.5, endScale: 1.0, darkening: 0.4,
            speed: {min: 10, max: 30}, spawnRate: 60,
            scale: {min: 0.3, max: 0.6}, alpha: {min: 0.7, max: 1.0},
            elevation: particleElevation,
            area: {type: "circle", x: origin.x, y: origin.y, radius},
            blend: PIXI.BLEND_MODES.NORMAL}
        },
        { // Ground deposit: persistent cracks/blast marks left behind after the storm
          animation: "shapeParticleResidue", anchor: "origin",
          textures: groundTextures, duration: STORM_DURATION + 2000, mask: true,
          params: {spawnRate: 30, count: null,
            speed: {min: 0, max: 0}, lifetime: {min: 4000, max: 6000},
            scale: {min: 0.6, max: 1.2}, alpha: {min: 0.6, max: 0.9},
            scaleCurve: [{time: 0, value: 1.0}, {time: 1, value: 1.0}],
            fade: {in: 0, out: 2500}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        { // Wintry blizzard haze: light ADD-blend air drift across a slightly larger area
          animation: "shapeParticleResidue", anchor: "origin",
          textures: airTextures, duration: STORM_DURATION, mask: true,
          params: {spawnRate: 40, count: null,
            area: {type: "circle", x: origin.x, y: origin.y, radius: Math.round(radius * 1.3)},
            speed: {min: 12, max: 55}, lifetime: {min: 2000, max: 2800},
            scale: {min: 1.0, max: 2.0}, alpha: {min: 0.05, max: 0.18},
            scaleCurve: [{time: 0, value: 1.0}, {time: 1, value: 1.4}],
            fade: {in: 150, out: 1800}, blend: PIXI.BLEND_MODES.ADD,
            elevation: particleElevation + 1}
        }
      ];
    }
  },

  // Blast+Flame
  flame: {
    ..._CHARGE_FLAME_VORTEX,
    ..._IMPACT_FLAME,
    chargeDuration: 800,
    projectile: {
      speed: 75, size: 3,
      frame: "flame/ProjectileBlazing",
      path: {type: "weave", params: {arcCount: 2, amplitude: 0.1}}
    },
    deliveryDuration: 1500,
    deliverySoundType: "damage",
    deliverySound: {fade: 400, offset: -200, release: 800},
    impactTiming: "atStart",
    buildDelivery(ctx) {
      const {action, textures, origin, radius, particleElevation} = ctx;
      const runeId = action.rune.id;
      const EXPLOSION_DURATION = this.deliveryDuration;
      return [
        { // Combustion burst: explosive radial particles flying outward from the blast origin
          animation: "shapeParticleCombustion", anchor: "origin",
          textures: getVFXFrames(runeId, "SprayFlame", "SprayEmbers"),
          duration: 500, mask: true,
          params: {count: 500, initial: 500,
            speed: {min: 80, max: 280},
            scale: {min: 0.8, max: 1.6},
            scaleCurve: [{time: 0, value: 0.6}, {time: 0.3, value: 1.4}, {time: 1, value: 1.8}],
            lifetime: {min: 600, max: 1200},
            alpha: {min: 0.75, max: 1.0},
            fade: {in: 30, out: 400},
            blend: PIXI.BLEND_MODES.ADD,
            area: {type: "circle", x: origin.x, y: origin.y, radius: Math.round(radius * 0.25)},
            elevation: particleElevation}
        },
        { // Ground scorch: char marks that flash hot on impact then cool to dark char as they linger
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundScorch"),
          offset: 200, duration: EXPLOSION_DURATION, mask: true,
          params: {count: 60, initial: 60,
            speed: {min: 0, max: 0},
            lifetime: {min: 5000, max: 7000},
            scale: {min: 0.7, max: 1.3}, alpha: {min: 0.4, max: 0.7},
            scaleCurve: [{time: 0, value: 1.0}, {time: 1, value: 1.0}],
            fade: {in: 200, out: 2500},
            blend: PIXI.BLEND_MODES.NORMAL,
            exposure: _exposureInHot(1, {normal: -1, hot: 1}),
            elevation: 0}
        },
        { // Air smoke residue: brown-tinted smoke drifting upward from the explosion
          animation: "shapeParticleResidue", anchor: "origin",
          textures: textures.air,
          offset: 300, duration: EXPLOSION_DURATION, mask: true,
          params: {count: 40, initial: 40,
            speed: {min: 10, max: 40},
            lifetime: {min: 2500, max: 4000},
            scale: {min: 1.0, max: 1.8}, alpha: {min: 0.2, max: 0.5},
            scaleCurve: [{time: 0, value: 0.6}, {time: 1, value: 1.4}],
            fade: {in: 300, out: 1500},
            tint: 0x6B5A48,
            blend: PIXI.BLEND_MODES.NORMAL,
            area: {type: "circle", x: origin.x, y: origin.y, radius: Math.round(radius * 0.7)},
            elevation: particleElevation + 1}
        }
      ];
    }
  },

  // Blast+Life
  life: {
    ..._CHARGE_LIFE_BLOOMS,
    ..._IMPACT_LIFE,
    chargeAnchor: "forward",
    chargeDuration: 1200,
    sustainedChargeAnchor: "forward",
    deliveryDuration: 4500,
    deliverySoundType: "damage",
    deliverySound: {fade: 500, offset: -300, release: 800},
    impactTiming: "fromCenter",
    buildDelivery(ctx) {
      const {action, origin, radius, particleElevation, casterElevation} = ctx;
      const runeId = action.rune.id;
      const MAELSTROM_DURATION = this.deliveryDuration;
      return [
        { // Ground roots: filling the blast area as the energy converges
          animation: "circleParticleBloom", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundRoots"),
          duration: MAELSTROM_DURATION, mask: true,
          params: {
            chargeRadius: Math.round(radius * 1.2),
            spawnRate: 30, lifetime: {min: 3000, max: 5000},
            scale: {min: 1.0, max: 1.6}, alpha: {min: 0.7, max: 0.95},
            growFraction: 0.35,
            fade: {in: 0.15, out: 0.4}, blend: PIXI.BLEND_MODES.NORMAL,
            sort: 0, elevation: 0}
        },
        { // Ground blooms: flowering up across the blast area through the maelstrom
          animation: "circleParticleBloom", anchor: "origin",
          textures: getVFXFrames(runeId, "GroundBlooms"),
          duration: MAELSTROM_DURATION, mask: true,
          params: {chargeRadius: Math.round(radius * 0.8),
            spawnRate: 30, lifetime: {min: 3000, max: 5000},
            scale: {min: 1.0, max: 1.5}, alpha: {min: 0.8, max: 1.0},
            growFraction: 0.3,
            fade: {in: 0.15, out: 0.4}, blend: PIXI.BLEND_MODES.NORMAL,
            sort: 1, elevation: 0}
        },
        { // Tornado of leaf/bubble spray sustained through the maelstrom
          animation: "circleParticleVortex", anchor: "origin",
          textures: getVFXFrames(runeId, "SprayLeaf", "SprayBubble"),
          duration: MAELSTROM_DURATION, mask: true,
          params: {chargeRadius: Math.round(radius * 1.2),
            swirlSpeed: 3.5, spinSpeed: 4,
            spawnRate: 220, lifetime: {min: 1800, max: 2600},
            scale: {min: 0.6, max: 1.1}, alpha: {min: 0.6, max: 0.95},
            fade: {in: 0.1, out: 0.4},
            exposure: _exposureInHot(0.7, {reverse: true}),
            elevation: casterElevation + 1}
        },
        { // Drifting bubble residue lingering above as the energy dissipates
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(runeId, "AirBubbles"),
          offset: 500, duration: MAELSTROM_DURATION, mask: true,
          params: {spawnRate: 10, count: null,
            speed: {min: 8, max: 25},
            lifetime: {min: 3500, max: 5500},
            scale: {min: 0.6, max: 1.2}, alpha: {min: 0.45, max: 0.85},
            scaleCurve: [{time: 0, value: 0.6}, {time: 1.0, value: 1.4}],
            fade: {in: 200, out: 1200},
            rotationSpeed: {min: -1.2, max: 1.2},
            blend: PIXI.BLEND_MODES.NORMAL,
            area: {type: "circle", x: origin.x, y: origin.y, radius: Math.round(radius * 0.8)},
            elevation: particleElevation + 1}
        }
      ];
    }
  }
};

/* -------------------------------------------- */

/**
 * Per-rune VFX overrides for the Fan gesture. Each entry may declare:
 * - `chargeDuration` (ms): pre-sweep charge phase length, 0 to skip.
 * - `sweepDuration` (ms): delivery (sweep) phase length.
 * - `impactSound` ("impact" | "impactHeavy"): RUNE_SOUNDS key for hit cues.
 * - `deliverySoundType` (string): RUNE_SOUNDS key for the looping delivery sound (omit for silent).
 * - `deliverySound` ({fade, offset, release}): envelope params when delivery sound is enabled.
 * - `buildDelivery(ctx)`: returns the delivery particle-layer array.
 * - All the chargeXxx fields consumed by {@link _resolveChargeLayers} (chargeBehavior, chargeAnchor,
 *   chargeAbove, chargeLayers, sprayParams, ...).
 * - All the impactXxx fields consumed by {@link _resolveHitTreatment} (impactSprite, recoil,
 *   impactParticles, impactGlow) - matches the arrow/ray declarative impact shape.
 * @type {Record<string, object>}
 */
const FAN_VFX_PROPS = {

  // Fan+Death: bone scythes yo-yo across the arc over forking bone roots, inside a spectral wisp haze
  death: {
    ..._CHARGE_DEATH_ORBIT,
    ..._IMPACT_DEATH,
    chargeDuration: 700,
    sweepDuration: 1400,
    deliverySoundType: "damage",
    deliverySound: {fade: 400, offset: -200, release: 1200},
    impactStart: ({chargeDuration, sweepDuration}) => chargeDuration + Math.round(sweepDuration / 2),
    buildDelivery(ctx) {
      const {action, radius, sweepDuration, particleElevation, casterElevation} = ctx;
      const runeId = action.rune.id;
      return [
        { // Bone scythes fired out to the cone perimeter and back in unison, spinning on their own axes
          animation: "fanParticleYoyo", anchor: "origin",
          textures: getVFXFrames(runeId, "ProjectileBoneScythe"),
          duration: sweepDuration, mask: true,
          params: {count: 4, initial: 4, spawnRate: 0,
            reach: Math.round(radius * 0.9),
            lifetime: {min: sweepDuration, max: sweepDuration},
            rotationSpeed: 7,
            alpha: {min: 0.85, max: 1.0}, scale: {min: 1.1, max: 1.45},
            fade: {in: 0.05, out: 0.15}, blend: PIXI.BLEND_MODES.NORMAL,
            elevation: casterElevation + 1}
        },
        { // Bone roots forking outward beneath the scythes as the wave expands through the cone
          animation: "fanParticleCascade", anchor: "origin",
          textures: getVFXFrames(runeId, "RootBone"),
          duration: sweepDuration, mask: true,
          params: {maxRadiusFactor: 0.85, initialFactor: 0.15, spawnRate: 25,
            velocity: {speed: [0, 0], angle: [0, 360]},
            lifetime: {min: sweepDuration + 2000, max: sweepDuration + 3500},
            alpha: {min: 0.6, max: 0.9}, scale: {min: 0.7, max: 1.2},
            fade: {in: 80, out: 1500}, blend: PIXI.BLEND_MODES.NORMAL,
            elevation: 0, sort: 0}
        },
        { // A few large, faint mist bodies hanging over the cone
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(runeId, "AirMistyWisps"),
          duration: sweepDuration, mask: true,
          params: {count: 10, initial: 10,
            speed: {min: 5, max: 18}, lifetime: {min: 2000, max: 3000},
            scale: {min: 1.6, max: 2.6}, alpha: {min: 0.06, max: 0.16},
            rotationSpeed: {min: -0.3, max: 0.3},
            scaleCurve: [{time: 0, value: 0.7}, {time: 1, value: 1.3}],
            fade: {in: 200, out: 1200}, blend: PIXI.BLEND_MODES.ADD,
            elevation: casterElevation + 2}
        },
        { // Fine spirit sparkle filling the cone
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(runeId, "SprayWisps"),
          duration: sweepDuration, mask: true,
          params: {count: 90, initial: 90,
            speed: {min: 20, max: 70}, lifetime: {min: 900, max: 1600},
            scale: {min: 0.3, max: 0.6}, alpha: {min: 0.5, max: 0.95},
            rotationSpread: Math.PI,
            scaleCurve: [{time: 0, value: 0.8}, {time: 1, value: 1.1}],
            fade: {in: 60, out: 400}, blend: PIXI.BLEND_MODES.ADD,
            elevation: particleElevation}
        }
      ];
    }
  },

  // Fan+Frost
  frost: {
    ..._IMPACT_FROST,
    chargeDuration: 0,
    sweepDuration: 400,
    buildDelivery(ctx) {
      const {action, textures, radius, startAngleRad, endAngleRad, sweepDuration, particleElevation} = ctx;
      const residueRadius = Math.round(radius * 0.7);
      const sweepInnerRadius = Math.round(action.token.getSize().width / 3);
      const sweepOuterRadius = Math.round(sweepInnerRadius * 1.3);
      return [
        { // Rotating arm of frost streaks wiped across the cone
          animation: "fanParticleSweep", anchor: "origin", textures: textures.streak,
          duration: sweepDuration, mask: true,
          params: {startAngleRad, endAngleRad,
            innerRadius: sweepInnerRadius, outerRadius: sweepOuterRadius, armSpread: 0.15,
            radialSpeed: 800, spawnRate: 360,
            alpha: {min: 0.7, max: 1.0}, scale: {min: 0.375, max: 0.6},
            elevation: particleElevation, blend: PIXI.BLEND_MODES.ADD}
        },
        { // Expanding ground cascade beneath the sweep
          animation: "fanParticleCascade", anchor: "origin",
          textures: getVFXTexturePaths(action.rune.id, "impact"),
          duration: 1000, mask: true,
          params: {alpha: {min: 0.5, max: 0.8}, scale: {min: 0.8, max: 1.2},
            lifetime: {min: 400, max: 700}, spawnRate: 240, elevation: 0,
            blend: PIXI.BLEND_MODES.NORMAL}
        },
        { // Thin overhead haze trailing after the sweep
          animation: "circleParticleResidue", anchor: "origin", textures: textures.air,
          offset: 200, duration: 200, mask: true,
          params: {radius: residueRadius, alpha: {min: 0.05, max: 0.18},
            scale: {min: 1.0, max: 2.0}, lifetime: {min: 2000, max: 2800},
            spawnRate: 80, initial: 0.3, elevation: particleElevation,
            speed: {min: 12, max: 55}, blend: PIXI.BLEND_MODES.ADD}
        }
      ];
    }
  },

  // Fan+Flame
  flame: {
    ..._IMPACT_FLAME,
    chargeDuration: 200,
    sweepDuration: 1200,
    oscillate: true,
    impactSound: "impact",
    deliverySoundType: "damage",
    deliverySound: {fade: 500, offset: -200, release: 1500},
    buildCharge(ctx) {
      const {runeId, particleElevation} = ctx;
      return [
        { // SprayFlame gather condensing at the muzzle just before the jet erupts
          animation: "circleParticleGather", anchor: "forward",
          textures: getVFXFrames(runeId, "SprayFlame"),
          duration: 200,
          params: {chargeRadius: 25, lifetime: 180, spawnRate: 600,
            alpha: {min: 0.75, max: 1.0}, scale: {min: 0.5, max: 0.9},
            elevation: particleElevation, blend: PIXI.BLEND_MODES.ADD}
        }
      ];
    },
    buildDelivery(ctx) {
      const {action, textures, radius, startAngleRad, endAngleRad, sweepDuration,
        casterElevation, casterRadiusPx} = ctx;
      const innerRadius = Math.round((casterRadiusPx * 2) / 3);
      const outerRadius = Math.round(casterRadiusPx);
      const jetReach = Math.round(radius * 0.6);
      const jetSpeed = 700;
      const jetLifetime = Math.round((jetReach / jetSpeed) * 1000);
      // Forward + return passes of the sweeping flamethrower jet
      const sweepLayer = (start, end, offset) => ({
        animation: "fanParticleSweep", anchor: "origin", textures: textures.streak,
        duration: sweepDuration, offset, mask: true,
        params: {startAngleRad: start, endAngleRad: end,
          innerRadius, outerRadius,
          radialSpeed: jetSpeed, armSpread: 0.18, spawnRate: 480,
          lifetime: {min: Math.round(jetLifetime * 0.7), max: jetLifetime},
          alpha: {min: 0.7, max: 1.0}, scale: {min: 0.7, max: 1.2},
          elevation: casterElevation + 1, blend: PIXI.BLEND_MODES.ADD}
      });
      return [
        sweepLayer(startAngleRad, endAngleRad, 0),
        sweepLayer(endAngleRad, startAngleRad, sweepDuration),
        { // Static GroundScorch deposits painted along the cone perimeter as the front sweeps
          animation: "fanParticleArcDeposit", anchor: "origin",
          textures: getVFXFrames(action.rune.id, "GroundScorch"),
          duration: sweepDuration, mask: true,
          params: {
            startAngleRad, endAngleRad,
            radiusFactor: 0.9, radialJitter: 35, arcSpread: 0.07,
            alpha: {min: 0.25, max: 0.5}, scale: {min: 0.75, max: 1.25},
            lifetime: {min: 5000, max: 7000}, spawnRate: 70, elevation: 0,
            fade: {in: 0, out: 2500},
            blend: PIXI.BLEND_MODES.NORMAL,
            exposure: _exposureInHot(1, {normal: -1, hot: 1})
          }
        },
        { // Sustained SprayEmbers stoking the area with ADD-blend sparks throughout the delivery
          animation: "shapeParticleCombustion", anchor: "origin",
          textures: getVFXFrames(action.rune.id, "SprayEmbers"),
          duration: sweepDuration * 2, mask: true,
          params: {spawnRate: 180,
            speed: {min: 30, max: 100},
            lifetime: {min: 1200, max: 2200},
            scale: {min: 0.25, max: 0.55}, alpha: {min: 0.7, max: 1.0},
            rotationSpread: Math.PI,
            elevation: casterElevation + 1,
            blend: PIXI.BLEND_MODES.ADD,
            scaleCurve: [{time: 0, value: 1.0}, {time: 1.0, value: 0.4}],
            fade: {in: 30, out: 500}}
        }
      ];
    }
  },

  // Fan+Life
  life: {
    ..._IMPACT_LIFE,
    chargeDuration: 900,
    sweepDuration: 1000,
    impactSound: "impact",
    deliverySoundType: "damage",
    deliverySound: {fade: 400, offset: -200, release: 1200},
    impactStart: ({chargeDuration, sweepDuration}) => chargeDuration + Math.round(sweepDuration / 2),
    buildCharge(ctx) {
      const {runeId, casterRadiusPx, casterElevation} = ctx;
      return [{
        animation: "circleParticleVortex", anchor: "source",
        textures: getVFXFrames(runeId, "SprayBubble", "SprayLeaf"),
        duration: 900,
        params: {chargeRadius: casterRadiusPx * 2.0, swirlSpeed: 4, spinSpeed: 4,
          lifetime: 700, spawnRate: 360,
          scale: {min: 0.6, max: 1.1}, alpha: {min: 0.6, max: 0.95},
          elevation: casterElevation + 1,
          blend: PIXI.BLEND_MODES.NORMAL,
          exposure: _exposureInHot(0.6, {reverse: true}),
          fade: {in: 0.15, out: 0.45}}
      }];
    },
    buildDelivery(ctx) {
      const {action, radius, sweepDuration, particleElevation, casterElevation} = ctx;
      const runeId = action.rune.id;
      return [
        { // Yo-yo discs fired out and return in unison. Six discs which go out hot and return cool
          animation: "fanParticleYoyo", anchor: "origin",
          textures: getVFXFrames(runeId, "DiscWispy"),
          duration: sweepDuration, mask: true,
          params: {count: 6, initial: 6, spawnRate: 0,
            reach: Math.round(radius * 0.9),
            lifetime: {min: sweepDuration, max: sweepDuration},
            rotationSpeed: 5,
            exposure: _exposureInHot(1.0),
            alpha: {min: 0.85, max: 1.0}, scale: {min: 1.0, max: 1.3},
            elevation: casterElevation + 1,
            fade: {in: 0.05, out: 0.15}
          }
        },
        { // Magical leaf spray throughout the cone that is highlighted with ADD blend
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(runeId, "SprayLeaf"),
          duration: sweepDuration, mask: true,
          params: {count: 60, initial: 60,
            speed: {min: 15, max: 50}, lifetime: {min: 1100, max: 1700},
            scale: {min: 0.5, max: 1.0}, alpha: {min: 0.4, max: 0.85},
            elevation: particleElevation, rotationSpread: Math.PI,
            blend: PIXI.BLEND_MODES.ADD,
            scaleCurve: [{time: 0, value: 0.7}, {time: 1.0, value: 1.1}],
            fade: {in: 100, out: 500}
          }
        },
        { // AirBubbles residue with long lifetime that outlives the delivery
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(runeId, "AirBubbles"),
          duration: sweepDuration, mask: true,
          params: {count: 40, initial: 40,
            speed: {min: 8, max: 25}, lifetime: {min: 3500, max: 5500},
            scale: {min: 0.6, max: 1.2}, alpha: {min: 0.45, max: 0.85},
            elevation: casterElevation + 2,
            blend: PIXI.BLEND_MODES.NORMAL,
            scaleCurve: [{time: 0, value: 0.6}, {time: 1.0, value: 1.4}],
            fade: {in: 200, out: 1200}
          }
        }
      ];
    }
  }
};

/* -------------------------------------------- */

/**
 * Per-rune VFX overrides for the contact gestures, shared by Touch and (scaled up) by Influence. A small
 * single-layer charge gathered at the caster's hand plus the shared per-rune impact treatment. The charge
 * field shape is documented on {@link ARROW_VFX_PROPS}; the impact field shape on {@link _resolveHitTreatment}.
 * @type {Record<string, object>}
 */
const TOUCH_VFX_PROPS = {

  // Touch+Death: wisps swirl around the caster and collapse inward, then a bone burst on contact
  death: {
    ..._IMPACT_DEATH,
    impactSpriteSize: 2.5,
    chargeDuration: 450,
    chargeBehavior: "circleParticleVortex",
    chargeLayers: [
      {frames: ["SprayWisps"], above: true, radiusFactor: 1.0,
        params: {lifetime: {min: 400, max: 700}, spawnRate: 220, alpha: {min: 0.5, max: 1.0},
          scale: {min: 0.4, max: 0.8}, blend: PIXI.BLEND_MODES.ADD}}
    ]
  },

  // Touch+Frost: frost motes swirl around the caster and collapse inward, then a frost burst on contact
  frost: {
    ..._IMPACT_FROST,
    impactSpriteSize: 2.5,
    chargeDuration: 450,
    chargeBehavior: "circleParticleVortex",
    chargeLayers: [
      {categories: ["spray"], above: true, radiusFactor: 1.0,
        params: {lifetime: {min: 400, max: 700}, spawnRate: 220, alpha: {min: 0.5, max: 1.0},
          scale: {min: 0.4, max: 0.8}}}
    ]
  },

  // Touch+Flame: an ember vortex swirls around the caster and collapses inward, then a flame burst on contact
  flame: {
    ..._IMPACT_FLAME,
    impactSpriteSize: 2.5,
    chargeDuration: 450,
    chargeBehavior: "circleParticleVortex",
    chargeLayers: [
      {categories: ["spray"], above: true, radiusFactor: 1.0,
        params: {lifetime: {min: 300, max: 500}, spawnRate: 260, alpha: {min: 0.4, max: 0.9},
          scale: {min: 0.5, max: 1.0}, blend: PIXI.BLEND_MODES.ADD}}
    ]
  },

  // Touch+Life: life motes gather inward to the caster over a longer channel, then a restorative bloom on contact
  life: {
    ..._IMPACT_LIFE,
    chargeDuration: 800,
    chargeBehavior: "circleParticleGather",
    chargeLayers: [
      {frames: ["SprayLeaf", "SprayBubble"], above: true, radiusFactor: 1.0,
        params: {lifetime: {min: 350, max: 600}, spawnRate: 160, alpha: {min: 0.4, max: 0.85},
          scale: {min: 0.4, max: 0.8}, blend: PIXI.BLEND_MODES.NORMAL}}
    ]
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
 * - `channel` - optional sustained-channel descriptor consumed by {@link configureContactVFXEffect} to turn a
 *   contact gesture into a lingering melee channel (Influence). See {@link _buildChannelDelivery}.
 * @type {Record<string, {configure?: SpellVFXGestureConfigurator, resolve?: function,
 *   finalize?: function, runes?: Record<string, object>, channel?: object}>}
 */
const SPELL_VFX_GESTURES = {
  arrow: {configure: configureArrowVFXEffect, runes: ARROW_VFX_PROPS},
  aspect: {},
  aura: {},
  blast: {configure: configureBlastVFXEffect, runes: BLAST_VFX_PROPS},
  cone: {},
  conjure: {},
  create: {},
  fan: {configure: configureFanVFXEffect, runes: FAN_VFX_PROPS},
  influence: {configure: configureContactVFXEffect, runes: TOUCH_VFX_PROPS, channel: {
    chargeDuration: 550, deliveryDuration: 1800, lingerDuration: 900, coatRadiusFactor: 1.1, burstSize: 3.5,
    glow: {frost: 0x8FE3FF, flame: 0xFF7A2A, life: 0xFF5DC0, death: 0x3FD9A0}
  }},
  pulse: {},
  ray: {configure: configureRayVFXEffect, runes: RAY_VFX_PROPS},
  sense: {},
  step: {},
  strike: {},
  surge: {},
  touch: {configure: configureContactVFXEffect, runes: TOUCH_VFX_PROPS},
  ward: {}
};
