/**
 * @import CrucibleAction from "../models/action.mjs";
 */

/**
 * Interrupt an unconfirmed action after its activation cost, or undo a prior interruption.
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
  if ( message.getFlag("crucible", "confirmed") !== reverse ) {
    const errorText = _loc("ACTION.WARNINGS.CannotConfirmTarget", {
      action: action.name,
      change: _loc(`DICE.${reverse ? "Reverse" : "Confirm"}`),
      state: _loc(`ACTION.${reverse ? "Unconfirmed" : "Confirmed"}`)
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
  if ( reverse ) {
    const target = CrucibleAction.fromChatMessage(message);
    target.clearNegation();
    await target.updateMessage();
  }
}
