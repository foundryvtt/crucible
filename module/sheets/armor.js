import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Skills
 * @type {ItemSheet}
 */
export default class ArmorSheet extends ItemSheet {

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "armor"],
      template: `systems/${SYSTEM.id}/templates/sheets/armor.html`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Armor] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.categories = Object.entries(SYSTEM.armor.ARMOR_CATEGORIES).map(e => {
      const [id, cat] = e;
      return { id, label: cat.label }
    });
    data.properties = Object.entries(SYSTEM.armor.ARMOR_PROPERTIES).map(e => {
      const [id, label] = e;
        return {
          id: id,
          name: `data.properties.${id}`,
          label: label,
          checked: data.data.properties[id] === true
        }
    });
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    event.preventDefault();
    return this.object.update(formData);
  }
}
