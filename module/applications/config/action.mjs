import CrucibleSheetMixin from "../sheets/crucible-sheet.mjs";

/**
 * A configuration application used to configure an Action inside a Talent.
 */
export default class ActionConfig extends CrucibleSheetMixin(DocumentSheet) {
  constructor(action, options) {
    super(action.parent.parent, options);
    this.action = action;
    this.talent = action.parent;
  }

  /* -------------------------------------------- */

  /** @override */
  static documentType = "action";

  /* -------------------------------------------- */

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `systems/${SYSTEM.id}/templates/config/action.hbs`,
    });
  }


  /* -------------------------------------------- */
  /** @override */
  get title() {
    return `[${game.i18n.localize("ACTION.Action")}] ${this.action.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    return {
      action: this.action,
      editable: this.isEditable
    }
  }
}
