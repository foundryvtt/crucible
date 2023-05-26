import { SYSTEM } from "../../config/system.js";
import CrucibleTalentNode from "../../config/talent-tree.mjs";
import CrucibleSheetMixin from "./crucible-sheet.mjs";

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
      actionsJSON: JSON.stringify(source.system.actions, null, 2),
      actorHookChoices: SYSTEM.ACTOR_HOOKS,
      actorHooks: this.#prepareActorHooks(),
      nodes: Object.fromEntries(nodeIds.map(id => [id, id])),
      runes: SYSTEM.SPELL.RUNES,
      gestures: SYSTEM.SPELL.GESTURES,
      inflections: SYSTEM.SPELL.INFLECTIONS
    }
  }

  /* -------------------------------------------- */

  static prepareActions(actions) {
    return actions.map(action => ({
      id: action.id,
      name: action.name,
      img: action.img,
      condition: action.condition,
      description: action.description,
      tags: action.getTags(),
      effects: action.effects.map(effect => ({
        name: action.name,
        tags: {
          scope: `Affects ${SYSTEM.ACTION.TARGET_SCOPES.label(effect.scope || action.target.scope)}`,
          duration: effect.duration?.rounds ? `${effect.duration.rounds}R` : "Until Ended"
        }
      }))
    }));
  }

  /* -------------------------------------------- */

  #prepareActorHooks() {
    return this.object.system.actorHooks.map(h => {
      const cfg = SYSTEM.ACTOR_HOOKS[h.hook];
      return {label: cfg.signature, ...h};
    });
  }

  /* -------------------------------------------- */

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action]").click(this.#onClickAction.bind(this));
  }


  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    const form = this.form;
    for ( const field of ["system.actions"] ) {
      try {
        JSON.parse(form[field].value);
      } catch(err) {
        return ui.notifications.error(`Invalid JSON in "${field}" field: ${err.message}`);
      }
    }
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    formData.system.actorHooks = Object.values(formData.system.actorHooks || {});
    return formData;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if ( !this.object.id ) return;
    return this.object.update(formData, {recursive: false, diff: false, noHook: true});
  }

  /* -------------------------------------------- */

  #onClickAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
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
