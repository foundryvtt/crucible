import { SYSTEM } from "../config/system.js";

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
    return this.system.config;
  }

  /**
   * An array of actions that this Item provides.
   * @type {ActionData}
   */
  get actions() {
    return this.system.actions;
  }

  /**
   * Current talent rank for this Item
   * @type {TalentRankData}
   */
  get rank() {
    return this.system.currentRank;
  }

  /* -------------------------------------------- */
  /*  Item Data Preparation                       */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    switch ( this.type ) {
      case "skill":
        this.system.config = SYSTEM.skills.skills[this.system.skill] || {};
        break;
    }
    return super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    switch ( this.type ) {
      case "skill":
        return this._prepareSkillData();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare additional data for Skill type Items.
   */
  _prepareSkillData() {
    const skill = this.config || {};

    // Copy and merge skill data
    this.name = skill.name;
    this.img = skill.icon;
    this.category = skill.category;
    this.attributes = skill.attributes;

    // Skill rank
    let current = null;
    let next = null;
    this.ranks = foundry.utils.deepClone(skill.ranks).map(r => {
      r.purchased = (r.rank > 0) && (r.rank <= this.rank);
      if ( r.rank === this.rank ) current = r;
      else if ( r.rank === this.rank + 1 ) next = r;
      return r;
    });
    this.currentRank = current;
    this.nextRank = next;

    // Skill progression paths
    let path = null;
    this.paths = foundry.utils.deepClone(skill.paths).map(p => {
      p.active = p.id === this.path;
      if ( p.active ) path = p;
      return p;
    });
    this.path = path;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Provide an array of detail tags which are shown in each item description
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Object<string, string>}    The tags which describe this Item
   */
  getTags(scope="full") {
    switch ( this.type ) {
      case "armor":
      case "talent":
      case "weapon":
        return this.system.getTags(scope);
      default:
        return {};
    }
  }

  /* -------------------------------------------- */
  /*  Dice Rolls                                  */
  /* -------------------------------------------- */

  roll(options={}) {
    if ( !this.isOwned ) return false;
    switch ( this.type ) {
      case "skill":
        return this._rollSkillCheck(options);
    }
  }

  /* -------------------------------------------- */

  async _rollSkillCheck({passive=false}={}) {
    const formula = `${passive ? SYSTEM.dice.passiveCheck : SYSTEM.activeCheckFormula} + ${this.value}`;
    const roll = new Roll(formula).roll();
    const skillName = this.system.path ? `${this.name} (${this.path.name})` : this.name;
    await roll.toMessage({
      speaker: {actor: this.actor, user: game.user},
      flavor: passive ? `Passive ${skillName}` : `${skillName} Skill Check`
    });
    return roll;
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Prevent creating certain types of items
    if ( this.isOwned ) {
      switch (data.type) {
        case "ancestry":
          if ( this.parent.type === "hero" ) {
            await this.parent.applyAncestry(this);
            options.temporary = true;
          }
          return;
        case "archetype":
          if ( this.parent.type === "archetype" ) {
            await this.parent.applyArchetype(this);
            options.temporary = true;
          }
          return;
        case "background":
          if ( this.parent.type === "hero" ) {
            await this.applyBackground(this);
            options.temporary = true;
          }
          return;
        case "talent":
          options.keepId = true;
          options.keepEmbeddedIds = true;
      }
    }
  }

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
    if ( changed.system?.equipped !== undefined ) {
      const text = `${changed.system.equipped ? "+" : "-"}(${this.name})`;
      const fontSize = 24 * (canvas.dimensions.size / 100).toNearest(0.25);
      for ( let token of tokens ) {
        canvas.interface.createScrollingText(token.center, text, {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          direction: CONST.TEXT_ANCHOR_POINTS[changed.system.equipped ? "TOP" : "BOTTOM"],
          fontSize: fontSize,
          stroke: 0x000000,
          strokeThickness: 4
        });
      }
    }
  }
}
