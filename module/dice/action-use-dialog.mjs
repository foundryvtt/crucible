import {SYSTEM} from "../config/system.js";
import StandardCheck from "./standard-check.js";
import StandardCheckDialog from "./standard-check-dialog.js";


/**
 * Prompt the user to active an action which may involve the rolling of a dice pool.
 * @extends {StandardCheckDialog}
 */
export default class ActionUseDialog extends StandardCheckDialog {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
	    template: `systems/${SYSTEM.id}/templates/dice/action-use-dialog.html`,
      classes: [SYSTEM.id, "roll"],
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
    const context = super.getData();
    const {actor, action, targets} = this.options;
    const tags = action.getTags();
    return foundry.utils.mergeObject(context, {
      action: action,
      actor: actor,
      activationTags: tags.activation,
      actionTags: tags.action,
      hasDice: action.context.hasDice ?? false,
      showTargets: action.targetType !== "self",
      targets: targets
    });
  }
}
