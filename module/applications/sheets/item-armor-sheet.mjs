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
      includesHooks: true,
      hasAdvancedDescription: true
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
  }
}
