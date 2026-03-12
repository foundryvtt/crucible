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
   * @param {string} [options.messageMode]                    The message mode to use
   */
  constructor({request=false, requestedActors=[], roll, messageMode, ...options}={}) {
    super(options);
    this.request = request && game.user.isGM;
    this.roll = roll;
    this.messageMode = messageMode;
    if ( this.roll.actor ) this.#requestActors.add(this.roll.actor);
    for ( const actor of requestedActors ) this.#requestActors.add(actor);
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
   * The selected message mode for this particular roll.
   * @type {string}
   */
  messageMode;

  /** @override */
  get title() {
    if ( this.options.window.title ) return this.options.window.title;
    const type = this.roll.data.type;
    const skill = SYSTEM.SKILLS[type];
    let label = skill ? _loc("ACTION.SkillCheck", {skill: skill.label}) : _loc("ACTION.StandardCheck");
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
      isGM: game.user.isGM,
      request: this.#prepareRequest(),
      messageModes: Object.entries(CONFIG.ChatMessage.modes).map(([action, { label, icon }]) => {
        return {icon, label, action, active: action === messageMode};
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
      {type: "button", action: "requestSubmit", icon: "fa-solid fa-dice-d8", label: _loc("DICE.REQUESTS.Request")},
      {type: "button", action: "requestClear", cssClass: "icon fa-solid fa-ban", tooltip: _loc("DICE.REQUESTS.ClearRequest")},
      {type: "button", action: "requestParty", cssClass: "icon fa-solid fa-users", tooltip: _loc("DICE.REQUESTS.AddParty")}
    );
    else if ( game.user.isGM )buttons.push({type: "button", action: "requestToggle", cssClass: "icon fa-solid fa-chevrons-right", tooltip: _loc("DICE.REQUESTS.RequestRolls")});
    return buttons;
  }

  /* -------------------------------------------- */

  #prepareRequest() {
    if ( !this.request ) return null;
    const actors = [];
    const skillId = this.roll.data.type;
    const skill = SYSTEM.SKILLS[skillId];
    const resourceColor = skill ? SYSTEM.SKILL.CATEGORIES[skill.category]?.color?.css : null;
    for ( const actor of this.#requestActors ) {
      const rank = actor.system.skills[skillId]?.rank ?? 0;
      const pips = Array.fromRange(4).map(i => i < rank ? "full" : "");
      const rankTooltip = SYSTEM.TALENT.TRAINING_RANK_VALUES[rank]?.label ?? SYSTEM.TALENT.TRAINING_RANKS.untrained.label;
      actors.push({id: actor.id, name: actor.name, img: actor.img, tags: actor.getTags("short"), pips, rank, rankTooltip});
    }
    return {actors, resourceColor};
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
    this.roll.data.messageMode = this.messageMode;
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

  static async #onRequestToggle(event) {
    this.request = game.user.isGM;
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
      ui.notifications.warn("WARNING.NoParty", {localize: true});
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
    await this.roll.requestGroupCheck({requestedActors: Array.from(this.#requestActors)});
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
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static async prompt(config={}) {
    config.rejectClose = false;
    return super.prompt(config);
  }
}
