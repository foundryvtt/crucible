const {api, sheets} = foundry.applications;
import {formatHookContext, HOOK_PARTIAL} from "../../hooks/_module.mjs";

/**
 * A specialized sheet for configuring affix-type ActiveEffects.
 */
export default class CrucibleAffixEffectSheet extends api.HandlebarsApplicationMixin(sheets.ActiveEffectConfig) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "item", "affix", "standard-form"],
    tag: "form",
    position: {
      width: 560,
      height: "auto"
    },
    actions: {
      actionAdd: CrucibleAffixEffectSheet.#onActionAdd,
      actionDelete: CrucibleAffixEffectSheet.#onActionDelete,
      actionEdit: CrucibleAffixEffectSheet.#onActionEdit,
      hookToggleSource: CrucibleAffixEffectSheet.#onHookToggleSource
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
    window: {
      resizable: true
    }
  };

  /**
   * The template partial used to render a single action.
   * @type {string}
   */
  static ACTION_PARTIAL = "systems/crucible/templates/sheets/item/included-action.hbs";

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/effect/affix-header.hbs"
    },
    tabs: {
      id: "tabs",
      template: "templates/generic/tab-navigation.hbs"
    },
    description: {
      id: "description",
      template: "systems/crucible/templates/sheets/effect/affix-description.hbs"
    },
    config: {
      id: "config",
      template: "systems/crucible/templates/sheets/effect/affix-config.hbs",
      scrollable: [""]
    },
    actions: {
      id: "actions",
      template: "systems/crucible/templates/sheets/item/item-actions.hbs",
      templates: [CrucibleAffixEffectSheet.ACTION_PARTIAL],
      scrollable: [""]
    },
    hooks: {
      id: "hooks",
      template: "systems/crucible/templates/sheets/effect/affix-hooks.hbs",
      templates: [HOOK_PARTIAL],
      scrollable: [""]
    }
  };

  /** @override */
  static TABS = {
    sheet: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "ITEM.TABS.Description"},
        {id: "config", icon: "fa-solid fa-cogs", label: "ITEM.TABS.Configuration"},
        {id: "actions", icon: "fa-solid fa-bolt", label: "ITEM.TABS.Actions"},
        {id: "hooks", icon: "fa-solid fa-code", label: "ITEM.TABS.Hooks"}
      ],
      initial: "description"
    }
  };

  /**
   * Track which module hooks have their source expanded.
   * @type {Set<string>}
   */
  #expandedHooks = new Set();

  /* -------------------------------------------- */

  /** @override */
  async _preparePartContext(partId, context) {
    context = await super._preparePartContext(partId, context);
    if ( partId in (context.tabs ?? {}) ) context.tab = context.tabs[partId];
    const effect = this.document;
    const source = effect.toObject();
    switch ( partId ) {
      case "header":
        context.source = source;
        context.effect = effect;
        context.tags = this.#prepareTags();
        break;
      case "description":
        context.descriptionField = effect.schema.fields.description;
        context.descriptionValue = source.description;
        context.descriptionHTML = await CONFIG.ux.TextEditor.enrichHTML(source.description, {
          relativeTo: effect, secrets: effect.isOwner
        });
        context.isEditable = this.isEditable;
        break;
      case "config":
        context.source = source;
        context.fields = effect.system.schema.fields;
        context.isEditable = this.isEditable;
        context.fieldDisabled = this.isEditable ? "" : "disabled";
        context.itemTypeOptions = Array.from(SYSTEM.ITEM.AFFIXABLE_ITEM_TYPES).map(t => ({
          value: t, label: _loc(CONFIG.Item.typeLabels[t] ?? t)
        }));
        break;
      case "actions":
        context.actionPartial = this.constructor.ACTION_PARTIAL;
        const editorCls = CONFIG.ux.TextEditor;
        const editorOptions = {relativeTo: effect, secrets: effect.isOwner};
        context.actionGroups = [{
          legend: null,
          canAdd: true,
          isEditable: this.isEditable,
          actions: await Promise.all((effect.system.actions ?? []).map(async action => ({
            id: action.id,
            name: action.name,
            img: action.img,
            condition: action.condition,
            description: await editorCls.enrichHTML(action.description, editorOptions),
            tags: action.getTags(),
            effects: action.effects
          })))
        }];
        break;
      case "hooks":
        context.hookPartial = HOOK_PARTIAL;
        const affixHookFns = crucible.api.hooks.affix?.[effect.system.identifier];
        context.moduleHooks = [];
        if ( affixHookFns ) {
          for ( const h of formatHookContext(affixHookFns, SYSTEM.ACTOR.HOOKS) ) {
            h.expanded = this.#expandedHooks.has(h.hookId);
            context.moduleHooks.push(h);
          }
        }
        break;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare header tags for the affix sheet.
   * @returns {Record<string, string>}
   */
  #prepareTags() {
    const tags = {};
    const affixType = SYSTEM.ITEM.AFFIX_TYPES[this.document.system.affixType];
    if ( affixType ) tags.affixType = _loc(affixType);
    const tier = this.document.system.tier;
    tags.tier = _loc("AFFIX.TierDisplay", {value: tier.value, max: tier.max});
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Toggle the display of a module-defined hook function source.
   * @this {CrucibleAffixEffectSheet}
   * @param {PointerEvent} _event         The initiating click event
   * @param {HTMLElement} target           The clicked button element
   */
  static #onHookToggleSource(_event, target) {
    const fieldset = target.closest(".module-hook");
    const hookId = fieldset.dataset.hookId;
    if ( this.#expandedHooks.has(hookId) ) this.#expandedHooks.delete(hookId);
    else this.#expandedHooks.add(hookId);
    this.render({parts: ["hooks"]});
  }

  /* -------------------------------------------- */

  /**
   * Add a new Action to the Affix.
   * @this {CrucibleAffixEffectSheet}
   * @param {PointerEvent} _event
   */
  static async #onActionAdd(_event) {
    const effect = this.document;
    const actions = effect.system.toObject().actions;
    const suffix = actions.length ? actions.length + 1 : "";
    const actionData = {id: crucible.api.methods.generateId(effect.name)};
    if ( actions.length ) {
      actionData.id += suffix;
      actionData.name = `${effect.name} ${suffix}`;
    }
    const action = new crucible.api.models.CrucibleAction(actionData, {parent: effect.system});
    actions.push(action.toObject());
    await effect.update({"system.actions": actions}, {diff: false});
    const created = effect.system.actions.at(-1);
    await created.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Delete an Action from the Affix.
   * @this {CrucibleAffixEffectSheet}
   * @param {PointerEvent} _event
   * @param {HTMLAnchorElement} button
   */
  static async #onActionDelete(_event, button) {
    const effect = this.document;
    const actionId = button.closest(".action").dataset.actionId;
    const action = effect.system.actions.find(a => a.id === actionId);
    if ( !action ) throw new Error(`Invalid Action id "${actionId}" requested for deletion`);
    const confirm = await api.DialogV2.confirm({
      title: _loc("ACTION.ACTIONS.Delete", {name: action.name}),
      content: `<p>${_loc("ACTION.ACTIONS.DeleteConfirm", {
        name: action.name,
        parent: effect.name,
        type: _loc("AFFIX.Affix")
      })}</p>`
    });
    if ( !confirm ) return;
    if ( action.sheet.rendered ) action.sheet.close();
    const actions = effect.system.toObject().actions;
    const idx = actions.findIndex(a => a.id === actionId);
    actions.splice(idx, 1);
    await effect.update({"system.actions": actions}, {diff: false});
  }

  /* -------------------------------------------- */

  /**
   * Edit an Action belonging to the Affix.
   * @this {CrucibleAffixEffectSheet}
   * @param {PointerEvent} _event
   * @param {HTMLAnchorElement} button
   */
  static async #onActionEdit(_event, button) {
    const actionId = button.closest(".action").dataset.actionId;
    const action = this.document.system.actions.find(a => a.id === actionId);
    await action.sheet.render(true);
  }

}
