const {DialogV2} = foundry.applications.api;

/**
 * Prompt the user to perform a Standard Check.
 * @extends {DialogV2}
 */
export default class StandardCheckDialog extends DialogV2 {
  constructor({request=false, roll, rollMode, ...options}={}) {
    super(options);
    this.request = request && game.user.isGM;
    this.roll = roll;
    this.rollMode = rollMode;
    if ( this.roll.actor ) this.#requestActors.add(this.roll.actor);
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
   * The selected roll mode for this particular roll.
   * @type {string}
   */
  rollMode;

  /** @override */
  get title() {
    if ( this.options.window.title ) return this.options.window.title;
    const type = this.roll.data.type;
    const skill = SYSTEM.SKILLS[type];
    let label = skill ? `${skill.label} Skill Check` : "Standard Check";
    const actor = this.#requestActors.first();
    if ( actor && (this.#requestActors.size === 1) ) label += `: ${actor.name}`;
    else if ( this.request ) label += `: Request Rolls`;
    return label;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    delete options.position?.width; // Ignore default dialog width
    options = super._initializeApplicationOptions(options);
    options.buttons = {
      roll: {action: "roll", label: "Roll", icon: "fa-solid fa-dice-d8", callback: this._onRoll.bind(this)},
    }
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
    const rollMode = this.rollMode || game.settings.get("core", "rollMode")
    return Object.assign({}, data, {
      buttons: this.#prepareButtons(),
      dice: this.roll.dice.map(d => `d${d.faces}`),
      difficulty: this._getDifficulty(data.dc),
      difficulties: Object.entries(SYSTEM.dice.checkDifficulties).map(d => ({dc: d[0], label: `${d[1]} (DC ${d[0]})`})),
      isGM: game.user.isGM,
      request: this.#prepareRequest(),
      rollModes:  Object.entries(CONFIG.Dice.rollModes).map(([action, { label, icon }]) => {
        return {icon, label, action, active: action === rollMode};
      }),
      showDetails: data.totalBoons + data.totalBanes > 0,
      canIncreaseBoons: data.totalBoons < SYSTEM.dice.MAX_BOONS,
      canDecreaseBoons: data.totalBoons > 0,
      canIncreaseBanes: data.totalBanes < SYSTEM.dice.MAX_BOONS,
      canDecreaseBanes: data.totalBanes > 0
    });
  }

  /* -------------------------------------------- */

  #prepareButtons() {
    const buttons = [];
    for ( const b of Object.values(this.options.buttons) ) buttons.push({type: "submit", ...b});
    if ( this.request ) buttons.push(
      {type: "button", action: "requestSubmit", icon: "fa-solid fa-dice-d8", label: "Request"},
      {type: "button", action: "requestClear", cssClass: "icon fa-solid fa-ban", tooltip: "Clear Request"},
      {type: "button", action: "requestParty", cssClass: "icon fa-solid fa-users", tooltip: "Add Party"},
    )
    else buttons.push({type: "button", action: "requestToggle", cssClass: "icon fa-solid fa-chevrons-right", tooltip: "Request Rolls"});
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
   * @return {{dc: number, label: string, tier: number}}
   * @private
   */
  _getDifficulty(dc) {
    let label = "";
    let tier = 0;
    for ( let [d, l] of Object.entries(SYSTEM.dice.checkDifficulties) ) {
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
   * @returns {StandardCheck}
   * @protected
   */
  _onRoll(_event, _button, _dialog) {
    this.roll.data.rollMode = this.rollMode;
    return this.roll;
  }

  /* -------------------------------------------- */

  async _submitRequest() {
    debugger;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    // Difficulty Tier
    if ( event.target.name === "difficultyTier" ) {
      const dc = Number(event.target.value) || null;
      if ( Number.isNumeric(dc) ) {
        event.target.parentElement.querySelector(`input[name="dc"]`).value = dc;
        this.roll.data.dc = dc;
      }
    }

    // Difficulty Class
    else if ( event.target.name === "dc" ) {
      event.target.parentElement.querySelector(`select[name="difficultyTier"]`).value = "";
      this.roll.data.dc = event.target.valueAsNumber;
    }
    super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /** @override */
  _onClickAction(event, target) {
    const action = target.dataset.action;
    const form = this.element.querySelector("form");
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
   * @param {Object<string, DiceBoon>} boons    The initial configuration of boons
   * @param {number} delta                      The requested delta change in special boons
   * @returns {Object<string, DiceBoon>}        The updated boons object
   */
  static #modifyBoons(boons, delta) {
    boons.special ||= {label: "Special", number: 0};
    const total = Object.values(boons).reduce((t, b) => t + (b.id === "special" ? 0 : b.number), 0);
    boons.special.number = Math.clamp(boons.special.number + delta, 0, SYSTEM.dice.MAX_BOONS - total);
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
   * Handle clicks on a roll mode selection button.
   * @this {StandardCheckDialog)
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
