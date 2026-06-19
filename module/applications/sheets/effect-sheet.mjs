const {api, sheets} = foundry.applications;

/**
 * The default sheet for Crucible ActiveEffects.
 * Extends the core sheet with crucible theming: a crucible header, a dedicated Description tab, and a Configuration
 * tab (replacing the core Details) that groups the standard and system fields into fieldsets. The core Duration and
 * Changes parts are retained.
 * @extends {ActiveEffectConfig}
 */
export default class CrucibleActiveEffectSheet extends sheets.ActiveEffectConfig {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "effect", "standard-form"],
    form: {submitOnChange: true, closeOnSubmit: false}
  };

  /** @override */
  static PARTS = {
    header: {template: "systems/crucible/templates/sheets/effect/effect-header.hbs"},
    tabs: sheets.ActiveEffectConfig.PARTS.tabs,
    description: {template: "systems/crucible/templates/sheets/effect/effect-description.hbs"},
    config: {template: "systems/crucible/templates/sheets/effect/effect-config.hbs", scrollable: [""]},
    duration: sheets.ActiveEffectConfig.PARTS.duration,
    changes: sheets.ActiveEffectConfig.PARTS.changes
  };

  /** @override */
  static TABS = {
    sheet: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "ITEM.TABS.description"},
        {id: "config", icon: "fa-solid fa-cogs", label: "ITEM.TABS.config"},
        {id: "duration", icon: "fa-solid fa-clock"},
        {id: "changes", icon: "fa-solid fa-gears"}
      ],
      initial: "description",
      labelPrefix: "EFFECT.TABS"
    }
  };

  /** @override */
  tabGroups = {sheet: "description"};

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    const effect = this.document;
    switch ( partId ) {
      case "header":
        partContext.tags = effect.system.getTags?.() ?? {};
        break;
      case "description":
        partContext.isEditable = this.isEditable;
        partContext.descriptionField = effect.schema.fields.description;
        partContext.descriptionValue = partContext.source.description;
        partContext.descriptionHTML = await CONFIG.ux.TextEditor.enrichHTML(partContext.source.description, {
          relativeTo: effect, secrets: effect.isOwner
        });
        break;
      case "config":
        partContext.systemFields = effect.system.schema.fields;
        partContext.fieldDisabled = this.isEditable ? "" : "disabled";
        partContext.propertiesWidget = this.#propertiesWidget.bind(this);
        partContext.isActorEffect = effect.parent?.documentName === "Actor";
        partContext.isItemEffect = effect.parent?.documentName === "Item";
        partContext.statuses = Object.values(CONFIG.statusEffects).map(s => ({value: s.id, label: _loc(s.name)}));
        partContext.showIconOptions = Object.entries(CONST.ACTIVE_EFFECT_SHOW_ICON).map(([k, value]) => ({
          value, label: _loc(`EFFECT.SHOW_ICON.${k.toLowerCase()}`)
        })).reverse();
        break;
    }
    return partContext;
  }

  /* -------------------------------------------- */

  /** @override */
  _attachFrameListeners() {
    // Deliberately skip ActiveEffectConfig#_attachFrameListeners which strips the editor's inline Save button
    api.DocumentSheetV2.prototype._attachFrameListeners.call(this);
  }

  /* -------------------------------------------- */

  /**
   * Render the properties field as a multi-checkboxes element.
   * @param {foundry.data.fields.DataField} field
   * @param {object} _groupConfig
   * @param {object} inputConfig
   * @returns {HTMLElement}
   */
  #propertiesWidget(field, _groupConfig, inputConfig) {
    inputConfig.name = field.fieldPath;
    inputConfig.options = Object.entries(SYSTEM.EFFECTS.PROPERTIES).map(([value, p]) => ({value, label: p.label}));
    inputConfig.type = "checkboxes";
    return foundry.applications.fields.createMultiSelectInput(inputConfig);
  }
}
