import {SYSTEM} from "../config/system.js";
import StandardCheck from "./standard-check.js";

/**
 * Prompt the user to active an action which may involve the rolling of a dice pool.
 * @extends {Dialog}
 */
export default class ActionUseDialog extends Dialog {
  constructor(data, options) {
    super(data, options);
    this.pool = new StandardCheck(this.options);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
	    template: `systems/${SYSTEM.id}/templates/dice/action-use-dialog.html`,
      classes: [SYSTEM.id, "roll", "action"],
      width: 360,
      submitOnChange: true,
      closeOnSubmit: false
    });
	}

  /* -------------------------------------------- */

  /**
   * The Action being performed
   * @type {ActionData}
   */
  get action() {
    return this.options.action;
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    const {actor, action} = this.options;
    return `[${actor.name}] ${action.name}`
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const {actor, action, targets} = this.options;
    const {boons, banes, ability, skill, enchantment} = action.bonuses;
    return {
      action: action,
      actor: actor,
      activationTags: action.getActivationTags(),
      actionTags: action.getActionTags(),
      boons: boons ?? 0,
      banes: banes ?? 0,
      dice: this.pool.dice.map(d => `d${d.faces}`),
      ability: ability,
      skill: skill,
      enchantment: enchantment,
      targets: targets,
      rollMode: this.options.rollMode || game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes
    }
  }

	/* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    html.find('[data-action]').click(this._onClickAction.bind(this));
    super.activateListeners(html);
  }

  /* -------------------------------------------- */

  _onClickAction(event) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action;
    const bonuses = this.action.bonuses;
    switch (action) {
      case "boon-add":
        bonuses.boons = Math.clamped(bonuses.boons + 1, 0, 6);
        break;
      case "boon-subtract":
        bonuses.boons = Math.clamped(bonuses.boons - 1, 0, 6);
        break;
      case "bane-add":
        bonuses.banes = Math.clamped(bonuses.banes + 1, 0, 6);
        break;
      case "bane-subtract":
        bonuses.banes = Math.clamped(bonuses.banes - 1, 0, 6);
        break;
    }

    // Update the pool and re-render the dialog
    this.pool.initialize(bonuses);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static async prompt(config={}) {
    config.callback = this._onSubmit;
    config.options.jQuery = false;
    config.rejectClose = false;
    return super.prompt(config);
  }

  /* -------------------------------------------- */

  /**
   * Return dialog submission data as a form data object
   * @param {HTMLElement} html    The rendered dialog HTML
   * @returns {object}            The processed form data
   * @private
   */
  static _onSubmit(html) {
    const form = html.querySelector("form");
    const fd = new FormDataExtended(form);
    return fd.toObject();
  }
}
