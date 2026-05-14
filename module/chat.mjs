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
export function addChatMessageContextOptions(_app, options) {
  if ( !game.user.isGM ) return;

  // Assign difficulty for skill or group checks
  options.push({
    label: _loc("DICE.SetDifficulty"),
    icon: '<i class="fas fa-bullseye"></i>',
    visible: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return message.isRoll && (flags.skill || flags.groupCheck);
    },
    onClick: async (_e, li) => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible;
      const skills = new Set(message.rolls.map(r => r.data.type));
      const formData = await foundry.applications.api.DialogV2.input({
        window: {title: _loc("DICE.SetDifficulty")},
        content: Array.from(skills).map(skill => `\
        <div class="form-group slim">
          <label>${_loc("DICE.DCTargetSpecific", {skill: SYSTEM.SKILLS[skill]?.label ?? skill})}</label>
          <div class="form-fields">
            <input type="number" name="${skill}" value="${message.rolls.find(r => r.data.type === skill).data.dc ?? 0}">
          </div>
        </div>`).join("")
      });
      for ( const r of message.rolls ) r.data.dc = formData[r.data.type];
      const update = {rolls: message.rolls};
      if ( flags.groupCheck ) {
        update.content = await crucible.api.dice.GroupCheck.renderGroupCheckCard(flags.groupCheck, message.rolls);
      }
      await message.update(update, {diff: false});
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
