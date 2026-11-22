/**
 * @import CrucibleAction from "../models/action.mjs";
 * @import CrucibleActor from "../documents/actor.mjs";
 * @import CrucibleItem from "../documents/item.mjs";
 */
import {planPushMovement} from "../canvas/movement.mjs";

/**
 * Test whether an action deploys an item by recording a deployed effect which originates from it.
 * @param {CrucibleAction} action   The action being used
 * @param {CrucibleItem} item       The item which may be deployed
 * @returns {boolean}
 */
export function isDeployingItem(action, item) {
  return action.selfEvents?.all.some(event => event.effects.some(effect => (effect.origin === item.uuid)
    && new Set(effect.system?.properties).has("deployed"))) ?? false;
}

/* -------------------------------------------- */

/**
 * Interrupt an unconfirmed action after its activation cost, or refund that cost when the interruption is reversed.
 * @param {CrucibleAction} action             The action performing the interruption
 * @param {string} messageId                  The chat message ID of the action being interrupted
 * @param {object} [options]
 * @param {boolean} [options.reverse=false]   Undo the interruption instead of applying it
 * @returns {Promise<void>}
 * @throws {Error}                            If the interrupted message is not in the required confirmation state
 */
export async function interruptAction(action, messageId, {reverse=false}={}) {
  const message = game.messages.get(messageId);
  if ( !message ) return;
  const isReversed = !reverse && message.getFlag("crucible", "reversed");
  if ( (message.getFlag("crucible", "confirmed") !== reverse) || isReversed ) {
    const state = isReversed ? "Reversed" : (reverse ? "Unconfirmed" : "Confirmed");
    const errorText = _loc("ACTION.WARNINGS.CannotConfirmTarget", {
      action: action.name,
      change: _loc(`DICE.${reverse ? "Reverse" : "Confirm"}`),
      state: _loc(`ACTION.${state}`)
    });
    ui.notifications.warn(errorText);
    throw new Error(errorText);
  }
  const CrucibleAction = crucible.api.models.CrucibleAction;
  if ( !reverse ) {
    const target = CrucibleAction.fromChatMessage(message);
    target.negate(target.selfEvents.activation);
    await target.updateMessage();
  }
  await CrucibleAction.confirmMessage(message, {reverse});
}

/* -------------------------------------------- */

/**
 * Format an effect name with parenthetical context, abbreviating each long context entry.
 * @param {string} name                       The base name of the effect
 * @param {...(string|number|null)} context   Context entries, omitting any which are empty
 * @returns {string}
 */
export function formatEffectName(name, ...context) {
  const maxLength = 20;
  const entries = context.filter(c => (c ?? "") !== "").map(c => {
    const entry = String(c);
    return (entry.length > maxLength) ? `${entry.slice(0, maxLength - 3).trimEnd()}...` : entry;
  });
  if ( !entries.length ) return name;
  return _loc("ACTIVE_EFFECT.ContextName", {effect: name, context: entries.join(", ")});
}

/* -------------------------------------------- */

/**
 * Allow a restorative rune in an actor's grimoire to be cast either to restore or to deal its damage type.
 * @param {object} grimoire     The grimoire of the actor being prepared
 * @param {string} rune         The restorative rune
 */
export function applyRuneDamageChoice(grimoire, rune) {
  const component = grimoire.runes.get(rune);
  if ( !component ) return;
  grimoire.runes.set(rune, component.clone({damageTypes: [component.damageType, "restoration"]}, {once: true}));
}


/* -------------------------------------------- */

/**
 * Modify a rune in an actor's grimoire so that it scales with the provided ability.
 * @param {object} grimoire     The grimoire of the actor being prepared
 * @param {string} rune         The rune to change the scaling of
 * @param {string} scaling      The ability the rune should newly scale with
 */
export function applyRuneScalingChange(grimoire, rune, scaling) {
  const component = grimoire.runes.get(rune);
  if ( !component ) return;
  grimoire.runes.set(rune, component.clone({scaling}, {once: true}));
}

/* -------------------------------------------- */

/**
 * Modify a gesture in an actor's grimoire with the provided changes.
 * @param {object} grimoire     The grimoire of the actor being prepared
 * @param {string} gesture      The gesture to change
 * @param {object} changes      Partial gesture data to apply
 */
export function applyGestureChange(grimoire, gesture, changes) {
  const component = grimoire.gestures.get(gesture);
  if ( !component ) return;
  grimoire.gestures.set(gesture, component.clone(changes, {once: true}));
}

/* -------------------------------------------- */

/**
 * Record a forced movement which pushes a target away from, or pulls it toward, a point.
 * @param {CrucibleAction} action     The action performing the forced movement
 * @param {CrucibleActor} target      The targeted actor to displace
 * @param {Point} fromPoint           The point to push away from or pull toward
 * @param {number} distanceFeet       Signed distance in feet; positive pushes, negative pulls
 * @returns {Promise<void>}
 */
export async function recordPushMovement(action, target, fromPoint, distanceFeet) {
  const targetToken = action.targets.get(target)?.token?.object;
  if ( !targetToken ) return;
  const sourceToken = action.token?.object;
  const minGap = sourceToken ? (sourceToken.w + targetToken.w) / 2 : 0; // A pull stops base-to-base with the source
  const plan = await planPushMovement(fromPoint, targetToken, distanceFeet, {minGap});
  if ( !plan ) return;
  const {x, y, elevation} = plan.origin;
  action.recordEvent({type: "movement", target, movement: {id: plan.id, origin: {x, y, elevation}}});
}
