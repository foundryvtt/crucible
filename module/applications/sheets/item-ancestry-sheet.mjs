import CrucibleActorDetailsItemSheet from "./item-actor-details-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "ancestry" type.
 */
export default class CrucibleAncestryItemSheet extends CrucibleActorDetailsItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "ancestry"
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Render the blank option of the temperature select to surface the humanoid category default
    const tier = SYSTEM.TEMPERATURE_TIERS[SYSTEM.ACTOR.CREATURE_CATEGORIES.humanoid.temperature];
    context.temperatureBlank = tier ? _loc("ANCESTRY.SHEET.TemperatureBlank", {temperature: tier.label}) : "";
    return context;
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
