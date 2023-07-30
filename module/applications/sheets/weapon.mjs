import CrucibleSheetMixin from "./crucible-sheet.mjs";

/**
 * A sheet application for displaying and configuring Items with the Weapon type.
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class WeaponSheet extends CrucibleSheetMixin(ItemSheet) {

  /** @override */
  static documentType = "weapon";

  /** @inheritDoc */
  static get defaultOptions() {
    return Object.assign(super.defaultOptions, {
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "config"}],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    const source = this.document.toObject();
    const allowedSlots = this.document.system.getAllowedEquipmentSlots();
    const context = {
      actions: this.constructor.prepareActions(this.document.system.actions),
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.document,
      source: source,
      categories: SYSTEM.WEAPON.CATEGORIES,
      damageTypes: SYSTEM.DAMAGE_TYPES,
      qualities: SYSTEM.QUALITY_TIERS,
      enchantments: SYSTEM.ENCHANTMENT_TIERS,
      equipmentSlots: Object.entries(this.document.system.constructor.WEAPON_SLOTS).reduce((obj, [k, v]) => {
        if ( allowedSlots.includes(v) ) obj[v] = game.i18n.localize(`WEAPON.SLOTS.${k}`);
        return obj;
      }, {}),
      usesReload: this.document.config.category.reload,
      tags: this.item.getTags(),
      animations: SYSTEM.WEAPON.ANIMATION_TYPES.reduce((obj, v) => {
        obj[v] = v;
        return obj;
      }, {})
    };

    // Weapon Properties
    context.properties = {};
    for ( let [id, prop] of Object.entries(SYSTEM.WEAPON.PROPERTIES) ) {
      const checked = source.system.properties.includes(id);
      context.properties[id] = {id, name: `system.properties.${id}`, label: prop.label, checked};
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _getSubmitData(updateData={}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    formData.system.properties = Object.entries(formData.system.properties).reduce((arr, p) => {
      if ( p[1] === true ) arr.push(p[0]);
      return arr;
    }, []);
    return formData;
  }
}
