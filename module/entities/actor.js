import { SYSTEM } from "../config/system.js";
import CrucibleItem from "./item.js";


export default class CrucibleActor extends Actor {
  constructor(...args) {
    super(...args);

    /**
     * Prepare the configuration entry for this Actor
     * @type {Object}
     */
    this.config = this.prepareConfig();


    this.points = {};
    this.skills = {};

    // Re-prepare the Item data once the config is ready
    this.prepareData();
  }

  /* -------------------------------------------- */
  /*  Actor Configuration
  /* -------------------------------------------- */

  /**
   * Prepare the Configuration object for this Actor type.
   * This configuration does not change when the data changes
   */
  prepareConfig() {
    return {};
  }

  /* -------------------------------------------- */
  /*  Actor Preparation
  /* -------------------------------------------- */

  /**
   * Prepare the data object for this Actor.
   * The prepared data will change as the underlying source data is updated
   */
  prepareData() {
    if ( !this.config ) return; // Hack to avoid preparing data before the config is ready
    const data = this.data;

    // Prepare placeholder point totals
    this._preparePoints(data.data.details.level);

    // Prepare Attributes
    this._prepareAttributes(data);

    // Prepare Skills
    this._prepareSkills(data);
  }

  /* -------------------------------------------- */

  /**
   * Compute the available points which can be spent to advance this character
   * @param {number} level      The character's current level
   * @private
   */
  _preparePoints(level) {
    this.points = {
      ability: { pool: 36, total: (level - 1) },
      skill: { total: 2 + ((level-1) * 2) },
      talent: { total: 3 + ((level - 1) * 3) }
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare attributes, ability scores, and resource pools for the Actor.
   * @param {object} data       The actor data to prepare
   * @private
   */
  _prepareAttributes(data) {
    const attrs = data.data.attributes;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in CONFIG.SYSTEM.ABILITIES ) {
      let ability = attrs[a];
      ability.value = ability.base + ability.increases + ability.bonus;
      abilityPointsBought += Array.fromRange(ability.base + 1).reduce((a, v) => a + v);
      abilityPointsSpent += ability.increases;
      ability.cost = ability.value + 1;
    }
    this.points.ability.bought = abilityPointsBought;
    this.points.ability.spent = abilityPointsSpent;

    // Resource Pools
    for ( let a in SYSTEM.RESOURCES ) {
      // pass
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Skills for the actor, translating the owned Items for skills and merging them with unowned skills.
   * Validate the number of points spent on skills, and the number of skill points remaining to be spent.
   * @private
   */
  _prepareSkills(data) {

    // Populate all the skills
    const ranks = SYSTEM.SKILL_RANKS;
    let pointsSpent = 0;

    // Iterate over skills
    for ( let [id, skill] of Object.entries(data.data.skills) ) {
      const config = SYSTEM.SKILLS[id];

      // Skill Rank
      const base = (skill.ancestry || 0) + (skill.background || 0);
      skill.rank = Math.max(skill.rank || 0, base);

      // Point Cost
      const rank = ranks[skill.rank];
      skill.cost = rank.cost;
      pointsSpent += (skill.cost - base);
      const next = ranks[skill.rank + 1] || {cost: null};
      skill.nextCost = next.cost;

      // Bonuses
      const attrs = config.attributes.map(a => data.data.attributes[a].value);
      skill.abilityBonus = Math.ceil(0.5 * (attrs[0] + attrs[1]));
      skill.skillBonus = ranks[skill.rank].bonus;
      skill.enchantmentBonus = 0;
      skill.score = skill.abilityBonus + skill.skillBonus + skill.enchantmentBonus;
      skill.passive = SYSTEM.PASSIVE_BASE + skill.score;
    }

    // Update available skill points
    const points = this.points;
    points.skill.spent = pointsSpent;
    points.skill.available = points.skill.total - points.skill.spent;
  }

  /* -------------------------------------------- */
  /*  Character Creation Methods                  */
  /* -------------------------------------------- */

  /**
   * When an Ancestry item is dropped on an Actor, apply its contents to the data model
   * @param {object} ancestry     The ancestry data to apply to the Actor.
   * @return {CrucibleActor}      The updated Actor with the new Ancestry applied.
   */
  async applyAncestry(ancestry) {
    const updates = {
      "data.details.ancestry": ancestry.name
    };

    // Only proceed if we are level 1 with no points already spent
    if ( (this.data.data.details.level !== 1) || (this.points.skill.spent > 0) || (this.points.ability.spent > 0) ) {
      const err = game.i18n.localize("ANCESTRY.ApplyError");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Apply primary and secondary abilities
    for ( let a in SYSTEM.ABILITIES ) {
      if ( ancestry.data.primaryAbility === a ) updates[`data.attributes.${a}.base`] = 3;
      else if ( ancestry.data.secondaryAbility === a ) updates[`data.attributes.${a}.base`] = 2;
      else updates[`data.attributes.${a}.base`] = 1;
    }

    // Apply skills
    for ( let s in SYSTEM.SKILLS ) {
      updates[`data.skills.${s}.rank`] = 0;
      updates[`data.skills.${s}.ancestry`] = ancestry.data.skills.includes(s) ? 1 : 0;
    }

    // Apply resistances and vulnerabilities
    for ( let s in SYSTEM.DAMAGE_TYPES ) {
      if ( ancestry.data.resistance ) updates[`data.resistances.${s}.base`] = 3;
      else if ( ancestry.data.vulnerability ) updates[`data.resistances.${s}.base`] = -3;
      else updates[`data.resistances.${s}.base`] = 0;
    }

    // Update the Actor
    await this.update(updates);
    ui.notifications.info(game.i18n.format("ANCESTRY.Applied", {ancestry: ancestry.name, actor: this.name}));
    return this;
  }

}