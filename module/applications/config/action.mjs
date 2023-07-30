import CrucibleSheetMixin from "../sheets/crucible-sheet.mjs";
import CrucibleItem from "../../documents/item.mjs";

/**
 * A configuration application used to configure an Action inside a Talent.
 * @extends DocumentSheet
 * @mixes CrucibleSheet
 */
export default class ActionConfig extends CrucibleSheetMixin(DocumentSheet) {
  constructor(action, options) {
    if ( !(action.parent.parent instanceof CrucibleItem) ) {
      throw new Error("You may only use the ActionConfig sheet to configure an Action that belongs to an Item.");
    }
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
      actionHookChoices: Object.keys(SYSTEM.ACTION_HOOKS).reduce((obj, k) => {
        obj[k] = k;
        return obj;
      }, {}),
      showHooks: game.user.isGM,
      actionHooks: this.#prepareActionHooks(),
      targetTypes: SYSTEM.ACTION.TARGET_TYPES,
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices,
      effectsJSON: JSON.stringify(this.action.effects, null, 2)
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

  /**
   * Prepare data for defined action hooks attached to the Action.
   * @returns {{label: string, hook: string, fn: string}[]}
   */
  #prepareActionHooks() {
    return this.action.actionHooks.map(h => {
      const cfg = SYSTEM.ACTION_HOOKS[h.hook];
      const args = ["action", ...cfg.argNames];
      const label = `${cfg.async ? "async " : ""}${h.hook}(action, ${args.join(", ")})`;
      return {label, ...h};
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    if ( "actionHooks" in formData ) {
      formData.actionHooks = Object.values(formData.actionHooks || {});
    }
    if ( "effectsJSON" in formData ) {
      formData.effects = JSON.parse(formData.effectsJSON);
      delete formData.effectsJSON;
    }
    return formData;
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    try {
      this.action.updateSource(formData);
    } catch(err) {
      return ui.notifications.error(`Invalid Action update: ${err.message}`);
    }
    const actions = this.object.toObject().system.actions;
    actions.findSplice(a => a.id === this.action.id, this.action.toObject());
    return this.object.update({"system.actions": actions}, {diff: false});
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleAction(action, event, button) {
    switch ( action ) {
      case "addHook":
        return this.#onAddHook(event, button);
      case "deleteHook":
        return this.#onDeleteHook(event, button);
    }
  }

  /* -------------------------------------------- */

  /**
   * Add a new hook function to the Action.
   * @returns {Promise<CrucibleItem|null>}
   */
  #onAddHook(event, button) {
    const hook = button.previousElementSibling.value;
    const fd = this._getSubmitData({});
    fd.actionHooks ||= [];
    if ( fd.actionHooks.find(h => h.hook === hook ) ) {
      ui.notifications.warn(`${this.object.name} already declares a function for the "${hook}" hook.`);
      return null;
    }
    fd.actionHooks.push({hook, fn: "// Hook code here"});
    return this._updateObject(event, fd);
  }

  /* -------------------------------------------- */

  /**
   * Delete a hook function from the Action.
   * @returns {Promise<CrucibleItem|null>}
   */
  #onDeleteHook(event, button) {
    const hook = button.closest(".form-group").querySelector(`input[type="hidden"]`).value;
    const fd = this._getSubmitData({});
    fd.actionHooks.findSplice(h => h.hook === hook);
    return this._updateObject(event, fd);
  }
}
