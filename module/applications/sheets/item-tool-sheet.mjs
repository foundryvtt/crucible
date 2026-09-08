import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "tool" type.
 */
export default class CrucibleToolItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "tool",
      includesActions: true,
      includesHooks: true,
      hasAdvancedDescription: true
    }
  };

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillOptions = Object.values(SYSTEM.SKILLS).map(({id: value, label, group}) => {
      return {value, label, group: SYSTEM.PROFICIENCY.GROUPS[group].label};
    });
    return context;
  }
}
