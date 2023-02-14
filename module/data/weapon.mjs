import CrucibleAction from "./action.mjs";
import AttackRoll from "../dice/attack-roll.mjs";
import PhysicalItemData from "./physical.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Weapon type Items.
 */
export default class CrucibleWeapon extends PhysicalItemData {

  /** @inheritDoc */
  _configure(options) {
    super._configure(options);
    Object.defineProperties(this.parent, {
      attack: {value: this.attack.bind(this), writable: false, configurable: true},
    });
  }

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
      damageType: new fields.StringField({required: true, choices: SYSTEM.DAMAGE_TYPES}),
      loaded: new fields.BooleanField({required: false, initial: undefined})
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
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Perform a weapon attack action.
   * @param {CrucibleActor} target    The target creature being attacked
   * @param {number} [banes=0]        The number of banes which afflict this attack roll
   * @param {number} [boons=0]        The number of boons which benefit this attack roll
   * @param {number} [damageBonus=0]  An additional damage bonus which applies to this attack
   * @param {number} [multiplier=0] An additional damage multiplier which applies to this attack
   * @returns {Promise<AttackRoll>}   The created AttackRoll which results from attacking once with this weapon
   */
  async attack(target, {banes=0, boons=0, multiplier=1, damageBonus=0}={}) {
    const actor = this.parent.actor;
    if ( !actor ) {
      throw new Error("You may only perform a weapon attack using an owned weapon Item.");
    }
    if ( !target ) {
      throw new Error("You must provide an Actor as the target for this weapon attack");
    }

    // Apply additional boons or banes
    const defenseType = "physical";
    const targetBoons = actor.getTargetBoons(target, defenseType)
    boons += targetBoons.boons;
    banes += targetBoons.banes;

    // Create the Attack Roll instance
    const {ability, skill, enchantment} = this.actionBonuses;
    const roll = new AttackRoll({
      actorId: actor.id,
      itemId: this.parent.id,
      target: target.uuid,
      ability: ability,
      skill: skill,
      enchantment: enchantment,
      banes: banes,
      boons: boons,
      defenseType,
      dc: target.defenses.physical
    });

    // Evaluate the attack roll
    await roll.evaluate({async: true});
    roll.data.result = target.testDefense(defenseType, roll.total);

    // Miss
    if ( roll.data.result !== AttackRoll.RESULT_TYPES.HIT ) return roll;

    // Damage
    roll.data.damage = {
      overflow: roll.overflow,
      multiplier: multiplier,
      base: this.damage.weapon,
      bonus: this.#getDamageBonus(damageBonus),
      resistance: target.resistances[this.damageType]?.total ?? 0,
      type: this.damageType
    };
    roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Get the damage bonus that should be applied to a weapon attack.
   * @param {number} bonus      The baseline roll damage bonus
   * @returns {number}          The final roll damage bonus
   */
  #getDamageBonus(bonus=0) {
    const rb = this.parent.actor.rollBonuses.damage;

    // Category-specific bonuses
    const category = this.config.category;
    if ( !category.ranged ) bonus += rb.melee ?? 0;
    if ( category.ranged ) bonus += rb.ranged ?? 0;
    if ( category.hands === 2 ) bonus += rb.twoHanded ?? 0;

    // Weapon-specific bonuses
    bonus += rb[this.damageType] ?? 0;
    return bonus;
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
