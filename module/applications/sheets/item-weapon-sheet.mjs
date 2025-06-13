import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "weapon" type.
 */
export default class CrucibleWeaponItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "weapon",
      includesActions: true,
      includesHooks: true,
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

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const allowedSlots = this.document.system.getAllowedEquipmentSlots();
    Object.assign(context, {
      equipmentSlots: Object.entries(SYSTEM.WEAPON.SLOTS.choices).reduce((arr, [value, label]) => {
        arr.push({value, label, disabled: !allowedSlots.includes(Number(value))});
        return arr;
      }, []),
      usesReload: this.document.config.category.reload,
    });
    return context;
  }
}
