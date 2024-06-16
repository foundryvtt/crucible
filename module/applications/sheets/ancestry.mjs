import CrucibleBaseItemSheet from "./base-item.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "ancestry" type.
 */
export default class AncestrySheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "ancestry"
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }
}
