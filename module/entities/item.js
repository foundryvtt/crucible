import { SYSTEM } from "../config/system.js";


export class CrucibleItem extends Item {
  constructor(...args) {
    super(...args);

    /**
     * Prepare the configuration entry for this Item
     * @type {Object}
     */
    this.config = this.prepareConfig();

    /**
     * Prepare the data object for this Item
     * @type {Object}
     */
    this.data = this.prepareData();
  }

  /* -------------------------------------------- */
  /*  Item Configuration
  /* -------------------------------------------- */

  /**
   * Prepare the Configuration object for this Item type.
   * This configuration does not change when the data changes
   */
  prepareConfig() {
    switch ( this.data.type ) {
      case "skill":
        return this._prepareSkillConfig();
      case "talent":
        return "foo";
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare configuration data for Skill type items
   * @return {Object}
   * @private
   */
  _prepareSkillConfig() {
    const skill = SYSTEM.skills.skills[this.data.data.skill];
    if ( !skill ) return {};

    // Update skill data
    skill.icon = `systems/${SYSTEM.id}/${skill.icon}`;
    const category = SYSTEM.skills.categories[skill.category];
    skill.categoryName = category.name;

    // Skill ranks
    const ranks = duplicate(SYSTEM.skills.ranks);
    skill.ranks.forEach(r => mergeObject(ranks[r.rank], r));
    skill.ranks = ranks;

    // Skill progression paths
    skill.paths.forEach(p => p.icon = `systems/${SYSTEM.id}/${p.icon}`);
    skill.paths.unshift(SYSTEM.skills.noPath);
    skill.paths[0].icon = `systems/${SYSTEM.id}/${category.noPathIcon}`;
    return skill;
  }

  /* -------------------------------------------- */
  /*  Item Preparation
  /* -------------------------------------------- */

  /**
   * Prepare the data object for this Item.
   * The prepared data will change as the underlying source data is updated
   * @param data
   */
  prepareData(data) {
    data = data || this.data;
    if ( !this.config ) return data; // Hack to avoid preparing data before the config is ready
    switch ( this.data.type ) {
      case "skill":
        return this._prepareSkillData(data);
      case "talent":
        return "foo";
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare additional data for Skill type Items
   * @param data
   * @private
   */
  _prepareSkillData(data) {
    const skill = this.config;
    if ( isObjectEmpty(skill) ) return data;

    // Override name and image
    data.name = skill.name;
    data.img = skill.icon;

    // Skill rank
    let current = null;
    let next = null;
    data.ranks = skill.ranks.map(r => {
      r.purchased = (r.rank > 0) && (r.rank <= data.data.rank);
      if ( r.rank === data.data.rank ) current = r;
      else if ( r.rank === data.data.rank + 1 ) next = r;
      return r;
    });
    data.currentRank = current;
    data.nextRank = next;

    // Skill progression paths
    let path = null;
    data.paths = skill.paths.map(p => {
      p.active = p.id === data.data.path;
      if ( p.active ) path = p;
      return p;
    });
    data.path = path;
    return data;
  }
}