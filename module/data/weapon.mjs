import * as fields from "/common/data/fields.mjs";
import PhysicalItemData from "./physical.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * A data structure which is specific to weapon items
 * @extends {PhysicalItemData}
 *
 * @property {number} attackBonus         The derived attack bonus this weapon provides
 * @property {number} damageBonus         The derived damage bonus this weapon provides
 * @property {number} damageMultiplier    The derived damage multiplier this weapon provides
 * @property {number} apCost              The derived action point cost of striking with this weapon
 * @property {number} rarity              The derived rarity score of this weapon
 */
export default class WeaponData extends PhysicalItemData {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      damageType: fields.field(fields.REQUIRED_STRING, {default: "slashing"}),
      block: {
        type: Object,
        required: true,
        default: {base: 0, bonus: 0},
        validate: this.validateDefense,
        validationError: '{name} {field} "{value}" must be an object \{base (number), bonus (number)\}'
      },
      parry: {
        type: Object,
        required: true,
        default: {base: 0, bonus: 0},
        validate: this.validateDefense,
        validationError: '{name} {field} "{value}" must be an object \{base (number), bonus (number)\}'
      },
    });
  }

  /** @override */
  static DEFAULT_CATEGORY = "simple1";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.WEAPON.PROPERTIES;

  /**
   * Validate the structure of a defense object, used for parry or block
   * @param {{base: number, bonus: number}} obj   The defense object
   * @returns {boolean}                           Is it a valid structure?
   */
  static validateDefense(obj) {
    if ( !("base" in obj) && Number.isNumeric(obj.base) ) return false;
    if ( !("bonus" in obj) && Number.isNumeric(obj.bonus) ) return false;
    return Array.from(Object.keys(obj)).length === 2;
  };

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Prepare derived data specific to the weapon type.
   */
  prepareData() {

    // Weapon Category
    const categories = SYSTEM.WEAPON.CATEGORIES;
    const category = categories[this.category] || categories.simple1;

    // Weapon Quality
    const qualities = SYSTEM.QUALITY_TIERS;
    const quality = qualities[this.quality] || qualities.standard;

    // Enchantment Level
    const enchantments = SYSTEM.ENCHANTMENT_TIERS;
    const enchantment = enchantments[this.enchantment] || enchantments.mundane;

    // Attack Attributes
    this.attackBonus = quality.bonus + enchantment.bonus;
    this.damageBonus = category.bonus;
    this.damageMultiplier = category.multiplier;
    this.apCost = category.ap;

    // Weapon Rarity
    this.rarity = quality.rarity + enchantment.rarity;

    // Weapon Properties
    for ( let p of this.properties ) {
      const prop = SYSTEM.WEAPON.PROPERTIES[p];
      if ( prop.ap ) this.apCost += prop.ap;
      if ( prop.rarity ) this.rarity += prop.rarity;
    }
    return {category, quality, enchantment};
  }

  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @returns {Object<string, string>}    The tags which describe this weapon
   */
  getTags() {
    const category = SYSTEM.WEAPON.CATEGORIES[this.category];
    const handsTag = category => {
      if ( category.hands === 2 ) return "WEAPON.HandsTwo";
      if ( category.main && category.off ) return "WEAPON.HandsEither";
      if ( category.main ) return "WEAPON.HandsMain";
      if ( category.off ) return "WEAPON.HandsOff";
    }
    const tags = {
      category: category.label,
      hands: game.i18n.localize(handsTag(category))
    }
    tags.damage = [
      this.attackBonus === 0 ? 0 : this.attackBonus.signedString(),
      this.damageBonus === 0 ? 0 : this.damageBonus.signedString(),
      `x${this.damageMultiplier}`
    ].join("/");
    for ( let p of this.properties ) {
      tags[p] = SYSTEM.WEAPON.PROPERTIES[p].label;
    }
    return tags;
  }
}