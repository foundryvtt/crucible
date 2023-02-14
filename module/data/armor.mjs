import PhysicalItemData from "./physical.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Armor type Items.
 */
export default class CrucibleArmor extends PhysicalItemData {

  /** @override */
  static DEFAULT_CATEGORY = "medium";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.ARMOR.PROPERTIES;

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(super.defineSchema(), {
      armor: new fields.SchemaField({
        base: new fields.NumberField({integer: true, nullable: false, initial: 0, min: 0}),
      }),
    });
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Weapon configuration data.
   * @type {{category: WeaponCategory, quality: ItemQualityTier, enchantment: ItemEnchantmentTier}}
   */
  config;

  /**
   * Item rarity score.
   * @type {number}
   */
  rarity;

  /* -------------------------------------------- */

  /**
   * Prepare derived data specific to the weapon type.
   */
  prepareBaseData() {

    // Armor Category
    const categories = SYSTEM.ARMOR.CATEGORIES;
    const category = categories[this.category] || categories[this.constructor.DEFAULT_CATEGORY];

    // Armor Quality
    const qualities = SYSTEM.QUALITY_TIERS;
    const quality = qualities[this.quality] || qualities.standard;

    // Enchantment Level
    const enchantments = SYSTEM.ENCHANTMENT_TIERS;
    const enchantment = enchantments[this.enchantment] || enchantments.mundane;

    // Armor Configuration
    this.config = {category, quality, enchantment};
    this.rarity = quality.rarity + enchantment.rarity;

    // Armor Defense
    this.armor.base = Math.clamped(this.armor.base, category.minArmor, category.maxArmor);
    this.armor.bonus = quality.bonus + enchantment.bonus;

    // Dodge Defense
    this.dodge = {start: 2 + Math.floor(this.armor.base / 2)};
    this.dodge.base = Math.clamped(SYSTEM.PASSIVE_BASE - this.dodge.start, 0, 8);

    // Broken Armor
    if ( this.broken ) {
      this.armor.base = Math.floor(this.armor.base / 2);
      this.armor.bonus = Math.floor(this.armor.bonus / 2);
    }

    // Armor Properties
    for ( let p of this.properties ) {
      const prop = SYSTEM.ARMOR.PROPERTIES[p];
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

    // Short Tags
    const tags = {
      armor: `${this.armor.base + this.armor.bonus} Armor`
    }
    if ( scope === "short" ) return tags;

    // Full Tags
    tags.category = this.config.category.label;
    for ( let p of this.properties ) {
      tags[p] = SYSTEM.ARMOR.PROPERTIES[p].label;
    }
    return tags;
  }
}
