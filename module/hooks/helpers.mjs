/**
 * @import CrucibleAction from "../models/action.mjs";
 * @import CrucibleItem from "../documents/item.mjs";
 */

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
