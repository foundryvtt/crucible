import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "armor" type.
 */
export default class CrucibleArmorItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "armor",
      includesActions: true,
      hasAdvancedDescription: true
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    Object.assign(context, {
      propertiesWidget: this.#propertiesWidget.bind(this),
      scaledPrice: new foundry.data.fields.StringField({label: game.i18n.localize("ARMOR.SHEET.SCALED_PRICE")})
    });
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Render the properties field as a multi-checkboxes element.
   * @returns {HTMLMultiCheckboxElement}
   */
  #propertiesWidget(field, groupConfig, inputConfig) {
    inputConfig.name = field.fieldPath;
    inputConfig.options = Object.entries(SYSTEM.ARMOR.PROPERTIES).map(([k, v]) => ({value: k, label: v.label}));
    inputConfig.type = "checkboxes";
    return foundry.applications.fields.createMultiSelectInput(inputConfig);
  }
}
