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
}
