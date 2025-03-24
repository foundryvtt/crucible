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
      armorWidget: this.#armorWidget.bind(this),
      dodgeWidget: this.#dodgeWidget.bind(this),
      propertiesWidget: this.#propertiesWidget.bind(this),
      scaledPrice: new foundry.data.fields.StringField({label: game.i18n.localize("ARMOR.SHEET.SCALED_PRICE")})
    });
    return context;
  }

  /* -------------------------------------------- */

  /**
   * A custom form field widget for rendering armor defense.
   */
  #armorWidget(field, groupConfig, inputConfig) {
    const config = this.document.system.config.category.armor;
    const {widget, fields} = CrucibleArmorItemSheet.#createDefenseWidget(field, groupConfig, inputConfig, config);
    fields.appendChild(CrucibleArmorItemSheet._createElement("label", {innerText: game.i18n.localize("ARMOR.SHEET.ARMOR_BONUS")}));
    const armorBonus = this.document.system.armor.bonus;
    fields.appendChild(foundry.applications.fields.createNumberInput({value: armorBonus, disabled: true}));
    return widget;
  }

  /* -------------------------------------------- */

  /**
   * A custom form field widget for rendering dodge defense.
   */
  #dodgeWidget(field, groupConfig, inputConfig) {
    const config = this.document.system.config.category.dodge;
    const {widget, fields} = CrucibleArmorItemSheet.#createDefenseWidget(field, groupConfig, inputConfig, config);
    fields.appendChild(CrucibleArmorItemSheet._createElement("label", {innerText: game.i18n.localize("ARMOR.SHEET.DODGE_SCALING")}));
    const dodgeStart = `${this.document.system.dodge.start} ${crucible.CONST.ABILITIES.dexterity.abbreviation}`;
    fields.appendChild(foundry.applications.fields.createTextInput({value: dodgeStart, disabled: true}));
    return widget;
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

  /* -------------------------------------------- */

  /**
   * Logic common to both the armor and dodge widgets.
   * @returns {widget: HTMLDivElement, fields: HTMLDivElement}
   */
  static #createDefenseWidget(field, groupConfig, inputConfig, config) {
    const widget = CrucibleArmorItemSheet._createElement("div", {className: "form-group slim defense"});
    widget.appendChild(CrucibleArmorItemSheet._createElement("label", {innerText: field.label}));
    const fields = widget.appendChild(CrucibleArmorItemSheet._createElement("div", {className: "form-fields"}));
    fields.appendChild(CrucibleArmorItemSheet._createElement("label", {innerText: field.fields.base.label}));
    fields.appendChild(field.fields.base.toInput({value: inputConfig.value.base}));
    return {widget, fields}
  }
}
