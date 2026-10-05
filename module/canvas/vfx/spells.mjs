import {getRandomSprite, getVFXTexturePaths, getVFXTexturePath, getVFXFrames} from "./sprites.mjs";
import {getParticleScaleFactor} from "./blocks.mjs";
import {computeAttackOffset, computeManifestPoint, exposureInHot, pickRandom, positionalSound, pushActorScrollingText,
  pushTargetScrollingText, registerTargetRefs, resolveActorGeometry, tokenCenter} from "./helpers.mjs";
import {getVFXSound} from "./sounds.mjs";
import CrucibleFanComponent from "./components/vfx-fan-component.mjs";
import CrucibleProjectileComponent from "./components/vfx-projectile-component.mjs";
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
 * @property {string} palette             The palette keying textures, sounds, and props.
 * @property {number} particleElevation   Elevation at which particle containers render.
 * @property {SpellVFXTextures} textures   Resolved texture paths for the palette.
 */

/**
 * Per-rune texture path arrays for each particle category, resolved from VFX_TEXTURES.
 * Each array contains #-prefixed scene texture paths. Arrays may be empty if no art exists
 * for that rune/category; the fallback white particle is used in that case.
 * @typedef SpellVFXTextures
 * @property {string[]} air          Foreground atmospheric residue drifting overhead (haze, mist).
 * @property {string[]} falling      Sprites drawn as power arriving from overhead (e.g., hail, lightning strikes).
 * @property {string[]} ground       Background debris residue settling underfoot (marks, cracks).
 * @property {string[]} impact       Impact burst textures for singleImpact components.
 * @property {string[]} orb          Small round motes with no inherent direction.
 * @property {string[]} projectile   Side-view directional sprites for x/y travel (e.g., arrow shafts).
 * @property {string[]} root         Ground-laid directional textures growing outward from an origin (roots, fissures).
 * @property {string[]} spray        Small mote textures for scatter and halo generators.
 * @property {string[]} streak       Mid-air directional textures for beam/ray generators.
 */

/**
 * The declarative impact treatment of a rune on a struck target, consumed by {@link resolveHitTreatment}.
 * @typedef RuneImpactData
 * @property {boolean} [impactSprite=true]    Show the impact burst sprite on a hit.
 * @property {string} [impactSpriteFrame]     A specific burst frame, otherwise a random `impact` texture.
 * @property {number} [impactSpriteAngle]     Degrees to turn the burst off the incoming direction, to a random side.
 * @property {number} [impactSpriteSize=2]    Burst size in feet, unless a gesture supplies its own burst size.
 * @property {number} [impactSpriteScale=1]   A multiplier on whichever burst size applies.
 * @property {boolean} [recoil=true]          Rock the struck token on a hit.
 * @property {object|object[]} [impactParticles]  Particle burst specs at the target, see {@link _buildImpactParticles}.
 * @property {object} [impactGlow]            {@link impactSpriteGlow} params for a glow on the target.
 * @property {object} [impactShock]           {@link impactSpriteShock} params for an electrocution strobe.
 */

/**
 * A projectile flight trail: `true` for the default directional streaks, or a texture selection with overrides.
 * @typedef {true|{frames?: string[], categories?: string[], params?: object}} ProjectileTrailConfig
 */

/**
 * A function that configures VFX data for a specific somatic gesture.
 * @callback SpellVFXGestureConfigurator
 * @param {CrucibleSpellAction} action   The spell action being animated.
 * @param {SpellVFXContext} context      The context resolved once for the whole configuration.
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
export function configureEffect(action, vfxConfig) {
  const hooks = SPELL_VFX_GESTURES[action.gesture.id];
  if ( hooks?.configure === null ) return null;
  if ( hooks?.configure === undefined ) return vfxConfig;

  const result = hooks.configure(action, _resolveSpellVFXContext(action));
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
 * Resolve spell VFX references before VFXReferenceField resolution by dispatching to the gesture-specific resolver.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
export function resolveEffect(action, vfxEffect, references) {
  const hooks = SPELL_VFX_GESTURES[action.gesture.id];
  if ( hooks?.resolve ) hooks.resolve(action, vfxEffect, references);
}

/* -------------------------------------------- */

/**
 * Apply play-time finalization to a composed spell VFXEffect immediately before playback.
 * Dispatches to gesture-specific finalizers for injecting runtime callbacks.
 * References are frozen at this point and must not be modified.
 * @param {CrucibleSpellAction} action
 * @param {foundry.canvas.vfx.VFXEffect} vfxEffect
 * @param {Record<string, any>} references
 */
export function finalizeEffect(action, vfxEffect, references) {
  const hooks = SPELL_VFX_GESTURES[action.gesture.id];
  if ( hooks?.finalize ) hooks.finalize(action, vfxEffect, references);
}

/* -------------------------------------------- */
/*  Shared Configurator Helpers                 */
/* -------------------------------------------- */

/**
 * Resolve the rune-styled treatment shown on a target which an attack failed to affect.
 * @param {SpellVFXTextures} textures   The rune's textures from {@link resolveRuneTextures}
 * @returns {{animations: object[], particles: object[]}}
 */
export function resolveMissTreatment(textures) {
  const animations = [];
  if ( textures.air.length ) {
    animations.push({function: "impactSpriteBurst",
      params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}});
  }
  return {animations, particles: []};
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
 * Build a single target's impact entry for the standard `{start, sound, animations, particles}` shape shared by
 * the region and contact gestures. A hit resolves the shared {@link resolveHitTreatment} (crit- and
 * knockback-aware); any other result resolves {@link resolveMissTreatment}.
 * @param {object} opts
 * @param {string} opts.palette
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
 * @param {object} [opts.treatmentCtx]    Per-spell overrides forwarded to {@link resolveHitTreatment}.
 * @returns {object}
 */
function _buildTargetImpact({palette, group, token, result, start, tokenRef, runeProps, textures, elevation,
  impactType="impact", forcedMovements, treatmentCtx={}}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const isHit = (result === T.HIT) || (result === T.GLANCE);
  if ( isHit ) {
    const knockback = CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, start);
    const crit = !!group.roll[0]?.roll?.isCriticalSuccess;
    const treatment = resolveHitTreatment(palette, {textures, elevation, crit, knockback, ...treatmentCtx}, runeProps);
    return {result, id: token.id, start, sound: positionalSound(getVFXSound(palette, impactType)),
      animations: treatment.animations, particles: treatment.particles};
  }
  const treatment = resolveMissTreatment(textures);
  return {result, id: token.id, start, sound: positionalSound(getVFXSound(palette, "miss")),
    animations: treatment.animations, particles: treatment.particles};
}

/* -------------------------------------------- */
/*  Projectile Building Blocks                  */
/* -------------------------------------------- */

/**
 * Build a rune-styled flight trail particle layer which follows a projectile.
 * @param {string} palette
 * @param {ProjectileTrailConfig} trail
 * @param {SpellVFXTextures} textures   The rune's textures from {@link resolveRuneTextures}
 * @param {number} elevation            Elevation of the trail particles
 * @returns {object}
 */
export function buildProjectileTrail(palette, trail, textures, elevation) {
  const trailTextures = trail.frames ? getVFXFrames(palette, ...trail.frames)
    : (trail.categories ? trail.categories.flatMap(c => textures[c]) : textures.streak);
  return {
    animation: "projectileParticleTrail", anchor: "delivery", textures: trailTextures,
    params: {align: true, flipX: true, lifetime: 250, spawnRate: 240,
      alpha: {min: 0.4, max: 0.8}, scale: {min: 0.3, max: 0.6},
      blend: PIXI.BLEND_MODES.ADD, elevation, ...(trail.params ?? {})}
  };
}

/* -------------------------------------------- */

/**
 * Build one Arrow gesture projectile component which charges, flies from the caster, and strikes one target.
 * @param {CrucibleSpellAction} action
 * @param {SpellVFXContext} context
 * @param {object} config
 * @param {string} config.key                 Unique component key, used to name the manifest reference
 * @param {TokenDocument} config.token        The target token
 * @param {AttackRoll} config.roll            The attack roll against the target
 * @param {ActorEventGroup} config.group      The target's event group
 * @param {string} config.tokenRef            Reference key of the target's TokenDocument
 * @param {string} config.meshRef             Reference key of the target's token mesh
 * @param {Record<string, any>} config.references   The references map, mutated in place
 * @param {object[]} config.forcedMovements   Accumulated forced movements
 * @returns {{component: object, impactTime: number}}
 */
function _buildArrowProjectile(action, {palette, textures, particleElevation},
  {key, token, roll, group, tokenRef, meshRef, references, forcedMovements}) {
  const runeProps = ARROW_VFX_PROPS[palette];
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const caster = resolveActorGeometry(action);
  const {elevation: casterElevation, radiusPx: casterRadiusPx, meshSort: casterMeshSort} = caster;
  const result = roll.data.result;

  const chargeDuration = runeProps.chargeDuration ?? 700;
  const chargeTail = runeProps.chargeTail ?? 200; // Ms the charge particles keep emitting past the release label
  const revealAtRelease = runeProps.projectileReveal === "release";

  // Resolve sound choices and configure their playback
  const sound = positionalSound;
  const chargeSound = (runeProps.chargeSound !== false) ? sound(getVFXSound(palette, "charge")) : null;
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

  // The projectile materializes in front of the caster rather than at their center
  const {x: tcx, y: tcy} = tokenCenter(token);
  const {x: manifestX, y: manifestY} = computeManifestPoint(caster, token);
  const offset = computeAttackOffset(token, result);

  // Projectile flight timing; the arrival is the impact beat (shared by scrolling text and any knockback)
  const projectileSpeed = runeProps.projectileSpeed ?? 150;
  const projectileTexture = runeProps.projectileFrame
    ? getVFXTexturePath(runeProps.projectileFrame)
    : (pickRandom(textures.projectile) ?? getRandomSprite("projectiles", "arrow"));
  const projectileSize = runeProps.projectileSize ?? 3;
  const textureAnchor = !!runeProps.projectileTextureAnchor;
  const {lead} = CrucibleProjectileComponent.computeLaunch({x: manifestX, y: manifestY}, {x: tcx, y: tcy},
    {texture: projectileTexture, size: projectileSize, textureAnchor});
  const distPx = Math.hypot(tcx - manifestX, tcy - manifestY) - lead;
  const flightMS = (distPx * 1000) / (projectileSpeed * canvas.dimensions.distancePixels);
  const impactTime = chargeDuration + flightMS;

  // Register the manifest point as a reference. Every element of a VFXReferenceObjectField array
  // must be a reference: resolveReferences builds a partial array update of only the resolved
  // (reference) elements, so a literal sibling would be dropped to a hole by updateSource.
  const manifestRef = `${key}_manifest`;
  references[manifestRef] = {x: manifestX, y: manifestY, elevation: casterElevation,
    sort: casterMeshSort + 1, sortLayer: SL.TOKENS};

  // Impact treatment; a force-moved target plays its knockback glide AS the impact, replacing the recoil/shake
  const isHit = (result === T.HIT) || (result === T.GLANCE);
  const knockback = isHit
    && CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, impactTime);
  const stickDuration = (isHit && runeProps.stickDuration) ? runeProps.stickDuration : 0;
  let impactSound = null;
  const animations = [];
  const particles = [];
  if ( isHit ) {
    impactSound = sound(getVFXSound(palette, "impact"));
    const treatment = resolveHitTreatment(palette, {textures, elevation: (token.elevation ?? 0) + 1,
      crit: !!roll.isCriticalSuccess, knockback, burstSize: 3, burstDuration: stickDuration || 1000}, runeProps);
    animations.push(...treatment.animations);
    particles.push(...treatment.particles);
  }
  else {
    impactSound = sound(getVFXSound(palette, "miss"));
    if ( runeProps.impactSprite !== false ) {
      const treatment = resolveMissTreatment(textures);
      animations.push(...treatment.animations);
      particles.push(...treatment.particles);
    }
  }

  // Charge particles and the optional flight trail
  const chargeParticles = _resolveChargeLayers(runeProps,
    {palette, textures, casterRadiusPx, casterElevation, particleElevation},
    {duration: chargeDuration + chargeTail});
  const projectileParticles = runeProps.trail
    ? [buildProjectileTrail(palette, runeProps.trail, textures, casterElevation + 1)] : [];

  const component = {
    type: "crucibleProjectile",
    originMesh: {reference: "tokenMesh"},
    targetMeshes: [{reference: meshRef}],
    path: [
      {reference: manifestRef, deltas: {}},
      {reference: meshRef, deltas: {x: offset.x, y: offset.y, sort: 1}}
    ],
    pathType: runeProps.path ?? {type: "linear", params: {}},
    charge: {duration: chargeDuration, sound: chargeSound,
      animations: revealAtRelease ? [] : [{function: "chargeProjectileFadeIn"}], particles: chargeParticles},
    delivery: {
      texture: projectileTexture, size: projectileSize, speed: projectileSpeed, sound: flightSound,
      fps: runeProps.projectileFps ?? null, textureAnchor,
      blend: runeProps.projectileBlend ?? PIXI.BLEND_MODES.NORMAL,
      animations: [...(revealAtRelease ? [{function: "deliveryProjectileReveal"}] : []),
        {function: "deliveryProjectileFlight"}],
      particles: projectileParticles},
    impacts: [{
      result, id: token.id, stick: stickDuration,
      sound: impactSound, animations, particles
    }],
    scrollingText: []
  };
  return {component, impactTime};
}

/* -------------------------------------------- */
/*  Gesture Configurators                       */
/* -------------------------------------------- */

/**
 * Configure the VFX for an Arrow gesture composed spell.
 * Arrow has `target.type: "single"` and no region shape, so the trajectory is computed from the
 * caster and target token centers. Per-rune visual overrides come from {@link ARROW_VFX_PROPS}.
 * @param {CrucibleSpellAction} action
 * @param {SpellVFXContext} context
 * @returns {SpellVFXData|null}
 */
function _configureArrowVFXEffect(action, context) {
  if ( action.target.type !== "single" ) return null;
  if ( !SPELL_VFX_GESTURES.arrow.runes?.[context.palette] ) return null; // No arrow-gesture config for this palette
  const components = {};
  const timeline = [];
  const forcedMovements = [];
  const references = {tokenMesh: "^token.object.mesh"};

  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    if ( !group.hasRoll ) continue;
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const roll = group.roll[0]?.roll;
    if ( !roll?.data.result ) continue;
    const {tokenRef, meshRef} = registerTargetRefs(references, "target", j, token);
    const {component, impactTime} = _buildArrowProjectile(action, context, {key: `arrow_${j}`, token, roll, group,
      tokenRef, meshRef, references, forcedMovements});
    pushTargetScrollingText(component.scrollingText, action, actor, group.all, meshRef, impactTime);
    components[`arrow_${j}`] = component;
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
 * @param {SpellVFXContext} context
 * @returns {SpellVFXData|null}
 */
function _configureFanVFXEffect(action, {palette, textures, particleElevation}) {
  const regionShape = action.region?.shapes[0];
  if ( !regionShape || (regionShape.type !== "cone") ) return null;
  const runeProps = SPELL_VFX_GESTURES.fan.runes?.[palette];
  if ( !runeProps ) return null;
  const shapeData = regionShape.toObject();
  const {x, y, radius, angle, rotation} = shapeData;
  const origin = {x, y};
  const rotRad = Math.toRadians(rotation);
  const halfAngleRad = Math.toRadians(angle / 2);
  const {gridSize, elevation: casterElevation, radiusPx: casterRadiusPx} = resolveActorGeometry(action);
  const chargeDuration = runeProps.chargeDuration ?? 0;
  const sweepDuration = runeProps.sweepDuration ?? 400;
  const oscillate = !!runeProps.oscillate;
  const deliveryDuration = oscillate ? (sweepDuration * 2) : sweepDuration;
  const MASK_RADIUS_FACTOR = 1.5;

  const {startAngleRad, endAngleRad} = CrucibleFanComponent.pickSweepDirection(action, origin, rotRad,
    halfAngleRad);
  const sweepRangeRad = endAngleRad - startAngleRad;

  const sound = positionalSound;

  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {polygon: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}}
  };

  let chargeParticles = [];
  if ( chargeDuration > 0 ) {
    const chargeCtx = {palette, textures, casterRadiusPx, casterElevation, particleElevation};
    chargeParticles = runeProps.buildCharge?.(chargeCtx)
      ?? _resolveChargeLayers(runeProps, chargeCtx, {duration: chargeDuration});
  }

  const buildCtx = {action, palette, textures, origin, radius, startAngleRad, endAngleRad, sweepDuration,
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
    const {tokenRef, meshRef} = registerTargetRefs(references, "fanTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    const impact = _buildTargetImpact({palette, group, token, result, start, tokenRef, runeProps, textures,
      elevation: particleElevation, impactType, forcedMovements});
    impact.animations.push(...(runeProps.buildImpact?.({...buildCtx, token, result, isHit}) ?? []));
    impacts.push(impact);
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  pushActorScrollingText(scrollingText, action, "tokenMesh");

  const deliverySound = runeProps.deliverySoundType
    ? _resolveDeliverySound({palette, sound}, runeProps.deliverySound ?? {}, runeProps.deliverySoundType)
    : null;
  const chargeSound = ((chargeDuration > 0) && (runeProps.chargeSound !== false))
    ? sound(getVFXSound(palette, "charge")) : null;

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
      delivery: {duration: deliveryDuration, sound: deliverySound,
        animations: runeProps.buildAnimations?.(buildCtx) ?? [], particles: deliveryParticles},
      impacts,
      scrollingText,
      sounds: runeProps.buildSounds?.({...buildCtx, sound, chargeDuration}) ?? []
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
 * @param {SpellVFXContext} context
 * @returns {SpellVFXData|null}
 */
function _configureRayVFXEffect(action, {palette, textures}) {
  const regionShape = action.region?.shapes[0];
  if ( !regionShape || (regionShape.type !== "line") ) return null;
  const runeProps = SPELL_VFX_GESTURES.ray.runes?.[palette];
  if ( !runeProps ) return null; // No ray-gesture config for this palette; skip VFX
  const shapeData = regionShape.toObject();
  const {x, y, length, width, rotation} = shapeData;
  const rotRad = Math.toRadians(rotation);
  const {elevation: casterElevation, radiusPx: casterRadiusPx} = resolveActorGeometry(action);
  const beamElevation = casterElevation + 1;
  const chargeDistance = casterRadiusPx;       // Half the caster token width: pulls the charge to the token's front edge
  const beamLength = length - chargeDistance;  // Effective beam reach from the charge point to the shape's end
  const spawnRadius = Math.max(8, width / 2);
  const CHARGE_DURATION = runeProps.chargeDuration ?? 700;
  const sound = positionalSound;

  // Declare necessary references to resolve at play-time
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {polygon: {x, y, type: "move", radius: Math.round(length * 1.5)}}
  };

  // Configure beam charge point and progression speed
  const chargeOrigin = {x: x + (Math.cos(rotRad) * chargeDistance), y: y + (Math.sin(rotRad) * chargeDistance)};
  const gridScale = getParticleScaleFactor();
  const effectiveBeamSpeed = runeProps.beamSpeed
    ?? (beamLength / gridScale / ((runeProps.frontDuration ?? runeProps.deliveryDuration) / 1000));

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
    const {tokenRef, meshRef} = registerTargetRefs(references, "rayTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    const start = timingFn(tokenCenter(token), timingCtx);
    impacts.push(_buildTargetImpact({palette, group, token, result, start, tokenRef, runeProps, textures,
      elevation: beamElevation, impactType, forcedMovements}));
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  pushActorScrollingText(scrollingText, action, "tokenMesh");

  // Build VFXEffect configuration
  const buildContext = {palette, textures, beamLength, beamElevation, spawnRadius, width, casterRadiusPx,
    casterElevation, CHARGE_DURATION, action, sound, beamSpeed: effectiveBeamSpeed};
  const {chargeParticles, delivery} = _buildRayChargeAndDelivery(runeProps, buildContext);
  const components = {
    ray: {
      type: "crucibleRay",
      shape: shapeData,
      originMesh: {reference: "tokenMesh"},
      targetMeshes: targetMeshRefs,
      mask: {reference: "wallMask"},
      charge: {duration: CHARGE_DURATION, distance: chargeDistance,
        sound: sound(getVFXSound(palette, "charge")),
        animations: [], particles: chargeParticles},
      delivery,
      impacts,
      scrollingText,
      sounds: runeProps.buildSounds?.(buildContext) ?? []
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
 * @param {SpellVFXContext} context
 * @returns {SpellVFXData|null}
 */
function _configureContactVFXEffect(action, {palette, textures, particleElevation}) {
  if ( action.target.type !== "single" ) return null;
  const gesture = SPELL_VFX_GESTURES[action.gesture.id];
  const runeProps = gesture.runes?.[palette];
  if ( !runeProps ) return null;
  const channel = gesture.channel ?? null;

  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const {gridSize, elevation: casterElevation, radiusPx: casterRadiusPx} = resolveActorGeometry(action);
  const chargeDuration = channel?.chargeDuration ?? runeProps.chargeDuration ?? 450;
  const deliveryDuration = channel?.deliveryDuration ?? runeProps.deliveryDuration ?? 100;
  const lingerDuration = channel?.lingerDuration ?? 0;
  const impactStart = chargeDuration + deliveryDuration;

  const sound = positionalSound;

  // Charge gathers at the caster's palm (halfway out toward the target) so the origin reads as the caster
  const references = {tokenMesh: "^token.object.mesh"};
  const chargeCtx = {palette, textures, casterRadiusPx, casterElevation, particleElevation};
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
    const {tokenRef, meshRef} = registerTargetRefs(references, "contactTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    channelTarget ??= {hit: isHit, radiusPx: (token.width * gridSize) / 2, elevation: targetElevation};

    // A channel keeps its glow on the delivery phase (suppressGlow) and lingers its burst over the linger window
    const treatmentCtx = channel
      ? {burstSize: channel.burstSize ?? 3, burstDuration: lingerDuration, flashDuration: 200, suppressGlow: true,
        impactShock: runeProps.channel?.impactShock}
      : {};
    impacts.push(_buildTargetImpact({palette, group, token, result, start: impactStart, tokenRef, runeProps,
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
    deliverySound = sound(getVFXSound(palette, "damage"));
    if ( deliverySound ) {
      Object.assign(deliverySound, {loop: true, fade: 250, volume: 0.8, ...runeProps.channel?.sound});
    }
    ({animations: deliveryAnimations, particles: deliveryParticles} = _buildChannelDelivery(runeProps,
      chargeCtx, {channel, deliveryDuration, lingerDuration, target: channelTarget}));
  }
  deliveryAnimations.push(...(runeProps.buildAnimations?.({action, palette, channel, target: channelTarget,
    deliveryDuration, lingerDuration, casterElevation}) ?? []));

  const chargeSound = (runeProps.chargeSound !== false) ? sound(getVFXSound(palette, "charge")) : null;
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
      scrollingText,
      sounds: runeProps.buildSounds?.({action, palette, sound, channel, chargeDuration, deliveryDuration}) ?? []
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
 * @param {SpellVFXContext} context
 * @returns {SpellVFXData|null}
 */
function _configureBlastVFXEffect(action, {palette, textures}) {
  const regionShape = action.region?.shapes[0];
  if ( !regionShape || (regionShape.type !== "circle") ) return null;
  const runeProps = SPELL_VFX_GESTURES.blast.runes?.[palette];
  if ( !runeProps ) return null;
  const shapeData = regionShape.toObject();
  const {x, y, radius} = shapeData;
  const origin = {x, y};
  const {elevation: casterElevation, radiusPx: casterRadiusPx,
    center: casterCenter, meshSort: casterMeshSort} = resolveActorGeometry(action);
  const particleElevation = (action.region?.elevation?.top ?? casterElevation) + 1;
  const chargeCtx = {palette, textures, casterRadiusPx, casterElevation, particleElevation};
  const CHARGE_DURATION = runeProps.chargeDuration ?? 0;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const distancePixels = canvas.dimensions.distancePixels;

  const sound = positionalSound;

  const MASK_RADIUS_FACTOR = 1.5;
  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {polygon: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}}
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

    const projectileChargeLayers = runeProps.buildCharge?.(chargeCtx)
      ?? _resolveChargeLayers(runeProps, chargeCtx, {duration: CHARGE_DURATION});
    const projectileChargeSound = ((CHARGE_DURATION > 0) && (runeProps.chargeSound !== false))
      ? sound(getVFXSound(palette, "charge")) : null;
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
    blastChargeParticles = runeProps.buildCharge?.(chargeCtx)
      ?? _resolveChargeLayers(runeProps, chargeCtx, {duration: CHARGE_DURATION});
    if ( runeProps.chargeSound !== false ) {
      blastChargeSound = sound(getVFXSound(palette, "charge"));
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
  const struck = Array.from(action.eventsByTarget).filter(([actor, group]) => {
    return group.hasRoll && action.targets.get(actor)?.token;
  });
  let j = 1;
  for ( const [actor, group] of struck ) {
    const token = action.targets.get(actor).token;
    const result = group.roll[0]?.roll?.data.result ?? null;
    const {tokenRef, meshRef} = registerTargetRefs(references, "blastTarget", j, token);
    targetMeshRefs.push({reference: meshRef});
    const start = runeProps.impactStart?.({...timingCtx, index: j - 1, total: struck.length})
      ?? timingFn(tokenCenter(token), timingCtx);
    const impact = _buildTargetImpact({palette, group, token, result, start, tokenRef, runeProps, textures,
      elevation: particleElevation, impactType, forcedMovements});
    const impactAnimations = runeProps.buildImpact?.({action, palette, token, result, particleElevation, radius});
    impact.animations.push(...(impactAnimations ?? []));
    impacts.push(impact);
    pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  pushActorScrollingText(scrollingText,
    action, projectileComponent ? "fireballManifest" : "tokenMesh");

  const buildCtx = {action, palette, textures, origin, radius, particleElevation, casterElevation,
    casterRadiusPx, sound};
  const deliveryParticles = runeProps.buildDelivery(buildCtx);
  const deliveryAnimations = runeProps.buildAnimations?.(buildCtx) ?? [];
  const sustainedLayers = (runeProps.sustainedChargeAnchor && !projectileComponent)
    ? _resolveChargeLayers(runeProps, chargeCtx,
      {anchor: runeProps.sustainedChargeAnchor, duration: runeProps.deliveryDuration, sustained: true})
    : [];
  const deliverySound = runeProps.deliverySoundType
    ? _resolveDeliverySound({palette, sound}, runeProps.deliverySound ?? {}, runeProps.deliverySoundType)
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
      delivery: {duration: runeProps.deliveryDuration, sound: deliverySound, animations: deliveryAnimations,
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
function _resolveSpellVFXContext(action) {
  const palette = _resolveSpellPalette(action);
  return {
    palette,
    particleElevation: action.region?.elevation.top ?? 0,
    textures: resolveRuneTextures(palette)
  };
}

/* -------------------------------------------- */

/**
 * The VFX palette of a restorative rune according to whether it is cast to restore or to harm.
 * @type {Record<string, {damage: string, restoration: string}>}
 */
const SPELL_VFX_PALETTES = {
  life: {damage: "poison", restoration: "life"}
};

/**
 * Resolve the VFX palette which keys the textures, sounds, and per-gesture props of a spell.
 * @param {CrucibleSpellAction} action
 * @returns {string}    A palette key, which is the rune id unless the rune has polarized palettes
 */
function _resolveSpellPalette(action) {
  const palettes = SPELL_VFX_PALETTES[action.rune.id];
  if ( !palettes ) return action.rune.id;
  return action.usage.restoration ? palettes.restoration : palettes.damage;
}

/* -------------------------------------------- */

/**
 * Resolve the texture paths of every particle category for a rune.
 * @param {string} palette
 * @returns {SpellVFXTextures}
 */
export function resolveRuneTextures(palette) {
  return {
    air: getVFXTexturePaths(palette, "air"),
    falling: getVFXTexturePaths(palette, "falling"),
    ground: getVFXTexturePaths(palette, "ground"),
    impact: getVFXTexturePaths(palette, "impact"),
    orb: getVFXTexturePaths(palette, "orb"),
    projectile: getVFXTexturePaths(palette, "projectile"),
    root: getVFXTexturePaths(palette, "root"),
    spray: getVFXTexturePaths(palette, "spray"),
    streak: getVFXTexturePaths(palette, "streak")
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
 * @param {string} ctx.palette   Required when any chargeLayers entry uses `frames`.
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.casterRadiusPx
 * @param {number} ctx.casterElevation
 * @param {number} [ctx.particleElevation]  Defaults to casterElevation when omitted.
 * @param {object} opts
 * @param {string} [opts.anchor]  Default layer anchor (defaults to runeProps.chargeAnchor ?? "origin"); an
 *                                individual layer's own `anchor` field wins over it.
 * @param {number} opts.duration  Emission duration (ms) for each layer.
 * @param {boolean} [opts.sustained=false]  Resolve the layers' `sustained` forms, held across a delivery.
 * @returns {object[]}
 */
function _resolveChargeLayers(runeProps, ctx, {anchor, duration, sustained=false}) {
  const {palette, textures, casterRadiusPx, casterElevation, particleElevation = casterElevation} = ctx;
  const behavior = runeProps.chargeBehavior ?? "circleParticleGather";
  const a = anchor ?? runeProps.chargeAnchor ?? "origin";
  const elevationFor = (above, anch) => above ? (casterElevation + 1)
    : (((anch === "source") || (anch === "forward")) ? casterElevation : particleElevation);
  if ( runeProps.chargeLayers ) {
    return runeProps.chargeLayers.map(layer => {
      const layerTextures = layer.frames ? getVFXFrames(palette, ...layer.frames)
        : layer.categories.flatMap(c => textures[c]);
      const rad = casterRadiusPx * (layer.radiusFactor ?? 2.0);
      const layerAnchor = layer.anchor ?? a;
      const sustain = sustained ? (layer.sustained ?? {}) : {};
      return {
        animation: layer.animation ?? behavior,
        anchor: layerAnchor, textures: layerTextures,
        offset: sustain.offset ?? layer.offset ?? 0,
        duration: layer.duration ?? duration,
        params: {chargeRadius: rad, radius: rad, elevation: elevationFor(layer.above, layerAnchor),
          ...layer.params, ...sustain.params}
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
 * @param {string} ctx.palette
 * @param {function} ctx.sound      The sound-descriptor builder closure used by the configurator.
 * @param {object} params           Envelope params (fade, offset, release).
 * @param {string} [soundType]      RUNE_SOUNDS type key to resolve; defaults to "damage".
 * @returns {object|null}
 */
function _resolveDeliverySound(ctx, params, soundType="damage") {
  const {palette, sound} = ctx;
  const descriptor = sound(getVFXSound(palette, soundType));
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
 * @param {string} palette
 * @param {SpecOrArray} specs   `SpecOrArray = Spec | Spec[]` where each `Spec` has
 *   `{animation?, duration?, radiusFactor?, frames?, categories?, params?}`.
 * @param {object} ctx
 * @param {string} [ctx.anchor="destination"]   Anchor for the layer (target-side at impact time).
 * @param {number} ctx.elevation                Particle elevation.
 * @param {SpellVFXTextures} [ctx.textures]     Required when any spec uses `categories`.
 * @returns {object[]}
 */
function _buildImpactParticles(palette, specs, {anchor = "destination", elevation, textures}) {
  if ( !specs ) return [];
  const specArray = Array.isArray(specs) ? specs : [specs];
  const gridSize = canvas.dimensions.size;
  return specArray.map(spec => {
    const layerTextures = spec.frames
      ? getVFXFrames(palette, ...spec.frames)
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
 * Get the reusable impact treatment of a rune.
 * @param {string} palette
 * @returns {RuneImpactData|null}
 */
export function getRuneImpact(palette) {
  return RUNE_IMPACTS[palette] ?? null;
}

/* -------------------------------------------- */

/**
 * Resolve the shared per-target hit treatment for every gesture from the runeProps declarative toggles
 * (`impactSprite`, `recoil`, default true), the burst size (`impactSpriteSize`, default 2 feet, which a gesture's
 * own `burstSize` overrides, and `impactSpriteScale`, a rune's multiplier on whichever applies), and the opt-in
 * fields (`impactParticles`, `impactGlow`, `impactShock`).
 * A critical hit rocks harder via `impactSpriteShake`; a force-moved target keeps the burst/glow but drops the
 * recoil (the knockback glide replaces it). A rune that wants a "soft" restorative arrival just disables the
 * burst and recoil and supplies its own particle spec.
 * @param {string} palette
 * @param {object} ctx
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.elevation
 * @param {boolean} [ctx.crit=false]          Critical hit: heavier shake instead of recoil.
 * @param {boolean} [ctx.knockback=false]     Target is force-moved: suppress the recoil (glide replaces it).
 * @param {number} [ctx.burstSize]            Override the burst sprite size (feet).
 * @param {number} [ctx.burstDuration=800]    Override the burst hold (ms).
 * @param {number} [ctx.flashDuration=150]    Override the burst ADD-blend flash window (ms).
 * @param {boolean} [ctx.suppressGlow=false]  Skip the rune's impact glow (e.g. when the gesture glows elsewhere).
 * @param {RuneImpactData} runeProps
 * @returns {{animations: object[], particles: object[]}}
 */
export function resolveHitTreatment(palette, ctx, runeProps) {
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
  const burstTexture = runeProps?.impactSpriteFrame ? getVFXTexturePath(runeProps.impactSpriteFrame)
    : pickRandom(textures.impact);
  if ( (runeProps?.impactSprite !== false) && burstTexture ) {
    const angle = Math.toRadians(runeProps?.impactSpriteAngle ?? 0) * ((Math.random() < 0.5) ? -1 : 1);
    animations.push({function: "impactSpriteBurst",
      params: {texture: burstTexture,
        size: (burstSize ?? runeProps?.impactSpriteSize ?? 2) * (runeProps?.impactSpriteScale ?? 1),
        duration: burstDuration, flash: true, flashDuration, rotation: angle}});
  }
  if ( runeProps?.impactParticles ) {
    particles.push(..._buildImpactParticles(palette, runeProps.impactParticles,
      {anchor: "destination", elevation, textures}));
  }
  if ( runeProps?.impactGlow && !suppressGlow ) {
    animations.push({function: "impactSpriteGlow", params: runeProps.impactGlow});
  }
  const shock = ctx.impactShock ?? runeProps?.impactShock;
  if ( shock ) animations.push({function: "impactSpriteShock", params: shock});
  return {animations, particles};
}

/* -------------------------------------------- */

/**
 * Build the sustained-channel delivery for an Influence contact gesture: the rune's charge swirl held at the
 * caster's palm for the full channel, and (on a hit) the element crusting onto the target via lingering bloom
 * motes under a saturating tinted glow that builds through the channel and fades over the linger.
 * @param {object} runeProps
 * @param {object} chargeCtx               The charge resolution context (see {@link _resolveChargeLayers}).
 * @param {object} opts
 * @param {object} opts.channel            The gesture's channel descriptor.
 * @param {number} opts.deliveryDuration   Channel length (ms).
 * @param {number} opts.lingerDuration     Post-climax glow/coat fade (ms).
 * @param {{hit: boolean, radiusPx: number, elevation: number}|null} opts.target
 * @returns {{animations: object[], particles: object[]}}
 */
function _buildChannelDelivery(runeProps, chargeCtx, {channel, deliveryDuration, lingerDuration, target}) {
  const {palette} = chargeCtx;
  const animations = [];
  const particles = _resolveChargeLayers(runeProps, chargeCtx,
    {anchor: "palm", duration: deliveryDuration, sustained: true});
  if ( !target?.hit ) return {animations, particles};

  // The element crusts onto the target and holds (bloom motes that appear in place and linger)
  const coat = runeProps.channel?.coat ?? {};
  const coatTextures = coat.frames ? getVFXFrames(palette, ...coat.frames) : getVFXTexturePaths(palette, "spray");
  if ( coatTextures.length ) {
    particles.push({
      animation: "circleParticleBloom", anchor: "destination", textures: coatTextures, duration: deliveryDuration,
      params: {chargeRadius: Math.round(target.radiusPx * (channel.coatRadiusFactor ?? 1.1)), growFraction: 0.5,
        lifetime: {min: 1000, max: 1700}, spawnRate: 70, alpha: {min: 0.5, max: 0.95}, scale: {min: 0.5, max: 1.1},
        elevation: target.elevation, fade: {in: 0.2, out: 0.45}, ...coat.params}
    });
  }

  // A tinted glow gradually overtakes the target, its strength building across the channel to a peak at the
  // climax then easing out over the linger. A rune which puts a filter of its own on the target forgoes it
  if ( runeProps.channel?.glow === false ) return {animations, particles};
  animations.push({function: "impactSpriteGlow",
    params: {glowColor: channel.glow?.[palette] ?? 0xffffff, duration: deliveryDuration + lingerDuration,
      fadeOut: lingerDuration, outerStrength: 5, innerStrength: 2,
      distance: 12, padding: 14, quality: 0.5, alpha: 0.9}});
  return {animations, particles};
}

/* -------------------------------------------- */

/**
 * Build the charge particles + delivery configuration for a ray, dispatching entirely through
 * the palette's RAY_VFX_PROPS row: charge layers (from the rune's chargeXxx fields via {@link
 * _resolveChargeLayers}), an optional sustained-charge layer set in delivery (when the rune sets
 * `sustainedChargeAnchor`), the looping delivery sound, and the rune's `buildDelivery(ctx)` returning
 * the layered particle composition.
 * @param {object} runeProps  The palette's RAY_VFX_PROPS row.
 * @param {object} ctx        Builder context produced by _configureRayVFXEffect.
 * @returns {{chargeParticles: object[], delivery: object}}
 */
function _buildRayChargeAndDelivery(runeProps, ctx) {
  const chargeCtx = {palette: ctx.palette, textures: ctx.textures, casterRadiusPx: ctx.casterRadiusPx,
    casterElevation: ctx.casterElevation, particleElevation: ctx.beamElevation};
  const chargeEmitDuration = ctx.CHARGE_DURATION + (runeProps.chargeTail ?? 0);
  const chargeParticles = _resolveChargeLayers(runeProps, chargeCtx,
    {anchor: runeProps.chargeAnchor, duration: chargeEmitDuration});
  const sustainedLayers = runeProps.sustainedChargeAnchor
    ? _resolveChargeLayers(runeProps, chargeCtx,
      {anchor: runeProps.sustainedChargeAnchor, duration: runeProps.deliveryDuration, sustained: true})
    : [];
  const deliverySound = _resolveDeliverySound(ctx, runeProps.deliverySound, runeProps.deliverySoundType);
  const deliveryLayers = runeProps.buildDelivery(ctx);
  return {
    chargeParticles,
    delivery: {
      duration: runeProps.deliveryDuration,
      sound: deliverySound,
      animations: runeProps.buildAnimations?.(ctx) ?? [],
      particles: [...sustainedLayers, ...deliveryLayers]
    }
  };
}

/* -------------------------------------------- */
/*  Configuration Helpers                       */
/* -------------------------------------------- */

/**
 * Build a bolt of lightning striking from overhead, bursting a disc of bolts on the ground where it lands.
 * @param {string} palette
 * @param {object} area
 * @param {number} area.radius              Pixel radius of the storm, which bounds the height of the bolt.
 * @param {number} area.particleElevation
 * @param {object} [params]                 Further {@link impactSpriteStrike} params, such as where it strikes.
 * @returns {{function: string, params: object}}
 */
function _stormStrike(palette, {radius, particleElevation}, params={}) {
  const radiusFeet = radius / canvas.dimensions.distancePixels;
  return {function: "impactSpriteStrike", params: {
    textures: getVFXFrames(palette, "FallingBolt"),
    size: Math.clamp(radiusFeet * 0.9, 8, 16), duration: 280, fps: 18, fadeOut: 110,
    elevation: particleElevation + 2,
    flash: {texture: getVFXTexturePath(`${palette}/DiscBolts`), size: 2.0, duration: 320},
    cloud: {textures: getVFXFrames(palette, "AirCloud"), alpha: 0.9, gather: 350, disperse: 700},
    ...params}};
}

/* -------------------------------------------- */

/**
 * The scorch a bolt of lightning leaves on open ground.
 * @param {string} palette
 * @returns {object}
 */
function _stormScorch(palette) {
  return {texture: getVFXTexturePath(`${palette}/GroundScorch`), size: 3, duration: 3500, alpha: 0.75};
}

/* -------------------------------------------- */

/**
 * The short streaks of lightning thrown as arcs and as the forks of a bolt.
 * @param {string} palette
 * @returns {string[]}
 */
function _stormStreaks(palette) {
  return getVFXFrames(palette, "StreakBoltSingle", "StreakBoltForked");
}

/* -------------------------------------------- */

/**
 * Build a forked bolt of lightning spanning between two points at once.
 * @param {string} palette
 * @param {object} params           Further {@link raySpriteBolt} params.
 * @param {object} [params.forks]   Merged over the default forks.
 * @returns {{function: string, params: object}}
 */
function _stormBolt(palette, {forks, ...params}) {
  return {function: "raySpriteBolt", params: {
    texture: getVFXTexturePath(`${palette}/ProjectileBolt2`), segment: 10,
    forks: {textures: _stormStreaks(palette), angle: 45, crossings: [0.506], ...forks},
    ...params}};
}

/* -------------------------------------------- */

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
        exposure: exposureInHot(0.5, {reverse: true})}},
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
        exposure: exposureInHot(0.5)}}
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

// The tight turbulence of a Storm spell: cloud and wind counter-rotating close about the caster beneath an aura
const _STORM_SWIRL = {speedJitter: 0.3, radiusJitter: 0.35, wobbleAmplitude: 0.12, wobbleSpeed: 3,
  fade: {in: 0.25, out: 0.4}, blend: PIXI.BLEND_MODES.NORMAL};
const _STORM_SWIRL_CLOUDS = {..._STORM_SWIRL, orbitSpeed: 6, spinSpeed: 2, spawnRate: 26,
  lifetime: {min: 600, max: 1000}, alpha: {min: 0.3, max: 0.6}, scale: {min: 2.0, max: 3.0}};
const _STORM_SWIRL_WIND = {..._STORM_SWIRL, orbitSpeed: -8, spinSpeed: 8, spawnRate: 22,
  lifetime: {min: 450, max: 800}, alpha: {min: 0.3, max: 0.6}, scale: {min: 1.5, max: 2.5}};
const _STORM_SWIRL_AURA = {spinSpeed: 0.6, jumpInterval: {min: 250, max: 700}, alpha: {min: 0.85, max: 0.95},
  blend: PIXI.BLEND_MODES.NORMAL, sort: 2};

// Electricity crackling in place: brief overexposed sparks blooming wherever they are spawned
const _STORM_CRACKLE = {growFraction: 0.15, lifetime: {min: 70, max: 160}, alpha: {min: 0.8, max: 1.0},
  scale: {min: 0.6, max: 1.1}, fade: {in: 0.05, out: 0.3}, blend: PIXI.BLEND_MODES.ADD,
  exposure: exposureInHot(0.7)};
const _STORM_SWIRL_SPARKS = {..._STORM_CRACKLE, spawnRate: 20, spawnRateEnd: 90};

// Reusable aura charge-up for Storm spells, its sparks gathering wherever the gesture releases from
const _CHARGE_STORM_AURA = {
  chargeBehavior: "circleParticleOrbit",
  chargeLayers: [
    {frames: ["AuraBolts"], above: true, anchor: "source", animation: "circleParticleAura", radiusFactor: 1.25,
      params: _STORM_SWIRL_AURA, sustained: {offset: -200}},
    {frames: ["SprayClouds"], above: true, anchor: "source", radiusFactor: 0.85, params: _STORM_SWIRL_CLOUDS},
    {frames: ["SprayWind"], above: true, anchor: "source", radiusFactor: 1.0, params: _STORM_SWIRL_WIND},
    {frames: ["SprayBolts"], above: true, animation: "circleParticleBloom", radiusFactor: 0.6,
      params: _STORM_SWIRL_SPARKS, sustained: {params: {spawnRate: 60, spawnRateEnd: 60}}}
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

// Reusable impact treatment for Storm spells: short-lived forking sparks thrown off a scorched strike point.
const _IMPACT_STORM = {
  impactSpriteSize: 3, impactSpriteScale: 1.35,
  impactShock: {duration: 450, rate: 14, fadeOut: 120},
  impactParticles: [
    {
      frames: ["SprayBolts"],
      params: {count: 14, speed: {min: 90, max: 260}, lifetime: {min: 180, max: 420},
        alpha: {min: 0.7, max: 1.0}, scale: {min: 0.65, max: 1.3},
        fade: {in: 0.05, out: 0.4}, blend: PIXI.BLEND_MODES.NORMAL, exposure: exposureInHot(0.7)}
    },
    {
      animation: "circleParticleBloom",
      frames: ["GroundScorch"],
      radiusFactor: 0.2,
      duration: 200,
      params: {count: 2, initial: 2, spawnRate: 0,
        lifetime: {min: 3000, max: 4500},
        scale: {min: 1.6, max: 2.4}, growFraction: 0.1,
        alpha: {min: 0.6, max: 0.85},
        fade: {in: 0.05, out: 0.5},
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

// TODO Poison repeats the Life charge and impact without the bloom and root art it lacks, pending manual tuning
const _CHARGE_POISON_SPRAY = {
  chargeBehavior: "circleParticleBloom", chargeAnchor: "source",
  chargeLayers: [
    {categories: ["spray"], above: true, radiusFactor: 2.5,
      params: {lifetime: {min: 900, max: 1500}, spawnRate: 80, scale: {min: 0.5, max: 0.8},
        exposure: exposureInHot(0.5)}}
  ]
};
const _IMPACT_POISON = {
  impactSprite: false, recoil: true,
  impactGlow: {..._IMPACT_LIFE.impactGlow, glowColor: 0x8bd43a},
  impactParticles: [{frames: ["SprayLeaf", "SprayBubble"]}]
};

/**
 * The reusable impact treatment of each palette, keyed by palette.
 * @type {Record<string, object>}
 */
const RUNE_IMPACTS = {
  death: _IMPACT_DEATH,
  flame: _IMPACT_FLAME,
  frost: _IMPACT_FROST,
  life: _IMPACT_LIFE,
  poison: _IMPACT_POISON,
  storm: _IMPACT_STORM
};

/* -------------------------------------------- */
/*  Per-Gesture Configuration                   */
/* -------------------------------------------- */

/**
 * Per-rune VFX overrides for the Arrow gesture.
 *
 * Projectile:
 * - `projectileSize` (number): override the projectile sprite size in feet (default 3).
 * - `projectileFrame` (string): a specific projectile texture frame (e.g. "life/ProjectileBubble") or flipbook
 *   (e.g. "storm/ProjectileBolt"); defaults to a random `projectile`-category texture.
 * - `projectileSpeed` (number): flight speed in feet/sec (default 150).
 * - `projectileFps` (number): frame rate at which a flipbook projectile cycles its middle frames between its first
 *   and last; omit to spread every frame once across the flight.
 * - `projectileReveal` ("charge"|"release"): fade the projectile in across the charge (default), or snap it
 *   into view only at release.
 * - `projectileTextureAnchor` (boolean): ride the flight path on the frame's own anchor rather than its center,
 *   launching from ahead of the manifest point (see {@link CrucibleProjectileComponent.computeLaunch}).
 * - `projectileBlend` (number): a PIXI.BLEND_MODES value for the projectile sprite (default NORMAL).
 * - `path` ({type, params}): a `CONFIG.Canvas.vfx.paths` generator for the flight trajectory
 *   (default linear); e.g. `{type: "weave", params: {arcCount, amplitude}}` for a serpentine bolt.
 * - `whoosh` (string|null): generic launch-whoosh sound key (default "whooshFast"); null for silence.
 * - `flightSound` ({rune, type, fade, offset, release}): a RUNE_SOUNDS entry played across the flight in place of
 *   the whoosh, looping when the entry loops; e.g. the storm `crackle`.
 * - `trail` (boolean|{frames|categories, params}): emit a particle trail behind the projectile;
 *   `true` uses directional streak textures, or pass texture frames/categories + behavior params.
 *
 * Charge phase (shape shared with Ray gesture, see {@link _resolveChargeLayers}):
 * - `chargeDuration` (number): charge phase length in ms (default 700).
 * - `chargeSound` (boolean): play the rune's charge sound (default true).
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
 *   `radius` (the same casterRadiusPx-scaled value) plus a derived `elevation` in its params. A layer tuned as a
 *   one-shot burst may give `sustained: {offset, params}`, merged over it when a gesture holds the charge across
 *   its delivery (`sustainedChargeAnchor`), e.g. to spawn continuously rather than all at once.
 * - `chargeTail` (number): ms the charge particles keep emitting past the projectile-release label
 *   (default 200; negative ends emission before release).
 * - `sprayParams` (object): per-layer material overrides applied when no `chargeLayers` are declared
 *   and the default spray-mote fallback layer is used.
 *
 * Impact:
 * - `stickDuration` (number): ms the projectile sprite stays at the impact location after a
 *   HIT/GLANCE before fading. Omit or 0 for no stick.
 * - The {@link RuneImpactData} fields, which configure the hit treatment on the target.
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
  },

  // Arrow+Storm: a bolt lashes out of the caster's turbulence, shedding sparks, its tip landing on the target
  storm: {
    ..._CHARGE_STORM_AURA,
    ..._IMPACT_STORM,
    impactSpriteFrame: "storm/ImpactBoltsSmall",
    chargeDuration: 1200,
    projectileFrame: "storm/ProjectileBolt", projectileSize: 8, projectileSpeed: 40, projectileFps: 8,
    projectileReveal: "release", projectileTextureAnchor: true, projectileBlend: PIXI.BLEND_MODES.ADD,
    flightSound: {rune: "storm", type: "crackle", fade: 60, release: 150, volume: 0.45},
    trail: {frames: ["SprayBolts"], params: {align: false, body: true, speed: {min: 10, max: 40},
      lifetime: {min: 90, max: 200}, spawnRate: 160, scale: {min: 0.4, max: 0.8},
      alpha: {min: 0.7, max: 1.0}, blend: PIXI.BLEND_MODES.NORMAL, exposure: exposureInHot(0.7)}}
  }
};

// TODO Arrow+Poison repeats Arrow+Life pending manual tuning
ARROW_VFX_PROPS.poison = {...ARROW_VFX_PROPS.life, ..._CHARGE_POISON_SPRAY, ..._IMPACT_POISON,
  projectileFrame: "poison/ProjectileBubble", flightSound: {...ARROW_VFX_PROPS.life.flightSound, rune: "poison"}};

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
 * - `frontDuration` (number, optional): ms the auto-derived front takes to reach the end of the beam, when that is
 *   sooner than `deliveryDuration`; e.g. a bolt of lightning which spans the ray at once and then lingers.
 * - `chargeDuration` (number): charge phase length in ms (default 700).
 * - `buildAnimations(ctx)` (function, optional): returns the delivery sprite-animation array (same `ctx`).
 * - `buildSounds(ctx)` (function, optional): returns `{sound, time, origin?}` cues for the component's `sounds`
 *   array (same `ctx`), e.g. the crack of a bolt at its release.
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
      const {palette, width, beamElevation, spawnRadius, beamSpeed} = ctx;
      const DELIVERY_DURATION = this.deliveryDuration;
      return [
        { // Tight jet of bone needles streaming down the beam, sparse enough to read as individual shards
          animation: "rayParticleBeam", anchor: "origin",
          textures: getVFXFrames(palette, "StreakBoneShard"),
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: beamSpeed * 1.5, angleSpread: 0.5, radius: spawnRadius,
            spawnRate: 28, rotationSpread: 0.03,
            alpha: {min: 0.75, max: 1.0}, scale: {min: 0.35, max: 0.6},
            fade: {in: 40, out: 200}, blend: PIXI.BLEND_MODES.NORMAL, elevation: beamElevation}
        },
        { // Bone spikes erupting from the ground as the front marches out along the beam
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(palette, "GroundBoneSpikes"),
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.5), spacing: 52,
            rotationSpread: Math.toRadians(15),
            lifetime: {min: DELIVERY_DURATION + 2000, max: DELIVERY_DURATION + 3500},
            alpha: {min: 0.7, max: 1.0}, scale: {min: 0.8, max: 1.3},
            fade: {in: 60, out: 1200}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0, sort: 0}
        },
        { // Spike fans, mirrored along the beam axis so the curl points at the target rather than back
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(palette, "GroundSpikesFan"),
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
          textures: getVFXFrames(palette, "GroundHandGrasp"),
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
            exposure: exposureInHot(0.5), elevation: beamElevation}
        },
        { // Cast-off flare: a slow, wide, short-lived spray softening the beam's root
          animation: "rayParticleRootCastoff", anchor: "origin", textures: textures.spray,
          duration: DELIVERY_DURATION, mask: true,
          params: {speed: beamSpeed, coneDeg: 60, radius: spawnRadius, spawnRate: 240,
            rotationSpread: 0.3, lifetime: {min: 200, max: 400}, alpha: {min: 0.75, max: 1.0},
            scale: {min: 0.6, max: 1.2}, fade: {in: 0, out: 150}, blend: PIXI.BLEND_MODES.NORMAL,
            exposure: exposureInHot(0.5), elevation: beamElevation}
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
            exposure: exposureInHot(1, {normal: -1, hot: 1}), elevation: 0}
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
      const {palette, textures, width, casterElevation, beamSpeed} = ctx;
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
          textures: getVFXFrames(palette, "GroundRoots"),
          duration: DELIVERY_DURATION, mask: true,
          params: {width: Math.round(width * 0.7), spacing: 50,
            rotationSpread: Math.PI,
            lifetime: rootLifetime,
            scale: {min: 0.8, max: 1.4}, alpha: {min: 0.5, max: 0.85},
            fade: {in: 200, out: 1800}, blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        {
          animation: "rayParticleHeadCastoff", anchor: "origin",
          textures: getVFXFrames(palette, "Spray"),
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
  },

  // Ray+Storm: where the arrow's bolt travels, this one spans the whole ray at once, through every target on it
  storm: {
    ..._CHARGE_STORM_AURA,
    ..._IMPACT_STORM,
    impactSpriteFrame: "storm/ImpactBoltsLarge", impactSpriteAngle: 45, impactSpriteScale: 1.8,
    chargeDuration: 1200,
    deliveryDuration: 560, frontDuration: 140,
    impactTiming: "beamFront",
    deliverySoundType: "crackle",
    deliverySound: {fade: 40, release: 300, volume: 0.6},
    buildSounds({palette, sound, CHARGE_DURATION}) {
      const crack = sound(getVFXSound(palette, "crack"));
      return crack ? [{sound: crack, time: Math.max(CHARGE_DURATION - 50, 0)}] : [];
    },
    buildAnimations(ctx) {
      return [_stormBolt(ctx.palette, {
        sweep: this.frontDuration, hold: this.deliveryDuration - this.frontDuration, fadeOut: 220, flicker: 16,
        afterimage: {alpha: 0.32, duration: 1600}, forks: {size: 5, jitter: 10, chance: 0.85},
        elevation: ctx.beamElevation})];
    },
    buildDelivery(ctx) {
      const {palette, beamElevation, beamLength} = ctx;
      const haze = Math.clamp(Math.round((beamLength / canvas.dimensions.distancePixels) * 0.8), 10, 60);
      return [{
        animation: "shapeParticleResidue", anchor: "origin",
        textures: getVFXFrames(palette, "SprayClouds"),
        offset: this.deliveryDuration - 260, duration: 300, mask: true,
        params: {count: haze, initial: haze, speed: {min: 4, max: 16},
          lifetime: {min: 1400, max: 2400}, scale: {min: 2.0, max: 3.5},
          scaleCurve: [{time: 0, value: 0.7}, {time: 1, value: 1.5}],
          rotationSpeed: {min: -0.4, max: 0.4}, alpha: {min: 0.12, max: 0.3},
          fade: {in: 250, out: 1200}, blend: PIXI.BLEND_MODES.NORMAL, elevation: beamElevation}
      }];
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
 * - `impactStart(ctx)` (optional): returns one target's impact start in place of the `impactTiming` strategy.
 *   `ctx` carries the timing context plus the target's `index` and the `total` struck, e.g. to give each target
 *   of a lightning storm a bolt of its own.
 * - `buildImpact(ctx)` (optional): returns further sprite animations for one target's impact, with `ctx` of
 *   `{action, token, result, particleElevation, radius}`.
 * - `impactSound` ("impact" | "impactHeavy"): RUNE_SOUNDS key for hit cues.
 * - `deliverySoundType` (string): RUNE_SOUNDS key for the looping delivery sound (omit for silent).
 * - `deliverySound` ({fade, offset, release}): envelope params when delivery sound is enabled.
 * - `buildDelivery(ctx)`: returns the delivery particle-layer array. `ctx` carries `{action,
 *   textures, origin, radius, particleElevation, casterElevation, casterRadiusPx, sound}`.
 * - `buildAnimations(ctx)` (optional): returns the delivery sprite-animation array (same `ctx`), e.g. a
 *   lightning strike from overhead.
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
 * - The {@link RuneImpactData} fields, which configure the hit treatment on the target.
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
      const {palette, textures, origin, radius, particleElevation} = ctx;
      const STORM_DURATION = this.deliveryDuration;
      const SPAWN_RATE = 14;
      const EMERGE_DELAY = 500;
      const area = {type: "circle", x: origin.x, y: origin.y, radius};
      return [
        { // Fissures cracking open across the blast circle, each recording a site for a hand to rise from
          animation: "blastParticleEmergenceSite", anchor: "origin",
          textures: getVFXFrames(palette, "GroundFissureLarge", "GroundFissureSmall"),
          duration: STORM_DURATION, mask: true,
          params: {spawnRate: SPAWN_RATE, count: null, growDuration: 180,
            lifetime: {min: 2500, max: 4000},
            scale: {min: 0.7, max: 1.2}, alpha: {min: 0.6, max: 0.9},
            fade: {in: 60, out: 1200}, area,
            blend: PIXI.BLEND_MODES.NORMAL, elevation: 0}
        },
        { // Skeletal hands bursting from each fissure half a second after it opens, then withdrawing
          animation: "blastParticleEmergingSprite", anchor: "origin",
          textures: getVFXFrames(palette, "GroundBoneHand"),
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
          textures: getVFXFrames(palette, "SprayWisps"),
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
      const {palette, sound} = ctx;
      const STORM_DURATION = this.deliveryDuration;
      const CHARGE_DURATION = this.chargeDuration;
      const CUES = 6;
      const cues = [];
      for ( let i = 0; i < CUES; i++ ) {
        const cue = sound(getVFXSound(palette, "impact"));
        if ( !cue ) break;
        const t = (i + (Math.random() * 0.6)) / CUES;
        cues.push({sound: cue, time: CHARGE_DURATION + Math.round(t * STORM_DURATION)});
      }
      return cues;
    },
    buildDelivery(ctx) {
      const {palette, textures, origin, radius, particleElevation} = ctx;
      const STORM_DURATION = this.deliveryDuration;
      const fallingTextures = getVFXFrames(palette, "Falling");
      const groundTextures = getVFXTexturePaths(palette, "ground");
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
      const {palette, textures, origin, radius, particleElevation} = ctx;
      const EXPLOSION_DURATION = this.deliveryDuration;
      return [
        { // Combustion burst: explosive radial particles flying outward from the blast origin
          animation: "shapeParticleCombustion", anchor: "origin",
          textures: getVFXFrames(palette, "SprayFlame", "SprayEmbers"),
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
          textures: getVFXFrames(palette, "GroundScorch"),
          offset: 200, duration: EXPLOSION_DURATION, mask: true,
          params: {count: 60, initial: 60,
            speed: {min: 0, max: 0},
            lifetime: {min: 5000, max: 7000},
            scale: {min: 0.7, max: 1.3}, alpha: {min: 0.4, max: 0.7},
            scaleCurve: [{time: 0, value: 1.0}, {time: 1, value: 1.0}],
            fade: {in: 200, out: 2500},
            blend: PIXI.BLEND_MODES.NORMAL,
            exposure: exposureInHot(1, {normal: -1, hot: 1}),
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
      const {palette, origin, radius, particleElevation, casterElevation} = ctx;
      const MAELSTROM_DURATION = this.deliveryDuration;
      return [
        { // Ground roots: filling the blast area as the energy converges
          animation: "circleParticleBloom", anchor: "origin",
          textures: getVFXFrames(palette, "GroundRoots"),
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
          textures: getVFXFrames(palette, "GroundBlooms"),
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
          textures: getVFXFrames(palette, "SprayLeaf", "SprayBubble"),
          duration: MAELSTROM_DURATION, mask: true,
          params: {chargeRadius: Math.round(radius * 1.2),
            swirlSpeed: 3.5, spinSpeed: 4,
            spawnRate: 220, lifetime: {min: 1800, max: 2600},
            scale: {min: 0.6, max: 1.1}, alpha: {min: 0.6, max: 0.95},
            fade: {in: 0.1, out: 0.4},
            exposure: exposureInHot(0.7, {reverse: true}),
            elevation: casterElevation + 1}
        },
        { // Drifting bubble residue lingering above as the energy dissipates
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(palette, "AirBubbles"),
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
  },

  // Blast+Storm: storm cloud blankets the area while the caster channels, raining bolts at random and on each target
  storm: {
    ..._CHARGE_STORM_AURA,
    ..._IMPACT_STORM,
    impactSprite: false,
    chargeAnchor: "forward",
    chargeDuration: 1200,
    sustainedChargeAnchor: "source",
    deliveryDuration: 5000,
    strikes: 5,
    impactStart({deliveryStart, deliveryDuration, index, total}) {
      const t = 0.15 + (0.7 * ((index + 0.2 + (Math.random() * 0.6)) / total));
      return deliveryStart + Math.round(deliveryDuration * t);
    },
    buildImpact({palette, token, result, particleElevation, radius}) {
      const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
      const isHit = (result === T.HIT) || (result === T.GLANCE);
      return [_stormStrike(palette, {radius, particleElevation},
        isHit ? {} : {delta: computeAttackOffset(token, result), scorch: _stormScorch(palette)})];
    },
    scheduleStrikes({origin, radius}) {
      const strikes = [];
      for ( let i = 0; i < this.strikes; i++ ) {
        const r = radius * 0.92 * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        strikes.push({
          time: Math.round(this.deliveryDuration * (0.06 + (0.88 * ((i + Math.random()) / this.strikes)))),
          point: {x: Math.round(origin.x + (Math.cos(a) * r)), y: Math.round(origin.y + (Math.sin(a) * r))}
        });
      }
      return strikes;
    },
    buildSounds(ctx) {
      const {palette, sound} = ctx;
      ctx.strikeSchedule ??= this.scheduleStrikes(ctx);
      const cues = [];
      const thunder = sound(getVFXSound(palette, "thunder"));
      if ( thunder ) cues.push({sound: {...thunder, radius: 60}, time: this.chargeDuration});
      for ( const strike of ctx.strikeSchedule ) {
        const cue = sound(getVFXSound(palette, "impact"));
        if ( !cue ) break;
        cue.volume = 0.45 + (Math.random() * 0.35);
        cues.push({sound: cue, time: this.chargeDuration + strike.time});
      }
      return cues;
    },
    buildAnimations(ctx) {
      const {palette} = ctx;
      ctx.strikeSchedule ??= this.scheduleStrikes(ctx);
      return ctx.strikeSchedule.map(strike => _stormStrike(palette, ctx,
        {point: strike.point, offset: strike.time, scorch: _stormScorch(palette)}));
    },
    buildDelivery(ctx) {
      const {palette, radius, particleElevation} = ctx;
      const STORM_DURATION = this.deliveryDuration;
      const coverRadius = Math.round(radius * 1.5);

      // A few vast, faint bodies, each wider than the whole blast, so their overlap leaves no ground bare
      const cloudScale = (radius * 3.6) / 128 / getParticleScaleFactor();
      const cloud = {
        area: {type: "circle", x: ctx.origin.x, y: ctx.origin.y, radius: Math.round(radius * 0.6)},
        speed: {min: 4, max: 14}, rotationSpeed: {min: -0.12, max: 0.12},
        scale: {min: cloudScale * 0.85, max: cloudScale * 1.15},
        scaleCurve: [{time: 0, value: 0.8}, {time: 0.5, value: 1.0}, {time: 1, value: 1.15}],
        alpha: {min: 0.16, max: 0.3}, blend: PIXI.BLEND_MODES.NORMAL, elevation: particleElevation + 1, sort: 1};

      // Cover hangs over the walls beneath it, so is unmasked, and stays under the density floor, so is never thinned
      return [
        {
          animation: "shapeParticleResidue", anchor: "origin", textures: getVFXFrames(palette, "AirCloud"),
          duration: 200,
          params: {...cloud, count: 6, initial: 6, spawnRate: 0, lifetime: {min: 1800, max: 3200},
            fade: {in: 700, out: 1300}}
        },
        {
          animation: "shapeParticleResidue", anchor: "origin", textures: getVFXFrames(palette, "AirCloud"),
          duration: STORM_DURATION - 1500,
          params: {...cloud, count: null, spawnRate: 2.5, lifetime: {min: 2600, max: 4200},
            fade: {in: 900, out: 1300}}
        },
        {
          animation: "circleParticleBloom", anchor: "origin", textures: getVFXFrames(palette, "SprayBolts"),
          duration: STORM_DURATION,
          params: {..._STORM_CRACKLE, chargeRadius: coverRadius, spawnRate: 40, scale: {min: 1.0, max: 1.8},
            elevation: particleElevation + 1, sort: 0}
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
 * - `buildAnimations(ctx)` (optional): returns the delivery sprite-animation array (same `ctx`).
 * - `buildImpact(ctx)` (optional): returns further sprite animations for one target's impact; `ctx` adds the
 *   target's `token`, `result`, and `isHit`.
 * - `buildSounds(ctx)` (optional): returns `{sound, time, origin?}` cues; `ctx` adds `sound` and `chargeDuration`.
 * - `impactStart(ctx)` (optional): returns one target's impact start in place of the bearing-based sweep timing,
 *   e.g. for a fan which strikes everything at once rather than sweeping an arm across it.
 * - All the chargeXxx fields consumed by {@link _resolveChargeLayers} (chargeBehavior, chargeAnchor,
 *   chargeAbove, chargeLayers, sprayParams, ...).
 * - The {@link RuneImpactData} fields, which configure the hit treatment on the target.
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
      const {palette, radius, sweepDuration, particleElevation, casterElevation} = ctx;
      return [
        { // Bone scythes fired out to the cone perimeter and back in unison, spinning on their own axes
          animation: "fanParticleYoyo", anchor: "origin",
          textures: getVFXFrames(palette, "ProjectileBoneScythe"),
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
          textures: getVFXFrames(palette, "RootBone"),
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
          textures: getVFXFrames(palette, "AirMistyWisps"),
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
          textures: getVFXFrames(palette, "SprayWisps"),
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
      const {action, palette, textures, radius, startAngleRad, endAngleRad, sweepDuration, particleElevation} = ctx;
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
          textures: getVFXTexturePaths(palette, "impact"),
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
      const {palette, particleElevation} = ctx;
      return [
        { // SprayFlame gather condensing at the muzzle just before the jet erupts
          animation: "circleParticleGather", anchor: "forward",
          textures: getVFXFrames(palette, "SprayFlame"),
          duration: 200,
          params: {chargeRadius: 25, lifetime: 180, spawnRate: 600,
            alpha: {min: 0.75, max: 1.0}, scale: {min: 0.5, max: 0.9},
            elevation: particleElevation, blend: PIXI.BLEND_MODES.ADD}
        }
      ];
    },
    buildDelivery(ctx) {
      const {palette, textures, radius, startAngleRad, endAngleRad, sweepDuration,
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
          textures: getVFXFrames(palette, "GroundScorch"),
          duration: sweepDuration, mask: true,
          params: {
            startAngleRad, endAngleRad,
            radiusFactor: 0.9, radialJitter: 35, arcSpread: 0.07,
            alpha: {min: 0.25, max: 0.5}, scale: {min: 0.75, max: 1.25},
            lifetime: {min: 5000, max: 7000}, spawnRate: 70, elevation: 0,
            fade: {in: 0, out: 2500},
            blend: PIXI.BLEND_MODES.NORMAL,
            exposure: exposureInHot(1, {normal: -1, hot: 1})
          }
        },
        { // Sustained SprayEmbers stoking the area with ADD-blend sparks throughout the delivery
          animation: "shapeParticleCombustion", anchor: "origin",
          textures: getVFXFrames(palette, "SprayEmbers"),
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
      const {palette, casterRadiusPx, casterElevation} = ctx;
      return [{
        animation: "circleParticleVortex", anchor: "source",
        textures: getVFXFrames(palette, "SprayBubble", "SprayLeaf"),
        duration: 900,
        params: {chargeRadius: casterRadiusPx * 2.0, swirlSpeed: 4, spinSpeed: 4,
          lifetime: 700, spawnRate: 360,
          scale: {min: 0.6, max: 1.1}, alpha: {min: 0.6, max: 0.95},
          elevation: casterElevation + 1,
          blend: PIXI.BLEND_MODES.NORMAL,
          exposure: exposureInHot(0.6, {reverse: true}),
          fade: {in: 0.15, out: 0.45}}
      }];
    },
    buildDelivery(ctx) {
      const {palette, radius, sweepDuration, particleElevation, casterElevation} = ctx;
      return [
        { // Yo-yo discs fired out and return in unison. Six discs which go out hot and return cool
          animation: "fanParticleYoyo", anchor: "origin",
          textures: getVFXFrames(palette, "DiscWispy"),
          duration: sweepDuration, mask: true,
          params: {count: 6, initial: 6, spawnRate: 0,
            reach: Math.round(radius * 0.9),
            lifetime: {min: sweepDuration, max: sweepDuration},
            rotationSpeed: 5,
            exposure: exposureInHot(1.0),
            alpha: {min: 0.85, max: 1.0}, scale: {min: 1.0, max: 1.3},
            elevation: casterElevation + 1,
            fade: {in: 0.05, out: 0.15}
          }
        },
        { // Magical leaf spray throughout the cone that is highlighted with ADD blend
          animation: "shapeParticleResidue", anchor: "origin",
          textures: getVFXFrames(palette, "SprayLeaf"),
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
          textures: getVFXFrames(palette, "AirBubbles"),
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
  },

  // Fan+Storm: a torrent of lightning poured from the caster's hands across the whole arc for as long as they
  // channel it, an arc of it held on each target they strike
  storm: {
    ..._IMPACT_STORM,
    impactSprite: false,
    impactShock: {duration: 2850, rate: 12, fadeOut: 250},
    impactParticles: [
      {
        frames: ["SprayBolts"], duration: 2850,
        params: {count: null, initial: 0, spawnRate: 40, speed: {min: 70, max: 220},
          lifetime: {min: 160, max: 380}, alpha: {min: 0.7, max: 1.0}, scale: {min: 0.55, max: 1.1},
          fade: {in: 0.05, out: 0.4}, blend: PIXI.BLEND_MODES.ADD, exposure: exposureInHot(0.7)}
      },
      _IMPACT_STORM.impactParticles[1]
    ],
    chargeDuration: 1000,
    chargeSound: false,
    sweepDuration: 3000,
    deliverySoundType: "damage",
    deliverySound: {fade: 900, offset: -1000, release: 500, volume: 0.5},
    impactStart: ({chargeDuration}) => chargeDuration + 60,
    buildSounds({palette, sound, chargeDuration, sweepDuration}) {
      const cues = [];

      // A channel has no single moment of release, so it is a bed of two loops under a scatter of impacts
      const crackle = sound(getVFXSound(palette, "crackle"));
      if ( crackle ) {
        cues.push({sound: {...crackle, fade: 80, release: 400}, time: chargeDuration, duration: sweepDuration});
      }
      for ( let t = 350 + (Math.random() * 250); t < (sweepDuration - 300); t += 450 + (Math.random() * 300) ) {
        const impact = sound(getVFXSound(palette, "impact"));
        if ( !impact ) break;
        cues.push({sound: {...impact, volume: 0.45 + (Math.random() * 0.3)}, time: chargeDuration + Math.round(t)});
      }
      return cues;
    },
    buildCharge({palette, casterRadiusPx, casterElevation}) {

      // The swirl outlasts the charge phase which spawns it, running unbroken to the end of the channel
      const elevation = casterElevation + 1;
      const spell = this.chargeDuration + this.sweepDuration;
      return [
        {
          animation: "circleParticleAura", anchor: "source", textures: getVFXFrames(palette, "AuraBolts"),
          duration: spell,
          params: {..._STORM_SWIRL_AURA, chargeRadius: Math.round(casterRadiusPx * 1.25), elevation}
        },
        {
          animation: "circleParticleOrbit", anchor: "source", textures: getVFXFrames(palette, "SprayClouds"),
          duration: spell,
          params: {..._STORM_SWIRL_CLOUDS, chargeRadius: Math.round(casterRadiusPx * 0.85), elevation}
        },
        {
          animation: "circleParticleOrbit", anchor: "source", textures: getVFXFrames(palette, "SprayWind"),
          duration: spell,
          params: {..._STORM_SWIRL_WIND, chargeRadius: Math.round(casterRadiusPx), elevation}
        },
        {
          animation: "circleParticleBloom", anchor: "source", textures: getVFXFrames(palette, "SprayBolts"),
          duration: this.chargeDuration,
          params: {..._STORM_SWIRL_SPARKS, chargeRadius: Math.round(casterRadiusPx * 1.2), elevation}
        }
      ];
    },
    buildAnimations({palette, radius, casterRadiusPx, casterElevation}) {
      const inset = Math.round(casterRadiusPx * 0.7);
      const streak = 3.5;
      const streakReach = radius - (streak * canvas.dimensions.distancePixels);
      return [
        { // The primary sprays: few enough that the torrent keeps its structure
          function: "fanSpriteArcs", params: {
            textures: getVFXFrames(palette, "ImpactBoltsLarge"),
            copies: 2, size: (radius - inset) / canvas.dimensions.distancePixels, inset, spray: 40,
            interval: {min: 70, max: 130}, fadeOut: 180, elevation: casterElevation + 1}
        },
        { // Secondary arcs: short streaks thrown anywhere out to the rim of the fan, skewed so they criss-cross
          function: "fanSpriteArcs", params: {
            textures: _stormStreaks(palette),
            copies: 5, size: streak, inset: {min: inset, max: Math.max(streakReach, inset)}, spray: 8, turn: 0,
            skew: 30, interval: {min: 45, max: 95}, fadeOut: 180, elevation: casterElevation + 1}
        }
      ];
    },
    buildImpact({palette, casterRadiusPx, casterElevation}) {
      return [_stormBolt(palette, {
        from: "origin", to: "destination", inset: Math.round(casterRadiusPx * 0.7),
        sweep: 60, hold: 2610, fadeOut: 180, flicker: 18, forks: {size: 2.5, jitter: 12, chance: 0.8},
        elevation: casterElevation + 2})];
    },
    buildDelivery({palette, casterRadiusPx, casterElevation, sweepDuration}) {
      return [{
        animation: "circleParticleBloom", anchor: "source", textures: getVFXFrames(palette, "SprayBolts"),
        duration: sweepDuration,
        params: {..._STORM_CRACKLE, chargeRadius: Math.round(casterRadiusPx * 1.2), spawnRate: 70,
          elevation: casterElevation + 1}
      }];
    }
  }
};

// TODO Fan+Poison repeats Fan+Life pending manual tuning
FAN_VFX_PROPS.poison = {...FAN_VFX_PROPS.life, ..._IMPACT_POISON};

/* -------------------------------------------- */

/**
 * Per-rune VFX overrides for the contact gestures, shared by Touch and (scaled up) by Influence. A small
 * single-layer charge gathered at the caster's hand plus the shared per-rune impact treatment. The charge
 * field shape is documented on {@link ARROW_VFX_PROPS}; the impact field shape on {@link RuneImpactData}.
 * One row serves both gestures, so an entry may also declare:
 * - `channel` ({glow, impactShock, sound, coat: {frames, params}}): how the rune differs when Influence channels
 *   it. `glow: false` forgoes the channel's tinted glow, `impactShock` replaces the row's own at the climax, `sound`
 *   merges over the channel's looping sound, and `coat` names which frames crust onto the target and tunes how.
 * - `buildAnimations(ctx)` (optional): returns delivery sprite animations. `ctx` carries `{action, channel, target,
 *   deliveryDuration, lingerDuration, casterElevation}`, with `channel` null for Touch. The delivery plays whatever
 *   the outcome; `target.hit` is for what it does to the target.
 * - `buildSounds(ctx)` (optional): returns `{sound, time, duration?, origin?}` cues. `ctx` carries `{action, sound,
 *   channel, chargeDuration, deliveryDuration}`.
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
  },

  // Touch+Storm is a zap: arcs snap from the hand into the target for an instant. Influence+Storm is an infusion:
  // they are held on the target for the whole channel, playing over its body as it is electrocuted throughout
  storm: {
    ..._CHARGE_STORM_AURA,
    ..._IMPACT_STORM,
    impactSpriteFrame: "storm/ImpactBoltsSmall", impactSpriteSize: 2.5,
    impactShock: {duration: 350, rate: 14, fadeOut: 120},
    chargeDuration: 600,
    channel: {
      glow: false,
      impactShock: {duration: 900, rate: 12, fadeOut: 450},
      sound: {volume: 0.5},
      coat: {frames: ["SprayBolts"], params: {..._STORM_CRACKLE, spawnRate: 60, scale: {min: 0.6, max: 1.2}}}
    },
    buildSounds({palette, sound, channel, chargeDuration, deliveryDuration}) {
      const crackle = channel ? sound(getVFXSound(palette, "crackle")) : null;
      if ( !crackle ) return [];
      return [{sound: {...crackle, fade: 80, release: 400}, time: chargeDuration, duration: deliveryDuration}];
    },
    buildAnimations({palette, channel, target, deliveryDuration, casterElevation}) {
      if ( !target ) return [];

      // The arcs are the delivery, thrown whatever the outcome. Only what they do to the target depends on it
      const arcs = (copies, scatter, params) => ({function: "impactSpriteArcs", params: {
        textures: _stormStreaks(palette), from: "forward",
        copies, scatter: Math.round(target.radiusPx * scatter), interval: {min: 35, max: 80}, fadeOut: 110,
        elevation: casterElevation + 2, ...params}});
      if ( !channel ) return [arcs(3, 0.3, {duration: 220})];
      const animations = [
        arcs(5, 0.65, {duration: deliveryDuration}),
        arcs(6, 0.75, {offset: deliveryDuration, duration: 320})
      ];
      if ( target.hit ) {
        animations.push({function: "impactSpriteShock", params: {duration: deliveryDuration, rate: 12, fadeOut: 0}});
      }
      return animations;
    }
  }
};

// TODO Touch+Poison and Influence+Poison repeat Touch+Life and Influence+Life pending manual tuning
TOUCH_VFX_PROPS.poison = {...TOUCH_VFX_PROPS.life, ..._IMPACT_POISON};

/* -------------------------------------------- */
/*  Gesture Registry                          */
/* -------------------------------------------- */

/**
 * A registry of gesture-specific VFX hooks and per-rune overrides, keyed by gesture ID.
 * Each entry may define:
 * - `configure` - called at configure-time to produce the serializable VFXEffect config.
 *    `null` explicitly suppresses VFX; absent defers to existing config.
 * - `resolve` - called at play-time to compute reference values before VFXReferenceField resolution.
 * - `finalize` - called at play-time after resolution to inject runtime callbacks.
 * - `runes` - per-rune VFX overrides for this gesture (see {@link ARROW_VFX_PROPS} / {@link RAY_VFX_PROPS}).
 * - `channel` - optional sustained-channel descriptor consumed by {@link _configureContactVFXEffect} to turn a
 *   contact gesture into a lingering melee channel (Influence). See {@link _buildChannelDelivery}.
 * @type {Record<string, {configure?: SpellVFXGestureConfigurator, resolve?: function,
 *   finalize?: function, runes?: Record<string, object>, channel?: object}>}
 */
const SPELL_VFX_GESTURES = {
  arrow: {configure: _configureArrowVFXEffect, runes: ARROW_VFX_PROPS},
  aspect: {},
  aura: {},
  blast: {configure: _configureBlastVFXEffect, runes: BLAST_VFX_PROPS},
  cone: {},
  conjure: {},
  create: {},
  fan: {configure: _configureFanVFXEffect, runes: FAN_VFX_PROPS},
  influence: {configure: _configureContactVFXEffect, runes: TOUCH_VFX_PROPS, channel: {
    chargeDuration: 550, deliveryDuration: 1800, lingerDuration: 900, coatRadiusFactor: 1.1, burstSize: 3.5,
    glow: {frost: 0x8FE3FF, flame: 0xFF7A2A, life: 0xFF5DC0, poison: 0x8BD43A, death: 0x3FD9A0}
  }},
  pulse: {},
  ray: {configure: _configureRayVFXEffect, runes: RAY_VFX_PROPS},
  sense: {},
  step: {},
  strike: {},
  surge: {},
  touch: {configure: _configureContactVFXEffect, runes: TOUCH_VFX_PROPS},
  ward: {}
};
