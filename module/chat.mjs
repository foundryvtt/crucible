import CrucibleAction from "./models/action.mjs";

/**
 * Handlebars template paths used for chat message rendering
 * @type {{initiativeReport: string, turnSummary: string}}
 */
export const TEMPLATES = {
  initiativeReport: "systems/crucible/templates/chat/initiative-summary.hbs",
  turnSummary: "systems/crucible/templates/chat/turn-change-summary.hbs",
  actionHeader: "systems/crucible/templates/dice/partials/action-use-header.hbs",
  actionFooter: "systems/crucible/templates/dice/partials/action-use-footer.hbs",
  rollBreakdown: "systems/crucible/templates/dice/partials/standard-check-breakdown.hbs",
  rollDetails: "systems/crucible/templates/dice/partials/standard-check-details.hbs",
  rollDice: "systems/crucible/templates/dice/partials/standard-check-roll.hbs",
  rollDiceResult: "systems/crucible/templates/dice/partials/standard-check-dice-result.hbs"
};

/**
 * Add Crucible-specific context menu options to chat messages.
 * @param {HTMLElement} html
 * @param {object} options
 */
export function addChatMessageContextOptions(html, options) {
  if ( !game.user.isGM ) return;

  // Assign difficulty for skill checks
  options.push({
    label: _loc("DICE.SetDifficulty"),
    icon: '<i class="fas fa-bullseye"></i>',
    visible: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return message.isRoll && flags.skill;
    },
    onClick: async (_e, li) => {
      const message = game.messages.get(li.dataset.messageId);
      const roll = message.rolls[0];
      const formData = await foundry.applications.api.DialogV2.input({
        window: {title: _loc("DICE.SetDifficulty")},
        content: `\
        <div class="form-group slim">
            <label>DC Target</label>
            <div class="form-fields">
                <input type="number" name="dc" value="${roll.data.dc || 15}" autofocus>
            </div>
        </div>`
      });
      for ( const r of message.rolls ) r.data.dc = formData.dc;
      await message.update({rolls: message.rolls}, {diff: false});
    }
  });

  // Confirm Action usage
  options.push({
    label: _loc("DICE.Confirm"),
    icon: '<i class="fas fa-hexagon-check"></i>',
    visible: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return flags.action && !flags.confirmed;
    },
    onClick: async (_e, li) => {
      const message = game.messages.get(li.dataset.messageId);
      return CrucibleAction.confirmMessage(message);
    }
  });

  // Reverse damage
  options.push({
    label: _loc("DICE.Reverse"),
    icon: '<i class="fas fa-hexagon-xmark"></i>',
    visible: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return flags.action && flags.confirmed;
    },
    onClick: async (_e, li) => {
      const message = game.messages.get(li.dataset.messageId);
      return CrucibleAction.confirmMessage(message, {reverse: true});
    }
  });

  // Replay VFX animation
  options.push({
    label: _loc("DICE.ReplayAnimation"),
    icon: '<i class="fas fa-wand-magic-sparkles"></i>',
    visible: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      if ( !game.settings.get("crucible", "enableVFX") ) return false;
      return flags.action && flags.confirmed && flags.vfxConfig;
    },
    onClick: (_e, li) => {
      const messageId = li.dataset.messageId;
      game.socket.emit("system.crucible", {action: "replayActionVFX", data: {messageId}});
      _replayActionVFX(messageId);
    }
  });
  return options;
}


/* -------------------------------------------- */

/**
 * Handle keybinding actions to confirm the most recent action in the chat log.
 * @param {KeyboardEventContext} context    The context data of the event
 */
export async function onKeyboardConfirmAction(context) {
  const messageIds = Array.from(game.messages.keys()).reverse();
  const now = Date.now();
  const toConfirm = [];
  for ( const id of messageIds ) {
    const message = game.messages.get(id);
    const seconds = (now - message.timestamp) / 1000;
    if ( seconds > 60 ) break;
    const {action, confirmed} = message.flags.crucible || {};
    if ( action && !confirmed ) toConfirm.unshift(message);
  }
  if ( toConfirm.length ) return CrucibleAction.confirmMessage(toConfirm[0]);
}

/* -------------------------------------------- */

/**
 * Replay the VFX animation for a confirmed action ChatMessage on this client.
 * @param {string} messageId     The ID of the ChatMessage
 */
function _replayActionVFX(messageId) {
  if ( !game.settings.get("crucible", "enableVFX") ) return;
  const message = game.messages.get(messageId);
  if ( !message ) return;
  const flags = message.flags.crucible || {};
  if ( !flags.action || !flags.confirmed || !flags.vfxConfig ) return;
  const action = CrucibleAction.fromChatMessage(message);
  const {references, ...vfxConfig} = flags.vfxConfig;
  action.playVFXEffect(vfxConfig, references);
}
