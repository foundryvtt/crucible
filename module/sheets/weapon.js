import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying and configuring a Weapon type Item.
 * @type {ItemSheet}
 */
export default class Weapon extends ItemSheet {

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "weapon"],
      template: `systems/${SYSTEM.id}/templates/sheets/weapon.html`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Weapon] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.categories = Object.entries(SYSTEM.WEAPON.CATEGORIES).map(e => {
      const [id, cat] = e;
      return { id, label: cat.label }
    });
    return data;
  }
}
