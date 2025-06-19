import CrucibleActorDetailsItemSheet from "./item-actor-details-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "background" type.
 */
export default class CrucibleBackgroundItemSheet extends CrucibleActorDetailsItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "background"
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }
}
