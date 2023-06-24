import { SYSTEM } from "../config/system.js";

/**
 * Prompt the user to perform a Standard Check.
 * @extends {Dialog}
 */
export default class StandardCheckDialog extends Dialog {

  /**
   * A StandardCheck dice pool instance which organizes the data for this dialog
   * @type {StandardCheck}
   */
  roll = this.options.roll;

  /* -------------------------------------------- */

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
	    template: `systems/${SYSTEM.id}/templates/dice/standard-check-dialog.hbs`,
        classes: ["crucible-new", "roll"],
        submitOnChange: true,
        closeOnSubmit: false
      });
	}

  /* -------------------------------------------- */

  /** @override */
  get title() {
    if ( this.options.title ) return this.options.title;
    const type = this.roll.data.type;
    const skill = CONFIG.SYSTEM.SKILLS[type];
    if ( skill ) return `${skill.name} Skill Check`;
    return "Generic Dice Check";
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options={}) {
    const data = this.roll.data;
    const displayGMOptions = false; // TODO temporarily disable for playtest 1
    options.position = {width: displayGMOptions ? 520 : 360};
    return Object.assign({}, data, {
      dice: this.roll.dice.map(d => `d${d.faces}`),
      difficulty: this._getDifficulty(data.dc),
      difficulties: Object.entries(SYSTEM.dice.checkDifficulties).map(d => ({dc: d[0], label: `${d[1]} (DC ${d[0]})`})),
      isGM: displayGMOptions,
      rollMode: this.options.rollMode || game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
      increaseBoonsClass: data.totalBoons < SYSTEM.dice.MAX_BOONS ? "" : "disabled",
      decreaseBoonsClass: data.totalBoons > 0 ? "" : "disabled",
      increaseBanesClass: data.totalBanes < SYSTEM.dice.MAX_BOONS ? "" : "disabled",
      decreaseBanesClass: data.totalBanes > 0 ? "" : "disabled"
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the text label for a dice roll DC
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
  activateListeners(html) {
    html.find('[data-action]').click(this._onClickAction.bind(this));
    html.find('label[data-action]').contextmenu(this._onClickAction.bind(this));
    html.find('select[name="tier"]').change(this._onChangeDifficultyTier.bind(this));
    super.activateListeners(html);
  }

  /* -------------------------------------------- */

  /**
   * Handle execution of one of the dialog roll actions
   * @private
   */
  _onClickAction(event) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action;
    const form = event.currentTarget.closest("form");
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
      case "request":
        this._updatePool(form);
        this.roll.request({
          title: this.title,
          flavor: this.options.flavor
        });
        const actor = game.actors.get(rollData.actorId);
        ui.notifications.info(`Requested a ${rollData.type} check be made by ${actor.name}.`);
        return this.close();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to the difficulty tier select input
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
   * Update the boons or banes object by changing the number of "special" boons applied to the roll.
   * @param {Object<string, DiceBoon>} boons    The initial configuration of boons
   * @param {number} delta                      The requested delta change in special boons
   * @returns {Object<string, DiceBoon>}        The updated boons object
   */
  static #modifyBoons(boons, delta) {
    boons.special ||= {label: "Special", number: 0};
    const total = Object.values(boons).reduce((t, b) => t + (b.id === "special" ? 0 : b.number), 0);
    boons.special.number = Math.clamped(boons.special.number + delta, 0, SYSTEM.dice.MAX_BOONS - total);
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
    const fd = new FormDataExtended(form);
    updates = foundry.utils.mergeObject(fd.object, updates);
    this.roll.initialize(updates);
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static async prompt(config={}) {
    config.callback = this.prototype._onSubmit;
    config.options.jQuery = false;
    config.rejectClose = false;
    return super.prompt(config);
  }

  /* -------------------------------------------- */

  /**
   * Return dialog submission data as a form data object
   * @param {HTMLElement} html    The rendered dialog HTML
   * @returns {StandardCheck}     The processed StandardCheck instance
   * @private
   */
  _onSubmit(html) {
    const form = html.querySelector("form");
    const fd = new FormDataExtended(form)
    this.roll.initialize(fd.object);
    return this.roll;
  }
}
