import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying and configuring a Weapon type Item.
 * @type {ItemSheet}
 */
export default class Weapon extends ItemSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
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
    const context = super.getData();
    context.systemData = context.data.data;
    context.categories = SYSTEM.WEAPON.CATEGORIES;
    context.qualities = SYSTEM.QUALITY_TIERS;
    context.enchantments = SYSTEM.ENCHANTMENT_TIERS;
    return context;
  }
}
