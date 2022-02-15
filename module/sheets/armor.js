import { SYSTEM } from "../config/system.js";

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
      template: `systems/${SYSTEM.id}/templates/sheets/armor.html`,
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
  getData() {
    const context = super.getData();
    const systemData = context.systemData = context.data.data;

    // Tags
    context.tags = this.item.getTags();

    // Categories
    context.categories = Object.entries(SYSTEM.ARMOR.CATEGORIES).map(e => {
      const [id, cat] = e;
      return { id, label: cat.label }
    });

    // Armor Properties
    context.properties = {};
    for ( let [id, prop] of Object.entries(SYSTEM.ARMOR.PROPERTIES) ) {
      context.properties[id] = {
        id: id,
        name: `data.properties.${id}`,
        label: prop.label,
        checked: systemData.properties.has(id)
      };
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _getSubmitData(updateData={}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    formData.data.properties = Object.entries(formData.data.properties).reduce((arr, p) => {
      if ( p[1] === true ) arr.push(p[0]);
      return arr;
    }, []);
    return formData;
  }
}
