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
  pool = this.options.pool;

  /* -------------------------------------------- */

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
	    template: `systems/${SYSTEM.id}/templates/dice/standard-check-dialog.html`,
      classes: [SYSTEM.id, "roll"],
      width: game.user.isGM ? 520 : 360,
      submitOnChange: true,
      closeOnSubmit: false
    });
	}

  /* -------------------------------------------- */

  /** @override */
  get title() {
    if ( this.options.title ) return this.options.title;
    const type = this.pool.data.type;
    if ( type in CONFIG.SYSTEM.SKILLS ) {
      const skill = CONFIG.SYSTEM.SKILLS[type];
      return `${skill.name} Skill Check`;
    }
    return "Generic Dice Check";
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = this.pool.data;
    return {
      ability: data.ability,
      banes: data.banes,
      boons: data.boons,
      difficulty: this._getDifficulty(data.dc),
      dice: this.pool.dice.map(d => `d${d.faces}`),
      difficulties: Object.entries(SYSTEM.dice.checkDifficulties).map(d => ({dc: d[0], label: `${d[1]} (DC ${d[0]})`})),
      enchantment: data.enchantment,
      isGM: game.user.isGM,
      rollMode: this.options.rollMode || game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
      skill: data.skill
    }
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
    const rollData = this.pool.data;
    switch ( action ) {
      case "boon-add":
        this._updatePool(form, {boons: Math.clamped(rollData.boons + 1, 0, SYSTEM.dice.MAX_BOONS)});
        return this.render();
      case "boon-subtract":
        this._updatePool(form, {boons: Math.clamped(rollData.boons - 1, 0, SYSTEM.dice.MAX_BOONS)});
        return this.render();
      case "bane-add":
        this._updatePool(form, {banes: Math.clamped(rollData.banes + 1, 0, SYSTEM.dice.MAX_BOONS)});
        return this.render();
      case "bane-subtract":
        this._updatePool(form, {banes: Math.clamped(rollData.banes - 1, 0, SYSTEM.dice.MAX_BOONS)});
        return this.render();
      case "request":
        this._updatePool(form);
        this.pool.request({
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
   * Handle updating the StandardCheck dice pool
   * @param {HTMLFormElement} form    The updated form HTML
   * @param {object} updates          Additional data updates
   * @private
   */
  _updatePool(form, updates={}) {
    const fd = new FormDataExtended(form);
    updates = foundry.utils.mergeObject(fd.object, updates);
    this.pool.initialize(updates);
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
    this.pool.initialize(fd.object);
    return this.pool;
  }
}
