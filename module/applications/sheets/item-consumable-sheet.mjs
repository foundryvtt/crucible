import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "consumable" type.
 */
export default class CrucibleConsumableItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "consumable",
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
