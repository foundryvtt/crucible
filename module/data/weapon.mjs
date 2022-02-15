import * as fields from "/common/data/fields.mjs";
import PhysicalItemData from "./physical.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * A data structure which is specific to weapon items
 * @extends {PhysicalItemData}
 *
 * @property {object} config              Weapon-specific configuration data
 * @property {number} attackBonus         The derived attack bonus this weapon provides
 * @property {number} damageBonus         The derived damage bonus this weapon provides
 * @property {number} damageMultiplier    The derived damage multiplier this weapon provides
 * @property {number} actionCost          The derived action point cost of striking with this weapon
 * @property {number} rarity              The derived rarity score of this weapon
 */
export default class WeaponData extends PhysicalItemData {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      damageType: new fields.StringField({required: true, choices: SYSTEM.DAMAGE_TYPES}),
      block: new fields.SchemaField({
        base: new fields.NumberField({required: true, nullable: false, integer: true, min: 0}),
        bonus: new fields.NumberField({required: true, nullable: false, integer: true, min: 0})
      }),
      parry: new fields.SchemaField({
        base: new fields.NumberField({required: true, nullable: false, integer: true, min: 0}),
        bonus: new fields.NumberField({required: true, nullable: false, integer: true, min: 0})
      })
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
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _initializeSource(data) {
    data = super._initializeSource(data);

    // Weapon Category
    const categories = SYSTEM.WEAPON.CATEGORIES;
    const category = categories[data.category] || categories.simple1;

    // Weapon Quality
    const qualities = SYSTEM.QUALITY_TIERS;
    const quality = qualities[data.quality] || qualities.standard;

    // Enchantment Level
    const enchantments = SYSTEM.ENCHANTMENT_TIERS;
    const enchantment = enchantments[data.enchantment] || enchantments.mundane;
    this.config = {category, quality, enchantment};
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Prepare derived data specific to the weapon type.
   */
  prepareData() {
    const {category, quality, enchantment} = this.config;

    // Attack Attributes
    this.attackBonus = enchantment.bonus;
    this.damageBonus = category.bonus + quality.bonus;
    this.damageMultiplier = category.multiplier;
    this.actionCost = category.actionCost;

    // Weapon Rarity
    this.rarity = quality.rarity + enchantment.rarity;

    // Weapon Properties
    for ( let p of this.properties ) {
      const prop = SYSTEM.WEAPON.PROPERTIES[p];
      if ( prop.actionCost ) this.actionCost += prop.actionCost;
      if ( prop.rarity ) this.rarity += prop.rarity;
    }
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Object<string, string>}    The tags which describe this weapon
   */
  getTags(scope="full") {
    const tags = {};
    const category = this.document.config.category;
    const handsTag = category => {
      if ( category.hands === 2 ) return "WEAPON.HandsTwo";
      if ( category.main && category.off ) return "WEAPON.HandsEither";
      if ( category.main ) return "WEAPON.HandsMain";
      if ( category.off ) return "WEAPON.HandsOff";
    }

    // Full Tags
    if ( scope === "full") {
      tags.category = category.label;
      tags.hands = game.i18n.localize(handsTag(category));
    }

    // Short Tags
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
