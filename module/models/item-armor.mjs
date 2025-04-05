import CruciblePhysicalItem from "./item-physical.mjs";
import {CATEGORIES, PROPERTIES, UNARMORED_DATA} from "../config/armor.mjs";
import {QUALITY_TIERS, ENCHANTMENT_TIERS} from "../config/items.mjs";

/**
 * Data schema, attributes, and methods specific to Armor type Items.
 */
export default class CrucibleArmorItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "medium";

  /** @override */
  static ITEM_PROPERTIES = PROPERTIES;

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
        base: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, max: 18, initial: 0})
      })
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
    const categoryId = this.category in CATEGORIES ? this.category : this.constructor.DEFAULT_CATEGORY;
    const category = CATEGORIES[categoryId];

    // Armor Quality
    const qualities = QUALITY_TIERS;
    const quality = qualities[this.quality] || qualities.standard;

    // Enchantment Level
    const enchantments = ENCHANTMENT_TIERS;
    const enchantment = enchantments[this.enchantment] || enchantments.mundane;

    // Armor Configuration
    this.config = {category, quality, enchantment};
    this.rarity = quality.rarity + enchantment.rarity;

    // Armor Defense
    this.armor.base = Math.clamp(this.armor.base, category.armor.min, category.armor.max);
    this.armor.bonus = quality.bonus + enchantment.bonus;

    // Dodge Defense
    this.dodge ||= {};
    this.dodge.base = category.dodge.base(this.armor.base);
    this.dodge.scaling = category.dodge.scaling;

    // Armor Properties
    for ( let p of this.properties ) {
      const prop = PROPERTIES[p];
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
   * @returns {Record<string, string>}    The tags which describe this weapon
   */
  getTags() {
    const tags = {};
    tags.category = this.config.category.label;
    for ( let p of this.properties ) {
      tags[p] = PROPERTIES[p].label;
    }
    tags.armor = `${this.armor.base + this.armor.bonus} Armor`;
    const actor = this.parent.parent;
    if ( !actor ) tags.dodge = `${this.dodge.base}+ Dodge`;
    else {
      const dodgeBonus = Math.max(actor.system.abilities.dexterity.value - this.dodge.scaling, 0);
      tags.dodge = `${this.dodge.base + dodgeBonus} Dodge`;
      tags.total = `${this.armor.base + this.armor.bonus + this.dodge.base + dodgeBonus} Defense`;
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Get the default unarmored Armor item used by this Actor if they do not have other equipped armor.
   * @param {CrucibleActor} actor
   * @returns {CrucibleItem}
   */
  static getUnarmoredArmor(actor) {
    const itemCls = /** @type Constructor<CrucibleItem> */ getDocumentClass("Item");
    const armor = new itemCls(UNARMORED_DATA, {parent: actor});
    armor.prepareData(); // Needs to be explicitly called since we may be in the midst of Actor preparation.
    return armor;
  }
}
