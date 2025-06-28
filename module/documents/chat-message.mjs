import StandardCheck from "../dice/standard-check.mjs";
import CrucibleAction from "../models/action.mjs";

/**
 * A ChatMessage document subclass that provides Crucible system-specific enhancements and operations.
 */
export default class CrucibleChatMessage extends ChatMessage {

  /* -------------------------------------------- */
  /*  Database Operations                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this.#autoConfirmMessage();
  }

  /* -------------------------------------------- */

  /**
   * As the active GM, auto-confirm a CrucibleAction contained in a ChatMessage.
   * @returns {Promise<void>}
   */
  async #autoConfirmMessage() {
    if ( !game.users.activeGM?.isSelf ) return;
    const flags = this.flags.crucible || {};
    if ( !flags.action || flags.confirmed ) return;
    const action = CrucibleAction.fromChatMessage(this);
    const canConfirm = action?.canAutoConfirm();
    if ( !canConfirm ) return;
    if ( this.rolls.length && ("dice3d" in game) ) await game.dice3d.waitFor3DAnimationByMessageID(this.id);
    await CrucibleAction.confirm(this, {action});
  }

  /* -------------------------------------------- */
  /*  Message Rendering                           */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async renderHTML(options) {
    const html = await super.renderHTML(options);
    if ( this.flags.crucible?.isInitiativeReport ) return html;
    if ( (this.rolls[0] instanceof StandardCheck) && !html.querySelector(".crucible.dice-roll") ) {
      let rollHTML = [];
      for ( const roll of this.rolls ) {
        rollHTML.push(await roll.render({isPrivate: !this.isContentVisible, message: this}));
      }
      const rolls = `<section class="dice-rolls">${rollHTML.join("")}</section>`;
      html.querySelector(".message-content").insertAdjacentHTML("beforeend", rolls);
    }
    return html;
  }

  /* -------------------------------------------- */

  /**
   * Custom alterations to apply when rendering chat message HTML.
   * Currently applied via the renderChatMessageHTML hook
   */
  static onRenderHTML(message, html, _messageData) {
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
          CrucibleAction.confirmMessage(message);
        })
      }
    }

    // Initiative Report
    if ( flags.isInitiativeReport ) {
      crucible.api.models.CrucibleCombatChallenge.onRenderInitiativeReport(message, html);
    }

    // Target Hover
    for ( const el of html.querySelectorAll(".target-link") ) {
      el.addEventListener("pointerover", onChatTargetLinkHover);
      el.addEventListener("pointerout", onChatTargetLinkHover);
    }
  }
}

/* -------------------------------------------- */

/**
 * Hover over chat target links to highlight the token of that target.
 * @param {MouseEvent} event      The originating pointer event
 * @returns {Promise<void>}
 */
async function onChatTargetLinkHover(event) {
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
