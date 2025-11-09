import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "tool" type.
 */
export default class CrucibleToolItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "tool",
      includesActions: true,
      includesHooks: false,
      hasAdvancedDescription: true
    }
  };

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillOptions = [];
    for ( const {id: value, label} of Object.values(SYSTEM.SKILLS) ) {
      context.skillOptions.push({value, label, group: "Skills"});
    }
    for ( const [value, {label}] of Object.entries(SYSTEM.CRAFTING.TRAINING) ) {
      context.skillOptions.push({value, label, group: "Tradecraft"});
    }
    return context;
  }
}
