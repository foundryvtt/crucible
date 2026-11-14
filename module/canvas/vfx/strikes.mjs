import {getRandomSound, getVFXSound} from "./sounds.mjs";
import {getRandomSprite, getVFXFlipbook, getVFXTexturePath} from "./sprites.mjs";
import * as helpers from "./helpers.mjs";
import {buildProjectileTrail, getDamageTypeRune, getRuneImpact, resolveAttackEffect, resolveRuneTextures,
  resolveSpellImpact} from "./spells.mjs";
import CrucibleFacingComponent, {CrucibleFacingPlan} from "./components/vfx-facing-component.mjs";
import CrucibleProjectileComponent from "./components/vfx-projectile-component.mjs";
import {getLinearRange} from "../grid/targeting.mjs";

/**
 * @import {ProjectileDeliveryData, ProjectilePathType} from "./components/vfx-projectile-component.mjs";
 * @import {ProjectileTrailConfig, RuneImpactData} from "./spells.mjs";
 * @import {RuneSoundCue} from "./sounds.mjs";
 * @import {AttackOutcome} from "./helpers.mjs";
 */

/**
 * The fields of a magical projectile preset which are specific to strikes. The projectile is styled by the rune of
 * its damage type, from {@link getDamageTypeRune}.
 * @typedef _ProjectileDamagePreset
 * @property {string} [frame]                   A specific projectile frame; otherwise a random rune projectile texture
 * @property {number} [manifest=150]            Milliseconds over which the projectile manifests before release
 * @property {"release"} [reveal]               Reveal the projectile at release instead of fading it in
 * @property {ProjectilePathType} [path]        The flight path; linear by default
 * @property {number} [stick=0]                 Milliseconds a landed projectile lingers in the target on a hit
 * @property {RuneSoundCue} [flightSound]       A rune sound played in flight; a generic whoosh by default
 * @property {number} [burstSize]               Impact burst size in feet, otherwise the rune impact's own size
 * @property {Partial<RuneImpactData>} [impact] Overrides merged over the rune's effect
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
  cold: {size: 2, speed: 150, trail: true},
  corruption: {
    frame: "death/ProjectileBoneArrow", size: 3, stick: 1200, burstSize: 3, trail: true,
    path: {type: "weave", params: {arcCount: 2, amplitude: 0.1}}
  },
  electricity: {
    frame: "storm/ProjectileBolt", size: 8, speed: 40, fps: 8, reveal: "release",
    textureAnchor: true, blend: PIXI.BLEND_MODES.ADD, burstSize: 3,
    impact: {impactSpriteFrame: "storm/ImpactBoltsSmall"},
    flightSound: {rune: "storm", type: "crackle", fade: 60, release: 150, volume: 0.45},
    trail: {frames: ["SprayBolts"], params: {align: false, body: true, speed: {min: 10, max: 40},
      lifetime: {min: 90, max: 200}, spawnRate: 160, scale: {min: 0.4, max: 0.8},
      alpha: {min: 0.7, max: 1.0}, blend: PIXI.BLEND_MODES.NORMAL, exposure: helpers.exposureInHot(0.7)}}
  },
  fire: {size: 2, speed: 150, trail: true},
  poison: {
    frame: "poison/ProjectileWispy", size: 3, speed: 30,
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
 * The style of a melee attack.
 * @typedef MeleeStrikeOptions
 * @property {string} [damageType="piercing"]   The damage type whose presets apply
 * @property {"small"|"medium"|"large"} [size="medium"]   The weapon size, which selects the strike art
 * @property {ColorSource} [tint]               Strike tint
 * @property {ColorSource|null} [impactTint]    Impact tint, or null to match the strike tint
 * @property {boolean} [windup=false]           Pause the drawn-back strike with a gleam at its tip before release
 * @property {boolean} [punch=false]            Burst streaks through the target on a hit
 * @property {boolean} [lunge=false]            Lean and twist the attacker into the blow
 */

/**
 * One melee strike of an attack.
 * @typedef MeleeStrikeData
 * @property {TokenDocument} token              The attacking token
 * @property {TokenDocument} target             The target token
 * @property {string} meshRef                   Reference key of the target's token mesh
 * @property {number} result                    The attack result in AttackRoll.RESULT_TYPES
 * @property {boolean} [critical=false]         Whether the attack is a critical success
 * @property {"right"|"left"} [hand="right"]    The attacker's side the strike originates from
 * @property {boolean} [mirror=false]           Flip the strike art across the attack line
 * @property {string} [damageType]              Its weapon's damage type, which selects the strike art, overriding the
 *                                              attack style
 * @property {string} [effectType]              The damage type dealt, which selects the effect; its damageType
 *                                              by default
 * @property {"small"|"medium"|"large"} [size]  This strike's weapon size, overriding the attack style
 * @property {AttackOutcome} [outcome]          What this strike did to its target; by default it harmed health
 */

/**
 * One strike of an action: an attack roll against a target.
 * @typedef ActionStrikeData
 * @property {TokenDocument} target             The target token
 * @property {string} meshRef                   Reference key of the target's token mesh
 * @property {CrucibleActionEvent} event        The action event which records the attack roll
 * @property {AttackRoll} roll                  The attack roll against the target
 */

/**
 * Melee strike art by damage type: candidate impacts, punch-through streaks, and the strike per weapon size with its
 * origin offset in caster radii, lateral toward the striking hand.
 * @type {Record<string, {impacts: string[], punch: string[]} &
 *   Record<string, {texture: string, offset: {forward: number, lateral: number}}>>}
 */
const MELEE_STRIKE_PRESETS = {
  piercing: {
    impacts: ["impacts/ImpactSparks", "impacts/ImpactRings"],
    punch: ["piercing/StreakFlare", "piercing/StreakLine"],
    small: {texture: "piercing/StrikeSmall", offset: {forward: -0.25, lateral: 0.8}},
    medium: {texture: "piercing/StrikeMedium", offset: {forward: -0.25, lateral: 0.8}},
    large: {texture: "piercing/StrikeLarge", offset: {forward: -0.5, lateral: 0.8}}
  }
};

/**
 * Shared tuning of every melee strike. Distances are in caster radii and durations in milliseconds.
 * @type {object}
 */
const MELEE_STRIKE_CONFIG = {
  fps: 16,
  impactAt: 0.75,
  charge: 200,
  drawBack: 0.3,
  thrust: 0.5,
  tint: 0xD8E4F0,
  impactTint: 0xD4B2AA,
  impactSize: 4,
  impactDuration: 700,
  windup: {hold: 150, gleamSize: 3, gleamTint: 0xFFF4C0},
  punchCount: 4,
  lunge: {lean: 0.3, twist: 18, recover: 300},
  reactionLead: {parry: 120, block: 100, dodge: 120},
  dodgeRetreat: 0.5,
  blockDustTint: 0xC8BBA8,
  reach: 5 // Feet base-to-base beyond which an action is not animated as melee
};

/**
 * Melee strike art size by weapon category.
 * @type {Record<string, "small"|"medium"|"large">}
 */
const MELEE_STRIKE_SIZES = {light1: "small", simple1: "medium", balanced1: "medium", heavy1: "large",
  simple2: "large", balanced2: "large", heavy2: "large"};

/**
 * Where a melee strike lands on its target by result, as a [min, max] range of offset from the target's center in
 * fractions of its size. Every result but a clean miss lands within the target's visual footprint.
 * @type {Record<string, [number, number]>}
 */
const MELEE_STRIKE_SPREAD = {
  HIT: [0.05, 0.2], GLANCE: [0.15, 0.3], ARMOR: [0.05, 0.25], RESIST: [0.05, 0.25], BLOCK: [0.05, 0.25],
  PARRY: [0.1, 0.3], DODGE: [0.2, 0.35], MISS: [0.35, 0.55]
};

/**
 * How far a melee strike's landing point shifts along the attack line by result, in fractions of the target's size.
 * Negative meets the strike short of the target's center (a parry), positive takes it past center (a block).
 * @type {Record<string, number>}
 */
const MELEE_STRIKE_DEPTH = {PARRY: -0.2, BLOCK: 0.15};

/**
 * Configure the data for a VFXEffect
 * @param {CrucibleAction} action
 * @param {object|null} vfxConfig       The current VFX configuration from prior hooks, if any.
 * @returns {{components: {}, name, timeline: *[]}|null}
 */
export function configureStrikeVFXEffect(action, vfxConfig) {
  if ( !action.tags.has("strike") ) throw new Error(`The Action ${action.id} does not use the strike tag.`);
  const references = {tokenMesh: "^token.object.mesh"};

  // One strike per attack roll, in target order
  const strikes = [];
  const targets = [];
  let j = 1;
  for ( const [actor, group] of action.eventsByTarget ) {
    const token = action.targets.get(actor)?.token;
    if ( !token ) continue;
    const {meshRef} = helpers.registerTargetRefs(references, "target", j, token);
    targets.push({actor, group, meshRef, first: strikes.length, count: group.roll.length});
    for ( const event of group.roll ) strikes.push({target: token, meshRef, event, roll: event.roll});
    j++;
  }

  const built = (action.range.category === "ranged")
    ? _configureRangedVFXEffect(action, strikes, references)
    : _configureMeleeVFXEffect(action, strikes);
  if ( !built ) return null;
  const {components, timeline} = built;

  // Scrolling text for each target at its first impact, and the actor's activation cost at its first strike
  for ( const {actor, group, meshRef, first, count} of targets ) {
    const strike = built.strikes.slice(first, first + count).find(Boolean);
    if ( strike ) {
      helpers.pushTargetScrollingText(components[strike.key].scrollingText, action, actor, group.all, meshRef,
        strike.impactTime);
    }
  }
  const firstStrike = built.strikes.find(Boolean);
  helpers.pushActorScrollingText(components[firstStrike.key].scrollingText, action, "tokenMesh");

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
 * Build the melee strikes of one attack, structured into beats of concurrent strikes which follow one another.
 * The attacker turns to face each beat's target before it; only the first strike of a beat lunges, and concurrent
 * strikes belong against a single target.
 * @param {TokenDocument} token             The attacking token
 * @param {(Omit<MeleeStrikeData, "token">|null)[]} strikes   In strike order, null for a strike to skip
 * @param {MeleeStrikeOptions & {concurrency?: number}} [options]   The attack style, plus the strikes per beat
 * @returns {{components: Record<string, object>, timeline: {component: string, position: number}[],
 *   strikes: ({key: string, impactTime: number}|null)[]}|null}   Each strike's component and its component-relative
 *   impact time, null for a strike skipped or without a preset for its damage type and size; null if none were built
 */
export function buildMeleeStrikes(token, strikes, {concurrency=1, ...options}={}) {
  const beatSize = Math.max(concurrency, 1);
  const components = {};
  const timeline = [];
  const results = [];
  const facing = new CrucibleFacingPlan(token);
  let start = 0;
  for ( const [i, strike] of strikes.entries() ) {
    const leader = (timeline.length % beatSize) === 0;
    const built = strike ? _buildMeleeStrike({...strike, token}, {...options, lunge: !!options.lunge && leader}) : null;
    if ( !built ) {
      results.push(null);
      continue;
    }

    // Each beat turns to its target once the prior beat has settled, and its strikes begin together after the turn
    if ( leader ) start = facing.turnToward(helpers.tokenCenter(strike.target));
    facing.deliver(start, {release: built.settledTime, end: built.deliveryEnd});
    const key = `strike_${i + 1}`;
    components[key] = built.component;
    timeline.push({component: key, position: start});
    results.push({key, impactTime: built.impactTime});
  }
  if ( !timeline.length ) return null;
  facing.apply(components, timeline);
  return {components, timeline, strikes: results};
}

/* -------------------------------------------- */

/**
 * Configure the VFX for the melee strikes of an action, skipping strikes whose animation is not yet supported.
 * @param {CrucibleAction} action
 * @param {ActionStrikeData[]} strikes          In strike order
 * @returns {{components: Record<string, object>, timeline: {component: string, position: number}[],
 *   strikes: ({key: string, impactTime: number}|null)[]}|null}   Null if no strike could be animated
 */
function _configureMeleeVFXEffect(action, strikes) {
  const token = action.token;
  const offhand = action.actor?.equipment.weapons.offhand;

  // TODO early outs, relaxed as melee art and style logic mature: single-target actions only
  if ( !token || (action.target.type !== "single") ) return null;

  // Each strike animates its own weapon against its own target; damage types without a preset are skipped as built
  const data = strikes.map(({target, meshRef, event, roll}) => {
    const weapon = action.usage.strikes[roll.data.strike];

    // TODO per-strike early outs: natural weapons and targets beyond melee reach
    if ( !weapon || weapon.system.properties.has("natural") ) return null;
    if ( getLinearRange(token, target) > MELEE_STRIKE_CONFIG.reach ) return null;
    return {target, meshRef, result: roll.data.result, critical: !!roll.isCriticalSuccess,
      hand: (weapon === offhand) ? "left" : "right", damageType: weapon.system.damageType,
      effectType: _getStrikeDamageType(roll, weapon), size: MELEE_STRIKE_SIZES[weapon.system.category] ?? "medium",
      outcome: helpers.getAttackOutcome(event)};
  });
  return buildMeleeStrikes(token, data, {windup: true, punch: true, lunge: true});
}

/* -------------------------------------------- */

/**
 * Configure the VFX for the projectiles of a ranged action.
 * Single-target attacks turn to each target and fire in sequence, the next turn beginning as the prior projectile is
 * released; area attacks turn once toward the area and fire together.
 * @param {CrucibleAction} action
 * @param {ActionStrikeData[]} strikes          In strike order
 * @param {Record<string, any>} references      The references map, mutated in place
 * @returns {{components: Record<string, object>, timeline: {component: string, position: number}[],
 *   strikes: ({key: string, impactTime: number}|null)[]}|null}   Each strike's component and its component-relative
 *   impact time, null where none could be built; null if no strike could be built
 */
function _configureRangedVFXEffect(action, strikes, references) {
  const token = action.token;
  const sequenced = action.target.type === "single";
  const facing = new CrucibleFacingPlan(token);
  const areaAim = (!sequenced && token) ? CrucibleFacingComponent.getAreaAim(token, action.region) : null;
  const areaStart = areaAim ? facing.turnToward(areaAim) : 0;
  const components = {};
  const timeline = [];
  const results = [];
  for ( const [i, {target, meshRef, event, roll}] of strikes.entries() ) {
    const key = `strike_${i + 1}`;
    const weapon = action.usage.strikes[roll.data.strike];
    const config = {key, token: target, event, roll, meshRef, references};
    const built = _PHYSICAL_PROJECTILE_CATEGORIES.has(weapon?.system.category)
      ? _buildPhysicalProjectile(action, config)
      : _buildMagicalProjectile(action, config);
    if ( !built ) {
      results.push(null);
      continue;
    }
    const position = sequenced ? facing.turnToward(helpers.tokenCenter(target)) : areaStart;
    facing.deliver(position, {release: built.releaseTime, end: built.impactTime});
    components[key] = built.component;
    timeline.push({component: key, position});
    results.push({key, impactTime: built.impactTime});
  }
  if ( !timeline.length ) return null;
  facing.apply(components, timeline);
  return {components, timeline, strikes: results};
}

/* -------------------------------------------- */

/**
 * Build a melee strike component delivered from beside the attacker to one target.
 * @param {MeleeStrikeData} strike
 * @param {MeleeStrikeOptions} [options]
 * @returns {{component: object, impactTime: number, deliveryEnd: number, settledTime: number}|null}   Null if no
 *   preset matches the damage type and size
 */
function _buildMeleeStrike(strike, {damageType="piercing", size="medium", tint=MELEE_STRIKE_CONFIG.tint,
  impactTint=MELEE_STRIKE_CONFIG.impactTint, windup=false, punch=false, lunge=false}={}) {
  const {token, target, meshRef, result, critical=false, hand="right", mirror=false,
    outcome={contact: true, damage: true, healing: false}} = strike;
  damageType = strike.damageType ?? damageType;
  size = strike.size ?? size;

  // The effect of the damage dealt, beneath the contact particle; a strike which harms health also punches through
  const effect = resolveAttackEffect(outcome, {damageType: strike.effectType ?? damageType, actor: target.actor,
    context: {elevation: (target.elevation ?? 0) + 1}});
  punch &&= outcome.damage;
  const preset = MELEE_STRIKE_PRESETS[damageType];
  const weapon = preset?.[size];
  if ( !weapon ) return null;
  const C = MELEE_STRIKE_CONFIG;
  const texture = getVFXTexturePath(weapon.texture);
  const offset = _computeMeleeStrikeOffset(token, target, result);
  const strikeTint = Number(foundry.utils.Color.from(tint));

  // Draw back, optionally pause with a gleam at the tip, and optionally lunge the attacker into the blow
  const hold = windup ? C.windup.hold : 0;
  const chargeDuration = C.charge + hold;
  const chargeAnimations = [{function: "strikeSpriteDrawBack", params: {distance: C.drawBack, hold}}];
  if ( windup ) {
    chargeAnimations.push({function: "strikeSpriteGleam", params: {texture: getVFXTexturePath("impacts/SpraySpark"),
      hold, size: C.windup.gleamSize, tint: C.windup.gleamTint}});
  }
  if ( lunge ) {
    const {lean, twist, recover} = C.lunge;
    chargeAnimations.push({function: "strikeSpriteLunge", params: {hand, lean, twist, recover}});
  }

  const component = {
    type: "crucibleMeleeStrike",
    originMesh: {reference: "tokenMesh"},
    targetMeshes: [{reference: meshRef}],
    destination: {reference: meshRef, deltas: {sort: 1, x: offset.x, y: offset.y}},
    casterRadiusPx: (token.width * canvas.dimensions.size) / 2,
    charge: {duration: chargeDuration, animations: chargeAnimations},
    delivery: {
      texture, fps: C.fps, impactAt: C.impactAt, tint: strikeTint, mirror,
      offset: {forward: weapon.offset.forward, lateral: weapon.offset.lateral * ((hand === "left") ? -1 : 1)},
      sound: helpers.positionalSound(getVFXSound("generic", "whooshFast")),
      animations: [{function: "strikeSpriteThrust", params: {distance: C.thrust}}]
    },
    impacts: [_buildMeleeImpact(target, result, {critical, preset, strikeTint, punch, effect,
      impactTint: (impactTint === null) ? strikeTint : Number(foundry.utils.Color.from(impactTint))})],
    scrollingText: []
  };

  // A following strike may begin once this one has settled, or shortly after it connects without a lunge
  const deliveryMS = ((getVFXFlipbook(texture)?.length ?? 1) * 1000) / C.fps;
  const impactTime = chargeDuration + (deliveryMS * C.impactAt);
  const deliveryEnd = chargeDuration + deliveryMS;
  const settledTime = lunge ? (deliveryEnd + C.lunge.recover) : (impactTime + 100);
  return {component, impactTime, deliveryEnd, settledTime};
}

/* -------------------------------------------- */

/**
 * Build the result-specific impact of a melee strike on its target.
 * @param {TokenDocument} target
 * @param {number} result                 The attack result in AttackRoll.RESULT_TYPES
 * @param {object} options
 * @param {boolean} options.critical      Whether the attack is a critical success
 * @param {object} options.preset         The damage type's strike presets
 * @param {number} options.strikeTint     Strike tint, carried by punch-through streaks
 * @param {number} options.impactTint     Impact tint
 * @param {boolean} options.punch         Burst streaks through the target, for a strike which harms health
 * @param {{animations: object[], particles: object[]}} options.effect   The effect of the damage dealt
 * @returns {object}                      The impact entry
 */
function _buildMeleeImpact(target, result, {critical, preset, strikeTint, impactTint, punch, effect}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const {START} = foundry.canvas.vfx.constants.SOUND_ALIGNMENT;
  const C = MELEE_STRIKE_CONFIG;
  const burst = (texture, params={}) => ({function: "impactSpriteBurst", params: {texture: getVFXTexturePath(texture),
    size: C.impactSize, duration: C.impactDuration, tint: impactTint, ...params}});
  const sound = (domain, key) => ({src: getRandomSound(domain, key), align: START});
  const impact = {result, id: target.id, sound: null, animations: [], particles: []};

  // Contact particles by result; TODO placeholder arrow sounds until melee thud and hit sounds exist
  switch ( result ) {
    case T.HIT:
    case T.GLANCE:
      impact.sound = sound("projectile", (result === T.HIT) ? "hitCreature" : "hitObject");
      impact.animations.push(burst(helpers.pickRandom(preset.impacts)),
        {function: (critical && (result === T.HIT)) ? "impactSpriteShake" : "impactSpriteRecoil"});
      break;
    case T.ARMOR:
      impact.sound = sound("projectile", "block");
      impact.animations.push(burst(helpers.pickRandom(preset.impacts)),
        {function: "impactSpriteRecoil", params: {distance: 6, duration: 380}});
      break;
    case T.RESIST:
      impact.sound = sound("projectile", "block");
      impact.animations.push(burst(helpers.pickRandom(preset.impacts)));
      break;
    case T.PARRY:
      impact.sound = sound("melee", "parry");
      impact.animations.push(burst("impacts/ImpactGeometric", {size: 3, duration: 450, tint: 0xFFFFFF, fps: 20}),
        burst("impacts/SpraySpark", {size: 5, duration: 600, tint: 0xFFE066, scaleStart: 0.3, scaleSettle: 0.7}),
        {function: "impactSpriteRecoil", params: {distance: -5, duration: 300, lead: C.reactionLead.parry}});
      break;
    case T.BLOCK:
      impact.sound = sound("projectile", "block");
      impact.animations.push(burst("air/AirDust", {size: 3, duration: 800, flash: false, tint: C.blockDustTint,
        scaleStart: 0.6, scaleSettle: 1.2}),
      {function: "impactSpriteRecoil", params: {distance: 6, duration: 380, lead: C.reactionLead.block}});
      break;
    default:
      impact.sound = sound("projectile", "miss");
  }
  helpers.addDodgeSidestep(impact, {lead: C.reactionLead.dodge, retreat: C.dodgeRetreat});

  // The effect beneath the contact particle
  impact.animations.unshift(...effect.animations);
  impact.particles.push(...effect.particles);

  // Streaks burst out of the far side of the target, more on a critical and fewer on a glance
  if ( punch ) {
    const count = Math.round(C.punchCount * (critical ? 2 : 1) * ((result === T.GLANCE) ? 0.5 : 1));
    impact.particles.push({animation: "strikeParticlePunch", anchor: "target",
      textures: preset.punch.map(n => getVFXTexturePath(n)), duration: 50, params: {count, initial: 1, spawnRate: 0,
        lifetime: {min: 160, max: 300}, scale: {min: 0.4, max: 0.8}, alpha: {min: 0.7, max: 1}, tint: strikeTint,
        blend: PIXI.BLEND_MODES.ADD, elevation: (target.elevation ?? 0) + 1}});
  }
  return impact;
}

/* -------------------------------------------- */

/**
 * Compute where a melee strike lands relative to its target's center, by attack result.
 * @param {TokenDocument} token           The attacking token
 * @param {TokenDocument} target
 * @param {number} result                 The attack result in AttackRoll.RESULT_TYPES
 * @returns {{x: number, y: number}}
 */
function _computeMeleeStrikeOffset(token, target, result) {
  const key = Object.entries(crucible.api.dice.AttackRoll.RESULT_TYPES).find(([, v]) => v === result)?.[0];
  const [min, max] = MELEE_STRIKE_SPREAD[key] ?? [0, 0];
  const size = canvas.dimensions.size;
  const w = target.width * size;
  const h = target.height * size;
  const spread = extent => Math.mix(extent * min, extent * max, Math.random()) * ((Math.random() > 0.5) ? 1 : -1);
  const offset = {x: spread(w), y: spread(h)};

  // Shift along the attack line, toward or away from the attacker
  const depth = MELEE_STRIKE_DEPTH[key];
  if ( depth ) {
    const from = helpers.tokenCenter(token);
    const to = helpers.tokenCenter(target);
    const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const shift = depth * Math.max(w, h);
    offset.x += ((to.x - from.x) / dist) * shift;
    offset.y += ((to.y - from.y) / dist) * shift;
  }
  return offset;
}

/* -------------------------------------------- */

/**
 * Build a magical projectile component which manifests in front of the actor and flies straight to one target.
 * @param {CrucibleAction} action
 * @param {object} config
 * @param {string} config.key                 Unique component key, used to name the manifest reference
 * @param {TokenDocument} config.token        The target token
 * @param {CrucibleActionEvent} config.event  The action event which records the attack roll
 * @param {AttackRoll} config.roll            The attack roll against the target
 * @param {string} config.meshRef             Reference key of the target's token mesh
 * @param {Record<string, any>} config.references   The references map, mutated in place
 * @returns {{component: object, releaseTime: number, impactTime: number}|null}   Null if the damage type has no
 *   magical projectile
 */
function _buildMagicalProjectile(action, {key, token, event, roll, meshRef, references}) {
  const weapon = action.usage.strikes[roll.data.strike];
  const damageType = _getStrikeDamageType(roll, weapon);
  const preset = PROJECTILE_DAMAGE_PRESETS[damageType];
  const rune = getDamageTypeRune(damageType);
  if ( !preset || !rune ) return null;
  const {size=2, speed=150, manifest=150, reveal, path, fps=null, textureAnchor=false,
    blend=PIXI.BLEND_MODES.NORMAL, stick=0, flightSound, burstSize, impact, trail} = preset;
  const textures = resolveRuneTextures(rune);
  const texture = preset.frame ? getVFXTexturePath(preset.frame) : helpers.pickRandom(textures.projectile);
  if ( !texture ) return null;
  const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
  const actorGeometry = helpers.resolveActorGeometry(action);
  const result = roll.data.result;
  const revealAtRelease = reveal === "release";

  // The projectile manifests in front of the actor and flies to a result-dependent landing point
  const manifestPoint = helpers.computeManifestPoint(actorGeometry, token);
  const manifestRef = `${key}_manifest`;
  references[manifestRef] = {...manifestPoint, elevation: actorGeometry.elevation,
    sort: actorGeometry.meshSort + 1, sortLayer: SL.TOKENS};
  const offset = helpers.computeAttackOffset(token, result, {sidestep: true});
  const targetCenter = helpers.tokenCenter(token);
  const {lead} = CrucibleProjectileComponent.computeLaunch(manifestPoint, targetCenter, {texture, size, textureAnchor});
  const distPx = Math.hypot(targetCenter.x - manifestPoint.x, targetCenter.y - manifestPoint.y) - lead;
  const flightMS = (distPx * 1000) / (speed * canvas.dimensions.distancePixels);

  // Flight sound
  let sound;
  if ( flightSound ) {
    const {rune: soundRune, type, ...envelope} = flightSound;
    sound = helpers.positionalSound(getVFXSound(soundRune, type));
    if ( sound ) Object.assign(sound, envelope);
  }
  else sound = helpers.positionalSound(getVFXSound("generic", "whooshFast"));

  // Impact treatment, as for a spell of the damage type's rune
  const treatment = resolveSpellImpact(event, {actor: token.actor, palette: rune, textures,
    runeProps: {...getRuneImpact(rune), ...impact}, elevation: (token.elevation ?? 0) + 1,
    context: {burstSize, burstDuration: stick || 1000}});
  const stickDuration = treatment.affected ? stick : 0;

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
      sound: helpers.positionalSound(getVFXSound(rune, treatment.affected ? "impact" : "miss")),
      animations: treatment.animations, particles: treatment.particles
    }],
    scrollingText: []
  };
  helpers.addDodgeSidestep(component.impacts[0]);
  return {component, releaseTime: manifest, impactTime: manifest + flightMS};
}

/* -------------------------------------------- */

/**
 * Build a physical arrow projectile component which is drawn back, loosed, and flies to one target.
 * @param {CrucibleAction} action
 * @param {object} config
 * @param {TokenDocument} config.token        The target token
 * @param {CrucibleActionEvent} config.event  The action event which records the attack roll
 * @param {AttackRoll} config.roll            The attack roll against the target
 * @param {string} config.meshRef             Reference key of the target's token mesh
 * @returns {{component: object, releaseTime: number, impactTime: number}}
 */
function _buildPhysicalProjectile(action, {token, event, roll, meshRef}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const PROJECTILE_SPEED = 150; // Feet-per-second
  const CHARGE_DURATION = 1000;
  const STICK_DURATION = 2000; // Milliseconds a landed projectile lingers in the target before fading

  // Flight timing from the caster to the target
  const casterCenter = action.token ? helpers.tokenCenter(action.token) : null;
  const targetCenter = helpers.tokenCenter(token);
  const distPx = casterCenter ? Math.hypot(targetCenter.x - casterCenter.x, targetCenter.y - casterCenter.y) : 0;
  const flightMS = (distPx * 1000) / (PROJECTILE_SPEED * canvas.dimensions.distancePixels);

  // Impact treatment: the arrow lodges in a target it strikes unhindered, beside the effect of the damage dealt
  const impact = _buildPhysicalImpact(token, roll.data.result, meshRef);
  const outcome = helpers.getAttackOutcome(event);
  const isHit = (roll.data.result === T.HIT) || (roll.data.result === T.GLANCE);
  const stick = isHit ? STICK_DURATION : 0;
  const weapon = action.usage.strikes[roll.data.strike];
  const effect = resolveAttackEffect(outcome, {damageType: _getStrikeDamageType(roll, weapon), actor: token.actor,
    context: {elevation: (token.elevation ?? 0) + 1}});
  const impactAnimations = [...effect.animations,
    ...helpers.buildContactReaction(outcome, roll.data.result, {critical: !!roll.isCriticalSuccess})];

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
      animations: impactAnimations,
      particles: effect.particles
    }],
    scrollingText: []
  };
  helpers.addDodgeSidestep(component.impacts[0]);
  return {component, releaseTime: CHARGE_DURATION, impactTime: CHARGE_DURATION + flightMS};
}

/* -------------------------------------------- */

/**
 * Build the landing position and sound of a physical projectile's impact on a target.
 * @param {CrucibleToken} token
 * @param {number} result                 The attack result in AttackRoll.RESULT_TYPES
 * @param {string} targetMeshReference
 * @returns {{position: {reference: string, deltas: Record<string, number>}, sound: string|null}}
 */
function _buildPhysicalImpact(token, result, targetMeshReference) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let sound = null;

  // Result-specific sound; positional offset is shared via computeAttackOffset
  switch ( result ) {
    case T.HIT:
      sound = getRandomSound("projectile", "hitCreature");
      break;
    case T.ARMOR:
    case T.BLOCK:
      sound = getRandomSound("projectile", "block");
      break;
    case T.GLANCE:
      sound = getRandomSound("projectile", "hitObject");
      break;
    case T.PARRY:
      sound = getRandomSound("projectile", "block");
      break;
    case T.DODGE:
    case T.MISS:
      sound = getRandomSound("projectile", "miss");
      break;
  }

  const offset = helpers.computeAttackOffset(token, result, {sidestep: true});
  const position = {reference: targetMeshReference, deltas: {sort: 1, x: offset.x, y: offset.y}};
  return {position, sound};
}

/* -------------------------------------------- */

/**
 * The damage type of one strike: what its roll dealt, otherwise what its weapon deals.
 * @param {AttackRoll} roll
 * @param {CrucibleItem|null} weapon
 * @returns {string|undefined}
 */
function _getStrikeDamageType(roll, weapon) {
  return roll.data.damage?.type ?? weapon?.system.damageType;
}

/* -------------------------------------------- */

