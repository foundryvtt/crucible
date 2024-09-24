import CrucibleBaseItemSheet from "./base-item.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "spell" type.
 */
export default class SpellSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "spell",
      includesActions: true,
      includesHooks: true
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /* -------------------------------------------- */

  /**
   * TODO this preprocessing of multi-select options should not be necessary in V13 and can be removed.
   * @inheritDoc
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const choices = foundry.data.fields.StringField._getChoices;
    context.runeOptions = choices({choices: context.fields.runes.element.choices, valueAttr: "id", labelAttr: "name"});
    context.gestureOptions = choices({choices: context.fields.gestures.element.choices, valueAttr: "id", labelAttr: "name"});
    context.inflectionOptions = choices({choices: context.fields.inflections.element.choices, valueAttr: "id", labelAttr: "name"});
    return context;
  }
}
