import CrucibleTalentNode from "../../config/talent-tree.mjs";
import CrucibleSheetMixin from "./crucible-sheet.mjs";
import ActionConfig from "../config/action.mjs";
import CrucibleBaseItemSheet from "./base-item.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "talent" type.
 */
export default class TalentSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["talent"],
    actions: {
      hookAdd: TalentSheet.#onHookAdd,
      hookDelete: TalentSheet.#onHookDelete
    }
  };

  /** @inheritDoc */
  static PARTS = foundry.utils.mergeObject(super.PARTS, {
    description: {template: "systems/crucible/templates/sheets/partials/item-description-basic.hbs"},
    config: {template: "systems/crucible/templates/sheets/partials/talent-config.hbs"},
    hooks: {
      id: "hooks",
      template: "systems/crucible/templates/sheets/partials/item-hooks.hbs"
    }
  }, {inplace: false});

  /** @inheritDoc */
  static TABS = foundry.utils.deepClone(super.TABS);
  static {
    this.TABS.sheet.push(
      {id: "actions", group: "sheet", icon: "fa-solid fa-bullseye", label: "ITEM.TABS.ACTIONS"},
      {id: "hooks", group: "sheet", icon: "fa-solid fa-cogs", label: "ITEM.TABS.HOOKS"}
    );
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( !game.user.isGM ) options.parts.findSplice(p => p === "hooks");
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getTabs() {
    const tabs = super._getTabs();
    if ( !game.user.isGM ) delete tabs.sheet.hooks;
    return tabs;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const nodeIds = Array.from(CrucibleTalentNode.nodes.keys());
    nodeIds.sort((a, b) => a.localeCompare(b));
    const hookIds = new Set(this.document.system.actorHooks.map(h => h.hook));
    return Object.assign(context, {
      actions: this.constructor.prepareActions(this.document.system.actions),
      actorHookChoices: Object.entries(SYSTEM.ACTOR_HOOKS).map(([hookId, cfg]) => {
        return {value: hookId, label: hookId, group: game.i18n.localize(cfg.group), disabled: hookIds.has(hookId)}
      }),
      actorHooks: this.#prepareActorHooks(),
      nodes: nodeIds.map(id => ({value: id, label: id}))
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for defined actor hooks attached to the Talent.
   * @returns {{label: string, hook: string, fn: string}[]}
   */
  #prepareActorHooks() {
    return this.document.system.actorHooks.map(h => {
      const cfg = SYSTEM.ACTOR_HOOKS[h.hook];
      const label = `${h.hook}(actor, ${cfg.argNames.join(", ")})`;
      return {label, ...h};
    });
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareSubmitData(event, form, formData) {
    const submitData = super._prepareSubmitData(event, form, formData);
    submitData.system.actorHooks ||= [];
    return submitData;
  }

  /* -------------------------------------------- */

  /**
   * Add a new hooked function to this Talent.
   * @this {TalentSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onHookAdd(event) {
    const hook = event.target.previousElementSibling.value
    const submitData = this._getSubmitData(event);
    submitData.system.actorHooks ||= [];
    if ( submitData.system.actorHooks.find(h => h.hook === hook ) ) {
      ui.notifications.warn(`${this.document.name} already declares a function for the "${hook}" hook.`);
      return;
    }
    submitData.system.actorHooks.push({hook, fn: "// Hook code here"});
    await this.document.update(submitData);
  }

  /* -------------------------------------------- */

  /**
   * Delete a hooked function from this Talent.
   * @this {TalentSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onHookDelete(event) {
    const hook = event.target.closest(".hook").querySelector("input[type=hidden]").value;
    const submitData = this._getSubmitData(event);
    submitData.system.actorHooks.findSplice(h => h.hook === hook);
    await this.document.update(submitData);
  }
}
