import {SYSTEM} from "../config/system.js";
import StandardCheckDialog from "./standard-check-dialog.mjs";

/**
 * Prompt the user to activate an action which may involve the rolling of a dice pool.
 * @extends {StandardCheckDialog}
 */
export default class ActionUseDialog extends StandardCheckDialog {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
	    template: `systems/${SYSTEM.id}/templates/dice/action-use-dialog.html`,
      classes: [SYSTEM.id, "sheet", "roll"],
      width: 360,
      submitOnChange: true,
      closeOnSubmit: false
    });
	}

  /* -------------------------------------------- */

  /**
   * The Action being performed
   * @type {CrucibleAction}
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
  async getData(options) {
    const context = await super.getData(options);
    const {actor, action, targets} = this.options;
    const tags = this._getTags();
    return foundry.utils.mergeObject(context, {
      action: action,
      actor: actor,
      activationTags: tags.activation,
      actionTags: tags.action,
      hasActionTags: !foundry.utils.isEmpty(tags.action),
      hasContextTags: action.usage.context?.tags.size > 0,
      hasDice: action.usage.hasDice ?? false,
      targets: targets
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the tags that apply to this dialog.
   * @returns {ActionTags}
   * @protected
   */
  _getTags() {
    return this.action.getTags();
  }

  /* -------------------------------------------- */

  /** @override */
  _onSubmit(html) {
    const form = html.querySelector("form");
    const {boons, banes} = (new FormDataExtended(form, {readonly: true})).object;
    Object.assign(this.action.usage.bonuses, {boons, banes});
    return this.action;
  }

  /* -------------------------------------------- */

  /**
   * Respond when the set of User Targets changes by re-rendering currently visible action use apps.
   */
  static debounceChangeTarget = foundry.utils.debounce(() => {
    for ( const app of Object.values(ui.windows) ) {
      if ( !(app instanceof ActionUseDialog) ) continue;
      app.render();
    }
  }, 20);
}
