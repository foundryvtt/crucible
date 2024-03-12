import CrucibleBaseItemSheet from "./base-item.mjs";

export default class ArmorSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["armor"]
  };

  static {
    this.PARTS.config.template = `systems/crucible/templates/sheets/partials/armor-config.hbs`
  }

  /* -------------------------------------------- */

  /** @override */
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

  /** @override */
  _getTabs() {
    const tabs = {
      config: {id: "config", group: "sheet", icon: "fa-solid fa-cogs", label: "ARMOR.SHEET.CONFIGURATION",
        active: false, cssClass: ""},
      actions: {id: "actions", group: "sheet", icon: "fa-solid fa-bullseye", label: "ARMOR.SHEET.ACTIONS",
        active: false, cssClass: ""}
    }
    for ( const v of Object.values(tabs) ) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? "active" : "";
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /**
   * A custom form field widget for rendering armor defense.
   */
  #armorWidget(field, groupConfig, inputConfig) {
    const config = this.document.system.config.category.armor;
    const {widget, fields} = ArmorSheet.#createDefenseWidget(field, groupConfig, inputConfig, config);
    fields.appendChild(ArmorSheet.#createElement("label", {innerText: game.i18n.localize("ARMOR.SHEET.ARMOR_BONUS")}));
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
    const {widget, fields} = ArmorSheet.#createDefenseWidget(field, groupConfig, inputConfig, config);
    fields.appendChild(ArmorSheet.#createElement("label", {innerText: game.i18n.localize("ARMOR.SHEET.DODGE_SCALING")}));
    const dodgeStart = `${this.document.system.dodge.start} ${crucible.CONST.ABILITIES.dexterity.abbreviation}`;
    fields.appendChild(foundry.applications.fields.createTextInput({value: dodgeStart, disabled: true}));
    return widget;
  }

  /* -------------------------------------------- */

  /**
   * A custom status checkbox widget.
   */
  #statusWidget(field, groupConfig, inputConfig) {
    const checkbox = document.createElement("label");
    checkbox.className = "checkbox";
    checkbox.replaceChildren(field.toInput(inputConfig), document.createTextNode(field.label));
    return checkbox;
  }

  /* -------------------------------------------- */

  /**
   * A custom form field widget used to render armor properties.
   */
  #propertiesWidget(field, groupConfig, inputConfig) {
    const widget = ArmorSheet.#createElement("fieldset", {className: "item-properties"});
    widget.appendChild(ArmorSheet.#createElement("legend", {innerText: field.label}));
    Object.entries(SYSTEM.ARMOR.PROPERTIES).map(([id, prop]) => {
      const f = new foundry.data.fields.BooleanField({label: prop.label}, {name: id, parent: field});
      widget.appendChild(this.#statusWidget(f, {}, {value: inputConfig.value.has(id)}));
    });
    return widget;
  }

  /* -------------------------------------------- */

  /**
   * A helper for quickly creating HTML elements.
   * @returns {HTMLElement}
   */
  static #createElement(tagName, {innerText, className}={}) {
    const el = document.createElement(tagName);
    if ( innerText ) el.innerText = innerText;
    if ( className ) el.className = className;
    return el;
  }

  /* -------------------------------------------- */

  /**
   * Logic common to both the armor and dodge widgets.
   * @returns {widget: HTMLDivElement, fields: HTMLDivElement}
   */
  static #createDefenseWidget(field, groupConfig, inputConfig, config) {
    const widget = ArmorSheet.#createElement("div", {className: "form-group slim defense"});
    widget.appendChild(ArmorSheet.#createElement("label", {innerText: field.label}));
    const fields = widget.appendChild(ArmorSheet.#createElement("div", {className: "form-fields"}));
    fields.appendChild(ArmorSheet.#createElement("label", {innerText: field.fields.base.label}));
    fields.appendChild(field.fields.base.toInput({value: inputConfig.value.base, min: config.min,
      max: config.max, step: 1}));
    return {widget, fields}
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareSubmitData(formData) {
    const submitData = super._prepareSubmitData(formData);
    submitData.system.properties = Object.entries(submitData.system.properties).reduce((arr, p) => {
      if ( p[1] === true ) arr.push(p[0]);
      return arr;
    }, []);
    return submitData;
  }
}
