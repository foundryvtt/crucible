import CrucibleTalentNode from "../../config/talent-tree.mjs";
import CrucibleSheetMixin from "./crucible-sheet.mjs";
import ActionConfig from "../config/action.mjs";

/**
 * A sheet application for displaying and configuring Items with the Talent type.
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class TalentSheet extends CrucibleSheetMixin(ItemSheet) {

  /** @override */
  static documentType = "talent";

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "details"}]
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options = {}) {
    const isEditable = this.isEditable;
    const nodeIds = Array.from(CrucibleTalentNode.nodes.keys());
    nodeIds.sort((a, b) => a.localeCompare(b));
    const source = this.object.toObject();
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.object,
      source: source,
      actions: TalentSheet.prepareActions(this.object.system.actions),
      tags: this.item.getTags(this.object.system.talents),
      actorHookChoices: Object.keys(SYSTEM.ACTOR_HOOKS).reduce((obj, k) => {
        obj[k] = k;
        return obj;
      }, {}),
      showHooks: game.user.isGM,
      actorHooks: this.#prepareActorHooks(),
      nodes: Object.fromEntries(nodeIds.map(id => [id, id])),
      runes: SYSTEM.SPELL.RUNES,
      gestures: SYSTEM.SPELL.GESTURES,
      inflections: SYSTEM.SPELL.INFLECTIONS
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for defined actor hooks attached to the Talent.
   * @returns {{label: string, hook: string, fn: string}[]}
   */
  #prepareActorHooks() {
    return this.object.system.actorHooks.map(h => {
      const cfg = SYSTEM.ACTOR_HOOKS[h.hook];
      const label = `${h.hook}(actor, ${cfg.argNames.join(", ")})`;
      return {label, ...h};
    });
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    if ( "actorHooks" in formData.system ) {
      formData.system.actorHooks = Object.values(formData.system.actorHooks || {});
    }
    return formData;
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    if ( !this.object.id ) return;
    return this.object.update(formData, {recursive: false, diff: false, noHook: true});
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
   * Add a new hook function to the Talent.
   * @returns {Promise<CrucibleItem|null>}
   */
  #onAddHook(event, button) {
    const hook = button.previousElementSibling.value;
    const fd = this._getSubmitData({});
    fd.system.actorHooks ||= [];
    if ( fd.system.actorHooks.find(h => h.hook === hook ) ) {
      ui.notifications.warn(`${this.object.name} already declares a function for the "${hook}" hook.`);
      return null;
    }
    fd.system.actorHooks.push({hook, fn: "// Hook code here"});
    return this._updateObject(event, fd);
  }

  /* -------------------------------------------- */

  /**
   * Delete a hook function from the Talent.
   * @returns {Promise<CrucibleItem>}
   */
  #onDeleteHook(event, button) {
    const hook = button.closest(".form-group").querySelector(`input[type="hidden"]`).value;
    const fd = this._getSubmitData({});
    fd.system.actorHooks.findSplice(h => h.hook === hook);
    return this._updateObject(event, fd);
  }

}
