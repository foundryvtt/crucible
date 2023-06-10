import CrucibleAction from "./data/action.mjs";


export function addChatMessageContextOptions(html, options)  {
  if ( !game.user.isGM ) return;

  // Assign difficulty for skill checks
  options.push({
    name: game.i18n.localize("DICE.SetDifficulty"),
    icon: '<i class="fas fa-bullseye"></i>',
    condition: li => {
      const message = game.messages.get(li.data("messageId"));
      const flags = message.flags.crucible || {};
      return message.isRoll && flags.skill;
    },
    callback: li => {
      const message = game.messages.get(li.data("messageId"));
      Dialog.prompt({
        title: game.i18n.localize("DICE.SetDifficulty"),
        content: `<form><div class="form-group"><label>DC Target</label><input type="text" name="dc" value="15" data-dtype="Number"/></div></form>`,
        callback: html => {
          const roll = message.roll;
          roll.data.dc = parseInt(html[0].querySelector('input').value);
          message.update({roll: JSON.stringify(roll)});
        },
        options: {width: 260}
      })
    }
  });

  // Confirm Action usage
  options.push({
    name: game.i18n.localize("DICE.Confirm"),
    icon: '<i class="fas fa-hexagon-check"></i>',
    condition: li => {
      const message = game.messages.get(li.data("messageId"));
      const flags = message.flags.crucible || {};
      return flags.action && !flags.confirmed;
    },
    callback: async li => {
      const message = game.messages.get(li.data("messageId"));
      return CrucibleAction.confirm(message);
    }
  });

  // Reverse damage
  options.push({
    name: game.i18n.localize("DICE.Reverse"),
    icon: '<i class="fas fa-hexagon-xmark"></i>',
    condition: li => {
      const message = game.messages.get(li.data("messageId"));
      const flags = message.flags.crucible || {};
      return flags.action && flags.confirmed;
    },
    callback: async li => {
      const message = game.messages.get(li.data("messageId"));
      return CrucibleAction.confirm(message, {reverse: true});
    }
  });
  return options;
}

/* -------------------------------------------- */

/**
 * Custom alterations to apply when rendering chat message HTML
 */
export function renderChatMessage(message, html, data, options) {
  const flags = message.flags.crucible || {};
  if ( flags.action ) {
    if ( flags.confirmed ) {
      html.find(".damage-result .target").addClass("applied");
      html.find(".message-metadata").prepend(`<i class="crucible confirmed fas fa-hexagon-check" data-tooltip="ACTION.Confirmed"></i>`);
    }
    else {
      html.find(".message-metadata").prepend(`<i class="crucible unconfirmed fas fa-hexagon-xmark" data-tooltip="ACTION.Unconfirmed"></i>`);
      if ( !game.user.isGM ) return;
      const confirm = $(`<button class="crucible confirm" type="button"><i class="fas fa-hexagon-check"></i>Confirm</button>`)
      html.append(confirm);
      confirm.click(() => CrucibleAction.confirm(message))
    }
  }
}

/* -------------------------------------------- */

/**
 * Hover over chat target links to highlight the token of that target.
 * @param {MouseEvent} event      The originating pointer event
 * @returns {Promise<void>}
 */
export async function onChatTargetLinkHover(event) {
  const link = event.currentTarget;
  const isActive = event.type === "mouseenter";

  // Get the target Token object;
  const target = await fromUuid(link.dataset.uuid);
  let token;
  if ( target instanceof TokenDocument ) {
    if ( !target.parent.isView ) return;
    token = target.object;
  } else {
    const tokens = target.getActiveTokens(true);
    if ( !tokens.length ) return;
    token = tokens[0];
  }

  // Toggle hover display
  if ( isActive ) token._onHoverIn(event, {hoverOutOthers: false});
  else token._onHoverOut(event);
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
  if ( toConfirm.length ) return CrucibleAction.confirm(toConfirm[0]);
}
