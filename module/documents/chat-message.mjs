import StandardCheck from "../dice/standard-check.mjs";
import StandardCheckDialog from "../dice/standard-check-dialog.mjs";
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

  /** @inheritDoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    const flags = this.flags.crucible || {};
    if ( flags.action && flags.vfxConfig && (data.flags.crucible.confirmed === true) ) this.#playVFXEffect();
  }

  /* -------------------------------------------- */

  /**
   * Play a VFX animation using data provided by this ChatMessage
   * @returns {Promise<void>}
   */
  async #playVFXEffect() {
    const action = CrucibleAction.fromChatMessage(this);
    if ( this.rolls.length && ("dice3d" in game) ) await game.dice3d.waitFor3DAnimationByMessageID(this.id);
    const {references, ...vfxConfig} = this.flags.crucible.vfxConfig;
    await action.playVFXEffect(vfxConfig, references);
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
    await CrucibleAction.confirmMessage(this, {action});
  }

  /* -------------------------------------------- */

  /**
   * Returns the most recent action in the chat log
   * @param {object} [options]                    Options which specify criteria the most recent action must meet
   * @param {boolean} [options.confirmed]         Require the action to be confirmed (true), unconfirmed (false),
   *   or either (undefined)
   * @param {Actor} [options.actor]               An Actor (or actor ID) who must have performed the most recent action
   * @returns {CrucibleAction|null}
   */
  static getLastAction({confirmed, actor}={}) {
    const messages = game.messages.contents;
    for ( let i = messages.length - 1; i >= 0; i-- ) {
      const message = messages[i];
      if ( !message.flags.crucible?.action ) continue;
      if ( (confirmed !== undefined) && (message.flags.crucible.confirmed !== confirmed) ) return null;
      const messageActor = fromUuidSync(message.flags.crucible.actor);
      if ( (typeof actor === "string") && (messageActor?.id !== actor) ) return null;
      if ( (actor instanceof Actor) && (messageActor !== actor) ) return null;
      return CrucibleAction.fromChatMessage(message);
    }
    return null;
  }

  /* -------------------------------------------- */
  /*  Message Rendering                           */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async renderHTML(options) {
    const html = await super.renderHTML(options);
    if ( this.flags.crucible?.isInitiativeReport ) return html;
    if ( (this.rolls[0] instanceof StandardCheck) && !html.querySelector(".crucible.dice-roll") ) {
      const rollHTML = [];
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
   * @param {ChatMessage} message
   * @param {HTMLElement} html
   * @param {object} _messageData
   */
  static onRenderHTML(message, html, _messageData) {
    const flags = message.flags.crucible || {};
    if ( !foundry.utils.isEmpty(flags) || (message.rolls[0] instanceof crucible.api.dice.StandardCheck) ) {
      html.classList.add("crucible");
      html.querySelector(".message-content").classList.add("themed", "theme-dark");
    }

    // Action Cards
    if ( flags.action ) {
      const meta = html.querySelector(".message-metadata");
      if ( flags.confirmed ) {
        const target = html.querySelector(".damage-result .target");
        if ( target ) target.classList.add("applied");
        if ( meta ) meta.insertAdjacentHTML("afterbegin", "<i class=\"confirmed fa-solid fa-hexagon-check\" data-tooltip=\"ACTION.Confirmed\"></i>");
      }
      else {
        if ( meta ) meta.insertAdjacentHTML("afterbegin", "<i class=\"unconfirmed fa-solid fa-hexagon-xmark\" data-tooltip=\"ACTION.Unconfirmed\"></i>");
        if ( game.user.isGM ) {
          const confirm = foundry.utils.parseHTML("<button class=\"confirm frame-brown\" type=\"button\"><i class=\"fas fa-hexagon-check\"></i>Confirm</button>");
          html.appendChild(confirm);
          confirm.addEventListener("click", event => {
            const button = event.currentTarget;
            button.disabled = true;
            button.firstElementChild.className = "fa-solid fa-spinner fa-spin";
            CrucibleAction.confirmMessage(message);
          });
        }
      }

      // Hide summoned creature names for non-GMs
      if ( (flags.action.target.type === "summon") && !game.user.isGM ) html.querySelector(".target-template.full-tags")?.remove();
    }

    // Initiative Report
    if ( flags.isInitiativeReport ) {
      crucible.api.models.CrucibleCombatChallenge.onRenderInitiativeReport(message, html);
    }

    // Group Check Card
    if ( flags[StandardCheckDialog.GROUP_CHECK.FLAG_KEY] ) {
      CrucibleChatMessage.#onRenderGroupCheck(message, html, flags[StandardCheckDialog.GROUP_CHECK.FLAG_KEY]);
    }

    // Target Hover
    for ( const el of html.querySelectorAll(".target-link") ) {
      el.addEventListener("pointerover", onChatTargetLinkHover);
      el.addEventListener("pointerout", onChatTargetLinkHover);
    }
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners for group check chat card controls.
   * Binds resend, roll-on-behalf, skip, and finalize buttons to their respective handlers.
   * @param {ChatMessage} message - The chat message being rendered
   * @param {HTMLElement} html - The rendered HTML element
   * @param {GroupCheckFlags} groupCheckFlags - The group check flags data
   */
  static #onRenderGroupCheck(message, html, groupCheckFlags) {
    const {ACTOR_STATUS} = StandardCheckDialog.GROUP_CHECK;

    for ( const row of html.querySelectorAll(".group-check-row.dice-roll") ) {
      row.addEventListener("click", event => {
        if ( event.target.closest("button, .controls") ) return;
        row.classList.toggle("expanded");
      });
    }

    if ( !game.user.isGM || groupCheckFlags.finalized ) return;

    for ( const row of html.querySelectorAll(".group-check-row.line-item") ) {
      const actorId = row.dataset.actorId;
      const entry = groupCheckFlags.actors?.[actorId];
      if ( !entry || entry.status === ACTOR_STATUS.COMPLETE || entry.status === ACTOR_STATUS.SKIPPED ) continue;
      const controls = document.createElement("div");
      controls.classList.add("controls");

      const resend = foundry.utils.parseHTML(`<button type="button" class="icon frame-brown fa-solid fa-rotate-right" data-tooltip="${game.i18n.localize("DICE.GROUP_CHECK.Resend")}"></button>`);
      resend.addEventListener("click", async event => {
        event.preventDefault();
        await StandardCheckDialog.resendGroupCheckRequest(message, actorId);
      });
      controls.appendChild(resend);

      const rollBehalf = foundry.utils.parseHTML(`<button type="button" class="icon frame-brown fa-solid fa-dice" data-tooltip="${game.i18n.localize("DICE.GROUP_CHECK.RollOnBehalf")}"></button>`);
      rollBehalf.addEventListener("click", async event => {
        event.preventDefault();
        await StandardCheckDialog.rollOnBehalfGroupCheck(message, actorId);
      });
      controls.appendChild(rollBehalf);

      const skip = foundry.utils.parseHTML(`<button type="button" class="icon frame-brown fa-solid fa-forward" data-tooltip="${game.i18n.localize("DICE.GROUP_CHECK.Skip")}"></button>`);
      skip.addEventListener("click", async event => {
        event.preventDefault();
        await StandardCheckDialog.skipGroupCheckActor(message, actorId);
      });
      controls.appendChild(skip);

      row.appendChild(controls);
    }

    const section = html.querySelector(".group-check-result");
    if ( section ) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("flexrow");
      const finalize = foundry.utils.parseHTML(`<button class="confirm frame-brown" type="button"><i class="fa-solid fa-check"></i> ${game.i18n.localize("DICE.GROUP_CHECK.Finalize")}</button>`);
      finalize.addEventListener("click", async event => {
        event.preventDefault();
        finalize.disabled = true;
        finalize.querySelector("i")?.classList.add("fa-spinner", "fa-spin");
        await StandardCheckDialog.finalizeGroupCheck(message);
      });
      wrapper.appendChild(finalize);
      section.appendChild(wrapper);
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
  if ( !target ) return; // Target no longer exists

  // Identify the token
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
