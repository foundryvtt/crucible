import {SYSTEM} from "../const/system.mjs";
const {DialogV2} = foundry.applications.api;

/**
 * Prompt the user to perform a Standard Check.
 * @extends {DialogV2}
 */
export default class StandardCheckDialog extends DialogV2 {

  /**
   * @param {object} [options={}]
   * @param {boolean} [options.request=false]             Display the roll request tray (GM only)
   * @param {CrucibleActor[]} [options.requestedActors=[]] Actors to pre-populate in the request tray
   * @param {StandardCheck} options.roll                   The StandardCheck roll instance
   * @param {string} [options.messageMode]                 The message mode to use
   * @param {Record<string, GroupCheckSkillConfig>} [options.skills]  Multi-skill choices (player mode)
   * @param {boolean} [options.configurable=true]  Whether the dialog allows GM configuration (skills, DC, request)
   */
  constructor({request=false, requestedActors=[], roll, messageMode, skills, configurable=true, ...options}={}) {
    super(options);
    this.request = request && game.user.isGM;
    this.configurable = configurable && game.user.isGM;
    this.roll = roll;
    this.messageMode = messageMode;
    if ( this.roll.actor ) this.#requestActors.add(this.roll.actor);
    for ( const actor of requestedActors ) this.#requestActors.add(actor);

    // Multi-skill: player receives allowed skills from GM with explicit DCs
    if ( skills ) {
      for ( const [id, config] of Object.entries(skills) ) this.#selectedSkills.set(id, config.dc);
    }

    // Default the skills panel to open when no skill is pre-configured
    if ( this.configurable && !SYSTEM.SKILLS[this.roll.data.type] ) {
      this.customizeSkills = true;
    }
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
      messageMode: StandardCheckDialog.#onChangeMessageMode,
      requestSubmit: StandardCheckDialog.#requestSubmit,
      skillsToggle: StandardCheckDialog.#onSkillsToggle,
      skillAdd: StandardCheckDialog.#onSkillAdd,
      skillRemove: StandardCheckDialog.#onSkillRemove
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
   * Whether the dialog allows GM configuration (skills, DC, request trays).
   * False when rolling on behalf of an absent player.
   * @type {boolean}
   */
  configurable;

  /**
   * Display the dialog in request mode.
   * @type {boolean}
   */
  request;

  /**
   * Display the skills customization panel.
   * @type {boolean}
   */
  customizeSkills = false;

  /** @type {Function|null} */
  #boundSubmit = null;

  /**
   * The actors who will be requested to roll.
   * @type {Set<CrucibleActor>}
   */
  #requestActors = new Set();

  /**
   * Selected skills for group check. Maps skill ID to its custom DC override (null = inherit shared DC).
   * During configuration, this is populated with allowed skills and DCs.
   * When non-configurable, this is a fixed list of skills that the resolving player can choose between.
   * @type {Map<string, number|null>}
   */
  #selectedSkills = new Map();

  /**
   * A StandardCheck dice pool instance which organizes the data for this dialog
   * @type {StandardCheck}
   */
  roll;

  /**
   * The selected message mode for this particular roll.
   * @type {string}
   */
  messageMode;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    if ( this.options.window.title ) return this.options.window.title;
    let label;
    if ( this.#selectedSkills.size > 1 ) label = _loc("ACTION.SkillCheckGeneric");
    else {
      const type = this.roll.data.type;
      const skill = SYSTEM.SKILLS[type];
      label = skill ? _loc("ACTION.SkillCheck", {skill: skill.label}) : _loc("ACTION.StandardCheck");
    }
    const actor = this.#requestActors.first();
    if ( actor && (this.#requestActors.size === 1) ) label += `: ${actor.name}`;
    else if ( this.request ) label = _loc("ACTION.RequestRollsSuffix", {label});
    return label;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    delete options.position?.width; // Ignore default dialog width
    options = super._initializeApplicationOptions(options);
    options.buttons = {
      roll: {action: "roll", label: _loc("DICE.Roll"), icon: "fa-solid fa-dice-d8", callback: this._onRoll.bind(this)}
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
    const messageMode = this.messageMode || game.settings.get("core", "messageMode");
    return Object.assign({}, data, {
      buttons: this.#prepareButtons(),
      dice: this.roll.dice.map(d => `d${d.faces}`),
      difficulty: this._getDifficulty(data.dc),
      difficulties: Object.entries(SYSTEM.DICE.checkDifficulties).map(d => ({dc: d[0], label: `${_loc(d[1])} (DC ${d[0]})`})),
      configurable: this.configurable,
      request: this.#prepareRequest(),
      customizeSkills: this.#prepareCustomizeSkills(),
      skillSelector: this.#prepareSkillSelector(),
      messageModes: this.#prepareMessageModes(messageMode),
      showDetails: data.totalBoons + data.totalBanes > 0,
      canIncreaseBoons: data.totalBoons < SYSTEM.DICE.MAX_BOONS,
      canDecreaseBoons: data.totalBoons > 0,
      canIncreaseBanes: data.totalBanes < SYSTEM.DICE.MAX_BOONS,
      canDecreaseBanes: data.totalBanes > 0
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare the footer button configuration based on dialog state.
   * @returns {object[]}
   */
  #prepareButtons() {
    const buttons = [];
    const isConfigurable = this.configurable;

    // Determine whether group check submission is allowed
    const hasActors = this.#requestActors.size > 1;
    const hasSkills = !this.customizeSkills || (this.#selectedSkills.size > 0);
    const canSubmitGroup = hasActors && hasSkills;

    // Left toggle: Customize Skills
    if ( isConfigurable ) {
      const chevron = this.customizeSkills ? "fa-chevrons-right" : "fa-chevrons-left";
      buttons.push({type: "button", action: "skillsToggle", cssClass: `icon fa-solid ${chevron}`, tooltip: _loc("DICE.SKILLS.CustomizeSkills"), position: "left"});
    }

    // Central buttons: Roll and (if request mode) Request + utilities
    for ( const b of Object.values(this.options.buttons) ) {
      const disabled = this.request && !canSubmitGroup;
      buttons.push({type: "submit", disabled, ...b});
    }
    if ( this.request ) buttons.push(
      {type: "button", action: "requestSubmit", icon: "fa-solid fa-paper-plane", label: _loc("DICE.REQUESTS.Request"), disabled: !canSubmitGroup},
      {type: "button", action: "requestClear", cssClass: "icon fa-solid fa-ban", tooltip: _loc("DICE.REQUESTS.ClearRequest")},
      {type: "button", action: "requestParty", cssClass: "icon fa-solid fa-users", tooltip: _loc("DICE.REQUESTS.AddParty")}
    );

    // Right toggle: Request Rolls
    if ( isConfigurable ) {
      const chevron = this.request ? "fa-chevrons-left" : "fa-chevrons-right";
      buttons.push({type: "button", action: "requestToggle", cssClass: `icon fa-solid ${chevron}`, tooltip: _loc("DICE.REQUESTS.RequestRolls")});
    }
    return buttons;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the request tray data with actor details and skill ranks.
   * @returns {object|null}
   */
  #prepareRequest() {
    if ( !this.request ) return null;
    const actors = [];
    const skillId = this.roll.data.type;
    const skill = SYSTEM.SKILLS[skillId];
    const resourceColor = skill ? SYSTEM.SKILL.CATEGORIES[skill.category]?.color?.css : null;
    for ( const actor of this.#requestActors ) {
      const rank = actor.system.skills[skillId]?.rank ?? 0;
      const pips = Array.fromRange(4).map(i => i < rank ? "full" : "");
      const rankTooltip = SYSTEM.TALENT.TRAINING_RANK_VALUES[rank]?.label
        ?? SYSTEM.TALENT.TRAINING_RANKS.untrained.label;
      actors.push({id: actor.id, name: actor.name, img: actor.img, tags: actor.getTags("short"), pips, rank, rankTooltip});
    }
    return {actors, resourceColor};
  }

  /* -------------------------------------------- */

  /**
   * Prepare message mode selector data.
   * When configurable, all modes are interactive. When not, only the active mode is shown as read-only.
   * @param {string} messageMode    The currently active message mode
   * @returns {object[]}
   */
  #prepareMessageModes(messageMode) {
    const allModes = Object.entries(CONFIG.ChatMessage.modes).map(([action, {label, icon}]) => {
      return {icon, label, action, active: action === messageMode, interactive: this.configurable};
    });
    return this.configurable ? allModes : allModes.filter(m => m.active);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the GM-side skill customization panel data.
   * @returns {object|null}
   */
  #prepareCustomizeSkills() {
    if ( !this.customizeSkills || !this.configurable ) return null;
    const defaultDc = this.roll.data.dc;
    const selected = [];
    for ( const [id, customDc] of this.#selectedSkills ) {
      selected.push({id, label: SYSTEM.SKILLS[id].label, dc: customDc, customDc: customDc !== null});
    }
    const selectedIds = new Set(this.#selectedSkills.keys());
    const skillChoices = Object.values(SYSTEM.SKILLS).map(s => ({
      id: s.id, label: s.label, disabled: selectedIds.has(s.id)
    }));
    const canAdd = selectedIds.size < Object.keys(SYSTEM.SKILLS).length;
    return {selected, skillChoices, defaultDc, multiSelect: true, canAdd};
  }

  /* -------------------------------------------- */

  /**
   * Prepare the player-side single skill selector.
   * @returns {object|null}
   */
  #prepareSkillSelector() {
    if ( this.#selectedSkills.size <= 1 ) return null;
    if ( this.customizeSkills ) return null; // GM uses the left panel instead
    const currentSkillId = this.roll.data.type;
    const selected = [];
    for ( const [id] of this.#selectedSkills ) {
      selected.push({id, label: SYSTEM.SKILLS[id].label, current: id === currentSkillId});
    }
    return {selected, enabled: true};
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

  /**
   * Special actions to perform when the target DC is changed.
   * @param {number} dc    The new shared DC value
   */
  #onUpdateDifficulty(dc) {
    for ( const input of this.element.querySelectorAll(".skill-dc-entry .skill-dc") ) {
      input.placeholder = dc;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(_context, _options) {
    const form = this.element.querySelector("form.window-content");
    if ( !this.#boundSubmit ) {
      this.#boundSubmit = event => this._onSubmit(event.submitter, event);
      form.addEventListener("submit", this.#boundSubmit);
    }
    form.classList.toggle("roll-request", this.request);
    form.classList.toggle("customize-skills", this.customizeSkills);
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
   * When the GM has requested actors, perform a local group check for all actors instead of a single roll.
   * @param {Event} _event
   * @param {HTMLButtonElement} _button
   * @param {Dialog} _dialog
   * @returns {StandardCheck|false}
   * @protected
   */
  async _onRoll(_event, _button, _dialog) {
    this.roll.data.messageMode = this.messageMode;
    if ( this.#requestActors.size > 1 ) {
      await this.#rollGroupCheck();
      return null;
    }
    return this.roll;
  }

  /* -------------------------------------------- */

  /**
   * Perform a local group check where the GM rolls for all requested actors.
   * @returns {Promise<void>}
   */
  async #rollGroupCheck() {
    const defaultDc = this.roll.data.dc;
    const skills = {};
    for ( const [id, customDc] of this.#selectedSkills ) skills[id] = {dc: customDc ?? defaultDc};
    const options = {requestedActors: this.#requestActors, local: true, messageMode: this.messageMode};
    if ( Object.keys(skills).length ) options.skills = skills;
    const groupCheckInstance = new crucible.api.dice.GroupCheck(foundry.utils.deepClone(this.roll.data));
    await groupCheckInstance.requestSubmit(options);
    await this.close();
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
        this.#onUpdateDifficulty(dc);
      }
    }

    // Difficulty Class
    else if ( event.target.name === "dc" ) {
      event.target.parentElement.querySelector("select[name=\"difficultyTier\"]").value = "";
      this.roll.data.dc = event.target.valueAsNumber;
      this.#onUpdateDifficulty(event.target.valueAsNumber);
    }

    // Per-skill DC (GM mode): empty input clears the override (inherit shared DC)
    else if ( event.target.name?.startsWith("skillDc.") ) {
      const skillId = event.target.name.split(".")[1];
      if ( this.#selectedSkills.has(skillId) ) {
        const value = event.target.value === "" ? null : event.target.valueAsNumber;
        this.#selectedSkills.set(skillId, value);
      }
    }

    // GM skill row select change: swap the old skill for the new one
    else if ( event.target.name?.startsWith("skillSelect.") ) {
      const newSkillId = event.target.value;
      const row = event.target.closest(".skill-dc-entry");
      const oldSkillId = row?.dataset.skillId;
      if ( oldSkillId && (oldSkillId !== newSkillId) && !this.#selectedSkills.has(newSkillId) ) {
        const customDc = this.#selectedSkills.get(oldSkillId);
        this.#selectedSkills.delete(oldSkillId);
        this.#selectedSkills.set(newSkillId, customDc);
        return this.render();
      }
    }

    // Player skill choice
    else if ( event.target.name === "skillChoice" ) {
      const skillId = event.target.value;
      if ( skillId === this.roll.data.type ) return;
      const actor = this.roll.actor;
      if ( !actor ) return;
      const dc = this.#selectedSkills.get(skillId) ?? this.roll.data.dc;
      this.roll = actor.getSkillCheck(skillId, {dc, boons: this.roll.data.totalBoons,
        banes: this.roll.data.totalBanes});
      return this.render({window: {title: this.title}});
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
   * Handle updating the StandardCheck dice pool
   * @param {HTMLFormElement} form    The updated form HTML
   * @param {object} updates          Additional data updates
   * @private
   */
  _updatePool(form, updates={}) {
    const fd = new foundry.applications.ux.FormDataExtended(form);
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

  /**
   * Toggle the request actors panel.
   * @this {StandardCheckDialog}
   */
  static async #onRequestToggle(_event) {
    this.request = !this.request && game.user.isGM;
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks to clear requested actors
   * @this StandardCheckDialog
   * @param {PointerEvent} _event
   * @returns {Promise<void>}
   */
  static async #onRequestClear(_event) {
    this.#requestActors.clear();
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks to add party to requested actors
   * @this StandardCheckDialog
   * @param {PointerEvent} _event
   * @returns {Promise<void>}
   */
  static async #onRequestParty(_event) {
    const members = crucible.party?.system.actors;
    if ( !members?.size ) {
      ui.notifications.warn(_loc("WARNING.NoParty"));
      return;
    }
    for ( const m of members ) this.#requestActors.add(m);
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks to remove a requested actor
   * @this StandardCheckDialog
   * @param {Event} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onRequestRemove(_event, target) {
    const actorId = target.closest(".line-item").dataset.actorId;
    const actor = game.actors.get(actorId);
    this.#requestActors.delete(actor);
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks to request rolls made by other players.
   * @param {Event} _event
   * @param {HTMLElement} _target
   * @this {StandardCheckDialog}
   */
  static async #requestSubmit(_event, _target) {
    const defaultDc = this.roll.data.dc;
    const skills = {};
    for ( const [id, customDc] of this.#selectedSkills ) skills[id] = {dc: customDc ?? defaultDc};
    const options = {requestedActors: this.#requestActors, messageMode: this.messageMode};
    if ( Object.keys(skills).length ) options.skills = skills;
    await this.roll.requestGroupCheck(options);
    await this.close();
  }

  /* -------------------------------------------- */

  /**
   * Handle clicks on a message mode selection button.
   * @this {StandardCheckDialog}
   * @param {Event} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onChangeMessageMode(_event, target) {
    this.messageMode = target.dataset.messageMode;
    for ( const button of target.parentElement.children ) {
      button.setAttribute("aria-pressed", button.dataset.messageMode === this.messageMode);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the skill customization panel.
   * @this {StandardCheckDialog}
   * @param {Event} _event
   * @returns {Promise<void>}
   */
  static async #onSkillsToggle(_event) {
    this.customizeSkills = !this.customizeSkills;
    if ( this.customizeSkills && !this.#selectedSkills.size ) {
      const currentSkill = this.roll.data.type;
      if ( currentSkill && SYSTEM.SKILLS[currentSkill] ) {
        this.#selectedSkills.set(currentSkill, null);
      }
    }
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a new skill row in the GM multi-skill selector.
   * @this {StandardCheckDialog}
   * @param {Event} _event
   * @returns {Promise<void>}
   */
  static async #onSkillAdd(_event) {
    const usedIds = new Set(this.#selectedSkills.keys());
    const available = Object.keys(SYSTEM.SKILLS).find(id => !usedIds.has(id));
    if ( !available ) return;
    this.#selectedSkills.set(available, null);
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a skill row in the GM multi-skill selector.
   * @this {StandardCheckDialog}
   * @param {Event} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onSkillRemove(_event, target) {
    const skillId = target.dataset.skillId;
    this.#selectedSkills.delete(skillId);
    await this.render({window: {title: this.title}});
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
