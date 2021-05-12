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

  /** @inheritdoc */
  getData() {
    const context = super.getData();
    const systemData = context.systemData = context.data.data;
    context.categories = Object.entries(SYSTEM.ARMOR.CATEGORIES).map(e => {
      const [id, cat] = e;
      return { id, label: cat.label }
    });
    context.properties = Object.entries(SYSTEM.ARMOR.PROPERTIES).map(e => {
      const [id, label] = e;
        return {
          id: id,
          name: `data.properties.${id}`,
          label: label,
          checked: systemData.properties[id] === true
        }
    });
    return context;
  }
}
