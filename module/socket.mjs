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

