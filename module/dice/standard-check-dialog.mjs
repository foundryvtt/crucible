const {DialogV2} = foundry.applications.api;

/**
 * @typedef {object} GroupCheckFlags
 * @property {string} checkId                        Unique group check ID
 * @property {string} skillId                        The skill being checked
 * @property {number} dc                             Difficulty class
 * @property {number} sharedBoons                    GM-assigned shared boons
 * @property {number} sharedBanes                    GM-assigned shared banes
 * @property {boolean} finalized                     Whether the GM has finalized results
 * @property {Object<string, GroupCheckActorEntry>} actors   Actor ID → entry
 */

/**
 * @typedef {object} GroupCheckActorEntry
 * @property {string} actorId                        The actor's ID
 * @property {string} actorName                      Display name (cached)
 * @property {string} actorImg                       Image path (cached)
 * @property {string} userId                         User ID responsible for rolling
 * @property {string} status                         Actor status enum value
 * @property {object|null} rollData                  Serialized StandardCheck data (after completion)
 * @property {GroupCheckActorResult|null} result     Computed result data
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
 * Prompt the user to perform a Standard Check.
 * @extends {DialogV2}
 */
export default class StandardCheckDialog extends DialogV2 {
  constructor({request=false, requestActors=[], roll, rollMode, ...options}={}) {
    super(options);
    this.request = request && game.user.isGM;
    this.roll = roll;
    this.rollMode = rollMode;
    if ( this.roll.actor ) this.#requestActors.add(this.roll.actor);
    for ( const actor of requestActors ) this.#requestActors.add(actor);
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "dialog", "dice-roll", "themed", "theme-dark"],
    window: {
      contentTag: "form",
      contentClasses: ["standard-check", "standard-form"]
    },
    actions: {
      requestToggle: StandardCheckDialog.#onRequestToggle,
      requestClear: StandardCheckDialog.#onRequestClear,
      requestParty: StandardCheckDialog.#onRequestParty,
      requestRemove: StandardCheckDialog.#onRequestRemove,
      rollMode: StandardCheckDialog.#onChangeRollMode,
      requestSubmit: StandardCheckDialog.#requestSubmit
    },
    position: {
      width: "auto",
      height: "auto"
    }
  };

  /**
   * The template path used to render the Dialog.
   * @type {string}
   */
  static TEMPLATE = "systems/crucible/templates/dice/standard-check-dialog.hbs";

  /**
   * The template path used to render group check chat cards.
   * @type {string}
   */
  static GROUP_CHECK_TEMPLATE = "systems/crucible/templates/chat/group-check-result.hbs";

  /**
   * Configuration constants for group check behavior.
   * @type {object}
   */
  static GROUP_CHECK = Object.freeze({
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

  /**
   * Display the dialog in request mode.
   * @type {boolean}
   */
  request;

  /**
   * The actors who will be requested to roll.
   * @type {Set<CrucibleActor>}
   */
  #requestActors = new Set();

  /**
   * A StandardCheck dice pool instance which organizes the data for this dialog
   * @type {StandardCheck}
   */
  roll;

  /**
   * The selected roll mode for this particular roll.
   * @type {string}
   */
  rollMode;

  /** @override */
  get title() {
    if ( this.options.window.title ) return this.options.window.title;
    const type = this.roll.data.type;
    const skill = SYSTEM.SKILLS[type];
    let label = skill ? game.i18n.format("ACTION.SkillCheck", {skill: skill.label}) : game.i18n.localize("ACTION.StandardCheck");
    const actor = this.#requestActors.first();
    if ( actor && (this.#requestActors.size === 1) ) label += `: ${actor.name}`;
    else if ( this.request ) label = game.i18n.format("ACTION.RequestRollsSuffix", {label});
    return label;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    delete options.position?.width; // Ignore default dialog width
    options = super._initializeApplicationOptions(options);
    options.buttons = {
      roll: {action: "roll", label: game.i18n.localize("DICE.Roll"), icon: "fa-solid fa-dice-d8", callback: this._onRoll.bind(this)}
    };
    return options;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preFirstRender(context, options) {
    await foundry.applications.handlebars.getTemplate(this.constructor.TEMPLATE);
    await super._preFirstRender(context, options);
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const data = this.roll.data;
    const rollMode = this.rollMode || game.settings.get("core", "rollMode");
    return Object.assign({}, data, {
      buttons: this.#prepareButtons(),
      dice: this.roll.dice.map(d => `d${d.faces}`),
      difficulty: this._getDifficulty(data.dc),
      difficulties: Object.entries(SYSTEM.DICE.checkDifficulties).map(d => ({dc: d[0], label: `${game.i18n.localize(d[1])} (DC ${d[0]})`})),
      isGM: game.user.isGM,
      request: this.#prepareRequest(),
      rollModes: Object.entries(CONFIG.Dice.rollModes).map(([action, { label, icon }]) => {
        return {icon, label, action, active: action === rollMode};
      }),
      showDetails: data.totalBoons + data.totalBanes > 0,
      canIncreaseBoons: data.totalBoons < SYSTEM.DICE.MAX_BOONS,
      canDecreaseBoons: data.totalBoons > 0,
      canIncreaseBanes: data.totalBanes < SYSTEM.DICE.MAX_BOONS,
      canDecreaseBanes: data.totalBanes > 0
    });
  }

  /* -------------------------------------------- */

  #prepareButtons() {
    const buttons = [];
    for ( const b of Object.values(this.options.buttons) ) buttons.push({type: "submit", ...b});
    if ( this.request ) buttons.push(
      {type: "button", action: "requestSubmit", icon: "fa-solid fa-dice-d8", label: game.i18n.localize("DICE.REQUESTS.Request")},
      {type: "button", action: "requestClear", cssClass: "icon fa-solid fa-ban", tooltip: game.i18n.localize("DICE.REQUESTS.ClearRequest")},
      {type: "button", action: "requestParty", cssClass: "icon fa-solid fa-users", tooltip: game.i18n.localize("DICE.REQUESTS.AddParty")}
    );
    else buttons.push({type: "button", action: "requestToggle", cssClass: "icon fa-solid fa-chevrons-right", tooltip: game.i18n.localize("DICE.REQUESTS.RequestRolls")});
    return buttons;
  }

  /* -------------------------------------------- */

  #prepareRequest() {
    if ( !this.request ) return null;
    const actors = [];
    for ( const actor of this.#requestActors ) {
      actors.push({id: actor.id, name: actor.name, img: actor.img, tags: actor.getTags("short")});
    }
    return {actors};
  }

  /* -------------------------------------------- */

  /** @override */
  async _renderHTML(context, _options) {
    return foundry.applications.handlebars.renderTemplate(this.constructor.TEMPLATE, context);
  }

  /* -------------------------------------------- */

  /** @override */
  _replaceHTML(result, content, _options) {
    content.innerHTML = result;
  }

  /* -------------------------------------------- */

  /**
   * Get the text label for a roll DC.
   * @param {number} dc    The difficulty check for the test
   * @returns {{dc: number, label: string, tier: number}}
   * @private
   */
  _getDifficulty(dc) {
    let label = "";
    let tier = 0;
    for ( const [d, l] of Object.entries(SYSTEM.DICE.checkDifficulties) ) {
      if ( dc >= d ) {
        tier = d;
        label = `${l} (DC ${d})`;
      }
      else break;
    }
    return {dc, label, tier};
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(_context, _options) {
    const form = this.element.querySelector("form.window-content");
    form.addEventListener("submit", event => this._onSubmit(event.submitter, event));
    form.classList.toggle("roll-request", this.request);
    if ( this.request ) {
      const dropZone = this.element.querySelector(".requested-actors");
      dropZone?.addEventListener("drop", this.#onDropActor.bind(this));
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Resolve dialog submission to enact a Roll.
   * @param {Event} _event
   * @param {HTMLButtonElement} _button
   * @param {Dialog} _dialog
   * @returns {StandardCheck}
   * @protected
   */
  _onRoll(_event, _button, _dialog) {
    this.roll.data.rollMode = this.rollMode;
    return this.roll;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    // Difficulty Tier
    if ( event.target.name === "difficultyTier" ) {
      const dc = Number(event.target.value) || null;
      if ( Number.isNumeric(dc) ) {
        event.target.parentElement.querySelector("input[name=\"dc\"]").value = dc;
        this.roll.data.dc = dc;
      }
    }

    // Difficulty Class
    else if ( event.target.name === "dc" ) {
      event.target.parentElement.querySelector("select[name=\"difficultyTier\"]").value = "";
      this.roll.data.dc = event.target.valueAsNumber;
    }
    super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /** @override */
  _onClickAction(event, target) {
    const action = target.dataset.action;
    const rollData = this.roll.data;
    switch ( action ) {
      case "boon-add":
        this.roll.initialize({boons: StandardCheckDialog.#modifyBoons(rollData.boons, 1)});
        return this.render(false, {height: "auto"});
      case "boon-subtract":
        this.roll.initialize({boons: StandardCheckDialog.#modifyBoons(rollData.boons, -1)});
        return this.render(false, {height: "auto"});
      case "bane-add":
        this.roll.initialize({banes: StandardCheckDialog.#modifyBoons(rollData.banes, 1)});
        return this.render(false, {height: "auto"});
      case "bane-subtract":
        this.roll.initialize({banes: StandardCheckDialog.#modifyBoons(rollData.banes, -1)});
        return this.render(false, {height: "auto"});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the boons or banes object by changing the number of "special" boons applied to the roll.
   * @param {Record<string, DiceBoon>} boons    The initial configuration of boons
   * @param {number} delta                      The requested delta change in special boons
   * @returns {Record<string, DiceBoon>}        The updated boons object
   */
  static #modifyBoons(boons, delta) {
    boons.special ||= {label: "Special", number: 0};
    const total = Object.values(boons).reduce((t, b) => t + (b.id === "special" ? 0 : b.number), 0);
    boons.special.number = Math.clamp(boons.special.number + delta, 0, SYSTEM.DICE.MAX_BOONS - total);
    return boons;
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to the difficulty tier select input
   * TODO support this
   * @param {Event} event           The event which triggers on select change
   * @private
   */
  _onChangeDifficultyTier(event) {
    event.preventDefault();
    event.stopPropagation();
    this._updatePool({dc: parseInt(event.target.value)});
    return this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle updating the StandardCheck dice pool
   * @param {HTMLFormElement} form    The updated form HTML
   * @param {object} updates          Additional data updates
   * @private
   */
  _updatePool(form, updates={}) {
    const fd = new FormDataExtended(form);
    updates = foundry.utils.mergeObject(fd.object, updates);
    this.roll.initialize(updates);
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping an Actor in the roll request drop-zone.
   * @param {DragEvent} event
   * @returns {Promise<void>}
   */
  async #onDropActor(event) {
    const data = CONFIG.ux.TextEditor.getDragEventData(event);
    if ( data.type !== "Actor" ) return;
    const actor = await fromUuid(data.uuid);
    if ( actor.pack ) return;
    const toAdd = actor.type === "group" ? actor.system.members.map(m => m.actor) : [actor];
    for ( const actor of toAdd ) {
      if ( actor.pack ) continue;
      this.#requestActors.add(actor);
    }
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  static async #onRequestToggle(event) {
    this.request = game.user.isGM;
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  static async #onRequestClear(event) {
    this.#requestActors.clear();
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  static async #onRequestParty(event) {
    if ( !crucible.party ) return;
    for ( const member of crucible.party.system.members ) {
      if ( member.actor ) this.#requestActors.add(member.actor);
    }
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  static async #onRequestRemove(_event, target) {
    const actorId = target.closest(".line-item").dataset.actorId;
    const actor = game.actors.get(actorId);
    this.#requestActors.delete(actor);
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks to request rolls made by other players.
   * Creates a GM-whispered ChatMessage with the group check state, then dispatches user.query() per actor.
   * Results stream back asynchronously and update the ChatMessage flags, triggering re-renders.
   * @param {Event} _event
   * @param {HTMLElement} _target
   * @this {StandardCheckDialog}
   */
  static async #requestSubmit(_event, _target) {
    const {ACTOR_STATUS, FLAG_KEY} = StandardCheckDialog.GROUP_CHECK;
    const activeUsers = game.users.filter(u => u.active && !u.isSelf);
    const checkId = foundry.utils.randomID();
    const skillId = this.roll.data.type;
    const skill = SYSTEM.SKILLS[skillId];
    const dc = this.roll.data.dc;
    const skillLabel = skill ? game.i18n.localize(skill.label) : game.i18n.localize("ACTION.StandardCheck");

    const actors = {};
    const unrequested = [];
    for ( const actor of this.#requestActors ) {
      let user = activeUsers.find(u => u.character === actor);
      user ||= activeUsers.find(u => actor.testUserPermission(u, "OWNER"));
      actors[actor.id] = {
        actorId: actor.id,
        actorName: actor.name,
        actorImg: actor.img,
        userId: user?.id || null,
        status: ACTOR_STATUS.PENDING,
        rollData: null,
        result: null
      };
      if ( !user ) unrequested.push(actor.id);
    }

    /** @type {GroupCheckFlags} */
    const groupCheckFlags = {
      checkId,
      skillId,
      dc,
      sharedBoons: this.roll.data.totalBoons,
      sharedBanes: this.roll.data.totalBanes,
      finalized: false,
      actors
    };

    const content = await StandardCheckDialog.#renderGroupCheckCard(groupCheckFlags);

    const gmUserIds = game.users.filter(u => u.isGM).map(u => u.id);
    const message = await ChatMessage.create({
      content,
      whisper: gmUserIds,
      speaker: ChatMessage.getSpeaker({alias: game.i18n.localize("DICE.GROUP_CHECK.Title")}),
      flags: {crucible: {[FLAG_KEY]: groupCheckFlags}}
    });

    for ( const actorId of unrequested ) {
      await StandardCheckDialog.rollOnBehalfGroupCheck(message, actorId);
    }

    await this.close();

    for ( const entry of Object.values(actors) ) {
      if ( !entry.userId ) continue;
      const user = game.users.get(entry.userId);
      if ( !user ) continue;
      StandardCheckDialog.#dispatchGroupCheckQuery({
        message, checkId, entry, user, skillId, dc, skillLabel,
        sharedBoons: groupCheckFlags.sharedBoons,
        sharedBanes: groupCheckFlags.sharedBanes
      });
    }
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
   */
  static async #dispatchGroupCheckQuery({message, checkId, entry, user, skillId, dc, skillLabel, sharedBoons, sharedBanes}) {
    const {ACTOR_STATUS, FLAG_KEY} = StandardCheckDialog.GROUP_CHECK;
    const title = game.i18n.format("DICE.GROUP_CHECK.ChatTitle", {skill: skillLabel, dc});
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

      if ( response && !response.aborted ) {
        const flags = foundry.utils.deepClone(message.flags.crucible?.[FLAG_KEY]);
        if ( !flags ) return;
        flags.actors[entry.actorId] = foundry.utils.mergeObject(flags.actors[entry.actorId], {
          status: ACTOR_STATUS.COMPLETE,
          rollData: response.rollData,
          result: response.result
        });
        const content = await StandardCheckDialog.#renderGroupCheckCard(flags);
        await message.update({content, [`flags.crucible.${FLAG_KEY}`]: flags});
      }
      else {
        await StandardCheckDialog.#markActorStatus(message, entry.actorId, ACTOR_STATUS.ABORTED);
      }
    }
    catch (err) {
      console.warn(`Group check query failed for ${entry.actorName}:`, err);
      await StandardCheckDialog.#markActorStatus(message, entry.actorId, ACTOR_STATUS.ABORTED);
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
  static async #markActorStatus(message, actorId, status, extra={}) {
    const {FLAG_KEY} = StandardCheckDialog.GROUP_CHECK;
    const flags = foundry.utils.deepClone(message.flags.crucible?.[FLAG_KEY]);
    if ( !flags?.actors?.[actorId] ) return;
    flags.actors[actorId] = foundry.utils.mergeObject(flags.actors[actorId], {status, ...extra});
    const content = await StandardCheckDialog.#renderGroupCheckCard(flags);
    await message.update({content, [`flags.crucible.${FLAG_KEY}`]: flags});
  }

  /* -------------------------------------------- */

  /**
   * Render the group check chat card HTML from the current flags state.
   * @param {GroupCheckFlags} flags - The group check flags data
   * @returns {Promise<string>} The rendered HTML content
   */
  static async #renderGroupCheckCard(flags) {
    const {ACTOR_STATUS} = StandardCheckDialog.GROUP_CHECK;
    const skill = SYSTEM.SKILLS[flags.skillId];
    const skillLabel = skill ? game.i18n.localize(skill.label) : flags.skillId;
    const title = game.i18n.format("DICE.GROUP_CHECK.ChatTitle", {skill: skillLabel, dc: flags.dc});

    const actors = Object.values(flags.actors).map(entry => {
      const isComplete = entry.status === ACTOR_STATUS.COMPLETE;
      const isPending = entry.status === ACTOR_STATUS.PENDING;
      const isAborted = entry.status === ACTOR_STATUS.ABORTED;
      const isSkipped = entry.status === ACTOR_STATUS.SKIPPED;

      const cssClasses = [];
      if ( isComplete && entry.result ) {
        if ( entry.result.isCriticalSuccess || entry.result.isCriticalFailure ) cssClasses.push("critical");
        cssClasses.push(entry.result.isSuccess ? "success" : "failure");
      }
      if ( isAborted ) cssClasses.push("aborted");
      if ( isSkipped ) cssClasses.push("skipped");

      let outcomeLabel = "";
      if ( isComplete && entry.result ) {
        let key = "ACTION.EFFECT_RESULT_TYPES.";
        if ( entry.result.isCriticalSuccess || entry.result.isCriticalFailure ) key += "Critical";
        key += entry.result.isSuccess ? "Success" : "Failure";
        outcomeLabel = game.i18n.localize(key);
      }

      let statusLabel = "";
      if ( isAborted ) statusLabel = game.i18n.localize("DICE.GROUP_CHECK.StatusAborted");
      else if ( isSkipped ) statusLabel = game.i18n.localize("DICE.GROUP_CHECK.StatusSkipped");

      let rollContext = null;
      if ( isComplete && entry.rollData ) {
        try {
          const roll = Roll.fromData(entry.rollData);
          rollContext = {
            data: roll.data,
            pool: roll.dice.map(d => ({denom: `d${d.faces}`, result: d.total})),
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
    });

    const templateData = {title, actors, finalized: flags.finalized};
    await foundry.applications.handlebars.getTemplate(StandardCheckDialog.GROUP_CHECK_TEMPLATE);
    return foundry.applications.handlebars.renderTemplate(StandardCheckDialog.GROUP_CHECK_TEMPLATE, templateData);
  }

  /* -------------------------------------------- */

  /**
   * Finalize a group check: remove whisper restriction to make the card public, and broadcast completion.
   * @param {ChatMessage} message - The group check ChatMessage
   * @returns {Promise<void>}
   */
  static async finalizeGroupCheck(message) {
    const {FLAG_KEY} = StandardCheckDialog.GROUP_CHECK;
    const flags = foundry.utils.deepClone(message.flags.crucible?.[FLAG_KEY]);
    if ( !flags ) return;
    flags.finalized = true;
    const content = await StandardCheckDialog.#renderGroupCheckCard(flags);
    await message.update({content, whisper: [], [`flags.crucible.${FLAG_KEY}`]: flags});
  }

  /* -------------------------------------------- */

  /**
   * Resend a group check request for a specific actor.
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to resend to
   * @returns {Promise<void>}
   */
  static async resendGroupCheckRequest(message, actorId) {
    const {FLAG_KEY} = StandardCheckDialog.GROUP_CHECK;
    const flags = message.flags.crucible?.[FLAG_KEY];
    if ( !flags ) return;
    const entry = flags.actors[actorId];
    if ( !entry ) return;

    const activeUsers = game.users.filter(u => u.active && !u.isSelf);
    const actor = game.actors.get(actorId);
    let user;
    if ( entry.userId ) user = game.users.get(entry.userId);
    if ( !user?.active ) {
      user = activeUsers.find(u => u.character === actor);
      user ||= activeUsers.find(u => actor?.testUserPermission(u, "OWNER"));
    }
    if ( !user ) {
      ui.notifications.warn(game.i18n.format("DICE.GROUP_CHECK.NoUserForActor", {name: entry.actorName}));
      return;
    }

    await StandardCheckDialog.#markActorStatus(message, actorId, StandardCheckDialog.GROUP_CHECK.ACTOR_STATUS.PENDING, {userId: user.id});

    const skill = SYSTEM.SKILLS[flags.skillId];
    const skillLabel = skill ? game.i18n.localize(skill.label) : flags.skillId;
    StandardCheckDialog.#dispatchGroupCheckQuery({
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

  /* -------------------------------------------- */

  /**
   * Open a StandardCheck dialog for the GM to roll on behalf of a non-responding player.
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to roll for
   * @returns {Promise<void>}
   */
  static async rollOnBehalfGroupCheck(message, actorId) {
    const {ACTOR_STATUS, FLAG_KEY} = StandardCheckDialog.GROUP_CHECK;
    const flags = message.flags.crucible?.[FLAG_KEY];
    if ( !flags ) return;
    const entry = flags.actors[actorId];
    if ( !entry ) return;

    const actor = game.actors.get(actorId);
    if ( !actor ) return;

    const skill = SYSTEM.SKILLS[flags.skillId];
    const skillLabel = skill ? game.i18n.localize(skill.label) : flags.skillId;
    const title = game.i18n.format("DICE.GROUP_CHECK.ChatTitle", {skill: skillLabel, dc: flags.dc});

    const checkData = {dc: flags.dc};
    if ( flags.sharedBoons ) checkData.boons = flags.sharedBoons;
    if ( flags.sharedBanes ) checkData.banes = flags.sharedBanes;
    const pool = skill ? actor.getSkillCheck(skill.id, checkData) : new crucible.api.dice.StandardCheck({
      ...checkData,
      type: flags.skillId,
      actorId: actorId
    });

    const response = await pool.dialog({title});
    if ( response === null ) return;

    await pool.evaluate();
    const result = {
      total: pool.total,
      dc: flags.dc,
      isSuccess: pool.isSuccess,
      isCriticalSuccess: pool.isCriticalSuccess,
      isCriticalFailure: pool.isCriticalFailure
    };

    await StandardCheckDialog.#markActorStatus(message, actorId, ACTOR_STATUS.COMPLETE, {
      rollData: pool.toJSON(),
      result
    });
  }

  /* -------------------------------------------- */

  /**
   * Skip (abort) an actor in a group check, marking them as skipped.
   * @param {ChatMessage} message - The group check ChatMessage
   * @param {string} actorId - The actor ID to skip
   * @returns {Promise<void>}
   */
  static async skipGroupCheckActor(message, actorId) {
    await StandardCheckDialog.#markActorStatus(message, actorId, StandardCheckDialog.GROUP_CHECK.ACTOR_STATUS.SKIPPED);
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks on a roll mode selection button.
   * @param {Event} _event
   * @param {HTMLElement} target
   * @this {StandardCheckDialog}
   */
  static async #onChangeRollMode(_event, target) {
    this.rollMode = target.dataset.rollMode;
    for ( const button of target.parentElement.children ) {
      button.setAttribute("aria-pressed", button.dataset.rollMode === this.rollMode);
    }
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static async prompt(config={}) {
    config.rejectClose = false;
    return super.prompt(config);
  }
}
