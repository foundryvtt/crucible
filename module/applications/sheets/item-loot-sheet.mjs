import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "consumable" type.
 */
export default class CrucibleLootItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "loot",
      includesActions: false,
      includesHooks: false,
      hasAdvancedDescription: true
    }
  };

  /** @inheritDoc */
  static PARTS = {...super.PARTS};

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }
}
