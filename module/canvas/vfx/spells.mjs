import {getRandomSprite, getVFXTexturePaths, getVFXTexturePath, getVFXFrames} from "./sprites.mjs";
import {getParticleScaleFactor} from "./blocks.mjs";
import {computeAttackOffset, pickRandom, tokenCenter} from "./helpers.mjs";
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
 * Push per-target scrolling-text entries onto a component's `scrollingText` array. Composes the
 * target's text events from its event slice and stages each at impact time, staggered 200ms apart
 * to avoid overlap when a single hit produces multiple text rows (resource + status).
 * @param {object[]} scrollingText      The component's scrollingText array (mutated).
 * @param {CrucibleSpellAction} action
 * @param {CrucibleActor} targetActor
 * @param {object[]} targetEvents       The target's slice of the action event stream.
 * @param {string} meshRef              Reference key of the target's mesh in the VFX references map.
 * @param {number} impactStart          Component-timeline ms at which this target is struck.
 */
function _pushTargetScrollingText(scrollingText, action, targetActor, targetEvents, meshRef, impactStart) {
  const events = action.constructor.composeTextEvents(targetActor, targetEvents,
    {reverse: false, isNegated: false, selfActor: action.actor});
  events.forEach((evt, i) => scrollingText.push({
    target: {reference: meshRef},
    text: evt.text,
    time: impactStart + (i * 200),
    fontSize: evt.fontSize ?? 32,
    fillColor: evt.fillColor ?? "#ffffff"
  }));
}

/* -------------------------------------------- */

/**
 * Push the caster's selfEvents (activation cost, heroism, etc.) onto a component's scrollingText
 * array. Skipped when the caster is also a target, since {@link _pushTargetScrollingText} already
 * surfaces those events from the target loop.
 * @param {object[]} scrollingText      The component's scrollingText array (mutated).
 * @param {CrucibleSpellAction} action
 * @param {string} meshRef              Reference key of the caster's mesh.
 * @param {number} [time=0]             Component-timeline ms at which the caster text fires.
 */
function _pushCasterScrollingText(scrollingText, action, meshRef, time=0) {
  if ( action.eventsByTarget.has(action.actor) ) return;
  const selfEvents = action.selfEvents?.all ?? [];
  if ( !selfEvents.length ) return;
  const events = action.constructor.composeTextEvents(action.actor, selfEvents,
    {reverse: false, isNegated: false, selfActor: action.actor});
  events.forEach((evt, i) => scrollingText.push({
    target: {reference: meshRef},
    text: evt.text,
    time: time + (i * 200),
    fontSize: evt.fontSize ?? 32,
    fillColor: evt.fillColor ?? "#ffffff"
  }));
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
  const forcedMovements = [];
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

  // Resolve sound choices and configure their playback
  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1, loop: d.loop ?? false} : null;
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
      if ( runeProps.impactSprite !== false ) {
        const burstTexture = pickRandom(textures.impact) ?? getRandomSprite("impacts", "blood");
        animations.push({function: "impactSpriteBurst",
          params: {texture: burstTexture, size: 3, duration: stickDuration || 1000}});
      }
      if ( (runeProps.recoil !== false) && !knockback ) {
        animations.push(roll?.isCriticalSuccess
          ? {function: "impactSpriteShake", params: {distance: Math.round(gridSize * 0.3), oscillations: 3, duration: 480}}
          : {function: "impactSpriteRecoil", params: {distance: Math.round(gridSize * 0.15), duration: 320}});
      }
      if ( runeProps.impactParticles ) {
        particles.push(..._buildImpactParticles(action, runeProps.impactParticles,
          {anchor: "destination", elevation: (token.elevation ?? 0) + 1, textures}));
      }
      if ( runeProps.impactGlow ) {
        animations.push({function: "impactSpriteGlow", params: runeProps.impactGlow});
      }
    }
    else {
      impactSound = sound(getVFXSound(action.rune.id, "miss"));
      if ( (result === T.RESIST) && (runeProps.impactSprite !== false) ) {
        animations.push({function: "impactSpriteBurst",
          params: {texture: pickRandom(textures.air), size: 4, duration: 1500, flash: false}});
      }
    }

    const chargeParticles = _resolveChargeLayers(runeProps,
      {runeId: action.rune.id, textures, casterRadiusPx, casterElevation, particleElevation},
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
    _pushTargetScrollingText(arrowScrollingText, action, actor, group.all, targetMeshRef,
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
  if ( components.arrow_1 ) _pushCasterScrollingText(components.arrow_1.scrollingText, action, "tokenMesh");
  CrucibleForcedMovementComponent.applyForcedMovements(components, timeline, forcedMovements);
  return {components, timeline, references};
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
  const gridSize = canvas.dimensions.size;
  const casterToken = action.token;
  const casterElevation = casterToken.elevation ?? 0;
  const casterRadiusPx = (casterToken.width * gridSize) / 2;
  const chargeDuration = runeProps.chargeDuration ?? 0;
  const sweepDuration = runeProps.sweepDuration ?? 400;
  const oscillate = !!runeProps.oscillate;
  const deliveryDuration = oscillate ? (sweepDuration * 2) : sweepDuration;
  const MASK_RADIUS_FACTOR = 1.5;

  const {startAngleRad, endAngleRad} = CrucibleFanComponent.pickSweepDirection(action, origin, rotRad,
    halfAngleRad);
  const sweepRangeRad = endAngleRad - startAngleRad;

  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1, loop: d.loop ?? false} : null;

  const references = {
    tokenMesh: "^token.object.mesh",
    wallMask: {x, y, type: "move", radius: Math.round(radius * MASK_RADIUS_FACTOR)}
  };

  let chargeParticles = [];
  if ( chargeDuration > 0 ) {
    const chargeCtx = {action, textures, casterRadiusPx, casterElevation, particleElevation};
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
    const tokenRef = `fanTarget_${j}_token`;
    const meshRef = `fanTarget_${j}_tokenMesh`;
    if ( isHit ) {
      const treatment = _resolveHitTreatment(action, {textures, elevation: particleElevation}, runeProps);
      references[tokenRef] = `@${token.uuid}`;
      references[meshRef] = `^${tokenRef}.object.mesh`;
      targetMeshRefs.push({reference: meshRef});

      // A force-moved target plays its knockback glide AS the impact animation, replacing the recoil/shake
      const knockback = CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, start);
      impacts.push({result, id: token.id, start,
        sound: sound(getVFXSound(action.rune.id, impactType)),
        animations: knockback ? [] : treatment.animations, particles: treatment.particles});
      _pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
      j++;
    }
    else if ( result === T.RESIST ) {
      references[tokenRef] = `@${token.uuid}`;
      references[meshRef] = `^${tokenRef}.object.mesh`;
      targetMeshRefs.push({reference: meshRef});
      impacts.push({result, id: token.id, start,
        sound: sound(getVFXSound(action.rune.id, "miss")),
        animations: textures.air.length
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}]
          : [], particles: []});
      _pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
      j++;
    }
  }

  _pushCasterScrollingText(scrollingText, action, "tokenMesh");

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
  CrucibleForcedMovementComponent.applyForcedMovements(components, timeline, forcedMovements);
  return {components, timeline, references};
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
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const impacts = [];
  const targetMeshRefs = [];
  const scrollingText = [];
  const forcedMovements = [];
  const timingFn = RAY_IMPACT_TIMINGS[runeProps.impactTiming] ?? RAY_IMPACT_TIMINGS.beamFront;
  const impactType = runeProps.impactSound ?? "impact";
  const hitTreatment = _resolveHitTreatment(action, {textures, elevation: beamElevation}, runeProps);
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
    const knockback = isHit && CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, start);
    impacts.push(isHit
      ? {result, id: token.id, start, sound: sound(getVFXSound(action.rune.id, impactType)),
        animations: knockback ? [] : hitTreatment.animations, particles: hitTreatment.particles}
      : {
        // Resisting target: a softer, flashless dissipating puff and a distinct sound
        result, id: token.id, start, sound: sound(getVFXSound(action.rune.id, "miss")),
        animations: textures.air.length
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}]
          : [],
        particles: []
      });
    _pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  _pushCasterScrollingText(scrollingText, action, "tokenMesh");

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
  CrucibleForcedMovementComponent.applyForcedMovements(components, timeline, forcedMovements);
  return {components, timeline, references};
}

/* -------------------------------------------- */

/**
 * Configure the VFX for a Touch gesture composed spell as a single {@link CrucibleTouchComponent}: a small
 * charge gathered at the caster's hand, then an impact on the single adjacent target. Touch has
 * `target.type: "single"` and no region shape, so the geometry is the caster and target token centers.
 * Per-rune visuals come from {@link TOUCH_VFX_PROPS}.
 * @param {CrucibleSpellAction} action
 * @returns {SpellVFXData|null}
 */
function configureTouchVFXEffect(action) {
  if ( action.target.type !== "single" ) return null;
  const runeProps = SPELL_VFX_GESTURES.touch.runes?.[action.rune.id];
  if ( !runeProps ) return null;
  const {textures, particleElevation} = resolveSpellVFXContext(action);

  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const gridSize = canvas.dimensions.size;
  const casterToken = action.token;
  const casterElevation = casterToken.elevation ?? 0;
  const casterRadiusPx = (casterToken.width * gridSize) / 2;
  const chargeDuration = runeProps.chargeDuration ?? 450;
  const deliveryDuration = runeProps.deliveryDuration ?? 100;
  const impactStart = chargeDuration + deliveryDuration;

  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1, loop: d.loop ?? false} : null;

  // Charge gathers at the caster's palm (halfway out toward the target) so the origin reads as the caster
  const references = {tokenMesh: "^token.object.mesh"};
  const chargeCtx = {runeId: action.rune.id, textures, casterRadiusPx, casterElevation, particleElevation};
  const chargeParticles = _resolveChargeLayers(runeProps, chargeCtx, {anchor: "palm", duration: chargeDuration});

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
    if ( !result ) continue;
    const isHit = (result === T.HIT) || (result === T.GLANCE);
    const tokenRef = `touchTarget_${j}_token`;
    const meshRef = `touchTarget_${j}_tokenMesh`;
    references[tokenRef] = `@${token.uuid}`;
    references[meshRef] = `^${tokenRef}.object.mesh`;
    targetMeshRefs.push({reference: meshRef});

    if ( isHit ) {
      const treatment = _resolveHitTreatment(action, {textures, elevation: (token.elevation ?? 0) + 1}, runeProps);
      // A force-moved target plays its knockback glide AS the impact animation, replacing the recoil/shake
      const knockback = CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, impactStart);
      impacts.push({result, id: token.id, start: impactStart,
        sound: sound(getVFXSound(action.rune.id, "impact")),
        animations: knockback ? [] : treatment.animations, particles: treatment.particles});
    }
    else {
      // Resisting target: a softer flashless puff and a distinct miss sound
      impacts.push({result, id: token.id, start: impactStart,
        sound: sound(getVFXSound(action.rune.id, "miss")),
        animations: ((result === T.RESIST) && textures.air.length)
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}]
          : [], particles: []});
    }
    _pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, impactStart);
    j++;
  }

  if ( !impacts.length ) return null;
  _pushCasterScrollingText(scrollingText, action, "tokenMesh");

  const chargeSound = (runeProps.chargeSound !== false) ? sound(getVFXSound(action.rune.id, "charge")) : null;
  const components = {
    touch: {
      type: "crucibleTouch",
      casterRadiusPx,
      originMesh: {reference: "tokenMesh"},
      targetMeshes: targetMeshRefs,
      charge: {duration: chargeDuration, sound: chargeSound, animations: [], particles: chargeParticles},
      delivery: {duration: deliveryDuration, animations: [], particles: []},
      impacts,
      scrollingText
    }
  };
  const timeline = [{component: "touch", position: 0}];
  CrucibleForcedMovementComponent.applyForcedMovements(components, timeline, forcedMovements);
  return {components, timeline, references};
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
  const casterToken = action.token;
  const gridSize = canvas.dimensions.size;
  const casterRadiusPx = (casterToken.width * gridSize) / 2;
  const casterElevation = casterToken.elevation ?? 0;
  const particleElevation = (action.region?.elevation?.top ?? casterElevation) + 1;
  const CHARGE_DURATION = runeProps.chargeDuration ?? 0;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const distancePixels = canvas.dimensions.distancePixels;

  const START = foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START;
  const sound = d => d ? {src: d.src, align: START, radius: 30, volume: 1, loop: d.loop ?? false} : null;

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
    const {x: casterCx, y: casterCy} = tokenCenter(casterToken);
    const dirDist = Math.max(1, Math.hypot(origin.x - casterCx, origin.y - casterCy));
    const manifestX = casterCx + (((origin.x - casterCx) / dirDist) * casterRadiusPx);
    const manifestY = casterCy + (((origin.y - casterCy) / dirDist) * casterRadiusPx);
    const casterMeshSort = casterToken.object?.mesh?.sort ?? 0;
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

    const projectileChargeCtx = {runeId: action.rune.id, textures, casterRadiusPx,
      casterElevation, particleElevation};
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
    const chargeCtx = {runeId: action.rune.id, textures, casterRadiusPx, casterElevation, particleElevation};
    blastChargeParticles = runeProps.buildCharge?.(chargeCtx)
      ?? _resolveChargeLayers(runeProps, chargeCtx, {duration: CHARGE_DURATION});
    if ( runeProps.chargeSound !== false ) {
      blastChargeSound = sound(getVFXSound(action.rune.id, "charge"));
    }
  }

  const timingFn = BLAST_IMPACT_TIMINGS[runeProps.impactTiming] ?? BLAST_IMPACT_TIMINGS.fromCenter;
  const timingCtx = {origin, radius, deliveryStart: blastChargeDuration,
    deliveryDuration: runeProps.deliveryDuration};
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const impactType = runeProps.impactSound ?? "impact";
  const hitTreatment = _resolveHitTreatment(action, {textures, elevation: particleElevation}, runeProps);
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
    const tokenRef = `blastTarget_${j}_token`;
    const meshRef = `blastTarget_${j}_tokenMesh`;
    references[tokenRef] = `@${token.uuid}`;
    references[meshRef] = `^${tokenRef}.object.mesh`;
    targetMeshRefs.push({reference: meshRef});
    const start = timingFn(tokenCenter(token), timingCtx);
    const knockback = isHit && CrucibleForcedMovementComponent.pushKnockback(forcedMovements, group, tokenRef, start);
    impacts.push(isHit
      ? {result, id: token.id, start, sound: sound(getVFXSound(action.rune.id, impactType)),
        animations: knockback ? [] : hitTreatment.animations, particles: hitTreatment.particles}
      : {result, id: token.id, start, sound: sound(getVFXSound(action.rune.id, "miss")),
        animations: textures.air.length
          ? [{function: "impactSpriteBurst",
            params: {texture: pickRandom(textures.air), size: 3, duration: 1200, flash: false}}]
          : [],
        particles: []});
    _pushTargetScrollingText(scrollingText, action, actor, group.all, meshRef, start);
    j++;
  }

  _pushCasterScrollingText(scrollingText,
    action, projectileComponent ? "fireballManifest" : "tokenMesh");

  const buildCtx = {action, textures, origin, radius, particleElevation, casterElevation,
    casterRadiusPx, sound};
  const deliveryParticles = runeProps.buildDelivery(buildCtx);
  const sustainedLayers = (runeProps.sustainedChargeAnchor && !projectileComponent)
    ? _resolveChargeLayers(runeProps,
      {runeId: action.rune.id, textures, casterRadiusPx, casterElevation, particleElevation},
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
  CrucibleForcedMovementComponent.applyForcedMovements(components, timeline, forcedMovements);
  return {components, timeline, references};
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
 * @param {string} [opts.anchor]  Layer anchor override (defaults to runeProps.chargeAnchor ?? "origin").
 * @param {number} opts.duration  Emission duration (ms) for each layer.
 * @returns {object[]}
 */
function _resolveChargeLayers(runeProps, ctx, {anchor, duration}) {
  const {runeId, textures, casterRadiusPx, casterElevation, particleElevation = casterElevation} = ctx;
  const behavior = runeProps.chargeBehavior ?? "circleParticleGather";
  const a = anchor ?? runeProps.chargeAnchor ?? "origin";
  const elevationFor = above => above ? (casterElevation + 1)
    : (((a === "source") || (a === "forward")) ? casterElevation : particleElevation);
  if ( runeProps.chargeLayers ) {
    return runeProps.chargeLayers.map(layer => {
      const layerTextures = layer.frames ? getVFXFrames(runeId, ...layer.frames)
        : layer.categories.flatMap(c => textures[c]);
      const rad = casterRadiusPx * (layer.radiusFactor ?? 2.0);
      return {
        animation: layer.animation ?? behavior,
        anchor: a, textures: layerTextures,
        offset: layer.offset ?? 0,
        duration: layer.duration ?? duration,
        params: {chargeRadius: rad, radius: rad, elevation: elevationFor(layer.above), ...layer.params}
      };
    });
  }
  return [{
    animation: behavior, anchor: a, textures: textures.spray, duration,
    params: {chargeRadius: casterRadiusPx * 2.0, lifetime: 350, spawnRate: 480,
      elevation: elevationFor(runeProps.chargeAbove), ...runeProps.sprayParams}
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
 * Resolve the per-target hit treatment for ray and fan impacts from the runeProps declarative toggles
 * (`impactSprite`, `recoil`, default true), the burst size (`impactSpriteSize`, default 2 feet), and the
 * opt-in fields (`impactParticles`, `impactGlow`). Computed once and reused across all hit targets. A rune
 * that wants a "soft" restorative arrival just disables the burst and recoil and supplies its own particle spec.
 * @param {CrucibleSpellAction} action
 * @param {object} ctx
 * @param {SpellVFXTextures} ctx.textures
 * @param {number} ctx.elevation
 * @param {object} runeProps
 * @returns {{animations: object[], particles: object[]}}
 */
function _resolveHitTreatment(action, ctx, runeProps) {
  const {textures, elevation} = ctx;
  const gridSize = canvas.dimensions.size;
  const animations = [];
  const particles = [];
  if ( runeProps?.recoil !== false ) {
    animations.push({function: "impactSpriteRecoil",
      params: {distance: Math.round(gridSize * 0.12), duration: 320}});
  }
  if ( runeProps?.impactSprite !== false ) {
    animations.push({function: "impactSpriteBurst",
      params: {texture: pickRandom(textures.impact), size: runeProps?.impactSpriteSize ?? 2,
        duration: 800, flash: true}});
  }
  if ( runeProps?.impactParticles ) {
    particles.push(..._buildImpactParticles(action, runeProps.impactParticles,
      {anchor: "destination", elevation, textures}));
  }
  if ( runeProps?.impactGlow ) {
    animations.push({function: "impactSpriteGlow", params: runeProps.impactGlow});
  }
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
  const chargeCtx = {runeId: action.rune.id, textures: ctx.textures, casterRadiusPx: ctx.casterRadiusPx,
    casterElevation: ctx.casterElevation, particleElevation: ctx.beamElevation};
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

// Reusable impact treatment for Life spells: soft restorative arrival (no recoil/burst) + glow +
// leaf/bubble spray + GroundBlooms growing at the target's feet.
const _IMPACT_LIFE = {
  impactSprite: false, recoil: false,
  impactGlow: {
    glowColor: 0xff5dc0, outerStrength: 6, innerStrength: 2, distance: 20, quality: 0.5, padding: 16,
    knockout: false, alpha: 1.0, duration: 1500, fadeIn: 100, fadeOut: 1100
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
      const {action, width, casterElevation, beamSpeed} = ctx;
      const runeId = action.rune.id;
      const DELIVERY_DURATION = this.deliveryDuration;
      const LINGER = 5000;
      const rootLifetime = {min: DELIVERY_DURATION + LINGER, max: DELIVERY_DURATION + LINGER + 1500};
      return [
        { // StreakRoots laid along the beam axis with subtle rotation jitter (~+/-10 deg)
          animation: "rayParticleGroundCascade", anchor: "origin",
          textures: getVFXFrames(runeId, "StreakRoots"),
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
      const {action, particleElevation} = ctx;
      return [
        { // SprayFlame gather condensing at the muzzle just before the jet erupts
          animation: "circleParticleGather", anchor: "forward",
          textures: getVFXFrames(action.rune.id, "SprayFlame"),
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
      const {action, casterRadiusPx, casterElevation} = ctx;
      return [{
        animation: "circleParticleVortex", anchor: "source",
        textures: getVFXFrames(action.rune.id, "SprayBubble", "SprayLeaf"),
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
          params: {count: 6, initial: 1, spawnRate: 0,
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
 * Per-rune VFX overrides for the Touch gesture. Touch uses a small single-layer charge gathered at the
 * caster's hand (the `forward` anchor) plus the shared per-rune impact treatment. The charge field shape
 * is documented on {@link ARROW_VFX_PROPS}; the impact field shape on {@link _resolveHitTreatment}.
 * @type {Record<string, object>}
 */
const TOUCH_VFX_PROPS = {

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
 * @type {Record<string, {configure?: SpellVFXGestureConfigurator, resolve?: function,
 *   finalize?: function, runes?: Record<string, object>}>}
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
  influence: {},
  pulse: {},
  ray: {configure: configureRayVFXEffect, runes: RAY_VFX_PROPS},
  sense: {},
  step: {},
  strike: {},
  surge: {},
  touch: {configure: configureTouchVFXEffect, runes: TOUCH_VFX_PROPS},
  ward: {}
};
