import CruciblePhysicalItem from "./physical.mjs";
import { SYSTEM } from "../config/system.mjs";
import Enum from "../config/enum.mjs";

/**
 * Data schema, attributes, and methods specific to Weapon type Items.
 */
export default class CrucibleWeapon extends CruciblePhysicalItem {

  /** @override */
  static DEFAULT_CATEGORY = "simple1";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.WEAPON.PROPERTIES;

  /**
   * Designate which equipped slot the weapon is used in.
   * @enum {Readonly<number>}
   */
  static WEAPON_SLOTS = new Enum({
    EITHER: {value: 0, label: "WEAPON.SLOTS.EITHER"},
    MAINHAND: {value: 1, label: "WEAPON.SLOTS.MAINHAND"},
    OFFHAND: {value: 2, label: "WEAPON.SLOTS.OFFHAND"},
    TWOHAND: {value: 3, label: "WEAPON.SLOTS.TWOHAND"},
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

    // Weapon Range
    this.range = this.#prepareRange();

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
   * Finalize equipped weapons by preparing data which depends on prepared talents or other Actor data.
   */
  prepareEquippedData() {
    const category = this.config.category;
    const actor = this.parent.actor;

    // Populate equipped skill bonus
    this.actionBonuses.skill = actor.training[category.training];

    // Populate current damage bonus
    const actorBonuses = actor.rollBonuses.damage || {};
    let bonus = actorBonuses[this.damageType] ?? 0;
    if ( !category.ranged ) bonus += (actorBonuses.melee ?? 0);
    if ( category.ranged ) bonus += (actorBonuses.ranged ?? 0);
    if ( category.hands === 2 ) bonus += (actorBonuses.twoHanded ?? 0);
    this.damage.bonus = bonus;
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
      bonus: 0,
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
    const category = this.config.category;
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

  /**
   * Prepare the effective range of the Weapon.
   * @returns {number}
   */
  #prepareRange() {
    const category = this.config.category;
    let range = category.range;
    if ( this.properties.has("reach") ) {
      range += category.ranged ? 20 : 2;
    }
    if ( this.properties.has("ambush") ) {
      range -= category.ranged ? 10 : 1;
    }
    return range;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Prepare the effective weapon damage resulting from a weapon attack.
   * @param {CrucibleActor} actor       The actor performing the attack action
   * @param {CrucibleAction} action     The attack action being performed
   * @param {CrucibleActor} target      The target of the attack action
   * @param {AttackRoll} roll           The attack roll performed
   * @returns {DamageData}              Damage data for the roll
   */
  getDamage(actor, action, target, roll) {
    const resource = action.usage.resouce || "health";
    const type = this.damageType;
    let {weapon: base, bonus} = this.damage;
    const multiplier = action.usage.bonuses.multiplier ?? 1;
    bonus += (action.usage.bonuses.damageBonus ?? 0);
    const resistance = target.getResistance(resource, type, false);

    // Configure bonus damage
    if ( actor.talentIds.has("weakpoints000000") && this.config.category.scaling.includes("dexterity")
      && (["exposed", "flanked", "unaware"].some(s => target.statuses.has(s))) ) {
      bonus += 2;
    }

    // Return prepare damage data
    return {overflow: roll.overflow, multiplier, base, bonus, resistance, resource, type};
  }

  /* -------------------------------------------- */

  /**
   * Identify which equipment slots are allowed for a certain weapon.
   * @returns {number[]}
   */
  getAllowedEquipmentSlots() {
    const SLOTS = this.constructor.WEAPON_SLOTS;
    const category = this.config.category;
    const slots = [];
    if ( category.main ) {
      if ( category.hands === 2 ) return [SLOTS.TWOHAND];
      if ( category.off ) slots.unshift(SLOTS.EITHER);
      slots.push(SLOTS.MAINHAND);
      if ( this.properties.has("versatile") ) slots.push(SLOTS.TWOHAND);
    }
    if ( category.off ) slots.push(SLOTS.OFFHAND);
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
    if ( this.broken ) tags.broken = this.schema.fields.broken.label;
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
      const paths = Sequencer.Database.searchFor(animation);
      if ( !paths.length ) return null;
      const preferredFlavors = ["melee", "standard", "200px"];
      let usage = paths.find(path => {
        const flavor = path.slice(animation.length + 1);
        return preferredFlavors.some(f => flavor.startsWith(f));
      });
      animation = usage ?? paths[0];
    }

    // Damage type
    const paths = Sequencer.Database.searchFor(animation);
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
