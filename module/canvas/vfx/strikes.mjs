import {getRandomSound, getVFXSound} from "./sounds.mjs";
import {getRandomSprite, getVFXTexturePath} from "./sprites.mjs";
import {computeAttackOffset, computeManifestPoint, exposureInHot, pickRandom, positionalSound,
  pushActorScrollingText, pushTargetScrollingText, resolveActorGeometry, tokenCenter} from "./helpers.mjs";
import {buildProjectileTrail, getRuneImpact, resolveHitTreatment, resolveMissTreatment,
  resolveRuneTextures} from "./spells.mjs";
import CrucibleProjectileComponent from "./components/vfx-projectile-component.mjs";

/**
 * @import {ProjectileDeliveryData, ProjectilePathType} from "./components/vfx-projectile-component.mjs";
 * @import {ProjectileTrailConfig, RuneImpactData} from "./spells.mjs";
 * @import {RuneSoundCue} from "./sounds.mjs";
 */

/**
 * The fields of a magical projectile preset which are specific to strikes.
 * @typedef _ProjectileDamagePreset
 * @property {string} rune                      The rune whose art, sounds, and impact treatment style the projectile
 * @property {string} [frame]                   A specific projectile frame; otherwise a random rune projectile texture
 * @property {number} [manifest=150]            Milliseconds over which the projectile manifests before release
 * @property {"release"} [reveal]               Reveal the projectile at release instead of fading it in
 * @property {ProjectilePathType} [path]        The flight path; linear by default
 * @property {number} [stick=0]                 Milliseconds a landed projectile lingers in the target on a hit
 * @property {RuneSoundCue} [flightSound]       A rune sound played in flight; a generic whoosh by default
 * @property {number} [burstSize]               Impact burst size in feet, otherwise the rune impact's own size
 * @property {Partial<RuneImpactData>} [impact] Overrides merged over the rune's impact treatment
 * @property {ProjectileTrailConfig} [trail]    A flight trail
 */

/**
 * A magical projectile preset for a ranged strike which deals a certain damage type.
 * @typedef {_ProjectileDamagePreset
 *   & Partial<Pick<ProjectileDeliveryData, "size"|"speed"|"fps"|"textureAnchor"|"blend">>} ProjectileDamagePreset
 */

/**
 * Preset configurations for single projectile strikes of various damage types.
 * @type {Record<string, ProjectileDamagePreset>}
 */
const PROJECTILE_DAMAGE_PRESETS = {
  cold: {rune: "frost", size: 2, speed: 150, trail: true},
  corruption: {
    rune: "death", frame: "death/ProjectileBoneArrow", size: 3, stick: 1200, burstSize: 3, trail: true,
    path: {type: "weave", params: {arcCount: 2, amplitude: 0.1}}
  },
  electricity: {
    rune: "storm", frame: "storm/ProjectileBolt", size: 8, speed: 40, fps: 8, reveal: "release",
    textureAnchor: true, blend: PIXI.BLEND_MODES.ADD, burstSize: 3,
    impact: {impactSpriteFrame: "storm/ImpactBoltsSmall"},
    flightSound: {rune: "storm", type: "crackle", fade: 60, release: 150, volume: 0.45},
    trail: {frames: ["SprayBolts"], params: {align: false, body: true, speed: {min: 10, max: 40},
      lifetime: {min: 90, max: 200}, spawnRate: 160, scale: {min: 0.4, max: 0.8},
      alpha: {min: 0.7, max: 1.0}, blend: PIXI.BLEND_MODES.NORMAL, exposure: exposureInHot(0.7)}}
  },
  fire: {rune: "flame", size: 2, speed: 150, trail: true},
  poison: {
    rune: "poison", frame: "poison/ProjectileWispy", size: 3, speed: 30,
    flightSound: {rune: "poison", type: "passive", release: 400, fade: 400},
    trail: {frames: ["SprayBubble"], params: {align: false, speed: {min: 2, max: 12},
      lifetime: {min: 800, max: 1400}, spawnRate: 40, scale: {min: 0.4, max: 0.9},
      alpha: {min: 0.4, max: 0.85}, blend: PIXI.BLEND_MODES.NORMAL}}
  }
};

/**
 * Weapon categories whose ranged strikes loose a physical projectile.
 * @type {Set<string>}
 */
const _PHYSICAL_PROJECTILE_CATEGORIES = new Set(["mechanical1", "mechanical2", "projectile1", "projectile2"]);

/**
 * Configure the data for a VFXEffect
 * @param {CrucibleAction} action
 * @param {object|null} vfxConfig       The current VFX configuration from prior hooks, if any.
 * @returns {{components: {}, name, timeline: *[]}|null}
 */
export function configureStrikeVFXEffect(action, vfxConfig) {
  if ( !action.tags.has("strike") ) throw new Error(`The Action ${action.id} does not use the strike tag.`);
  const components = {};
  const timeline = [];
  const references = {tokenMesh: "^token.object.mesh"};

  let j = 1; // Target
  for ( const [actor, group] of action.eventsByTarget ) {
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const targetTokenReference = `target_${j}_token`;
    const targetMeshReference = `target_${j}_tokenMesh`;
    Object.assign(references, {
      [targetTokenReference]: `@${token.uuid}`,
      [targetMeshReference]: `^${targetTokenReference}.object.mesh`
    });

    let i = 1; // Roll
    let text = null;
    for ( const event of group.roll ) {
      const roll = event.roll;
      const weapon = action.usage.strikes[roll.data.strike];
      const projectileName = `projectile_${j}_${i}`;
      const config = {key: projectileName, token, roll, meshRef: targetMeshReference, references};
      if ( action.range.category !== "ranged" ) continue;
      const built = _PHYSICAL_PROJECTILE_CATEGORIES.has(weapon?.category)
        ? _buildPhysicalProjectile(action, config)
        : _buildMagicalProjectile(action, config);
      if ( !built ) continue;
      components[projectileName] = built.component;
      timeline.push({component: projectileName, position: 0});
      text ??= built;
      i++;
    }

    // Schedule scrolling text for the first impact on this target
    if ( text ) {
      pushTargetScrollingText(text.component.scrollingText, action, actor, group.all, targetMeshReference,
        text.impactTime);
    }
    j++;
  }
  if ( !timeline.length ) return null;

  // Caster activation-cost text rides the first projectile at the start of the sequence
  const firstComponent = components[timeline[0].component];
  if ( firstComponent ) pushActorScrollingText(firstComponent.scrollingText, action, "tokenMesh");

  // Validate the constructed effect and return its configuration
  try {
    const effect = new foundry.canvas.vfx.VFXEffect({name: action.id, components, timeline});
    vfxConfig = effect.toObject();
    vfxConfig.references = references;
  } catch(cause) {
    console.error(new Error(`Strike VFX configuration failed for Action "${action.id}"`, {cause}));
  }
  return vfxConfig;
}

/* -------------------------------------------- */

/**
 * Build a magical projectile component which manifests in front of the actor and flies straight to one target.
 * @param {CrucibleAction} action
 * @param {object} config
 * @param {string} config.key                 Unique component key, used to name the manifest reference
 * @param {TokenDocument} config.token        The target token
 * @param {AttackRoll} config.roll            The attack roll against the target
 * @param {string} config.meshRef             Reference key of the target's token mesh
 * @param {Record<string, any>} config.references   The references map, mutated in place
 * @returns {{component: object, impactTime: number}|null}   Null if the damage type has no magical projectile
 */
function _buildMagicalProjectile(action, {key, token, roll, meshRef, references}) {
  const weapon = action.usage.strikes[roll.data.strike];
  const preset = PROJECTILE_DAMAGE_PRESETS[roll.data.damage?.type ?? weapon?.system.damageType];
  if ( !preset ) return null;
  const {rune, size=2, speed=150, manifest=150, reveal, path, fps=null, textureAnchor=false,
    blend=PIXI.BLEND_MODES.NORMAL, stick=0, flightSound, burstSize, impact, trail} = preset;
  const textures = resolveRuneTextures(rune);
  const texture = preset.frame ? getVFXTexturePath(preset.frame) : pickRandom(textures.projectile);
  if ( !texture ) return null;
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const actorGeometry = resolveActorGeometry(action);
  const result = roll.data.result;
  const isHit = (result === T.HIT) || (result === T.GLANCE);
  const revealAtRelease = reveal === "release";

  // The projectile manifests in front of the actor and flies to a result-dependent landing point
  const manifestPoint = computeManifestPoint(actorGeometry, token);
  const manifestRef = `${key}_manifest`;
  references[manifestRef] = {...manifestPoint, elevation: actorGeometry.elevation,
    sort: actorGeometry.meshSort + 1, sortLayer: SL.TOKENS};
  const offset = computeAttackOffset(token, result);
  const targetCenter = tokenCenter(token);
  const {lead} = CrucibleProjectileComponent.computeLaunch(manifestPoint, targetCenter, {texture, size, textureAnchor});
  const distPx = Math.hypot(targetCenter.x - manifestPoint.x, targetCenter.y - manifestPoint.y) - lead;
  const flightMS = (distPx * 1000) / (speed * canvas.dimensions.distancePixels);

  // Flight sound
  let sound;
  if ( flightSound ) {
    const {rune: soundRune, type, ...envelope} = flightSound;
    sound = positionalSound(getVFXSound(soundRune, type));
    if ( sound ) Object.assign(sound, envelope);
  }
  else sound = positionalSound(getVFXSound("generic", "whooshFast"));

  // Impact treatment
  const stickDuration = isHit ? stick : 0;
  const treatment = isHit
    ? resolveHitTreatment(rune, {textures, elevation: (token.elevation ?? 0) + 1, crit: !!roll.isCriticalSuccess,
      burstSize, burstDuration: stickDuration || 1000}, {...getRuneImpact(rune), ...impact})
    : resolveMissTreatment(textures);

  const component = {
    type: "crucibleProjectile",
    originMesh: {reference: "tokenMesh"},
    targetMeshes: [{reference: meshRef}],
    path: [
      {reference: manifestRef, deltas: {}},
      {reference: meshRef, deltas: {x: offset.x, y: offset.y, sort: 1}}
    ],
    pathType: path ?? {type: "linear", params: {}},
    charge: {duration: manifest, animations: revealAtRelease ? [] : [{function: "chargeProjectileFadeIn"}]},
    delivery: {
      texture, size, speed, sound, fps, textureAnchor, blend,
      animations: [...(revealAtRelease ? [{function: "deliveryProjectileReveal"}] : []),
        {function: "deliveryProjectileFlight"}],
      particles: trail ? [buildProjectileTrail(rune, trail, textures, actorGeometry.elevation + 1)] : []
    },
    impacts: [{
      result, id: token.id, stick: stickDuration,
      sound: positionalSound(getVFXSound(rune, isHit ? "impact" : "miss")),
      animations: treatment.animations, particles: treatment.particles
    }],
    scrollingText: []
  };
  return {component, impactTime: manifest + flightMS};
}

/* -------------------------------------------- */

/**
 * Build a physical arrow projectile component which is drawn back, loosed, and flies to one target.
 * @param {CrucibleAction} action
 * @param {object} config
 * @param {TokenDocument} config.token        The target token
 * @param {AttackRoll} config.roll            The attack roll against the target
 * @param {string} config.meshRef             Reference key of the target's token mesh
 * @returns {{component: object, impactTime: number}}
 */
function _buildPhysicalProjectile(action, {token, roll, meshRef}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const PROJECTILE_SPEED = 150; // Feet-per-second
  const CHARGE_DURATION = 1000;
  const STICK_DURATION = 2000; // Milliseconds a landed projectile lingers in the target before fading

  // Flight timing from the caster to the target
  const casterCenter = action.token ? tokenCenter(action.token) : null;
  const targetCenter = tokenCenter(token);
  const distPx = casterCenter ? Math.hypot(targetCenter.x - casterCenter.x, targetCenter.y - casterCenter.y) : 0;
  const flightMS = (distPx * 1000) / (PROJECTILE_SPEED * canvas.dimensions.distancePixels);

  // Impact treatment
  const impact = _buildPhysicalImpact(token, roll, meshRef);
  const isHit = (roll.data.result === T.HIT) || (roll.data.result === T.GLANCE);
  const stick = isHit ? STICK_DURATION : 0;
  const impactAnimations = [];
  if ( impact.texture ) {
    impactAnimations.push({function: "impactSpriteBurst",
      params: {texture: impact.texture, size: 3, duration: stick || 1000}});
  }
  if ( isHit ) impactAnimations.push({function: roll.isCriticalSuccess ? "impactSpriteShake" : "impactSpriteRecoil"});

  const component = {
    type: "crucibleProjectile",
    originMesh: {reference: "tokenMesh"},
    targetMeshes: [{reference: meshRef}],
    path: [{reference: "tokenMesh", deltas: {sort: 1}}, impact.position],
    pathType: {type: "linear", params: {}},
    charge: {
      duration: CHARGE_DURATION,
      animations: [{function: "chargeDrawBack"}],
      sound: {src: getRandomSound("bow", "draw"), align: 2}
    },
    delivery: {
      texture: getRandomSprite("projectiles", "arrow"),
      size: 3,
      speed: PROJECTILE_SPEED,
      animations: [{function: "deliveryProjectileFlight", params: {returnAnchor: true}}]
    },
    impacts: [{
      result: roll.data.result,
      id: token.id,
      stick,
      sound: impact.sound ? {src: impact.sound, align: 1} : null,
      animations: impactAnimations
    }],
    scrollingText: []
  };
  return {component, impactTime: CHARGE_DURATION + flightMS};
}

/* -------------------------------------------- */

/**
 * Build the landing position, sound, and texture of a physical projectile's impact on a target.
 * @param {CrucibleToken} token
 * @param {AttackRoll} roll
 * @param {string} targetMeshReference
 * @returns {{position: {reference: string, deltas: Record<string, number>}, sound: string|null, texture: string|null}}
 */
function _buildPhysicalImpact(token, roll, targetMeshReference) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let sound = null;
  let texture = null;

  // Result-specific sound and impact texture; positional offset is shared via computeAttackOffset
  switch ( roll.data.result ) {
    case T.HIT:
      sound = getRandomSound("projectile", "hitCreature");
      texture = getRandomSprite("impacts", "blood");
      break;
    case T.ARMOR:
    case T.BLOCK:
      sound = getRandomSound("projectile", "block");
      break;
    case T.GLANCE:
      sound = getRandomSound("projectile", "hitObject");
      texture = getRandomSprite("impacts", "blood");
      break;
    case T.PARRY:
      sound = getRandomSound("projectile", "block");
      break;
    case T.DODGE:
    case T.MISS:
      sound = getRandomSound("projectile", "miss");
      break;
  }

  const offset = computeAttackOffset(token, roll.data.result);
  const position = {reference: targetMeshReference, deltas: {sort: 1, x: offset.x, y: offset.y}};
  return {position, sound, texture};
}

/* -------------------------------------------- */

