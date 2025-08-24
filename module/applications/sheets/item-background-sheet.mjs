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

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      languages: this.#prepareLanguages()
    });
  }

  /* -------------------------------------------- */

  #prepareLanguages() {
    const categories = crucible.CONFIG.languageCategories;
    const options = [];
    for ( const [value, {label, category}] of Object.entries(crucible.CONFIG.languages) ) {
      options.push({value, label, group: categories[category]?.label});
    }
    return options;
  }
}
