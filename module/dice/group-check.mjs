import StandardCheck from "./standard-check.mjs";

/**
 * @typedef {object} GroupCheckFlags
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
 * @property {GroupCheckActorResult|null} result      Computed result data
 */

/**
 * @typedef {object} GroupCheckActorResult
 * @property {number} total                          The roll total
 * @property {number} dc                             The DC checked against
 * @property {boolean} isSuccess                     Whether the roll exceeded DC
 * @property {boolean} isCriticalSuccess             Whether the roll critically succeeded
 * @property {boolean} isCriticalFailure             Whether the roll critically failed
 */

/**
 * Orchestrates group skill checks across multiple actors.
 * Creates a GM-whispered chat card that tracks individual roll statuses,
 * dispatches roll queries to players, and finalizes results.
 * @extends {StandardCheck}
 */
export default class GroupCheck extends StandardCheck {
  /**
 * The template path used to render group check chat cards.
 * @type {string}
 */
  static GROUP_CHECK_TEMPLATE = "systems/crucible/templates/dice/group-check-chat.hbs";

  /**
 * Configuration constants for group check behavior.
 * @type {object}
 */
  static CONFIG = Object.freeze({
    /** @enum {string} Possible status values for an actor in a group check */
    ACTOR_STATUS: Object.freeze({
      PENDING: "pending",
      COMPLETE: "complete",
      ABORTED: "aborted",
      SKIPPED: "skipped"
    }),
    /** @type {string} Key used for ChatMessage flags */
    FLAG_KEY: "groupCheck"
  });

  /* -------------------------------------------- */
  /*  Helpers                                      */
  /* -------------------------------------------- */

  /**
   * Get the localized label for a skill, falling back to the raw skill ID.
   * @param {string} skillId - The skill identifier
   * @returns {string} The localized skill label
   */
  static #getSkillLabel(skillId) {
    const skill = SYSTEM.SKILLS[skillId];
    return skill ? game.i18n.localize(skill.label) : skillId;
  }

  /* -------------------------------------------- */

  /**
   * Find the best active user to roll for a given actor.
   * Prefers users whose assigned character matches, then falls back to any owner.
   * @param {CrucibleActor} actor - The actor to find a user for
   * @param {User[]} [activeUsers] - Pre-filtered active non-self users (computed if omitted)
   * @returns {User|undefined} The matched user, or undefined if none found
   */
  static #findUserForActor(actor, activeUsers) {
    activeUsers ??= game.users.filter(u => u.active && !u.isSelf);
    let user = activeUsers.find(u => u.character === actor);
    user ||= activeUsers.find(u => actor.testUserPermission(u, "OWNER"));
    return user;
  }

  /* -------------------------------------------- */

  /**
   * Prepare a StandardCheck pool for an actor, present the dialog, evaluate, and build the result.
   * Optionally shows a Dice So Nice animation.
   * @param {CrucibleActor} actor - The actor performing the check
   * @param {object} options
   * @param {string} options.skillId - The skill being checked
   * @param {number} options.dc - The difficulty class
   * @param {number} [options.sharedBoons=0] - GM-assigned shared boons
   * @param {number} [options.sharedBanes=0] - GM-assigned shared banes
   * @param {string} [options.title] - The dialog title
   * @param {boolean} [options.showDSN=true] - Whether to show a Dice So Nice animation
   * @returns {Promise<{pool: StandardCheck, result: GroupCheckActorResult}|null>} The evaluated pool and result, or null if the dialog was cancelled
   */
  static async #prepareAndRoll(actor, {skillId, dc, sharedBoons=0, sharedBanes=0, title, showDSN=true}={}) {
    const skill = SYSTEM.SKILLS[skillId];
    const checkData = {dc};
    if ( sharedBoons ) checkData.boons = sharedBoons;
    if ( sharedBanes ) checkData.banes = sharedBanes;
    const pool = skill ? actor.getSkillCheck(skill.id, checkData) : new this({...checkData, type: skillId, actorId: actor.id});

    const response = await pool.dialog({title});
    if ( response === null ) return null;

    await pool.evaluate();
    if ( showDSN ) await pool.showDiceSoNice();

    /** @type {GroupCheckActorResult} */
    const result = {
      total: pool.total,
      dc,
      isSuccess: pool.isSuccess,
      isCriticalSuccess: pool.isCriticalSuccess,
      isCriticalFailure: pool.isCriticalFailure
    };
    return {pool, result};
  }

  /* -------------------------------------------- */
  /*  Group Check Orchestration                   */
  /* -------------------------------------------- */

  /**
   * Submit a group check request: create the tracking chat card, dispatch queries to players,
   * and auto-roll for actors whose owners are not online.
   * @param {object} options
   * @param {StandardCheck} options.roll             The configured StandardCheck roll (skill, DC, boons/banes)
   * @param {CrucibleActor[]} options.requestedActors  The actors to include in the group check
   * @returns {Promise<void>}
   */
  static async requestSubmit({ roll, requestedActors }) {
    if (!roll || !requestedActors || requestedActors.length === 0) return;

    const { ACTOR_STATUS, FLAG_KEY } = this.CONFIG;
    const activeUsers = game.users.filter(u => u.active && !u.isSelf);
    const checkId = foundry.utils.randomID();
    const skillId = roll.data.type;
    const dc = roll.data.dc;
    const skillLabel = this.#getSkillLabel(skillId);

    const actors = {};
    const unrequested = [];
    for (const actor of requestedActors) {
      const user = this.#findUserForActor(actor, activeUsers);
      actors[actor.id] = {
        actorId: actor.id,
        actorName: actor.name,
        actorImg: actor.img,
        userId: user?.id || null,
        status: ACTOR_STATUS.PENDING,
        rollData: null,
        result: null
      };
      if (!user) unrequested.push(actor.id);
    }

    /** @type {GroupCheckFlags} */
    const groupCheckFlags = {
      checkId,
      skillId,
      dc,
      sharedBoons: roll.data.totalBoons,
      sharedBanes: roll.data.totalBanes,
      finalized: false,
      actors
    };

    const content = await this.#renderGroupCheckCard(groupCheckFlags);

    const gmUserIds = game.users.filter(u => u.isGM).map(u => u.id);
    const message = await ChatMessage.create({
      content,
      whisper: gmUserIds,
      speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("DICE.GROUP_CHECK.Title") }),
      flags: { crucible: { [FLAG_KEY]: groupCheckFlags } }
    });

    for (const actorId of unrequested) {
      await this.#rollOnBehalfGroupCheck(message, actorId);
    }

    for (const entry of Object.values(actors)) {
      if (!entry.userId) continue;
      const user = game.users.get(entry.userId);
      if (!user) continue;
      this.#dispatchGroupCheckQuery({
        message, checkId, entry, user, skillId, dc, skillLabel,
        sharedBoons: groupCheckFlags.sharedBoons,
        sharedBanes: groupCheckFlags.sharedBanes
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Update a single actor's status in the group check ChatMessage flags and re-render.
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to update
   * @param {string} status - The new status value
   * @param {object} [extra={}] - Additional data to merge into the actor entry
   * @returns {Promise<void>}
   */
  static async #markActorStatus(message, actorId, status, extra = {}) {
    const { FLAG_KEY } = this.CONFIG;
    const flags = foundry.utils.deepClone(message.flags.crucible?.[FLAG_KEY]);
    if (!flags?.actors?.[actorId]) return;
    flags.actors[actorId] = foundry.utils.mergeObject(flags.actors[actorId], { status, ...extra });
    const content = await this.#renderGroupCheckCard(flags);
    await message.update({ content, [`flags.crucible.${FLAG_KEY}`]: flags });
  }

  /* -------------------------------------------- */

  /**
   * Dispatch a single group check query to a player and handle the response.
   * @param {object} options - Dispatch options
   * @param {ChatMessage} options.message - The group check ChatMessage
   * @param {string} options.checkId - The unique check ID
   * @param {GroupCheckActorEntry} options.entry - The actor entry
   * @param {User} options.user - The target user
   * @param {string} options.skillId - The skill being checked
   * @param {number} options.dc - The difficulty class
   * @param {string} options.skillLabel - The localized skill label
   * @param {number} options.sharedBoons - GM-assigned shared boons
   * @param {number} options.sharedBanes - GM-assigned shared banes
   * @returns {Promise<void>}
   */
  static async #dispatchGroupCheckQuery({ message, checkId, entry, user, skillId, dc, skillLabel, sharedBoons, sharedBanes }) {
    const { ACTOR_STATUS, FLAG_KEY } = this.CONFIG;
    const title = game.i18n.format("DICE.GROUP_CHECK.DialogTitle", { skill: skillLabel || this.#getSkillLabel(skillId), name: entry.actorName });
    try {
      const response = await user.query("requestGroupCheck", {
        checkId,
        actorId: entry.actorId,
        skillId,
        dc,
        sharedBoons,
        sharedBanes,
        title
      });

      if (response && !response.aborted) {
        const flags = foundry.utils.deepClone(message.flags.crucible?.[FLAG_KEY]);
        if (!flags) return;
        flags.actors[entry.actorId] = foundry.utils.mergeObject(flags.actors[entry.actorId], {
          status: ACTOR_STATUS.COMPLETE,
          rollData: response.rollData,
          result: response.result
        });
        const content = await this.#renderGroupCheckCard(flags);
        await message.update({ content, [`flags.crucible.${FLAG_KEY}`]: flags });
      }
      else {
        await this.#markActorStatus(message, entry.actorId, ACTOR_STATUS.ABORTED);
      }
    }
    catch (err) {
      console.warn(`Group check query failed for ${entry.actorName}:`, err);
      await this.#markActorStatus(message, entry.actorId, ACTOR_STATUS.ABORTED);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single actor entry from flags data into a template-ready object.
   * Derives status booleans, CSS classes, outcome/status labels, and roll context.
   * @param {GroupCheckActorEntry} entry - The raw actor entry from flags
   * @returns {object} The enriched entry for the Handlebars template
   */
  static #prepareActorTemplateData(entry) {
    const { ACTOR_STATUS } = this.CONFIG;
    const isComplete = entry.status === ACTOR_STATUS.COMPLETE;
    const isPending = entry.status === ACTOR_STATUS.PENDING;
    const isAborted = entry.status === ACTOR_STATUS.ABORTED;
    const isSkipped = entry.status === ACTOR_STATUS.SKIPPED;

    const cssClasses = [];
    if (isComplete && entry.result) {
      if (entry.result.isCriticalSuccess || entry.result.isCriticalFailure) cssClasses.push("critical");
      cssClasses.push(entry.result.isSuccess ? "success" : "failure");
    }
    if (isAborted) cssClasses.push("aborted");
    if (isSkipped) cssClasses.push("skipped");

    let outcomeLabel = "";
    if (isComplete && entry.result) {
      let key = "ACTION.EFFECT_RESULT_TYPES.";
      if (entry.result.isCriticalSuccess || entry.result.isCriticalFailure) key += "Critical";
      key += entry.result.isSuccess ? "Success" : "Failure";
      outcomeLabel = game.i18n.localize(key);
    }

    let statusLabel = "";
    if (isAborted) statusLabel = game.i18n.localize("DICE.GROUP_CHECK.StatusAborted");
    else if (isSkipped) statusLabel = game.i18n.localize("DICE.GROUP_CHECK.StatusSkipped");

    let rollContext = null;
    if (isComplete && entry.rollData) {
      try {
        const roll = Roll.fromData(entry.rollData);
        rollContext = {
          data: roll.data,
          pool: roll.dice.map(d => ({ denom: `d${d.faces}`, result: d.total })),
          diceTotal: roll.dice.reduce((t, d) => t + d.total, 0),
          ability: roll.data.ability ?? 0,
          skill: roll.data.skill ?? 0,
          enchantment: roll.data.enchantment ?? 0,
          hasDetails: (roll.data.totalBoons > 0) || (roll.data.totalBanes > 0)
        };
      }
      catch (err) {
        console.warn("Failed to reconstruct roll for group check actor:", err);
      }
    }

    return {
      ...entry,
      isComplete,
      isPending,
      isAborted,
      isSkipped,
      cssClass: cssClasses.join(" "),
      outcomeLabel,
      statusLabel,
      rollContext
    };
  }

  /* -------------------------------------------- */

  /**
   * Render the group check chat card HTML from the current flags state.
   * @param {GroupCheckFlags} flags - The group check flags data
   * @returns {Promise<string>} The rendered HTML content
   */
  static async #renderGroupCheckCard(flags) {
    const skillLabel = this.#getSkillLabel(flags.skillId);
    const title = game.i18n.format("DICE.GROUP_CHECK.ChatTitle", { skill: skillLabel, dc: flags.dc });
    const actors = Object.values(flags.actors).map(entry => this.#prepareActorTemplateData(entry));
    const templateData = { title, actors, finalized: flags.finalized };
    return foundry.applications.handlebars.renderTemplate(this.GROUP_CHECK_TEMPLATE, templateData);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /**
   * Handle a group check request dispatched via user.query("requestGroupCheck").
   * Opens a StandardCheck dialog for the player, evaluates the roll, shows DSN animation,
   * and returns the result without posting a chat message.
   * @param {object} [params={}] - The query payload
   * @param {string} params.checkId - Unique ID for this group check session
   * @param {string} params.actorId - The actor ID for whom the check is requested
   * @param {string} params.skillId - The skill being checked
   * @param {number} params.dc - The difficulty class
   * @param {number} params.sharedBoons - GM-assigned shared boons
   * @param {number} params.sharedBanes - GM-assigned shared banes
   * @param {string} params.title - The dialog title
   * @returns {Promise<{rollData: object, result: GroupCheckActorResult}|{aborted: boolean}>}
   */
  static async handle({checkId, actorId, skillId, dc, sharedBoons, sharedBanes, title}={}) {
    const actor = game.actors.get(actorId);
    if ( !actor ) return {aborted: true};
    if ( !actor.testUserPermission(game.user, "OWNER") ) return {aborted: true};

    const outcome = await this.#prepareAndRoll(actor, {skillId, dc, sharedBoons, sharedBanes, title});
    if ( !outcome ) return {aborted: true};
    return {rollData: outcome.pool.toJSON(), result: outcome.result};
  }

  /* -------------------------------------------- */
  /*  Chat Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Attach event listeners for group check chat card controls.
   * Binds resend, roll-on-behalf, skip, and finalize buttons to their respective handlers.
   * @param {ChatMessage} message - The chat message being rendered
   * @param {HTMLElement} html - The rendered HTML element
   * @param {GroupCheckFlags} groupCheckFlags - The group check flags data
   */
  static onRenderGroupCheck(message, html, groupCheckFlags) {
    const {ACTOR_STATUS} = this.CONFIG;

    if ( !game.user.isGM || groupCheckFlags.finalized ) return;

    const makeButton = (icon, tooltipKey, handler) => {
      const btn = foundry.utils.parseHTML(
        `<button type="button" class="icon frame-brown fa-solid ${icon}" data-tooltip="${game.i18n.localize(tooltipKey)}"></button>`
      );
      btn.addEventListener("click", async event => {
        event.preventDefault();
        await handler();
      });
      return btn;
    };

    for ( const row of html.querySelectorAll(".group-check-row.line-item") ) {
      const actorId = row.dataset.actorId;
      const entry = groupCheckFlags.actors?.[actorId];
      if ( !entry || entry.status === ACTOR_STATUS.COMPLETE || entry.status === ACTOR_STATUS.SKIPPED ) continue;
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
      const finalize = foundry.utils.parseHTML(`<button class="confirm frame-brown" type="button"><i class="fa-solid fa-check"></i> ${game.i18n.localize("DICE.GROUP_CHECK.Finalize")}</button>`);
      finalize.addEventListener("click", async event => {
        event.preventDefault();
        finalize.disabled = true;
        finalize.querySelector("i")?.classList.add("fa-spinner", "fa-spin");
        await this.#finalizeGroupCheck(message);
      });
      wrapper.appendChild(finalize);
      section.appendChild(wrapper);
    }
  }

  /* -------------------------------------------- */

  /**
   * Open a StandardCheck dialog for the GM to roll on behalf of a non-responding player.
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to roll for
   * @returns {Promise<void>}
   */
  static async #rollOnBehalfGroupCheck(message, actorId) {
    const {ACTOR_STATUS, FLAG_KEY} = this.CONFIG;
    const flags = message.flags.crucible?.[FLAG_KEY];
    if ( !flags ) return;
    const entry = flags.actors[actorId];
    if ( !entry ) return;

    const actor = game.actors.get(actorId);
    if ( !actor ) return;

    const skillLabel = this.#getSkillLabel(flags.skillId);
    const title = game.i18n.format("DICE.GROUP_CHECK.DialogTitle", {skill: skillLabel, name: actor.name});

    const outcome = await this.#prepareAndRoll(actor, {
      skillId: flags.skillId, dc: flags.dc,
      sharedBoons: flags.sharedBoons, sharedBanes: flags.sharedBanes, title
    });
    if ( !outcome ) return;

    await this.#markActorStatus(message, actorId, ACTOR_STATUS.COMPLETE, {
      rollData: outcome.pool.toJSON(),
      result: outcome.result
    });
  }

  /**
   * Skip (abort) an actor in a group check, marking them as skipped.
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to skip
   * @returns {Promise<void>}
   */
  static async #skipGroupCheckActor(message, actorId) {
    await this.#markActorStatus(message, actorId, this.CONFIG.ACTOR_STATUS.SKIPPED);
  }

  /**
   * Finalize a group check: remove whisper restriction to make the card public, and broadcast completion.
   * @param {ChatMessage} message - The group check ChatMessage
   * @returns {Promise<void>}
   */
  static async #finalizeGroupCheck(message) {
    const { FLAG_KEY } = this.CONFIG;
    const flags = foundry.utils.deepClone(message.flags.crucible?.[FLAG_KEY]);
    if (!flags) return;
    flags.finalized = true;
    const content = await this.#renderGroupCheckCard(flags);
    await message.update({ content, whisper: [], [`flags.crucible.${FLAG_KEY}`]: flags });
  }

  /**
   * Resend a group check request for a specific actor (e.g. on disconnect).
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to resend to
   * @returns {Promise<void>}
   */
  static async #resendGroupCheckRequest(message, actorId) {
    const {FLAG_KEY} = this.CONFIG;
    const flags = message.flags.crucible?.[FLAG_KEY];
    if ( !flags ) return;
    const entry = flags.actors[actorId];
    if ( !entry ) return;

    const actor = game.actors.get(actorId);
    let user;
    if ( entry.userId ) user = game.users.get(entry.userId);
    if ( !user?.active ) user = this.#findUserForActor(actor);
    if ( !user ) {
      ui.notifications.warn(game.i18n.format("DICE.GROUP_CHECK.NoUserForActor", {name: entry.actorName}));
      return;
    }

    await this.#markActorStatus(message, actorId, this.CONFIG.ACTOR_STATUS.PENDING, {userId: user.id});

    const skillLabel = this.#getSkillLabel(flags.skillId);
    this.#dispatchGroupCheckQuery({
      message,
      checkId: flags.checkId,
      entry: {...entry, userId: user.id},
      user,
      skillId: flags.skillId,
      dc: flags.dc,
      skillLabel,
      sharedBoons: flags.sharedBoons,
      sharedBanes: flags.sharedBanes
    });
  }
}