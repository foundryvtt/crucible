import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "spell" type.
 */
export default class CrucibleSpellItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "spell",
      includesActions: true,
      includesHooks: true
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getTabs() {
    const tabs = super._getTabs();
    if ( !this.document.system.isConfigured ) delete tabs.sheet.actions;
    return tabs;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      isConfigured: this.document.system.isConfigured
    });
  }
}
