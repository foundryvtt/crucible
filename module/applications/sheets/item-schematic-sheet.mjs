import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "schematic" type.
 */
export default class CrucibleSchematicItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "schematic",
      includesActions: false,
      includesHooks: false,
      hasAdvancedDescription: true
    }
  };

  static ITEM_PARTIAL = "systems/crucible/templates/sheets/item/included-equipment.hbs";
  static INPUT_PARTIAL = "systems/crucible/templates/sheets/item/schematic-input.hbs";

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
    this.PARTS.components = {
      id: "components",
      template: "systems/crucible/templates/sheets/item/schematic-components.hbs",
      templates: [this.ITEM_PARTIAL, this.INPUT_PARTIAL]
    }
    this.TABS.sheet.push({
      id: "components",
      group: "sheet",
      icon: "fa-solid fa-list-ol",
      label: "SCHEMATIC.SHEET.COMPONENTS"
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.itemPartial = this.constructor.ITEM_PARTIAL;
    context.inputPartial = this.constructor.INPUT_PARTIAL;
    const {inputs, outputs} = await this.#prepareItems();
    context.inputs = inputs;
    context.outputs = outputs;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * TODO Prepare the ingredients and outputs rendered in the schematic sheet.
   * @returns {Promise<{inputs: object[], outputs: object[]}>}
   */
  async #prepareItems() {
    return {
      inputs: [{items: []}],
      outputs: []
    }
  }
}
