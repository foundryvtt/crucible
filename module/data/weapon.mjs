import PhysicalItemData from "./physical.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Weapon type Items.
 */
export default class CrucibleWeapon extends PhysicalItemData {

  /** @override */
  static DEFAULT_CATEGORY = "simple1";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.WEAPON.PROPERTIES;

  /**
   * Designate which equipped slot the weapon is used in.
   * @enum {Readonly<number>}
   */
  static WEAPON_SLOTS = Object.freeze({
    EITHER: 0,
    MAINHAND: 1,
    OFFHAND: 2,
    TWOHAND: 3
  });

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(super.defineSchema(), {
      damageType: new fields.StringField({required: true, choices: SYSTEM.DAMAGE_TYPES, initial: "bludgeoning"}),
      loaded: new fields.BooleanField({required: false, initial: undefined}),
      slot: new fields.NumberField({required: true, choices: Object.values(CrucibleWeapon.WEAPON_SLOTS), initial: 0}),
      animation: new fields.StringField({required: false, choices: SYSTEM.WEAPON.ANIMATION_TYPES, initial: undefined})
    });
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Bonuses applied to actions performed with this weapon
   * @type {DiceCheckBonuses}
   */
  actionBonuses;

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
   * @type {{base: number, quality: number, weapon: number}}
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

    // Equipment Slot
    const allowedSlots = this.getAllowedEquipmentSlots();
    if ( !allowedSlots.includes(this.slot) ) this.slot = allowedSlots[0];

    // Weapon Damage
    this.damage = this.#prepareDamage();

    // Weapon Defense
    this.defense = this.#prepareDefense();

    // Weapon Rarity Score
    this.rarity = quality.rarity + enchantment.rarity;
    this.price = this.price * Math.max(Math.pow(this.rarity, 3), 1);

    // Action bonuses and cost
    this.actionBonuses = this.parent.actor ? {
      ability: this.parent.actor.getAbilityBonus(category.scaling.split(".")),
      skill: 0,
      enchantment: enchantment.bonus
    } : {}
    this.actionCost = category.actionCost;

    // Weapon Properties
    for ( let p of this.properties ) {
      const prop = SYSTEM.WEAPON.PROPERTIES[p];
      if ( prop.actionCost ) this.actionCost += prop.actionCost;
      if ( prop.rarity ) this.rarity += prop.rarity;
    }

    // Versatile Two-Handed
    if ( this.properties.has("versatile") && this.slot === CrucibleWeapon.WEAPON_SLOTS.TWOHAND ) {
      this.damage.base += 2;
      this.actionCost += 1;
    }
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    this.damage.weapon = this.damage.base + this.damage.quality;
    if ( this.broken ) this.damage.weapon = Math.floor(this.damage.weapon / 2);

  }

  /* -------------------------------------------- */

  /**
   * Prepare damage for the Weapon.
   * @returns {{weapon: number, base: number, quality: number}}
   */
  #prepareDamage() {
    const {category, quality} = this.config;
    const damage = {
      base: category.damage.base,
      quality: quality.bonus,
      weapon: 0
    };
    if ( this.properties.has("oversized") ) damage.base += 2;
    return damage;
  }

  /* -------------------------------------------- */

  /**
   * Prepare defense for the Weapon.
   * @returns {{block: number, parry: number}}
   */
  #prepareDefense() {

    // Broken weapons cannot defend
    if ( this.broken ) return {block: 0, parry: 0};

    // Base defense for the category
    const category = this.config.category
    const defense = {
      block: category.defense?.block ?? 0,
      parry: category.defense?.parry ?? 0
    };

    // Parrying and Blocking properties
    if ( this.properties.has("parrying") ) {
      defense.parry += (category.hands + this.config.enchantment.bonus);
    }
    if ( this.properties.has("blocking") ) {
      defense.block += (category.hands + this.config.enchantment.bonus);
    }
    return defense;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  getDamageBonus() {
    const category = this.config.category;
    let actorBonuses = this.parent.actor?.rollBonuses?.damage || {};
    let bonus = actorBonuses[this.damageType] ?? 0;
    if ( !category.ranged ) bonus += (actorBonuses.melee ?? 0);
    if ( category.ranged ) bonus += (actorBonuses.ranged ?? 0);
    if ( category.hands === 2 ) bonus += (actorBonuses.twoHanded ?? 0);
    return bonus;
  }

  /* -------------------------------------------- */

  /**
   * Identify which equipment slots are allowed for a certain weapon.
   * @returns {number[]}
   */
  getAllowedEquipmentSlots() {
    const SLOTS = this.constructor.WEAPON_SLOTS;
    const category = this.config.category;
    if ( category.hands === 2 ) return [SLOTS.TWOHAND];
    const slots = [SLOTS.MAINHAND];
    if ( category.off ) {
      slots.unshift(SLOTS.EITHER);
      slots.push(SLOTS.OFFHAND);
    }
    if ( this.properties.has("versatile") ) slots.push(SLOTS.TWOHAND);
    return slots;
  }

  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Object<string, string>}    The tags which describe this weapon
   */
  getTags(scope="full") {
    const tags = {};

    // Damage
    tags.damage = `${this.damage.weapon} Damage`;
    if ( this.config.category.reload && !this.loaded ) tags.damage = "Reload";
    if ( scope === "short" ) return tags;

    // Weapon Category
    const category = this.config.category;
    tags.category = category.label;

    // Equipment Slot
    const slotKey = Object.entries(CrucibleWeapon.WEAPON_SLOTS).find(([k, v]) => v === this.slot)[0];
    tags.slot = game.i18n.localize(`WEAPON.SLOTS.${slotKey}`);

    // Weapon Properties
    if ( this.broken ) tags.broken = game.i18n.localize("ITEM.Broken");
    if ( this.defense.block ) tags.block = `Block ${this.defense.block}`;
    if ( this.defense.parry ) tags.parry = `Parry ${this.defense.parry}`;
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the Sequencer animation configuration for this Weapon.
   * @returns {{src: string}|null}
   */
  getAnimationConfiguration() {
    if ( !this.animation ) return null;
    let animation = `jb2a.${this.animation}`;

    // Implement some special hacky overrides
    const overrides = {
      katana: "jb2a.melee_attack.04.katana"
    }
    if ( this.animation in overrides ) animation = overrides[this.animation];

    // Restrict to melee animations
    else if ( !this.config.category.ranged ) {
      const paths = Sequencer.Database.getPathsUnder(animation);
      const usage = ["melee", "standard", "200px"].find(p => paths.includes(p));
      if ( !usage ) {
        console.warn(`Crucible | Unable to find weapon animation usage for ${animation}`);
        return null
      }
      animation += `.${usage}`;
    }

    // Damage type
    const paths = Sequencer.Database.getPathsUnder(animation);
    const damageColors = {
      bludgeoning: "white",
      corruption: "green",
      piercing: "white",
      slashing: "white",
      poison: "green",
      acid: "green",
      fire: "orange",
      cold: "blue",
      electricity: "blue",
      psychic: "purple",
      radiant: "yellow",
      void: "purple"
    }
    const typePaths = [this.damageType, damageColors[this.damageType], SYSTEM.DAMAGE_TYPES[this.damageType].type];
    const typeSuffix = typePaths.find(p => paths.includes(p));
    if ( typeSuffix ) animation += `.${typeSuffix}`;

    // Return animation config
    return {src: animation, wait: -500};
  }
}
