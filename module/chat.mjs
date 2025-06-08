import CrucibleAction from "./models/action.mjs";


export function addChatMessageContextOptions(html, options)  {
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
    callback: li => {
      const message = game.messages.get(li.dataset.messageId);
      Dialog.prompt({ // TODO refactor DialogV2
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
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return flags.action && !flags.confirmed;
    },
    callback: async li => {
      const message = game.messages.get(li.dataset.messageId);
      return CrucibleAction.confirm(message);
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
      return CrucibleAction.confirm(message, {reverse: true});
    }
  });
  return options;
}

/* -------------------------------------------- */

/**
 * When a new ChatMessage is created, auto-confirm it if the current auto-confirmation settings allow.
 * @param {ChatMessage} message     The newly created ChatMessage
 * @param {object} data             Provided message creation data
 * @param {object} options          Message creation options
 * @param {string} userId           The creating user ID
 */
export async function onCreateChatMessage(message, data, options, userId) {
  if ( game.user !== game.users.activeGM ) return;
  const flags = message.flags.crucible || {};
  if ( !flags.action || flags.confirmed ) return;

  // Wait for DSN animation if applicable
  if ( message.rolls.length && ("dice3d" in game) ) await game.dice3d.waitFor3DAnimationByMessageID(message.id);

  // Confirm the message
  const action = CrucibleAction.fromChatMessage(message);
  const canConfirm = action.canAutoConfirm();
  if ( canConfirm ) await CrucibleAction.confirm(message, {action});
}

/* -------------------------------------------- */

/**
 * Custom alterations to apply when rendering chat message HTML
 */
export function renderChatMessageHTML(message, html, _messageData) {
  const flags = message.flags.crucible || {};
  if ( flags.action || (message.rolls[0] instanceof crucible.api.dice.StandardCheck) ) html.classList.add("crucible");

  // Action Cards
  if ( flags.action ) {
    const meta = html.querySelector(".message-metadata");
    if ( flags.confirmed ) {
      const target = html.querySelector(".damage-result .target");
      if ( target ) target.classList.add("applied");
      if ( meta ) meta.insertAdjacentHTML("afterbegin", `<i class="confirmed fa-solid fa-hexagon-check" data-tooltip="ACTION.Confirmed"></i>`);
    }
    else {
      if ( meta ) meta.insertAdjacentHTML("afterbegin", `<i class="unconfirmed fa-solid fa-hexagon-xmark" data-tooltip="ACTION.Unconfirmed"></i>`);
      if ( !game.user.isGM ) return;
      const confirm = foundry.utils.parseHTML(`<button class="confirm frame-brown" type="button"><i class="fas fa-hexagon-check"></i>Confirm</button>`);
      html.appendChild(confirm);
      confirm.addEventListener("click", event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.firstElementChild.className = "fa-solid fa-spinner fa-spin";
        CrucibleAction.confirm(message);
      })
    }
  }

  // Initiative Report
  if ( flags.isInitiativeReport ) html.querySelector(".dice-rolls")?.remove();

  // Target Hover
  for ( const el of html.querySelectorAll(".target-link") ) {
    el.addEventListener("pointerover", onChatTargetLinkHover);
    el.addEventListener("pointerout", onChatTargetLinkHover);
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
  const isActive = event.type === "pointerover";

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
