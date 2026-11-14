import {getRandomSound, getVFXSound} from "./sounds.mjs";
import {getRandomSprite, getVFXFlipbook, getVFXTexturePath} from "./sprites.mjs";
import {addDodgeSidestep, computeAttackOffset, computeManifestPoint, exposureInHot, pickRandom, positionalSound,
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
 * The style of a melee attack.
 * @typedef MeleeStrikeOptions
 * @property {string} [damageType="piercing"]   The damage type whose presets apply
 * @property {"small"|"medium"|"large"} [size="medium"]   The weapon size, which selects the strike art
 * @property {ColorSource} [tint]               Strike tint
 * @property {ColorSource|null} [impactTint]    Impact tint, or null to match the strike tint
 * @property {boolean} [windup=false]           Pause the drawn-back strike with a gleam at its tip before release
 * @property {boolean} [punch=false]            Burst streaks through the target on a hit
 * @property {boolean} [lunge=false]            Turn the attacker to face the target, then lean and twist into the blow
 * @property {boolean} [blood=false]            Splatter blood beneath hits and glances
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
 * @property {number|null} [fromAngle=null]     Radians toward a prior target a lunging attacker turns from
 * @property {boolean} [final=true]             Whether a lunging attacker returns to rest after this strike
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
  lunge: {lean: 0.15, twist: 12, recover: 300, quarterTurn: 220},
  reactionLead: {parry: 120, block: 100, dodge: 180},
  dodgeRetreat: 0.5,
  blockDustTint: 0xC8BBA8,
  bloodSize: 6
};

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
 * Build a melee strike component delivered from beside the attacker to one target.
 * @param {MeleeStrikeData} strike
 * @param {MeleeStrikeOptions} [options]
 * @returns {{component: object, impactTime: number, settledTime: number}|null}   Null if no preset matches the
 *   damage type and size
 */
export function buildMeleeStrike(strike, {damageType="piercing", size="medium", tint=MELEE_STRIKE_CONFIG.tint,
  impactTint=MELEE_STRIKE_CONFIG.impactTint, windup=false, punch=false, lunge=false, blood=false}={}) {
  const {token, target, meshRef, result, critical=false, hand="right", mirror=false, fromAngle=null,
    final=true} = strike;
  const preset = MELEE_STRIKE_PRESETS[damageType];
  const weapon = preset?.[size];
  if ( !weapon ) return null;
  const C = MELEE_STRIKE_CONFIG;
  const texture = getVFXTexturePath(weapon.texture);
  const offset = _computeMeleeStrikeOffset(token, target, result);
  const strikeTint = Number(foundry.utils.Color.from(tint));

  // Draw back, optionally pause with a gleam at the tip, and optionally turn the attacker into the blow
  const hold = windup ? C.windup.hold : 0;
  const chargeDuration = C.charge + hold;
  const chargeAnimations = [{function: "strikeSpriteDrawBack", params: {distance: C.drawBack, hold}}];
  if ( windup ) {
    chargeAnimations.push({function: "strikeSpriteGleam", params: {texture: getVFXTexturePath("impacts/SpraySpark"),
      hold, size: C.windup.gleamSize, tint: C.windup.gleamTint}});
  }
  const turn = lunge ? _computeMeleeTurnDuration(token, target, fromAngle) : 0;
  if ( lunge ) {
    const {lean, twist, recover} = C.lunge;
    chargeAnimations.push({function: "strikeSpriteLunge", params: {hand, lean, twist, recover, fromAngle, final}});
  }

  const component = {
    type: "crucibleMeleeStrike",
    originMesh: {reference: "tokenMesh"},
    targetMeshes: [{reference: meshRef}],
    destination: {reference: meshRef, deltas: {sort: 1, x: offset.x, y: offset.y}},
    casterRadiusPx: (token.width * canvas.dimensions.size) / 2,
    turn,
    charge: {duration: chargeDuration, animations: chargeAnimations},
    delivery: {
      texture, fps: C.fps, impactAt: C.impactAt, tint: strikeTint, mirror,
      offset: {forward: weapon.offset.forward, lateral: weapon.offset.lateral * ((hand === "left") ? -1 : 1)},
      sound: positionalSound(getVFXSound("generic", "whooshFast")),
      animations: [{function: "strikeSpriteThrust", params: {distance: C.thrust}}]
    },
    impacts: [_buildMeleeImpact(target, result, {critical, preset, strikeTint, punch, blood,
      impactTint: (impactTint === null) ? strikeTint : Number(foundry.utils.Color.from(impactTint))})],
    scrollingText: []
  };

  // A following strike may begin once this one has settled, or shortly after it connects without a lunge
  const deliveryMS = ((getVFXFlipbook(texture)?.length ?? 1) * 1000) / C.fps;
  const impactTime = turn + chargeDuration + (deliveryMS * C.impactAt);
  const settledTime = lunge ? (turn + chargeDuration + deliveryMS + C.lunge.recover) : (impactTime + 100);
  return {component, impactTime, settledTime};
}

/* -------------------------------------------- */

/**
 * Build the melee strikes of one attack, structured into beats of concurrent strikes which follow one another.
 * Only the first strike of a beat moves a lunging attacker, turning from the prior beat's target; concurrent strikes
 * belong against a single target.
 * @param {TokenDocument} token             The attacking token
 * @param {Omit<MeleeStrikeData, "token"|"fromAngle"|"final">[]} strikes   In strike order
 * @param {MeleeStrikeOptions & {concurrency?: number}} [options]   The attack style, plus the strikes per beat
 * @returns {{components: Record<string, object>, timeline: {component: string, position: number}[],
 *   impactTimes: number[]}|null}   Null if no preset matches the damage type and size
 */
export function buildMeleeStrikes(token, strikes, {concurrency=1, ...options}={}) {
  const beatSize = Math.max(concurrency, 1);
  const lastBeat = Math.floor((strikes.length - 1) / beatSize);
  const from = tokenCenter(token);
  const components = {};
  const timeline = [];
  const impactTimes = [];
  let beatStart = 0;
  let nextBeat = 0;
  let beatTurn = 0;
  let fromAngle = null;
  for ( const [i, strike] of strikes.entries() ) {
    const beat = Math.floor(i / beatSize);
    const leader = (i % beatSize) === 0;
    if ( leader && (i > 0) ) beatStart = nextBeat;
    const built = buildMeleeStrike({...strike, token, fromAngle, final: beat === lastBeat},
      {...options, lunge: !!options.lunge && leader});
    if ( !built ) return null;
    if ( leader ) {
      const to = tokenCenter(strike.target);
      fromAngle = Math.atan2(to.y - from.y, to.x - from.x);
      beatTurn = built.component.turn;
    }

    // Other strikes of the beat wait out the leader's turn, and the next beat waits for all of them to settle
    const start = leader ? beatStart : (beatStart + beatTurn);
    nextBeat = Math.max(leader ? 0 : nextBeat, start + built.settledTime);
    const key = `strike_${i + 1}`;
    components[key] = built.component;
    timeline.push({component: key, position: start});
    impactTimes.push(start + built.impactTime);
  }
  return {components, timeline, impactTimes};
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
 * @param {boolean} options.punch         Burst streaks through the target on a hit
 * @param {boolean} options.blood         Splatter blood beneath a hit
 * @returns {object}                      The impact entry
 */
function _buildMeleeImpact(target, result, {critical, preset, strikeTint, impactTint, punch, blood}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const {START} = foundry.canvas.vfx.constants.SOUND_ALIGNMENT;
  const C = MELEE_STRIKE_CONFIG;
  const burst = (texture, params={}) => ({function: "impactSpriteBurst", params: {texture: getVFXTexturePath(texture),
    size: C.impactSize, duration: C.impactDuration, tint: impactTint, ...params}});
  const sound = (domain, key) => ({src: getRandomSound(domain, key), align: START});
  const impact = {result, id: target.id, sound: null, animations: [], particles: []};

  // TODO placeholder arrow sounds until melee thud and hit sounds exist
  switch ( result ) {
    case T.HIT:
    case T.GLANCE:
      impact.sound = sound("projectile", (result === T.HIT) ? "hitCreature" : "hitObject");
      impact.animations.push(burst(pickRandom(preset.impacts)),
        {function: (critical && (result === T.HIT)) ? "impactSpriteShake" : "impactSpriteRecoil"});
      break;
    case T.ARMOR:
      impact.sound = sound("projectile", "block");
      impact.animations.push(burst(pickRandom(preset.impacts)),
        {function: "impactSpriteRecoil", params: {distance: 6, duration: 380}});
      break;
    case T.RESIST:
      impact.sound = sound("projectile", "block");
      impact.animations.push(burst(pickRandom(preset.impacts)));
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
  addDodgeSidestep(impact, {lead: C.reactionLead.dodge, retreat: C.dodgeRetreat});
  if ( (result !== T.HIT) && (result !== T.GLANCE) ) return impact;

  // TODO standalone red blood images; replace with white atlas blood art, then drop textureAnchor: false
  if ( blood ) {
    impact.animations.unshift({function: "impactSpriteBurst", params: {texture: getRandomSprite("impacts", "blood"),
      size: C.bloodSize, duration: C.impactDuration * 1.5, flash: false, textureAnchor: false}});
  }

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
    const from = tokenCenter(token);
    const to = tokenCenter(target);
    const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const shift = depth * Math.max(w, h);
    offset.x += ((to.x - from.x) / dist) * shift;
    offset.y += ((to.y - from.y) / dist) * shift;
  }
  return offset;
}

/* -------------------------------------------- */

/**
 * Milliseconds an attacker takes to turn from its current or prior facing toward a target, by the angle turned.
 * Token art faces +y at rotation 0.
 * @param {TokenDocument} token             The attacking token
 * @param {TokenDocument} target            The target token
 * @param {number|null} fromAngle           Radians toward a prior target, or null for the token's own rotation
 * @returns {number}
 */
function _computeMeleeTurnDuration(token, target, fromAngle) {
  if ( token.lockRotation ) return 0;
  const from = tokenCenter(token);
  const to = tokenCenter(target);
  const facing = Math.atan2(to.y - from.y, to.x - from.x) - (Math.PI / 2);
  const start = (fromAngle === null) ? Math.toRadians(token.rotation) : (fromAngle - (Math.PI / 2));
  const turned = Math.abs(Math.normalizeRadians(facing - start));
  if ( turned < Math.toRadians(10) ) return 0;
  return Math.round(MELEE_STRIKE_CONFIG.lunge.quarterTurn * Math.min(turned / (Math.PI / 2), 1.5));
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
  const offset = computeAttackOffset(token, result, {sidestep: true});
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
  addDodgeSidestep(component.impacts[0]);
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
  const impact = _buildPhysicalImpact(token, roll.data.result, meshRef);
  const isHit = (roll.data.result === T.HIT) || (roll.data.result === T.GLANCE);
  const stick = isHit ? STICK_DURATION : 0;
  const impactAnimations = [];
  // TODO standalone blood image anchors at its top-left corner, landing past the target; fixed by white atlas blood art
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
  addDodgeSidestep(component.impacts[0]);
  return {component, impactTime: CHARGE_DURATION + flightMS};
}

/* -------------------------------------------- */

/**
 * Build the landing position, sound, and texture of a physical projectile's impact on a target.
 * @param {CrucibleToken} token
 * @param {number} result                 The attack result in AttackRoll.RESULT_TYPES
 * @param {string} targetMeshReference
 * @returns {{position: {reference: string, deltas: Record<string, number>}, sound: string|null, texture: string|null}}
 */
function _buildPhysicalImpact(token, result, targetMeshReference) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let sound = null;
  let texture = null;

  // Result-specific sound and impact texture; positional offset is shared via computeAttackOffset
  // TODO standalone red blood images; replace with white atlas blood art
  switch ( result ) {
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

  const offset = computeAttackOffset(token, result, {sidestep: true});
  const position = {reference: targetMeshReference, deltas: {sort: 1, x: offset.x, y: offset.y}};
  return {position, sound, texture};
}

/* -------------------------------------------- */

