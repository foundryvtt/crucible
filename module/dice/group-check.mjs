import StandardCheck from "./standard-check.mjs";

/**
 * @typedef {object} GroupCheckSkillConfig
 * @property {number} dc                             Difficulty class for this skill
 */

/**
 * @typedef GroupCheckFlags
 * @property {string} checkId                        Unique group check ID
 * @property {Record<string, GroupCheckSkillConfig>} skills  Skill ID → config (DC per skill)
 * @property {number} sharedBoons                    GM-assigned shared boons
 * @property {number} sharedBanes                    GM-assigned shared banes
 * @property {string} [messageMode]                  The chat message visibility mode
 * @property {Record<string, GroupCheckActorEntry>} actors   Actor ID → entry
 */

/**
 * @typedef {object} GroupCheckActorEntry
 * @property {string} actorId                        The actor's ID
 * @property {string} actorName                      Display name (cached)
 * @property {string} actorImg                       Image path (cached)
 * @property {string|null} userId                    User ID responsible for rolling
 * @property {string} status                         Actor status enum value
 * @property {boolean} dispatched                    Whether a query has been dispatched to a user
 * @property {string|null} skillId                   The skill chosen by this actor
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
 * Creates a chat card that tracks individual roll statuses and dispatches roll queries to players.
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
  /*  API                                         */
  /* -------------------------------------------- */

  /**
   * Open the group check configuration dialog for the current GM.
   * This is the primary API entrypoint for initiating a group check.
   * @param {object} [options]                Options to pre-configure the dialog
   * @param {string} [options.skillId]        An initial skill to pre-select
   * @param {number} [options.dc=15]          The default difficulty class
   * @param {boolean} [options.party=false]    Pre-populate with all party members
   * @returns {Promise<void>}
   */
  static async configure({skillId, dc=15, party=false}={}) {
    if ( !game.user.isGM ) {
      ui.notifications.warn(_loc("DICE.GROUP_CHECK.RequiresGM"));
      return;
    }
    const data = {dc};
    if ( skillId ) data.type = skillId;
    const check = new this(data);
    const requestedActors = party ? Array.from(crucible.party?.system.actors ?? []) : [];
    await check.dialog({request: true, requestedActors});
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Recreate a GroupCheck instance from persisted flags for rendering updates.
   * @param {GroupCheckFlags} flags     The persisted group check state
   * @returns {GroupCheck}              A configured group check instance
   */
  static #fromFlags(flags) {
    const firstSkill = Object.keys(flags.skills)[0];
    const data = {type: firstSkill, dc: flags.skills[firstSkill].dc};
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
   * Prepare a StandardCheck roll for an actor, present the dialog, and evaluate it.
   * @param {CrucibleActor} actor The actor performing the check
   * @param {object} options
   * @param {string} options.skillId            The skill being checked (single-skill mode)
   * @param {Record<string, GroupCheckSkillConfig>} [options.skills]  Allowed skills (multi-skill mode)
   * @param {number} [options.dc=15]            The difficulty class for the check
   * @param {number} [options.sharedBoons=0]    GM-assigned shared boons
   * @param {number} [options.sharedBanes=0]    GM-assigned shared banes
   * @param {string} [options.title]            The dialog title
   * @param {boolean} [options.configurable=true]  Whether the dialog allows configuration
   * @returns {Promise<StandardCheck|null>}    The evaluated roll, or null if the dialog was cancelled
   */
  static async #prepareAndRoll(actor, {skillId, skills, dc=15, sharedBoons=0, sharedBanes=0, title, messageMode, configurable=true}={}) {

    // Resolve the initial skill from either single-skill or multi-skill mode
    if ( skills ) {
      const skillIds = Object.keys(skills);
      skillId ??= skillIds[0];
      dc = skills[skillId].dc;
    }

    const skill = SYSTEM.SKILLS[skillId];
    const checkData = {dc, boons: sharedBoons, banes: sharedBanes};
    const pool = skill
      ? actor.getSkillCheck(skill.id, checkData)
      : new this({...checkData, type: skillId, actorId: actor.id});

    const dialogOptions = {title, configurable, messageMode};
    if ( skills && (Object.keys(skills).length > 1) ) dialogOptions.skills = skills;
    const roll = await pool.dialog(dialogOptions);
    if ( roll === null ) return null;
    return roll.evaluate();
  }

  /* -------------------------------------------- */

  /**
   * Silently prepare and evaluate a roll for an actor without presenting a dialog.
   * For multi-skill checks, automatically selects the actor's highest-ranked skill.
   * @param {CrucibleActor} actor                                The actor performing the check
   * @param {Record<string, GroupCheckSkillConfig>} skills        The available skills with DCs
   * @param {number} [sharedBoons=0]                             GM-assigned shared boons
   * @param {number} [sharedBanes=0]                             GM-assigned shared banes
   * @returns {Promise<StandardCheck>}                           The evaluated roll
   */
  static async #silentRoll(actor, skills, {sharedBoons=0, sharedBanes=0}={}) {
    const skillId = this.#bestSkillForActor(actor, skills);
    const dc = skills[skillId].dc;
    const checkData = {dc, boons: sharedBoons, banes: sharedBanes};
    const pool = actor.getSkillCheck(skillId, checkData);
    await pool.evaluate();
    return pool;
  }

  /* -------------------------------------------- */

  /**
   * Determine the best skill for an actor from the available set based on passive score.
   * @param {CrucibleActor} actor                                The actor to evaluate
   * @param {Record<string, GroupCheckSkillConfig>} skills        The available skills
   * @returns {string}                                           The chosen skill ID
   */
  static #bestSkillForActor(actor, skills) {
    return Object.keys(skills)
      .map(id => ({id, passive: actor.system.skills[id]?.passive ?? 0}))
      .sort((a, b) => b.passive - a.passive)[0].id;
  }

  /* -------------------------------------------- */
  /*  Group Check Orchestration                   */
  /* -------------------------------------------- */

  /**
   * Submit a group check request: create the tracking chat card, dispatch queries to players,
   * and auto-roll for actors whose owners are not online.
   * @param {object} options
   * @param {Iterable<CrucibleActor>} options.requestedActors  The actors to include in the group check
   * @param {Record<string, GroupCheckSkillConfig>} [options.skills]  Skill configs. Defaults to single skill from roll data.
   * @param {boolean} [options.local=false]  If true, the GM rolls for all actors locally without dispatching queries.
   * @param {string} [options.messageMode]   The chat message visibility mode chosen by the GM.
   * @returns {Promise<void>}
   */
  async requestSubmit({requestedActors, skills, local=false, messageMode}={}) {
    if ( !requestedActors?.size && !requestedActors?.length ) return;

    // Default to single skill from the roll data
    skills ??= {[this.data.type]: {dc: this.data.dc}};

    const checkId = foundry.utils.randomID();
    const actors = {};
    const unrequested = [];
    for ( const actor of requestedActors ) {
      const user = local ? null : GroupCheck.#findUserForActor(actor);
      actors[actor.id] = {
        actorId: actor.id,
        actorName: actor.name,
        actorImg: actor.img,
        userId: user?.id || null,
        status: GroupCheck.#STATUSES.PENDING,
        dispatched: false,
        skillId: null
      };
      if ( !user ) unrequested.push(actor.id);
    }

    /** @type {GroupCheckFlags} */
    const groupCheckFlags = {
      checkId,
      skills,
      sharedBoons: this.data.totalBoons,
      sharedBanes: this.data.totalBanes,
      messageMode,
      actors
    };

    const content = await this.#renderGroupCheckCard(groupCheckFlags);
    const skillIds = Object.keys(skills);
    const flavor = (skillIds.length === 1)
      ? _loc("ACTION.SkillCheck", {skill: SYSTEM.SKILLS[skillIds[0]].label})
      : _loc("DICE.GROUP_CHECK.Title");
    const messageData = {
      content,
      flavor,
      speaker: ChatMessage.implementation.getSpeaker(),
      flags: {crucible: {[GroupCheck.FLAG_KEY]: groupCheckFlags }}
    };
    ChatMessage.implementation.applyMode(messageData, messageMode || game.settings.get("core", "messageMode"));
    const message = await ChatMessage.implementation.create(messageData);

    for ( const actorId of unrequested ) {
      if ( local ) await GroupCheck.#silentRollForActor(message, actorId, groupCheckFlags);
      else await GroupCheck.#rollOnBehalfGroupCheck(message, actorId);
    }

    for ( const entry of Object.values(actors) ) {
      if ( !entry.userId ) continue;
      const user = game.users.get(entry.userId);
      if ( !user ) continue;
      GroupCheck.#dispatchGroupCheckQuery({
        message, checkId, entry, user, skills, messageMode,
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
   * @param {Record<string, GroupCheckSkillConfig>} options.skills  The allowed skills with DCs
   * @param {number} options.sharedBoons     GM-assigned shared boons
   * @param {number} options.sharedBanes     GM-assigned shared banes
   * @returns {Promise<void>}
   */
  static async #dispatchGroupCheckQuery({message, checkId, entry, user, skills, sharedBoons, sharedBanes, messageMode}) {
    const skillIds = Object.keys(skills);
    const title = (skillIds.length === 1)
      ? _loc("DICE.GROUP_CHECK.DialogTitle", {skill: SYSTEM.SKILLS[skillIds[0]].label, name: entry.actorName})
      : `${_loc("ACTION.SkillCheckGeneric")}: ${entry.actorName}`;
    await this.#markActorStatus(message, entry.actorId, this.#STATUSES.PENDING, {dispatched: true});
    try {
      const rollData = await user.query("requestGroupCheck", {
        checkId,
        actorId: entry.actorId,
        skills,
        sharedBoons,
        sharedBanes,
        messageMode,
        title
      }, {timeout: this.QUERY_TIMEOUT});

      if ( rollData && !rollData.aborted ) {
        const chosenSkillId = rollData.data.type;
        rollData.data.dc = skills[chosenSkillId]?.dc;
        const roll = Roll.fromData(rollData);
        await this.#updateGroupCheckMessage(message, flags => {
          if ( flags.actors?.[entry.actorId]?.status !== this.#STATUSES.PENDING ) return false;
          flags.actors[entry.actorId] = foundry.utils.mergeObject(flags.actors[entry.actorId], {
            status: this.#STATUSES.COMPLETE,
            dispatched: false,
            skillId: chosenSkillId
          });
          return {rolls: [roll]};
        });
      }
      else {
        await this.#markActorStatus(
          message, entry.actorId, this.#STATUSES.ABORTED, {dispatched: false}, {expectedStatus: this.#STATUSES.PENDING}
        );
      }
    }
    catch(err) {
      console.warn(`Group check query failed for ${entry.actorName}:`, err);
      await this.#markActorStatus(
        message, entry.actorId, this.#STATUSES.ABORTED, {dispatched: false}, {expectedStatus: this.#STATUSES.PENDING}
      );
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single actor entry from flags data into a template-ready object.
   * Derives row classes, display status data, outcome, and roll context.
   * @param {GroupCheckActorEntry} entry    The raw actor entry from flags
   * @param {Roll[]} rolls                 The message's canonical rolls array
   * @returns {GroupCheckActorTemplateData} The enriched entry for the Handlebars template
   */
  static #prepareActorTemplateData(entry, rolls) {
    let showRollResult = false;
    let statusDisplay = null;
    let rollContext = null;
    const statusTooltip = `DICE.GROUP_CHECK.STATUSES.${entry.status.titleCase()}`;

    switch ( entry.status ) {
      case GroupCheck.#STATUSES.COMPLETE:
        showRollResult = true;
        const roll = rolls.findLast(r => r.data?.actorId === entry.actorId);
        if ( roll ) {
          const skill = entry.skillId ? SYSTEM.SKILLS[entry.skillId] : null;
          rollContext = roll.prepareDiceResultContext({targetLabel: skill?.label ?? ""});
        }
        break;

      case GroupCheck.#STATUSES.ABORTED:
        statusDisplay = {classes: "fa-solid fa-circle-xmark", tooltip: statusTooltip};
        break;

      case GroupCheck.#STATUSES.SKIPPED:
        statusDisplay = {classes: "fa-solid fa-forward", tooltip: statusTooltip};
        break;

      case GroupCheck.#STATUSES.PENDING:
        statusDisplay = entry.dispatched
          ? {classes: "fa-solid fa-spinner fa-spin", tooltip: statusTooltip}
          : {classes: "fa-solid fa-hourglass", tooltip: statusTooltip};
        break;
    }

    const skillLabel = entry.skillId ? SYSTEM.SKILLS[entry.skillId].label : null;
    return {
      ...entry,
      showRollResult,
      statusDisplay,
      rollContext,
      skillLabel
    };
  }

  /* -------------------------------------------- */

  /**
   * Render the group check chat card HTML from the current flags state.
   * @param {GroupCheckFlags} flags     The group check flags data
   * @param {Roll[]} [rolls=[]]         The message's canonical rolls array
   * @returns {Promise<string>}         The rendered HTML content
   */
  async #renderGroupCheckCard(flags, rolls=[]) {
    const actors = Object.values(flags.actors).map(entry => GroupCheck.#prepareActorTemplateData(entry, rolls));
    return foundry.applications.handlebars.renderTemplate(GroupCheck.#GROUP_CHECK_TEMPLATE, {actors});
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /**
   * Handle a group check request dispatched via user.query("requestGroupCheck").
   * Opens a StandardCheck dialog for the player, evaluates the roll, and returns the serialized result.
   * The GM appends the roll to the ChatMessage#rolls array, which triggers Dice So Nice automatically.
   * @param {object} [params={}]          The query payload
   * @param {string} params.checkId       Unique ID for this group check session
   * @param {string} params.actorId       The actor ID for whom the check is requested
   * @param {Record<string, GroupCheckSkillConfig>} params.skills  Allowed skills with DCs
   * @param {number} params.sharedBoons   GM-assigned shared boons
   * @param {number} params.sharedBanes   GM-assigned shared banes
   * @param {string} [params.messageMode] The chat message visibility mode
   * @param {string} params.title         The dialog title
   * @returns {Promise<object>}
   */
  static async handle({checkId, actorId, skills, sharedBoons, sharedBanes, messageMode, title}={}) {
    const actor = game.actors.get(actorId);
    if ( !actor ) return {aborted: true};
    if ( !actor.testUserPermission(game.user, "OWNER") ) return {aborted: true};
    const pool = await this.#prepareAndRoll(actor, {skills, sharedBoons, sharedBanes, messageMode, title, configurable: false});
    if ( !pool ) return {aborted: true};
    return pool.toJSON();
  }

  /* -------------------------------------------- */
  /*  Chat Listeners and Handlers                 */
  /* -------------------------------------------- */

  /**
   * Serialize group check message updates so concurrent responses are handled in sequence.
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
      const updateData = foundry.utils.isPlainObject(result) ? result : {};
      const newRolls = updateData.rolls ?? [];
      const allRolls = [...current.rolls, ...newRolls];
      const content = await this.#fromFlags(flags).#renderGroupCheckCard(flags, allRolls);
      if ( newRolls.length ) {
        const existingRolls = current.rolls.map(r => JSON.stringify(r.toJSON()));
        updateData.rolls = [...existingRolls, ...newRolls.map(r => JSON.stringify(r.toJSON()))];
      }
      // FIXME: When rolls are appended in the same update as content, Dice So Nice hides the new
      // .dice-roll elements during animation, causing the completed actor row to appear collapsed
      // until animation finishes. A DSN update option to suppress content hiding would resolve this.
      await current.update({content, [`flags.crucible.${this.FLAG_KEY}`]: flags, ...updateData});
      return true;
    });
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners for group check chat card controls.
   * Binds resend, roll-on-behalf, skip, and reset buttons to their respective handlers.
   * @param {ChatMessage} message             The chat message being rendered
   * @param {HTMLElement} html                The rendered HTML element
   * @param {GroupCheckFlags} groupCheckFlags The group check flags data
   */
  static onRenderGroupCheck(message, html, groupCheckFlags) {

    // For non-GM users, hide individual roll results until all actors are resolved
    if ( !game.user.isGM ) {
      const allResolved = Object.values(groupCheckFlags.actors).every(
        e => (e.status === this.#STATUSES.COMPLETE) || (e.status === this.#STATUSES.SKIPPED)
      );
      const section = html.querySelector(".group-check-result");
      if ( section ) section.classList.toggle("unresolved", !allResolved);
      return;
    }

    // For GM users, append DC values to roll result target labels
    for ( const row of html.querySelectorAll(".group-check-row") ) {
      const actorId = row.dataset.actorId;
      const roll = message.rolls.findLast(r => r.data?.actorId === actorId);
      if ( !roll?.data?.dc ) continue;
      const target = row.querySelector(".dice-result .target");
      if ( target ) target.textContent += ` ${roll.data.dc}`;
    }

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
      if ( !entry ) continue;
      const controls = row.querySelector(".controls");
      if ( !controls ) continue;

      // Pending actors: append resend, roll-on-behalf, and skip controls
      if ( entry.status === GroupCheck.#STATUSES.PENDING ) {
        controls.append(
          makeButton("fa-rotate-right", "DICE.GROUP_CHECK.Resend", () => this.#resendGroupCheckRequest(message, actorId)),
          makeButton("fa-dice", "DICE.GROUP_CHECK.RollOnBehalf", () => this.#rollOnBehalfGroupCheck(message, actorId)),
          makeButton("fa-forward", "DICE.GROUP_CHECK.Skip", () => this.#skipGroupCheckActor(message, actorId))
        );
      }

      // Aborted or skipped actors: make the status indicator clickable to reset to pending
      else if ( (entry.status === GroupCheck.#STATUSES.ABORTED) || (entry.status === GroupCheck.#STATUSES.SKIPPED) ) {
        const statusEl = controls.querySelector("i");
        if ( statusEl ) {
          statusEl.style.cursor = "pointer";
          statusEl.dataset.tooltip = _loc("DICE.GROUP_CHECK.ResetPending");
          statusEl.addEventListener("click", () => this.#resetActorStatus(message, actorId));
        }
      }
    }

  }

  /* -------------------------------------------- */

  /**
   * Silently evaluate a roll for an actor and update the group check message.
   * Used for the local batch roll path (GM clicks Roll).
   * @param {ChatMessage} message             The group check ChatMessage
   * @param {string} actorId                  The actor ID to roll for
   * @param {GroupCheckFlags} flags            The current group check flags
   * @returns {Promise<void>}
   */
  static async #silentRollForActor(message, actorId, flags) {
    const actor = game.actors.get(actorId);
    if ( !actor ) return;
    const {skills} = flags;
    const roll = await this.#silentRoll(actor, skills, {
      sharedBoons: flags.sharedBoons, sharedBanes: flags.sharedBanes
    });
    const chosenSkillId = roll.data.type;
    roll.data.dc = skills[chosenSkillId].dc;
    await this.#updateGroupCheckMessage(message, gcFlags => {
      gcFlags.actors[actorId] = foundry.utils.mergeObject(gcFlags.actors[actorId], {
        status: this.#STATUSES.COMPLETE,
        skillId: chosenSkillId
      });
      return {rolls: [roll]};
    });
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

    const {skills} = flags;
    const skillIds = Object.keys(skills);
    const title = (skillIds.length === 1)
      ? _loc("DICE.GROUP_CHECK.DialogTitle", {skill: SYSTEM.SKILLS[skillIds[0]].label, name: actor.name})
      : `${_loc("ACTION.SkillCheckGeneric")}: ${actor.name}`;

    const roll = await this.#prepareAndRoll(
      actor,
      {skills, sharedBoons: flags.sharedBoons, sharedBanes: flags.sharedBanes, title, configurable: false}
    );
    if ( !roll ) return;

    const chosenSkillId = roll.data.type;
    roll.data.dc = skills[chosenSkillId].dc;
    await this.#updateGroupCheckMessage(message, gcFlags => {
      if ( entry.status && (gcFlags.actors[actorId]?.status !== entry.status) ) return false;
      gcFlags.actors[actorId] = foundry.utils.mergeObject(gcFlags.actors[actorId], {
        status: this.#STATUSES.COMPLETE,
        skillId: chosenSkillId
      });
      return {rolls: [roll]};
    });
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
   * Reset an aborted or skipped actor back to pending so the roll can be retried.
   * @param {ChatMessage} message     The group check ChatMessage
   * @param {string} actorId          The actor ID to reset
   * @returns {Promise<void>}
   */
  static async #resetActorStatus(message, actorId) {
    const entry = message.flags.crucible?.[this.FLAG_KEY]?.actors?.[actorId];
    if ( !entry ) return;
    const resettable = [this.#STATUSES.ABORTED, this.#STATUSES.SKIPPED];
    if ( !resettable.includes(entry.status) ) return;
    await this.#markActorStatus(message, actorId, this.#STATUSES.PENDING, {dispatched: false, skillId: null});
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
      skills: flags.skills,
      sharedBoons: flags.sharedBoons,
      sharedBanes: flags.sharedBanes,
      messageMode: flags.messageMode
    });
  }
}
