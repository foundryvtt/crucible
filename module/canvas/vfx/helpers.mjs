/**
 * Shared utilities used by VFX configurators across spells and strikes.
 */

/* -------------------------------------------- */

/**
 * Compute a per-target hit/miss offset relative to the target token center, banded by attack
 * result so projectiles land tighter on HIT and clearly past-the-target on MISS.
 * @param {CrucibleToken} token
 * @param {string} result   AttackRoll.RESULT_TYPES value.
 * @returns {{x: number, y: number}}
 */
export function computeAttackOffset(token, result) {
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
    case T.DODGE:
    case T.MISS: hitRange = [0.5, 1.0]; break;
    default: hitRange = [0, 0]; break;
  }
  const x = Math.mix(w * hitRange[0], w * hitRange[1], Math.random()) * (Math.random() > 0.5 ? 1 : -1);
  const y = Math.mix(h * hitRange[0], h * hitRange[1], Math.random()) * (Math.random() > 0.5 ? 1 : -1);
  return {x, y};
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
