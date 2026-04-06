const {api, sheets} = foundry.applications;
import {formatHookContext} from "../../hooks/_module.mjs";

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
    hooks: {
      id: "hooks",
      template: "systems/crucible/templates/sheets/effect/affix-hooks.hbs",
      templates: ["systems/crucible/templates/sheets/partials/hook.hbs"],
      scrollable: [""]
    }
  };

  /** @override */
  static TABS = {
    sheet: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "ITEM.TABS.Description"},
        {id: "config", icon: "fa-solid fa-cogs", label: "ITEM.TABS.Configuration"},
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
      case "hooks":
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

}
