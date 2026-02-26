import CrucibleAction from "./models/action.mjs";


/**
 * Add Crucible-specific context menu options to chat messages.
 * @param {HTMLElement} html
 * @param {object} options
 */
export function addChatMessageContextOptions(html, options) {
  if ( !game.user.isGM ) return;

  // Assign difficulty for skill checks
  options.push({
    name: game.i18n.localize("DICE.SetDifficulty"),
    icon: '<i class="fas fa-bullseye"></i>',
    condition: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return message.isRoll && flags.skill;
    },
    callback: async li => {
      const message = game.messages.get(li.dataset.messageId);
      const roll = message.rolls[0];
      const formData = await foundry.applications.api.DialogV2.input({
        window: {title: game.i18n.localize("DICE.SetDifficulty")},
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
    name: game.i18n.localize("DICE.Confirm"),
    icon: '<i class="fas fa-hexagon-check"></i>',
    condition: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return flags.action && !flags.confirmed;
    },
    callback: async li => {
      const message = game.messages.get(li.dataset.messageId);
      return CrucibleAction.confirmMessage(message);
    }
  });

  // Reverse damage
  options.push({
    name: game.i18n.localize("DICE.Reverse"),
    icon: '<i class="fas fa-hexagon-xmark"></i>',
    condition: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return flags.action && flags.confirmed;
    },
    callback: async li => {
      const message = game.messages.get(li.dataset.messageId);
      return CrucibleAction.confirmMessage(message, {reverse: true});
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
