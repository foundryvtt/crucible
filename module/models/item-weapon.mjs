import CruciblePhysicalItem from "./item-physical.mjs";
import {SYSTEM} from "../config/system.mjs";
import * as ARMOR from "../config/armor.mjs";

/**
 * Data schema, attributes, and methods specific to Weapon type Items.
 */
export default class CrucibleWeaponItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = SYSTEM.WEAPON.CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "simple1";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.WEAPON.PROPERTIES;

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "WEAPON"];

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(super.defineSchema(), {
      damageType: new fields.StringField({required: true, choices: SYSTEM.DAMAGE_TYPES, initial: "bludgeoning"}),
      dropped: new fields.BooleanField({required: true, initial: false}),
      loaded: new fields.BooleanField({required: false, initial: undefined}),
      slot: new fields.NumberField({required: true, choices: () => SYSTEM.WEAPON.SLOTS.choices, initial: 0})
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
   * Weapon damage data.
   * @type {{base: number, quality: number, weapon: number}}
   */
  damage;

  /**
   * Defensive bonuses provided by this weapon
   * @type {{block: number, parry: number}}
   */
  defense;

  /* -------------------------------------------- */

  /**
   * Prepare derived data specific to the weapon type.
   */
  prepareBaseData() {
    super.prepareBaseData();
    const {category, enchantment} = this.config;

    // Equipment Slot
    if ( this.dropped ) this.equipped = false;
    const allowedSlots = this.getAllowedEquipmentSlots();
    if ( !allowedSlots.includes(this.slot) ) this.slot = allowedSlots[0];

    // Weapon Damage
    this.damage = this.#prepareDamage();

    // Weapon Defense
    this.defense = this.#prepareDefense();

    // Weapon Range
    this.range = this.#prepareRange();

    // Action bonuses and cost
    this.actionBonuses = this.parent.actor ? {
      ability: this.parent.actor.getAbilityBonus(category.scaling.split(".")),
      skill: 0,
      enchantment: enchantment.bonus
    } : {}
    this.actionCost = category.actionCost;

    // Versatile Two-Handed
    if ( this.properties.has("versatile") && this.slot === SYSTEM.WEAPON.SLOTS.TWOHAND ) {
      this.damage.base += 2;
      this.actionCost += 1;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareDerivedData() {
    this.damage.weapon = this.damage.base + this.damage.quality;
    if ( this.broken ) {
      this.damage.weapon = Math.floor(this.damage.weapon / 2);
      this.rarity -= 2;
    }
    super.prepareDerivedData();
  }

  /* -------------------------------------------- */

  /**
   * Finalize equipped weapons by preparing data which depends on prepared talents or other Actor data.
   */
  prepareEquippedData() {
    const category = this.config.category;
    const actor = this.parent.actor;

    // Populate equipped skill bonus
    this.actionBonuses.skill = actor.system.training[category.training];

    // Populate current damage bonus
    const actorBonuses = actor.system.rollBonuses.damage || {};
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
      base: category.damage,
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
    if ( this.properties.has("reach") ) range += category.ranged ? 20 : 2;
    if ( this.properties.has("ambush") ) range = Math.max(range - (category.ranged ? 10 : 1), 1);
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
    const type = action.usage.damageType || this.damageType;
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
    const SLOTS = SYSTEM.WEAPON.SLOTS;
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

  /** @inheritDoc */
  getTags(scope="full") {
    const parentTags = super.getTags(scope);
    const tags = {};

    // Equipment Slot
    if ( this.equipped ) {
      const slotKey = Object.entries(SYSTEM.WEAPON.SLOTS).find(([k, v]) => v === this.slot)[0];
      tags.slot = game.i18n.localize(`WEAPON.SLOTS.${slotKey}`);
    }
    Object.assign(tags, parentTags);

    // Damage and Range
    tags.damage = `${this.damage.weapon} Damage`;
    if ( this.config.category.reload && !this.loaded ) tags.damage = "Reload";
    tags.range = `Range ${this.range}`;

    // Weapon Properties
    if ( this.defense.block ) tags.block = `Block ${this.defense.block}`;
    if ( this.defense.parry ) tags.parry = `Parry ${this.defense.parry}`;
    if ( this.broken ) tags.broken = this.schema.fields.broken.label;
    return scope === "short" ? {damage: tags.damage, range: tags.range} : tags;
  }
}
