import CrucibleAction from "./models/action.mjs";
import {playClick} from "./audio.mjs";

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
      const skills = Array.from(new Set(message.rolls.map(r => r.data.type)));
      const {NumberField} = foundry.data.fields;
      const content = document.createElement("div");
      for ( const [i, skill] of skills.entries() ) {
        const label = _loc("DICE.DCTargetSpecific", {skill: SYSTEM.SKILLS[skill]?.label ?? skill});
        const field = new NumberField({label, integer: true});
        const value = message.rolls.find(r => r.data.type === skill).data.dc;
        content.append(field.toFormGroup({classes: ["slim"]}, {name: skill, value, autofocus: i === 0}));
      }
      const formData = await foundry.applications.api.DialogV2.input({
        window: {title: _loc("DICE.SetDifficulty")},
        content
      });
      for ( const r of message.rolls ) r.data.dc = formData[r.data.type];
      const update = {rolls: message.rolls};
      if ( flags.groupCheck ) {
        update.content = await crucible.api.dice.GroupCheck.renderGroupCheckCard(flags.groupCheck, message.rolls);
      }
      await message.update(update, {diff: false});
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

  // Confirm Action usage
  options.push({
    label: _loc("DICE.Confirm"),
    icon: '<i class="fas fa-hexagon-check"></i>',
    visible: li => {
      const message = game.messages.get(li.dataset.messageId);
      const flags = message.flags.crucible || {};
      return flags.action && !flags.confirmed && !flags.reversed;
    },
    onClick: async (_e, li) => {
      const message = game.messages.get(li.dataset.messageId);
      return CrucibleAction.confirmMessage(message);
    }
  });

  // Reverse Action
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
 * Create the conventional button which sends its enclosing read-aloud block to chat.
 * @returns {HTMLButtonElement}
 */
export function createChatReadaloudButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon fa-solid fa-message-quote";
  button.dataset.chatReadaloud = "";
  button.dataset.tooltip = "";
  button.ariaLabel = _loc("CRUCIBLE.SendChatReadaloud");
  return button;
}

/* -------------------------------------------- */

/**
 * Handle clicks on a read-aloud send-to-chat button anywhere in the document.
 * @param {PointerEvent} event
 */
export async function onClickChatReadaloud(event) {
  const button = event.target.closest("button[data-chat-readaloud]");
  if ( !button || !game.user.isGM ) return;
  const block = button.closest(".readaloud");
  if ( !block ) return;
  playClick();

  // Content without controls or secrets
  const copy = block.cloneNode(true);
  for ( const el of copy.querySelectorAll("button[data-chat-readaloud], secret-block, section.secret") ) el.remove();
  const content = `<section class="block readaloud">${copy.innerHTML}</section>`;

  // Speaker: a world Actor id, otherwise a plain alias, otherwise the posting User
  const cls = foundry.documents.ChatMessage.implementation;
  const value = block.closest("[data-speaker]")?.dataset.speaker;
  const actor = value ? game.actors.get(value) : null;
  const speaker = actor ? cls.getSpeaker({actor}) : {alias: value || game.user.name};

  // Prepare and create the message
  const source = _getReadaloudSource(block);
  const messageData = {content, speaker, flags: {crucible: {chatReadaloud: {source}}}};
  Hooks.callAll("crucible.prepareChatReadaloud", messageData, {block, source});
  await cls.create(messageData);
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
    const {action, confirmed, reversed} = message.flags.crucible || {};
    if ( action && !confirmed && !reversed ) toConfirm.unshift(message);
  }
  if ( toConfirm.length ) return CrucibleAction.confirmMessage(toConfirm[0]);
}

/* -------------------------------------------- */

/**
 * Identify the document a read-aloud block was rendered from: an embedded document, else a journal page.
 * @param {HTMLElement} block
 * @returns {string|null}     The source document UUID
 */
function _getReadaloudSource(block) {
  const embed = block.closest("[data-content-embed]");
  if ( embed ) return embed.dataset.uuid;
  const doc = foundry.applications.instances.get(block.closest(".application")?.id)?.document;
  const pageId = block.closest("[data-page-id]")?.dataset.pageId;
  return (doc?.pages?.get(pageId) ?? doc)?.uuid ?? null;
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
