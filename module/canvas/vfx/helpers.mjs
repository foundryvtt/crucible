import {getRandomSprite, getVFXTexturePath} from "./sprites.mjs";

/**
 * Shared utilities used by VFX configurators across spells and strikes.
 */

/**
 * What an attack did to its target, which decides what every attack animation displays there: the delivery's
 * contact particle and reaction where it connected, plus an effect chosen by damage type where it harmed health or
 * restored a resource.
 * @typedef AttackOutcome
 * @property {boolean} contact    The attack connected, even if deflected
 * @property {boolean} damage     The attack harmed health
 * @property {boolean} healing    The attack restored a resource
 */

/**
 * A burst which harming a creature's health with physical damage draws from it, such as blood.
 * @typedef DamageParticle
 * @property {string} [frame]                   An atlas frame
 * @property {[string, string]} [sprite]        A VFX_SPRITES domain and key, of which a random standalone image
 * @property {number} size                      Burst size in feet
 * @property {number} duration                  Burst milliseconds
 * @property {boolean} flash                    Flash the burst in with ADD blending
 * @property {boolean} [textureAnchor]          False to center a standalone image
 */

/**
 * What physical damage to health draws from a creature: blood from a blooded creature, otherwise by creature category.
 * @type {Record<string, DamageParticle>}
 */
const DAMAGE_PARTICLES = {
  // TODO standalone red blood images; replace with white atlas blood art, then drop textureAnchor: false
  blood: {sprite: ["impacts", "blood"], size: 6, duration: 1050, flash: false, textureAnchor: false},
  construct: {frame: "storm/ImpactBoltsSmall", size: 4, duration: 500, flash: true},
  undead: {frame: "death/GroundFissureSmall", size: 3, duration: 1200, flash: false}
};

/* -------------------------------------------- */

/**
 * Build the impact animation which shows the damage particle physical damage draws from an actor, if any.
 * @param {CrucibleActor|null} actor
 * @returns {{function: string, params: object}|null}
 */
export function buildDamageParticle(actor) {
  const biology = actor?.system.details?.[actor.system.constructor.biologyName];
  if ( !biology ) return null;
  const particle = biology.characteristics?.blooded ? DAMAGE_PARTICLES.blood : DAMAGE_PARTICLES[biology.category];
  if ( !particle ) return null;
  const {frame, sprite, ...params} = particle;
  const texture = sprite ? getRandomSprite(...sprite) : getVFXTexturePath(frame);
  return {function: "impactSpriteBurst", params: {texture, ...params}};
}

/* -------------------------------------------- */

/**
 * Determine the outcome of an attack against its target from the action event which records its roll.
 * What the attack intends comes from the event's own vocabulary; it takes effect only where its damage total is
 * positive, so a hit resisted to nothing shows contact alone.
 * @param {CrucibleActionEvent} event
 * @returns {AttackOutcome}
 */
export function getAttackOutcome(event) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const data = event.roll?.data;
  const contact = [T.HIT, T.GLANCE, T.ARMOR, T.RESIST, T.BLOCK, T.PARRY].includes(data?.result);
  const landed = contact && (data.damage?.total > 0);
  return {contact, damage: landed && event.damagesHealth, healing: landed && (event.healsHealth || event.healsMorale)};
}

/* -------------------------------------------- */

/**
 * Build a target's reaction to a ranged or spell attack which connected: a recoil, or a shake on a critical hit.
 * A healing arrival or a knockback glide, which replaces the recoil, draws no reaction.
 * @param {AttackOutcome} outcome
 * @param {number} result                 The attack result in AttackRoll.RESULT_TYPES
 * @param {object} [options]
 * @param {boolean} [options.critical=false]
 * @param {boolean} [options.knockback=false]
 * @returns {object[]}                    Impact animations
 */
export function buildContactReaction(outcome, result, {critical=false, knockback=false}={}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  if ( !outcome.contact || outcome.healing || knockback || ![T.HIT, T.GLANCE].includes(result) ) return [];
  const gridSize = canvas.dimensions.size;
  return [critical
    ? {function: "impactSpriteShake", params: {distance: Math.round(gridSize * 0.3), oscillations: 3, duration: 480}}
    : {function: "impactSpriteRecoil", params: {distance: Math.round(gridSize * 0.15), duration: 320}}];
}

/* -------------------------------------------- */

/**
 * Compute a per-target hit/miss offset relative to the target token center, banded by attack
 * result so projectiles land tighter on HIT and clearly past-the-target on MISS.
 * @param {CrucibleToken} token
 * @param {string} result   AttackRoll.RESULT_TYPES value.
 * @param {object} [options]
 * @param {boolean} [options.sidestep=false]   Land a dodge within the target, which sidesteps it via
 *                                             {@link addDodgeSidestep}, rather than clearly past it.
 * @returns {{x: number, y: number}}
 */
export function computeAttackOffset(token, result, {sidestep=false}={}) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  const w = token.width * canvas.dimensions.size;
  const h = token.height * canvas.dimensions.size;
  let hitRange;
  switch ( result ) {
    case T.HIT: hitRange = [0, 0.1]; break;
    case T.ARMOR:
    case T.BLOCK: hitRange = [0, 0.25]; break;
    case T.GLANCE:
    case T.PARRY: hitRange = [0.25, 0.5]; break;
    case T.DODGE: hitRange = sidestep ? [0.2, 0.35] : [0.5, 1.0]; break;
    case T.MISS: hitRange = [0.5, 1.0]; break;
    default: hitRange = [0, 0]; break;
  }
  const x = Math.mix(w * hitRange[0], w * hitRange[1], Math.random()) * (Math.random() > 0.5 ? 1 : -1);
  const y = Math.mix(h * hitRange[0], h * hitRange[1], Math.random()) * (Math.random() > 0.5 ? 1 : -1);
  return {x, y};
}

/* -------------------------------------------- */

/**
 * Make a dodging target sidestep an arriving attack, starting before it arrives.
 * @param {object} impact                 An impact entry, mutated in place
 * @param {object} [options]
 * @param {number} [options.lead=120]     Milliseconds before arrival at which the sidestep begins
 * @param {number} [options.retreat=0]    Backward share of the step relative to its sideways share
 */
export function addDodgeSidestep(impact, {lead=120, retreat=0}={}) {
  if ( impact.result !== crucible.api.dice.AttackRoll.RESULT_TYPES.DODGE ) return;
  impact.animations = [...(impact.animations ?? []),
    {function: "impactSpriteDodge", params: {duration: 450, lead, retreat}}];
}

/* -------------------------------------------- */

/**
 * The point one caster radius forward from the caster's center toward a target, where a projectile materializes.
 * @param {{radiusPx: number, center: {x: number, y: number}}} caster   Geometry from {@link resolveActorGeometry}
 * @param {CrucibleToken} token     The target token
 * @returns {{x: number, y: number}}
 */
export function computeManifestPoint({radiusPx, center}, token) {
  const target = tokenCenter(token);
  const dist = Math.max(1, Math.hypot(target.x - center.x, target.y - center.y));
  return {
    x: center.x + (((target.x - center.x) / dist) * radiusPx),
    y: center.y + (((target.y - center.y) / dist) * radiusPx)
  };
}

/* -------------------------------------------- */

/**
 * Build a particle exposure curve that starts hot and settles back to normal.
 * @param {number} t    Normalized time [0, 1] when the particle cools to normal exposure
 * @param {object} [options]
 * @param {boolean} [options.reverse=false]  Start normal and become hot after t
 * @param {number} [options.normal=0]        The normal exposure value
 * @param {number} [options.hot=0.5]         The hot exposure value
 * @returns {{curve: Array<{time: number, value: number}>}}
 */
export function exposureInHot(t, {reverse=false, normal=0, hot=0.5}={}) {
  const curve = reverse
    ? [{time: 0, value: normal}, {time: t, value: hot}]
    : [{time: 0, value: hot}, {time: t, value: normal}];
  if ( t < 1 ) curve.push({time: 1, value: curve[1].value});
  return {curve};
}

/* -------------------------------------------- */

/**
 * Build a positional sound descriptor for a VFX phase from a sound library entry.
 * @param {{src: string, loop?: boolean}|null} d   A sound entry, or null.
 * @returns {object|null}   A phase sound descriptor, or null when no source was provided.
 */
export function positionalSound(d) {
  if ( !d ) return null;
  const {START} = foundry.canvas.vfx.constants.SOUND_ALIGNMENT;
  return {src: d.src, align: START, radius: 30, volume: 1, loop: d.loop ?? false};
}

/* -------------------------------------------- */

/**
 * Register a target's TokenDocument and token-mesh references under a component-specific prefix.
 * @param {Record<string, string>} references   The references map, mutated in place.
 * @param {string} prefix   Reference prefix (e.g. "rayTarget").
 * @param {number} j        1-based target index.
 * @param {TokenDocument} token
 * @returns {{tokenRef: string, meshRef: string}}
 */
export function registerTargetRefs(references, prefix, j, token) {
  const tokenRef = `${prefix}_${j}_token`;
  const meshRef = `${prefix}_${j}_tokenMesh`;
  references[tokenRef] = `@${token.uuid}`;
  references[meshRef] = `^${tokenRef}.object.mesh`;
  return {tokenRef, meshRef};
}

/* -------------------------------------------- */

/**
 * Resolve the acting token's geometry for positioning VFX around it.
 * @param {CrucibleAction} action
 * @returns {{gridSize: number, token: TokenDocument, elevation: number, radiusPx: number,
 *   center: {x: number, y: number}, meshSort: number}}
 */
export function resolveActorGeometry(action) {
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
 * The center point of a token in canvas pixels.
 * @param {CrucibleToken} token
 * @returns {{x: number, y: number}}
 */
export function tokenCenter(token) {
  const size = canvas.dimensions.size;
  return {x: token.x + ((token.width * size) / 2), y: token.y + ((token.height * size) / 2)};
}

/* -------------------------------------------- */

/**
 * Pick a random element from an array, returning null for empty/missing arrays.
 * @param {any[]|undefined} arr
 * @returns {any|null}
 */
export function pickRandom(arr) {
  if ( !arr?.length ) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/* -------------------------------------------- */

/**
 * Call a function on each rendered frame of a span of a timeline, which alone keeps time for it.
 * @param {object} timeline    The animejs timeline.
 * @param {number} start       Timeline position in milliseconds at which the span begins.
 * @param {number} duration    Milliseconds the span lasts.
 * @param {(ms: number) => void} onRender   Called with the milliseconds elapsed within the span.
 */
export function scheduleTimelineClock(timeline, start, duration, onRender) {
  const clock = {ms: 0};
  timeline.add(clock, {ms: {from: 0, to: duration}, duration, ease: "linear", onRender: () => onRender(clock.ms)},
    start);
}

/* -------------------------------------------- */

/**
 * Push per-target scrolling-text entries onto a component's `scrollingText` array, composing the target's text events
 * from its event slice and staggering each 200ms to avoid overlap when a hit produces multiple rows.
 * @param {object[]} scrollingText   The component's scrollingText array (mutated).
 * @param {CrucibleAction} action
 * @param {CrucibleActor} targetActor
 * @param {object[]} targetEvents    The target's slice of the action event stream.
 * @param {string} meshRef           Reference key of the target's mesh in the VFX references map.
 * @param {number} impactStart       Component-timeline ms at which this target is struck.
 */
export function pushTargetScrollingText(scrollingText, action, targetActor, targetEvents, meshRef, impactStart) {
  const events = action.constructor.composeTextEvents(targetActor, targetEvents, {reverse: false});
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
 * Push the acting actor's selfEvents (activation cost, heroism, etc.) onto a component's scrollingText array. Skipped
 * when that actor is also a target, since {@link pushTargetScrollingText} already surfaces those events.
 * @param {object[]} scrollingText   The component's scrollingText array (mutated).
 * @param {CrucibleAction} action
 * @param {string} meshRef           Reference key of the acting actor's mesh.
 * @param {number} [time=0]          Component-timeline ms at which the actor text fires.
 */
export function pushActorScrollingText(scrollingText, action, meshRef, time=0) {
  if ( action.eventsByTarget.has(action.actor) ) return;
  const selfEvents = action.selfEvents?.all ?? [];
  if ( !selfEvents.length ) return;
  const events = action.constructor.composeTextEvents(action.actor, selfEvents, {reverse: false});
  events.forEach((evt, i) => scrollingText.push({
    target: {reference: meshRef},
    text: evt.text,
    time: time + (i * 200),
    fontSize: evt.fontSize ?? 32,
    fillColor: evt.fillColor ?? "#ffffff"
  }));
}
