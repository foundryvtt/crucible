import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "accessory" type.
 */
export default class CrucibleAccessoryItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "accessory",
      includesActions: true,
      includesHooks: true,
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
