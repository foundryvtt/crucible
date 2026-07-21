import StandardCheck from "../dice/standard-check.mjs";
import GroupCheck from "../dice/group-check.mjs";
import CrucibleAction from "../models/action.mjs";

/**
 * A ChatMessage document subclass that provides Crucible system-specific enhancements and operations.
 */
export default class CrucibleChatMessage extends ChatMessage {

  /**
   * Whether a reverse-confirm is currently in flight for this message.
   * @type {boolean}
   * @internal
   */
  _reversing;

  /**
   * The in-flight VFX playback triggered by this message's confirmation, if any.
   * Awaited by {@link CrucibleAction#confirm} to defer postConfirm hooks until animation playback concludes.
   * @type {Promise<void>|undefined}
   * @internal
   */
  _vfxPlayback;

  /* -------------------------------------------- */
  /*  Database Operations                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if ( foundry.utils.hasProperty(data, "flags.crucible.action") ) CrucibleChatMessage.#renderAllSheetSidebars();
    this.#autoConfirmMessage();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    const flags = this.flags.crucible || {};
    if ( foundry.utils.hasProperty(data, "flags.crucible.confirmed") ) CrucibleChatMessage.#renderAllSheetSidebars();
    if ( flags.action && flags.vfxConfig && (foundry.utils.getProperty(data, "flags.crucible.confirmed") === true) ) {
      this._vfxPlayback = this.#playVFXEffect();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( foundry.utils.hasProperty(this, "flags.crucible.action") ) CrucibleChatMessage.#renderAllSheetSidebars();
  }

  /* -------------------------------------------- */

  /**
   * Re-render all currently-rendered actor sheet sidebars
   * @returns {Promise<void>}
   */
  static #renderAllSheetSidebars() {
    const promises = [];
    for ( const app of crucible.api.applications.CrucibleBaseActorSheet.instances() ) {
      promises.push(app.render({parts: ["sidebar"]}));
    }
    return Promise.allSettled(promises);
  }

  /* -------------------------------------------- */

  /**
   * Play a VFX animation using data provided by this ChatMessage.
   * The dice-rolls -> VFX ordering is already enforced upstream by {@link #autoConfirmMessage},
   * which awaits 3D dice before flipping the confirmed flag. Calling
   * {@link Dice3D#waitFor3DAnimationByMessageID} again here would hang forever in DSN >= 6.0,
   * because the function registers its completion hook lazily and dice for this message have
   * already finished by the time we get here.
   * @returns {Promise<void>}
   */
  async #playVFXEffect() {
    if ( !game.settings.get("crucible", "enableVFX") ) return;
    const action = CrucibleAction.fromChatMessage(this);
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
   * Return the most recent action in the chat log, optionally requiring it to satisfy the supplied criteria.
   * Criteria are strict: if the latest action message fails any of them, this returns null rather than continuing
   * to search backward for an earlier match.
   * @param {object} [options]
   * @param {boolean} [options.confirmed]         Require the most recent action to be confirmed (true) or
   *                                              unconfirmed (false). If omitted, either state is accepted.
   * @param {Actor|string} [options.actor]        Require the most recent action to have been performed by this Actor
   *                                              (or actor ID).
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
    if ( ["isInitiativeReport", "isTurnChangeSummary"].some(f => f in (this.flags.crucible ?? {})) ) return html;
    const content = html.querySelector(".message-content");
    const sections = this.flags.crucible?.sections;

    // Render data into per-target sections with a target header, rolls, and a table of secondary changes
    if ( this.isContentVisible && sections?.length && content && !content.querySelector(".action-sections") ) {
      const rendered = [];
      for ( const section of sections ) {
        const rollHTML = [];
        for ( const i of section.rollIndices ) {
          const roll = this.rolls[i];
          if ( !roll ) continue;
          roll.data.newTarget = false;
          rollHTML.push(await roll.render({isPrivate: false, message: this, hideActor: true}));
        }
        rendered.push(await foundry.applications.handlebars.renderTemplate(
          "systems/crucible/templates/dice/partials/action-target-section.hbs",
          {section, rollsHTML: rollHTML.join("")}));
      }
      content.insertAdjacentHTML("beforeend", `<section class="action-sections">${rendered.join("")}</section>`);
    }

    // Fallback: non-action roll messages, or action cards this client cannot fully see (flat rolls, no outcomes)
    else if ( (this.rolls[0] instanceof StandardCheck) && content && !content.querySelector(".crucible.dice-roll") ) {
      const rollHTML = [];
      for ( const roll of this.rolls ) {
        rollHTML.push(await roll.render({isPrivate: !this.isContentVisible, message: this}));
      }
      content.insertAdjacentHTML("beforeend", `<section class="dice-rolls">${rollHTML.join("")}</section>`);
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
          const confirm = foundry.utils.parseHTML(`<button class=\"confirm frame-brown\" type=\"button\"><i class=\"fas fa-hexagon-check\"></i>${_loc("DICE.Confirm")}</button>`);
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
      if ( (flags.action.target.type === "summon") && !game.user.isGM ) html.querySelector(".target-region.full-tags")?.remove();
    }

    // Hide GM-only roll details (e.g. an invisible attacker's secret boon) for non-GMs
    if ( !game.user.isGM ) {
      for ( const el of html.querySelectorAll(".gm-only") ) el.remove();
    }

    // Initiative Report
    if ( flags.isInitiativeReport ) {
      crucible.api.models.CrucibleCombatChallenge.onRenderInitiativeReport(message, html);
    }

    // Group Check Card
    const groupCheck = flags[GroupCheck.FLAG_KEY];
    if ( groupCheck ) GroupCheck.onRenderGroupCheck(message, html, groupCheck);

    // Handle target hover interactivity with a delegated listener bound to the message root
    html.addEventListener("pointerover", onChatTargetLinkHover);
    html.addEventListener("pointerout", onChatTargetLinkHover);
  }
}

/* -------------------------------------------- */

/**
 * Hover over chat target links to highlight the token of that target.
 * @param {MouseEvent} event      The originating pointer event
 * @returns {Promise<void>}
 */
async function onChatTargetLinkHover(event) {
  const link = event.target.closest(".target-link");
  if ( !link ) return;
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
