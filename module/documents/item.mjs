import { SYSTEM } from "../config/system.js";
import ActionData from "../data/action.mjs";
import AttackRoll from "../dice/attack-roll.mjs";
import {TalentData} from "../data/talent.mjs";
import WeaponData from "../data/weapon.mjs";


/**
 * An Item subclass which handles system specific logic for the Item document type.
 */
export default class CrucibleItem extends Item {

  /* -------------------------------------------- */
  /*  Item Attributes                             */
  /* -------------------------------------------- */

  /**
   * Item-specific configuration data which is constructed before any additional data preparation steps.
   * @type {object}
   */
  get config() {
    return this.data.data.config;
  }

  /**
   * A more semantic reference to the system data.data object
   * @type {object}
   */
  get systemData() {
    return this.data.data;
  }

  /**
   * An array of actions that this Item provides.
   * @type {ActionData}
   */
  get actions() {
    return this.data.data.actions;
  }

  /**
   * Usage requirement configuration for the Item
   * @type {object}
   */
  get requirements() {
    return this.data.data.requirements;
  }

  /**
   * Current talent rank for this Item
   * @type {TalentRankData}
   */
  get rank() {
    return this.data.data.currentRank;
  }

  /* -------------------------------------------- */
  /*  Item Data Preparation                       */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    switch ( this.data.type ) {
      case "skill":
        this.data.data.config = SYSTEM.skills.skills[this.data.data.skill] || {};
        break;
      case "talent":
        this.data.data = new TalentData(this.systemData, this);
        break;
      case "weapon":
        this.data.data = new WeaponData(this.systemData, this);
        break;
    }
    return super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const data = this.data;
    switch ( this.data.type ) {
      case "armor":
        return this._prepareArmorData(data);
      case "skill":
        return this._prepareSkillData(data);
      case "talent":
      case "weapon":
        return this.data.data.prepareData();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare base data for Armor type Items
   * @param {object} data     The item data object
   * @private
   */
  _prepareArmorData(data) {
    const ad = data.data;
    const {armor, dodge} = ad;
    const category = SYSTEM.ARMOR.CATEGORIES[data.data.category] || "unarmored";

    // Base Armor can be between zero and the maximum allowed for the category
    armor.base = Math.clamped(armor.base, category.minArmor, category.maxArmor);

    // Starting Dodge is half of base armor
    dodge.start = Math.floor(armor.base / 2);

    // Base Dodge is 10 - dodge start, clamped between 0 and 8
    dodge.base = Math.clamped(10 - dodge.start, 0, 8);

    // Armor can have an enchantment bonus up to a maximum of 6
    armor.bonus = Math.clamped(armor.bonus, 0, 6);

    // Armor Properties
    const properties = SYSTEM.ARMOR.PROPERTIES;
    if ( !(ad.properties instanceof Array ) ) ad.properties = [];
    ad.properties = ad.properties.filter(p => p in properties);
  }

  /* -------------------------------------------- */

  /**
   * Prepare additional data for Skill type Items
   * @param {object} data   The base Item data
   * @private
   */
  _prepareSkillData(data) {
    const skill = this.config || {};

    // Copy and merge skill data
    data.name = skill.name;
    data.img = skill.icon;
    data.category = skill.category;
    data.attributes = skill.attributes;

    // Skill rank
    let current = null;
    let next = null;
    data.ranks = duplicate(skill.ranks).map(r => {
      r.purchased = (r.rank > 0) && (r.rank <= data.data.rank);
      if ( r.rank === data.data.rank ) current = r;
      else if ( r.rank === data.data.rank + 1 ) next = r;
      return r;
    });
    data.currentRank = current;
    data.nextRank = next;

    // Skill progression paths
    let path = null;
    data.paths = duplicate(skill.paths).map(p => {
      p.active = p.id === data.data.path;
      if ( p.active ) path = p;
      return p;
    });
    data.path = path;
    return data;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Provide an array of detail tags which are shown in each item description
   * @return {object}
   */
  getTags({scope="full"}={}) {
    const d = this.data.data;
    switch ( this.data.type ) {
      case "armor":
        const defenses = this.parent ? this.actor.getDefenses({armor: this}) : {
          armor: {total: d.armor.base},
          dodge: {total: d.dodge.base}
        };
        const armorTags = {
          category: SYSTEM.ARMOR.CATEGORIES[this.data.data.category].label,
        };
        for ( let p of d.properties ) {
          armorTags[p] = SYSTEM.ARMOR.PROPERTIES[p].label;
        }
        armorTags.defenses = `${defenses.armor.total + defenses.dodge.total} PD`;
        return armorTags;
      case "talent":
      case "weapon":
        return this.data.data.getTags({scope});
      default:
        return {};
    }
  }

  /* -------------------------------------------- */
  /*  Dice Rolls                                  */
  /* -------------------------------------------- */

  roll(options={}) {
    if ( !this.isOwned ) return false;
    switch ( this.data.type ) {
      case "skill":
        return this._rollSkillCheck(options);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare an object of bonuses associated with this item usage
   * @returns {DiceCheckBonuses}
   */
  getItemBonuses() {
    if ( !this.isOwned ) throw new Error("Item bonuses are not determined until it is owned by an Actor");
    switch ( this.data.type ) {
      case "weapon":
        return {
          ability: this.actor.getAbilityBonus(this.config.category.scaling),
          skill: 0,
          enchantment: this.systemData.attackBonus
        };
      default:
        throw new Error("NOT YET SUPPORTED");
    }
  }

  /* -------------------------------------------- */

  async _rollSkillCheck({passive=false}={}) {
    const formula = `${passive ? SYSTEM.dice.passiveCheck : SYSTEM.activeCheckFormula} + ${this.data.value}`;
    const roll = new Roll(formula).roll();
    const skillName = this.data.data.path ? `${this.name} (${this.data.path.name})` : this.name;
    await roll.toMessage({
      speaker: {actor: this.actor, user: game.user},
      flavor: passive ? `Passive ${skillName}` : `${skillName} Skill Check`
    });
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Activate a weapon attack action
   * @param {CrucibleActor} target    The target creature being attacked
   * @param {number} [banes=0]        The number of banes which afflict this attack roll
   * @param {number} [boons=0]        The number of boons which benefit this attack roll
   * @returns {Promise<AttackRoll>}   The created AttackRoll which results from attacking once with this weapon
   * @private
   */
  async weaponAttack(target, {banes=0, boons=0}={}) {
    if ( this.data.type !== "weapon" ) {
      throw new Error("You may only call the weaponAttack method for weapon-type Items");
    }
    if ( !target ) {
      throw new Error("You must provide an Actor as the target for this weapon attack");
    }
    const id = this.data.data;

    // Create the Attack Roll instance
    const {ability, skill, enchantment} = this.getItemBonuses();
    const roll = new AttackRoll({
      actorId: this.parent.id,
      itemId: this.id,
      banes: banes,
      boons: boons,
      dc: target.defenses.physical,
      ability: ability,
      skill: skill,
      enchantment: enchantment
    });

    // Evaluate the result and record the result
    await roll.evaluate({async: true});
    roll.data.result = target.testPhysicalDefense(roll.total);
    if ( roll.data.result === AttackRoll.RESULT_TYPES.HIT ) {
      roll.data.damage = {
        overflow: roll.overflow,
        multiplier: id.damageMultiplier,
        bonus: id.damageBonus,
        resistance: target.resistances[id.damageType]?.total ?? 0,
        type: id.damageType
      };
      roll.data.damage.total = ActionData.computeDamage(roll.data.damage);
    }
    return roll;
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    this._displayScrollingStatus(data);
    return super._onUpdate(data, options, userId);
  }

  /* -------------------------------------------- */

  /**
   * Display changes to the Item as scrolling combat text.
   * @private
   */
  _displayScrollingStatus(changed) {
    if ( !this.isOwned ) return;
    const tokens = this.actor.getActiveTokens(true);

    // Equipment changes
    if ( "equipped" in changed.data ) {
      const text = `${changed.data.equipped ? "+" : "-"}(${this.name})`;
      const fontSize = 24 * (canvas.dimensions.size / 100).toNearest(0.25);
      for ( let token of tokens ) {
        token.hud.createScrollingText(text, {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          direction: CONST.TEXT_ANCHOR_POINTS[changed.data.equipped ? "TOP" : "BOTTOM"],
          fontSize: fontSize,
          stroke: 0x000000,
          strokeThickness: 4
        });
      }
    }
  }
}
