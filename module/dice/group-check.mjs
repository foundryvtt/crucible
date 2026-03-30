import StandardCheck from "./standard-check.mjs";

/**
 * @typedef GroupCheckFlags
 * @property {string} checkId                        Unique group check ID
 * @property {string} skillId                        The skill being checked
 * @property {number} dc                             Difficulty class
 * @property {number} sharedBoons                    GM-assigned shared boons
 * @property {number} sharedBanes                    GM-assigned shared banes
 * @property {boolean} finalized                     Whether the GM has finalized results
 * @property {Record<string, GroupCheckActorEntry>} actors   Actor ID → entry
 */

/**
 * @typedef {object} GroupCheckActorEntry
 * @property {string} actorId                        The actor's ID
 * @property {string} actorName                      Display name (cached)
 * @property {string} actorImg                       Image path (cached)
 * @property {string|null} userId                    User ID responsible for rolling
 * @property {string} status                         Actor status enum value
 * @property {object|null} rollData                  Serialized StandardCheck data (after completion)
 */

/**
 * @typedef {object} GroupCheckStatusDisplay
 * @property {string} classes                        CSS classes for the rendered status element
 * @property {string} [text]                         Optional text content for the status element
 * @property {string} [tooltip]                      Optional tooltip localization key
 */

/**
 * @typedef {GroupCheckActorEntry & object} GroupCheckActorTemplateData
 * @property {boolean} showRollResult                     Whether the expanded roll result layout should be rendered
 * @property {GroupCheckStatusDisplay|null} statusDisplay Prepared status indicator for non-complete rows
 * @property {DiceResultContext|null} rollContext         Prepared roll context for the dice result partial
 */

/**
 * Orchestrates group skill checks across multiple actors.
 * Creates a GM-whispered chat card that tracks individual roll statuses,
 * dispatches roll queries to players, and finalizes results.
 */
export default class GroupCheck extends StandardCheck {
  /**
   * The template path used to render group check chat cards.
   * @type {string}
   */
  static #GROUP_CHECK_TEMPLATE = "systems/crucible/templates/dice/group-check-chat.hbs";

  /**
   * Key used for ChatMessage flags.
   * @type {string}
   */
  static FLAG_KEY = "groupCheck";

  /**
   * Possible status values for an actor in a group check.
   * @enum {string}
   */
  static #STATUSES = Object.freeze({
    PENDING: "pending",
    COMPLETE: "complete",
    ABORTED: "aborted",
    SKIPPED: "skipped"
  });

  /** @type {foundry.utils.Semaphore} */
  static #UPDATE_SEMAPHORE = new foundry.utils.Semaphore(1);

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Recreate a GroupCheck instance from persisted flags for rendering updates.
   * @param {GroupCheckFlags} flags     The persisted group check state
   * @returns {GroupCheck}              A configured group check instance
   */
  static #fromFlags(flags) {
    const data = {
      type: flags.skillId,
      dc: flags.dc
    };
    if ( flags.sharedBoons ) data.boons = {special: {label: "Special", number: flags.sharedBoons}};
    if ( flags.sharedBanes ) data.banes = {special: {label: "Special", number: flags.sharedBanes}};
    return new this(data);
  }

  /* -------------------------------------------- */

  /**
   * Find the best active user to roll for a given actor.
   * Prefers users whose assigned character matches, then falls back to any owner.
   * @param {CrucibleActor} actor     The actor to find a user for
   * @returns {User|undefined}        The matched user, or undefined if none found
   */
  static #findUserForActor(actor) {
    return game.users.getDesignatedUser(user => {
      if ( !user.active || user.isGM ) return false;
      if ( user.character === actor ) return true;
      return actor.testUserPermission(user, "OWNER");
    }) ?? game.users.activeGM;
  }

  /* -------------------------------------------- */

  /**
   * Show Dice So Nice animation for a group check roll.
   * By default the animation is whispered to the current user only.
   * @param {Roll} roll                           The evaluated roll to animate
   * @param {object} [options={}]                 Additional options
   * @param {User} [options.user]                 The user who rolled (defaults to current user)
   * @param {boolean} [options.blind=false]       Whether this is a blind roll
   * @param {boolean} [options.synchronize=false] Whether to synchronize the animation across clients
   * @returns {Promise<void>}
   */
  static async #showDiceSoNice(roll, {user=game.user, blind=false, synchronize=false}={}) {
    if ( !game.dice3d ) return;
    const whisper = [user.id];
    try {
      await game.dice3d.showForRoll(roll, user, synchronize, whisper, blind);
    }
    catch(err) {
      console.warn("Dice So Nice error:", err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a StandardCheck roll for an actor, present the dialog, and evaluate it.
   * Optionally shows a Dice So Nice animation.
   * @param {CrucibleActor} actor The actor performing the check
   * @param {object} options
   * @param {string} options.skillId            The skill being checked
   * @param {number} [options.dc=15]            The difficulty class for the check
   * @param {number} [options.sharedBoons=0]    GM-assigned shared boons
   * @param {number} [options.sharedBanes=0]    GM-assigned shared banes
   * @param {string} [options.title]            The dialog title
   * @param {boolean} [options.showDSN=true]    Whether to show a Dice So Nice animation
   * @returns {Promise<StandardCheck|null>}    The evaluated roll, or null if the dialog was cancelled
   */
  static async #prepareAndRoll(actor, {skillId, dc=15, sharedBoons=0, sharedBanes=0, title, showDSN=true}={}) {
    const skill = SYSTEM.SKILLS[skillId];
    const checkData = {dc};
    if ( sharedBoons ) checkData.boons = {special: {label: "Special", number: sharedBoons}};
    if ( sharedBanes ) checkData.banes = {special: {label: "Special", number: sharedBanes}};
    const pool = skill
      ? actor.getSkillCheck(skill.id, checkData)
      : new this({...checkData, type: skillId, actorId: actor.id});

    const response = await pool.dialog({title});
    if ( response === null ) return null;

    await pool.evaluate();
    if ( showDSN ) await this.#showDiceSoNice(pool);
    return pool;
  }

  /* -------------------------------------------- */
  /*  Group Check Orchestration                   */
  /* -------------------------------------------- */

  /**
   * Submit a group check request: create the tracking chat card, dispatch queries to players,
   * and auto-roll for actors whose owners are not online.
   * @param {object} options
   * @param {CrucibleActor[]} options.requestedActors  The actors to include in the group check
   * @returns {Promise<void>}
   */
  async requestSubmit({requestedActors}={}) {
    if ( !requestedActors?.length ) return;

    const checkId = foundry.utils.randomID();
    const skillId = this.data.type;

    const actors = {};
    const unrequested = [];
    for ( const actor of requestedActors ) {
      const user = GroupCheck.#findUserForActor(actor);
      actors[actor.id] = {
        actorId: actor.id,
        actorName: actor.name,
        actorImg: actor.img,
        userId: user?.id || null,
        status: GroupCheck.#STATUSES.PENDING,
        rollData: null
      };
      if ( !user ) unrequested.push(actor.id);
    }

    /** @type {GroupCheckFlags} */
    const groupCheckFlags = {
      checkId,
      skillId,
      dc: this.data.dc,
      sharedBoons: this.data.totalBoons,
      sharedBanes: this.data.totalBanes,
      finalized: false,
      actors
    };

    const content = await this.#renderGroupCheckCard(groupCheckFlags);
    const message = await ChatMessage.implementation.create({
      content,
      whisper: game.users.filter(u => u.isGM).map(u => u.id),
      speaker: ChatMessage.implementation.getSpeaker({alias: _loc("DICE.GROUP_CHECK.Title")}),
      flags: {crucible: {[GroupCheck.FLAG_KEY]: groupCheckFlags }}
    });

    for ( const actorId of unrequested ) {
      await GroupCheck.#rollOnBehalfGroupCheck(message, actorId);
    }

    for ( const entry of Object.values(actors) ) {
      if ( !entry.userId ) continue;
      const user = game.users.get(entry.userId);
      if ( !user ) continue;
      GroupCheck.#dispatchGroupCheckQuery({
        message, checkId, entry, user, skillId,
        sharedBoons: groupCheckFlags.sharedBoons,
        sharedBanes: groupCheckFlags.sharedBanes
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Update a single actor's status in the group check ChatMessage flags and re-render.
   * @param {ChatMessage} message             The group check ChatMessage
   * @param {string} actorId                  The actor ID to update
   * @param {string} status                   The new status value
   * @param {object} [extra={}]               Additional data to merge into the actor entry
   * @param {object} [options={}]             Additional update guards
   * @param {string} [options.expectedStatus] Require the actor to currently have this status before updating
   * @returns {Promise<boolean>}              True if the update was applied
   */
  static async #markActorStatus(message, actorId, status, extra={}, {expectedStatus}={}) {
    return this.#updateGroupCheckMessage(message, flags => {
      if ( !flags.actors?.[actorId] ) return false;
      if ( expectedStatus && (flags.actors[actorId].status !== expectedStatus) ) return false;
      flags.actors[actorId] = foundry.utils.mergeObject(flags.actors[actorId], {status, ...extra});
    });
  }

  /* -------------------------------------------- */

  /**
   * Dispatch a single group check query to a player and handle the response.
   * @param {object} options                 Dispatch options
   * @param {ChatMessage} options.message    The group check ChatMessage
   * @param {string} options.checkId         The unique check ID
   * @param {GroupCheckActorEntry} options.entry The actor entry
   * @param {User} options.user              The target user
   * @param {string} options.skillId         The skill being checked
   * @param {number} options.sharedBoons     GM-assigned shared boons
   * @param {number} options.sharedBanes     GM-assigned shared banes
   * @returns {Promise<void>}
   */
  static async #dispatchGroupCheckQuery({message, checkId, entry, user, skillId, sharedBoons, sharedBanes}) {
    const skill = SYSTEM.SKILLS[skillId]?.label ?? skillId;
    const title = _loc("DICE.GROUP_CHECK.DialogTitle", {skill, name: entry.actorName});
    try {
      const rollData = await user.query("requestGroupCheck", {
        checkId,
        actorId: entry.actorId,
        skillId,
        sharedBoons,
        sharedBanes,
        title
      }, {timeout: this.QUERY_TIMEOUT});

      if ( rollData && !rollData.aborted ) {
        await this.#updateGroupCheckMessage(message, flags => {
          if ( flags.actors?.[entry.actorId]?.status !== this.#STATUSES.PENDING ) return false;
          rollData.data.dc = flags.dc;
          flags.actors[entry.actorId] = foundry.utils.mergeObject(flags.actors[entry.actorId], {
            status: this.#STATUSES.COMPLETE,
            rollData
          });
        });
      }
      else {
        await this.#markActorStatus(
          message, entry.actorId, this.#STATUSES.ABORTED, {}, {expectedStatus: this.#STATUSES.PENDING}
        );
      }
    }
    catch(err) {
      console.warn(`Group check query failed for ${entry.actorName}:`, err);
      await this.#markActorStatus(
        message, entry.actorId, this.#STATUSES.ABORTED, {}, {expectedStatus: this.#STATUSES.PENDING}
      );
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single actor entry from flags data into a template-ready object.
   * Derives row classes, display status data, outcome, and roll context.
   * @param {GroupCheckActorEntry} entry    The raw actor entry from flags
   * @param {boolean} [finalized=false]     Whether the group check has been finalized
   * @returns {GroupCheckActorTemplateData} The enriched entry for the Handlebars template
   */
  static #prepareActorTemplateData(entry, finalized=false) {
    let showRollResult = false;
    let statusDisplay = null;
    let rollContext = null;
    const statusTooltip = `DICE.GROUP_CHECK.STATUSES.${entry.status.titleCase()}`;

    switch ( entry.status ) {
      case GroupCheck.#STATUSES.COMPLETE:
        showRollResult = true;
        if ( entry.rollData ) {
          try {
            const roll = Roll.fromData(entry.rollData);
            rollContext = roll.prepareDiceResultContext({targetLabel: entry.actorName});
          }
          catch(err) {
            console.warn("Failed to reconstruct roll for group check actor:", err);
          }
        }
        break;

      case GroupCheck.#STATUSES.ABORTED:
        statusDisplay = {classes: "fa-solid fa-circle-xmark", tooltip: statusTooltip};
        break;

      case GroupCheck.#STATUSES.SKIPPED:
        statusDisplay = {classes: "fa-solid fa-forward", tooltip: statusTooltip};
        break;

      case GroupCheck.#STATUSES.PENDING:
        statusDisplay = {classes: "fa-solid fa-spinner fa-spin", tooltip: statusTooltip};
        break;
    }

    if ( finalized && !showRollResult ) statusDisplay = {classes: "tag", text: "-"};

    return {
      ...entry,
      showRollResult,
      statusDisplay,
      rollContext
    };
  }

  /* -------------------------------------------- */

  /**
   * Render the group check chat card HTML from the current flags state.
   * @param {GroupCheckFlags} flags     The group check flags data
   * @returns {Promise<string>}         The rendered HTML content
   */
  async #renderGroupCheckCard(flags) {
    const skill = SYSTEM.SKILLS[this.data.type]?.label ?? this.data.type;
    const title = _loc("DICE.GROUP_CHECK.ChatTitle", {skill, dc: this.data.dc});
    const actors = Object.values(flags.actors).map(entry => GroupCheck.#prepareActorTemplateData(entry, flags.finalized));
    const templateData = {title, actors};
    return foundry.applications.handlebars.renderTemplate(GroupCheck.#GROUP_CHECK_TEMPLATE, templateData);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /**
   * Handle a group check request dispatched via user.query("requestGroupCheck").
   * Opens a StandardCheck dialog for the player, evaluates the roll, shows DSN animation,
   * and returns the result without posting a chat message.
   * @param {object} [params={}]          The query payload
   * @param {string} params.checkId       Unique ID for this group check session
   * @param {string} params.actorId       The actor ID for whom the check is requested
   * @param {string} params.skillId       The skill being checked
   * @param {number} params.sharedBoons   GM-assigned shared boons
   * @param {number} params.sharedBanes   GM-assigned shared banes
   * @param {string} params.title         The dialog title
   * @returns {Promise<object>}
   */
  static async handle({checkId, actorId, skillId, sharedBoons, sharedBanes, title}={}) {
    const actor = game.actors.get(actorId);
    if ( !actor ) return {aborted: true};
    if ( !actor.testUserPermission(game.user, "OWNER") ) return {aborted: true};

    const pool = await this.#prepareAndRoll(actor, {skillId, sharedBoons, sharedBanes, title});
    if ( !pool ) return {aborted: true};
    return pool.toJSON();
  }

  /* -------------------------------------------- */
  /*  Chat Listeners and Handlers                 */
  /* -------------------------------------------- */

  /**
   * Serialize group check message updates so concurrent responses do not clobber each other.
   * @param {ChatMessage} message     The group check ChatMessage
   * @param {(flags: GroupCheckFlags, current: ChatMessage) => (false|void|object|Promise<false|void|object>)} mutator
   * Mutates the latest flags state and may return additional message update data, or false to skip updating.
   * @returns {Promise<boolean>}      True if an update was applied
   */
  static async #updateGroupCheckMessage(message, mutator) {
    return this.#UPDATE_SEMAPHORE.add(async () => {
      const current = game.messages.get(message.id) ?? message;
      const flags = foundry.utils.deepClone(current.flags.crucible?.[this.FLAG_KEY]);
      if ( !flags ) return false;

      const result = await mutator(flags, current);
      if ( result === false ) return false;

      const content = await this.#fromFlags(flags).#renderGroupCheckCard(flags);
      const updateData = foundry.utils.isPlainObject(result) ? result : {};
      await current.update({content, [`flags.crucible.${this.FLAG_KEY}`]: flags, ...updateData});
      return true;
    });
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners for group check chat card controls.
   * Binds resend, roll-on-behalf, skip, and finalize buttons to their respective handlers.
   * @param {ChatMessage} message             The chat message being rendered
   * @param {HTMLElement} html                The rendered HTML element
   * @param {GroupCheckFlags} groupCheckFlags The group check flags data
   */
  static onRenderGroupCheck(message, html, groupCheckFlags) {
    if ( !game.user.isGM || groupCheckFlags.finalized ) return;

    const makeButton = (icon, descriptionKey, handler, isIconButton=true) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("frame-brown");

      if ( isIconButton ) {
        btn.classList.add("icon", "fa-solid", icon);
        btn.dataset.tooltip = "";
        btn.ariaLabel = _loc(descriptionKey);
      }
      else {
        const iconElement = document.createElement("i");
        iconElement.classList.add("fa-solid", icon);
        btn.append(iconElement, ` ${_loc(descriptionKey)}`);
      }

      btn.addEventListener("click", handler);
      return btn;
    };

    for ( const row of html.querySelectorAll(".group-check-row.line-item") ) {
      const actorId = row.dataset.actorId;
      const entry = groupCheckFlags.actors?.[actorId];
      if ( !entry || (entry.status !== GroupCheck.#STATUSES.PENDING) ) continue;
      const controls = document.createElement("div");
      controls.classList.add("controls");
      controls.append(
        makeButton("fa-rotate-right", "DICE.GROUP_CHECK.Resend", () => this.#resendGroupCheckRequest(message, actorId)),
        makeButton("fa-dice", "DICE.GROUP_CHECK.RollOnBehalf", () => this.#rollOnBehalfGroupCheck(message, actorId)),
        makeButton("fa-forward", "DICE.GROUP_CHECK.Skip", () => this.#skipGroupCheckActor(message, actorId))
      );
      row.appendChild(controls);
    }

    const section = html.querySelector(".group-check-result");
    if ( section ) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("flexrow");
      wrapper.appendChild(
        makeButton("fa-check", "DICE.GROUP_CHECK.Finalize", () => this.#finalizeGroupCheck(message), false)
      );
      section.appendChild(wrapper);
    }
  }

  /* -------------------------------------------- */

  /**
   * Open a StandardCheck dialog for the GM to roll on behalf of a non-responding player.
   * @param {ChatMessage} message     The group check ChatMessage
   * @param {string} actorId          The actor ID to roll for
   * @returns {Promise<void>}
   */
  static async #rollOnBehalfGroupCheck(message, actorId) {
    const flags = message.flags.crucible?.[this.FLAG_KEY];
    if ( !flags ) return;
    const entry = flags.actors[actorId];
    if ( !entry ) return;

    const actor = game.actors.get(actorId);
    if ( !actor ) return;

    const skillId = flags.skillId;
    const skill = SYSTEM.SKILLS[skillId]?.label ?? skillId;
    const title = _loc("DICE.GROUP_CHECK.DialogTitle", {skill, name: actor.name});

    const rollData = await this.#prepareAndRoll(
      actor,
      {skillId, dc: flags.dc, sharedBoons: flags.sharedBoons, sharedBanes: flags.sharedBanes, title}
    );
    if ( !rollData ) return;

    rollData.data.dc = flags.dc;
    await this.#markActorStatus(message, actorId, this.#STATUSES.COMPLETE, {rollData}, {expectedStatus: entry.status});
  }

  /**
   * Skip (abort) an actor in a group check, marking them as skipped.
   * @param {ChatMessage} message     The group check ChatMessage
   * @param {string} actorId          The actor ID to skip
   * @returns {Promise<void>}
   */
  static async #skipGroupCheckActor(message, actorId) {
    const entry = message.flags.crucible?.[this.FLAG_KEY]?.actors?.[actorId];
    if ( !entry ) return;
    await this.#markActorStatus(message, actorId, this.#STATUSES.SKIPPED, {}, {expectedStatus: GroupCheck.#STATUSES.PENDING});
  }

  /**
   * Finalize a group check: remove whisper restriction to make the card public, and broadcast completion.
   * @param {ChatMessage} message     The group check ChatMessage
   * @returns {Promise<void>}
   */
  static async #finalizeGroupCheck(message) {
    await this.#updateGroupCheckMessage(message, flags => {
      flags.finalized = true;
      return {whisper: []};
    });
  }

  /**
   * Resend a group check request for a specific actor (e.g. on disconnect).
   * @param {ChatMessage} message     The group check ChatMessage
   * @param {string} actorId          The actor ID to resend to
   * @returns {Promise<void>}
   */
  static async #resendGroupCheckRequest(message, actorId) {
    const flags = message.flags.crucible?.[this.FLAG_KEY];
    if ( !flags ) return;
    const entry = flags.actors[actorId];
    if ( !entry ) return;

    const actor = game.actors.get(actorId);
    let user;
    if ( entry.userId ) user = game.users.get(entry.userId);
    if ( !user?.active ) user = this.#findUserForActor(actor);
    if ( !user ) {
      ui.notifications.warn("DICE.GROUP_CHECK.NoUserForActor", {localize: true, format: {name: entry.actorName}});
      return;
    }

    const updated = await this.#markActorStatus(
      message, actorId, this.#STATUSES.PENDING, {userId: user.id}, {expectedStatus: entry.status}
    );
    if ( !updated ) return;

    await this.#dispatchGroupCheckQuery({
      message,
      checkId: flags.checkId,
      entry: {...entry, userId: user.id},
      user,
      skillId: flags.skillId,
      sharedBoons: flags.sharedBoons,
      sharedBanes: flags.sharedBanes
    });
  }
}
