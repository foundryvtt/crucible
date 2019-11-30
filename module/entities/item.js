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
    skill.icon = `systems/${SYSTEM.id}/${skill.icon}`;
    skill.categoryName = SYSTEM.skills.categories[skill.category];
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

    // Skill ranks
    data.rank = SYSTEM.skills.ranks[data.data.rank || 0];
    data.ranks = duplicate(skill.ranks || []).map(r => {
      r.purchased = r.rank <= data.data.rank;
      return r;
    });

    // Progression path
    data.path = skill.paths.find(p => p.id === data.data.path) || null;
    if ( data.path ) {
      for ( let r of data.path.ranks ) {
        data.ranks[r.rank-1].description = `<strong>${data.path.name}:</strong> ${r.description}`;
      }
    }
    for ( let r of [2, 4, 5] ) {
      if ( !data.ranks[r-1].description ) data.ranks[r-1].description = "<strong>No Path Chosen:</strong> Choose a progression path.";
    }

    // Compile current skill description
    let current = data.ranks.reduce((desc, r) => {
      if ( r.purchased ) desc.push(`<p>${r.description}</p>`);
      return desc;
    }, []);
    current = data.data.rank > 0 ? current : [`<p>You are not trained in this skill.</p>`];
    data.description = {current: current.join("\n")};

    // Next progression rank
    data.nextRank = data.data.rank < 5 ? data.ranks.find(r => r.rank > data.data.rank) : null;
    if ( data.nextRank === null ) data.description.next = "Skill is at maximum rank.";
    else if ( data.nextRank.description ) data.description.next = data.nextRank.description;
    else if ( data.nextRank.progression ) data.description.next = "Choose a progression path.";
    else data.description.next = "No benefit";
    return data;
  }
}