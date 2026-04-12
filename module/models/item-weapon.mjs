import CruciblePhysicalItem from "./item-physical.mjs";
import {SYSTEM} from "../const/system.mjs";

/**
 * Data schema, attributes, and methods specific to Weapon type Items.
 */
export default class CrucibleWeaponItem extends CruciblePhysicalItem {

  /** @override */
  static AFFIXABLE = true;

  /** @override */
  static ITEM_CATEGORIES = SYSTEM.WEAPON.CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "simple1";

  /** @override */
  static ITEM_PROPERTIES = SYSTEM.WEAPON.PROPERTIES;

  /** @override */
  static STATEFUL_FIELDS = [...super.STATEFUL_FIELDS, "slot", "loaded"];

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

    // Weapon Bonuses
    this.actionBonuses = {ability: 0, skill: -4, enchantment: enchantment.bonus};
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

    // Ability Bonus
    this.actionBonuses.ability = actor.getAbilityBonus(category.scaling.split("."));

    // Skill Bonus
    const trainingTypes = this.properties.has("natural") ? ["natural"] : category.training;
    const isIntuitive = ["simple1", "simple2"].includes(category.id) || this.properties.has("intuitive");
    let b = actor.getSkillBonus(trainingTypes);
    if ( isIntuitive ) b = Math.max(b, -1);
    this.actionBonuses.skill = b;

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
      weapon: 0,
      criticalSuccessThreshold: 6,
      criticalFailureThreshold: 6
    };
    if ( this.properties.has("oversized") ) damage.base += category.hands;
    if ( this.properties.has("blocking") || this.properties.has("engaging") ) damage.base -= category.hands;
    if ( this.properties.has("parrying") ) damage.criticalSuccessThreshold += 1;
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
    if ( this.properties.has("parrying") ) defense.parry += 1;
    if ( this.properties.has("blocking") ) defense.block += 1;
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
    if ( this.properties.has("ambush") ) range = Math.max(range - (category.ranged ? 10 : 1), 1);
    return range;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Can this weapon be thrown?
   * @type {boolean}
   */
  get canThrow() {
    const category = this.config.category;
    if ( (category.id === "unarmed") || category.ranged || this.properties.has("natural") ) return false;
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Does this weapon require reloading before it can be used?
   * @type {boolean}
   */
  get needsReload() {
    return this.config.category.reload && !this.loaded;
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
    if ( this.properties.has("natural") ) return slots;
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

    // Equipment Slot and Type
    if ( this.properties.has("natural") ) tags.natural = SYSTEM.WEAPON.PROPERTIES.natural.label;
    else if ( this.equipped ) {
      const slotKey = Object.entries(SYSTEM.WEAPON.SLOTS).find(([_k, v]) => v === this.slot)[0];
      tags.slot = SYSTEM.WEAPON.SLOTS.labels[slotKey];
    }
    Object.assign(tags, parentTags);

    // Damage and Range
    tags.damage = _loc("ITEM.PROPERTIES.Damage", {damage: this.damage.weapon});
    if ( this.needsReload ) tags.damage = _loc("WEAPON.TAGS.Reload");
    tags.range = _loc("ITEM.PROPERTIES.Range", {range: this.range});

    // Weapon Properties
    if ( this.defense.block ) tags.block = _loc("ITEM.PROPERTIES.Block", {block: this.defense.block});
    if ( this.defense.parry ) tags.parry = _loc("ITEM.PROPERTIES.Parry", {parry: this.defense.parry});
    if ( this.broken ) tags.broken = this.schema.fields.broken.label;

    return scope === "short" ? {damage: tags.damage, range: tags.range} : tags;
  }

  /* -------------------------------------------- */

  /**
   * Snapshot the stateful properties of this weapon at the time an Action is performed.
   * Properties outside this list are assumed to be permanent attributes of the item and not stateful.
   * @returns {CrucibleItemSnapshot}
   */
  snapshot() {
    const source = this.toObject();
    return this.constructor.STATEFUL_FIELDS.reduce((obj, field) => {
      obj.system[field] = source[field];
      return obj;
    }, {_id: this.parent.id, system: {}});
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    source = super.migrateData(source);

    /** @deprecated since 0.7.3 */
    if ( source.category === "natural" ) {
      source.category = "simple1";
      source.properties ||= [];
      source.properties.push("natural");
    }

    return source;
  }
}
