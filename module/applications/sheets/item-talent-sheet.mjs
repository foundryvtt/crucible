import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "talent" type.
 */
export default class CrucibleTalentItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "talent",
      includesActions: true,
      includesHooks: true
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.trainingRanks = Object.values(SYSTEM.TALENT.TRAINING_RANKS).reduce((arr, r) => {
      if ( r.rank > 0 ) arr.push({value: r.rank, label: r.label})
      return arr;
    }, []);
    return context;
  }
}
