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
      submitOnChange: true
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  get title() {
    return `[Weapon] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData() {
    const context = super.getData();
    context.systemData = context.data.data;

    // Configuration Categories
    context.categories = SYSTEM.WEAPON.CATEGORIES;
    context.damageTypes = SYSTEM.DAMAGE_TYPES;
    context.qualities = SYSTEM.QUALITY_TIERS;
    context.enchantments = SYSTEM.ENCHANTMENT_TIERS;

    // Weapon Header Tags
    const headerTags = [
      context.systemData.damage,
      SYSTEM.DAMAGE_TYPES[context.systemData.damageType].label,
      context.systemData.attackBonus ? `${context.systemData.attackBonus.signedString()} Bonus` : "",
      context.systemData.apCost ? `${context.systemData.apCost.signedString()} Action Cost` : "",
      context.systemData.rarity ? `Rarity ${context.systemData.rarity}` : ""
    ];

    // Weapon Properties
    context.properties = {};
    for ( let [id, prop] of Object.entries(SYSTEM.WEAPON.PROPERTIES) ) {
      const checked = context.systemData.properties.includes(id);
      if ( checked ) headerTags.push(prop.label);
      context.properties[id] = {label: prop.label, checked};
    }
    context.headerTags = headerTags.filter(t => !!t);
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
