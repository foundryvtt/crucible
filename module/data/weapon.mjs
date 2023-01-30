import PhysicalItemData from "./physical.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Weapon type Items.
 */
export default class WeaponData extends PhysicalItemData {

  /** @override */
  static DEFAULT_CATEGORY = "simple1";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.WEAPON.PROPERTIES;

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(super.defineSchema(), {
      damageType: new fields.StringField({required: true, choices: SYSTEM.DAMAGE_TYPES})
    });
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Weapon Strike action cost.
   * @type {number}
   */
  actionCost;

  /**
   * Weapon configuration data.
   * @type {{category: WeaponCategory, quality: ItemQualityTier, enchantment: ItemEnchantmentTier}}
   */
  config;

  /**
   * Weapon damage data.
   * @type {{base: number, quality: number, enchantment: number, weapon: number}}
   */
  damage;

  /**
   * Defensive bonuses provided by this weapon
   * @type {{block: number, parry: number}}
   */
  defense;

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

    // Weapon Category
    const categories = SYSTEM.WEAPON.CATEGORIES;
    const category = categories[this.category] || categories[this.constructor.DEFAULT_CATEGORY];

    // Weapon Quality
    const qualities = SYSTEM.QUALITY_TIERS;
    const quality = qualities[this.quality] || qualities.standard;

    // Enchantment Level
    const enchantments = SYSTEM.ENCHANTMENT_TIERS;
    const enchantment = enchantments[this.enchantment] || enchantments.mundane;

    // Weapon Configuration
    this.config = {category, quality, enchantment};

    // Weapon Damage
    this.damage = {
      base: category.damage.base,
      quality: quality.bonus,
      weapon: category.damage.base + quality.bonus
    };
    if ( this.broken ) this.damage.weapon = Math.floor(this.damage.weapon / 2);

    // Weapon Defense
    this.defense = {
      block: category.defense?.block ?? 0,
      parry: category.defense?.parry ?? 0
    };
    if ( this.properties.has("parrying") ) this.defense.parry += (1 + enchantment.bonus);
    if ( this.properties.has("blocking") ) this.defense.block += (2 * (enchantment.bonus + 1));
    if ( this.broken ) this.defense = {block: 0, parry: 0};

    // Weapon Rarity Score
    this.rarity = quality.rarity + enchantment.rarity;

    // Weapon Strike action cost
    this.actionCost = category.actionCost;

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
    tags.damage = `${this.damage.weapon} Damage`;
    if ( scope === "short" ) return tags;

    // Weapon Category
    const category = this.config.category;
    const handsTag = () => {
      if ( category.hands === 2 ) return "WEAPON.HandsTwo";
      if ( category.main && category.off ) return "WEAPON.HandsEither";
      if ( category.main ) return "WEAPON.HandsMain";
      if ( category.off ) return "WEAPON.HandsOff";
    }
    tags.category = category.label;
    tags.hands = game.i18n.localize(handsTag());

    // Weapon Properties
    if ( this.broken ) tags.broken = game.i18n.localize("ITEM.Broken");
    if ( this.defense.block ) tags.block = `Block ${this.defense.block}`;
    if ( this.defense.parry ) tags.parry = `Parry ${this.defense.parry}`;
    return tags;
  }
}
