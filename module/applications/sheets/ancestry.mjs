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

  /* -------------------------------------------- */

  /** @override */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);

    // Only allow (primary,secondary) or (resistance,vulnerability) to be submitted if both are defined
    const pairs = [["primary", "secondary"], ["resistance", "vulnerability"]];
    for ( const [a, b] of pairs ) {
      if ( !(submitData.system[a] && submitData.system[b]) ) {
        delete submitData.system[a];
        delete submitData.system[b];
      }
    }
    return submitData;
  }
}
