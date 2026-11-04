import CrucibleAction from "./models/action.mjs";

/**
 * Handle incoming socket events dispatched to the Crucible system.
 * @param {object} event
 * @param {string|null} event.action
 * @param {object} event.data
 */
export function handleSocketEvent({action=null, data={}}={}) {
  switch (action) {
    case "replayActionVFX":
      _onReplayActionVFX(data);
      break;
    case "requestRoundAdvance":
      _onRequestRoundAdvance(data);
      break;
  }
}

/* -------------------------------------------- */

/**
 * Handle a socket request to replay a VFX animation from a confirmed action ChatMessage.
 * @param {object} data
 * @param {string} data.messageId     The ID of the ChatMessage containing the action
 */
function _onReplayActionVFX({messageId}) {
  if ( !game.settings.get("crucible", "enableVFX") ) return;
  const message = game.messages.get(messageId);
  if ( !message ) return;
  const flags = message.flags.crucible || {};
  if ( !flags.action || !flags.confirmed || !flags.vfxConfig ) return;
  const action = CrucibleAction.fromChatMessage(message);
  const {references, ...vfxConfig} = flags.vfxConfig;
  action.playVFXEffect(vfxConfig, references);
}

/* -------------------------------------------- */

/**
 * Handle a socket request from a User asking the Gamemaster to advance the Combat round on their behalf, which
 * occurs when the final acting Combatant of a round belongs to a player. The request is re-validated by the
 * designated Gamemaster before the round is advanced, in case the encounter has changed since it was made.
 * @param {object} data
 * @param {string} data.combatId     The ID of the Combat to advance
 * @param {string} data.userId       The ID of the requesting User
 * @param {number} data.round        The Combat round expected by the requesting User
 */
function _onRequestRoundAdvance({combatId, userId, round}) {
  if ( game.users.activeGM?.isSelf !== true ) return;
  const combat = game.combats.get(combatId);
  const user = game.users.get(userId);
  if ( !combat || (combat.round !== round) || !user?.active || user.isGM ) return;
  if ( !combat._canRequestRoundAdvance(user) ) return;
  combat.nextRound();
}

