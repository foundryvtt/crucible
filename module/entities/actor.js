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

    // Classify the Actor's items into different categories
    const [skills, talents, inventory, spells] = this._classifyItems(this.items);

    // Prepare placeholder point totals
    this._preparePoints(data.data.details.level);

    // Prepare Attributes
    this._prepareAttributes(data);

    // Prepare Skills
    this._prepareSkills(data, skills);
  }

  /* -------------------------------------------- */

  _classifyItems(items) {
    return items.reduce((categories, item) => {
      if ( item.type === "skill" ) categories[0].push(item);
      else if ( item.type === "talent" ) categories[1].push(item);
      else if ( item.type === "item" ) categories[2].push(item);
      else if ( item.type === "spell" ) categories[3].push(item);
      return categories;
    }, [[], [], [], []])
  }

  /* -------------------------------------------- */

  _preparePoints(level) {
    this.points = {
      attribute: { pool: 36, total: (level - 1) },
      skill: { total: 6 + ((level-1) * 2) },
      talent: { total: 3 + ((level - 1) * 3) }
    };
  }

  /* -------------------------------------------- */

  _prepareAttributes(data) {
    const attrs = data.data.attributes;

    // Attribute Scores
    let attributePointsBought = 0;
    let attributePointsSpent = 0;
    for ( let a of SYSTEM.attributeScores ) {
      let attr = attrs[a];
      attr.value = attr.base + attr.increases + attr.bonus;
      attributePointsBought += Array.fromRange(attr.base + 1).reduce((a, v) => a + v);
      attributePointsSpent += attr.increases;
      attr.cost = attr.base + 1;
    }
    this.points.attribute.bought = attributePointsBought;
    this.points.attribute.spent = attributePointsSpent;

    // Attribute Pools
    for ( let a of SYSTEM.attributePools ) {
      // pass
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Skills for the actor, translating the owned Items for skills and merging them with unowned skills.
   * Validate the number of points spent on skills, and the number of skill points remaining to be spent.
   * @private
   */
  _prepareSkills(data, items) {

    // Map skill items to their skill name
    items = items.reduce((items, i) => {
      items[i.data.data.skill] = i;
      return items;
    }, {});

    // Populate all the skills
    const skillPointCosts = [0, 1, 2, 4, 7, 12];
    let skillPointsSpent = 0;
    this.skills = Object.entries(SYSTEM.skills.skills).reduce((skills, s) => {
      let [id, skill] = s;

      // Retrieve the Item instance
      const item = items[id] || new CrucibleItem({
        name: skill.name,
        type: "skill",
        data: {skill: id, rank: 0, bonus: 0, path: ""}
      });

      // Compute the skill bonus
      const attrs = item.data.attributes.map(a => data.data.attributes[a].value);
      const score = Math.ceil(0.5 * (attrs[0] + attrs[1])) + item.data.currentRank.modifier + item.data.data.bonus;
      const passive = SYSTEM.dice.passiveCheck + score;

      // Track points spent
      skillPointsSpent += skillPointCosts[item.data.data.rank];

      // Assign the skill
      skills[id] = {score, passive, item};
      return skills;
    }, {});

    // Update available skill points
    const points = this.points;
    points.skill.spent = skillPointsSpent;
    points.skill.available = points.skill.total - points.skill.spent;
  }
}