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
      width: 520,
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "usage"}]
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
      editable: this.isEditable,
      tags: this.#prepareTags(),
      targetTypes: SYSTEM.ACTION.TARGET_TYPES,
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare tag options and selections for the Action.
   * @returns {Object<string, {label: string, tags: {value: string, label: string, selected: boolean}[]}[]>}
   */
  #prepareTags() {
    const groups = {};
    for ( const [category, {label}] of Object.entries(SYSTEM.ACTION.TAG_CATEGORIES) ) {
      groups[category] = {label, tags: []};
    }
    for ( const {tag, label, category} of Object.values(SYSTEM.ACTION.TAGS) ) {
      const cat = groups[category];
      cat.tags.push({value: tag, label, selected: this.action.tags.has(tag) ? "selected" : ""});
    }
    return groups;
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const clone = this.action.clone();
    try {
      clone.updateSource(formData);
    } catch(err) {
      return ui.notifications.error(`Invalid Action update: ${err.message}`);
    }
    const actions = this.object.toObject().system.actions;
    actions.findSplice(a => a.id = this.action.id, clone.toObject());
    return this.object.update({"system.actions": actions});
  }
}
