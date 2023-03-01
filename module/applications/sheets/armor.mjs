import { SYSTEM } from "../../config/system.js";

/**
 * A sheet application for displaying Armor items
 * @extends {ItemSheet}
 */
export default class ArmorSheet extends ItemSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "armor"],
      template: `systems/${SYSTEM.id}/templates/sheets/armor.hbs`,
      resizable: false,
      submitOnChange: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Armor] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    const context = {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.document,
      source: this.document.toObject(),
      category: this.document.system.config.category,
      categories: SYSTEM.ARMOR.CATEGORIES,
      qualities: SYSTEM.QUALITY_TIERS,
      enchantments: SYSTEM.ENCHANTMENT_TIERS,
      tags: this.item.getTags(),
    };

    // Armor Properties
    context.properties = {};
    for ( let [id, prop] of Object.entries(SYSTEM.ARMOR.PROPERTIES) ) {
      context.properties[id] = {
        id: id,
        name: `system.properties.${id}`,
        label: prop.label,
        checked: this.item.system.properties.has(id)
      };
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
