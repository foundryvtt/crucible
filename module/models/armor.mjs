import CruciblePhysicalItem from "./physical.mjs";
import { SYSTEM } from "../config/system.mjs";

/**
 * Data schema, attributes, and methods specific to Armor type Items.
 */
export default class CrucibleArmor extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = SYSTEM.ARMOR.CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "medium";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.ARMOR.PROPERTIES;

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "ARMOR"];

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
      dodge: new fields.SchemaField({
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
    const categoryId = this.category in SYSTEM.ARMOR.CATEGORIES ? this.category : this.constructor.DEFAULT_CATEGORY;
    const category = SYSTEM.ARMOR.CATEGORIES[categoryId];

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
    this.armor.base = Math.clamp(this.armor.base, category.armor.min, category.armor.max);
    this.armor.bonus = quality.bonus + enchantment.bonus;

    // Dodge Defense
    this.dodge.base = Math.clamp(this.dodge.base, category.dodge.min, category.dodge.max);
    this.dodge.start = category.dodge.start;

    // Armor Properties
    for ( let p of this.properties ) {
      const prop = SYSTEM.ARMOR.PROPERTIES[p];
      if ( prop.rarity ) this.rarity += prop.rarity;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareDerivedData() {
    if ( this.broken ) {
      this.armor.base = Math.floor(this.armor.base / 2);
      this.armor.bonus = Math.floor(this.armor.bonus / 2);
      this.rarity -= 2;
    }
    this.price = this._preparePrice();
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
    tags.category = this.config.category.label;
    for ( let p of this.properties ) {
      tags[p] = SYSTEM.ARMOR.PROPERTIES[p].label;
    }
    tags.armor = `${this.armor.base + this.armor.bonus} Armor`;
    const actor = this.parent.parent;
    if ( !actor ) tags.dodge = `${this.dodge.base}+ Dodge`;
    else {
      const dodgeBonus = Math.max(actor.system.abilities.dexterity.value - this.dodge.start, 0);
      tags.dodge = `${this.dodge.base + dodgeBonus} Dodge`;
      tags.total = `${this.armor.base + this.armor.bonus + this.dodge.base + dodgeBonus} Defense`;
    }
    return tags;
  }
}
