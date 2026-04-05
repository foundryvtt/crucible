const {api, sheets} = foundry.applications;

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
    }
  };

  /** @override */
  static TABS = {
    sheet: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "ITEM.TABS.Description"},
        {id: "config", icon: "fa-solid fa-cogs", label: "ITEM.TABS.Configuration"}
      ],
      initial: "description"
    }
  };

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

}
