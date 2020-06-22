import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Skills
 * @type {Actor}
 */
export default class HeroSheet extends ActorSheet {
  constructor(actor, options) {
    super(actor, options);

    /**
     * The initial tab viewed on the sheet
     * @type {string}
     * @private
     */
    this._tab = "skills";

    /**
     * Record the scroll positions of each sheet tab
     * @type {Object}
     */
    this._scroll = {};
  }

  /* -------------------------------------------- */

	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 760,
      height: 840,
      classes: [SYSTEM.id, "sheet", "actor"],
      template: `systems/${SYSTEM.id}/templates/sheets/hero.html`,
      resizable: false,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}],
      scrollY: [".tab.attributes", ".tab.skills"]
    });
  }

  /* -------------------------------------------- */

  getData() {
    const data = super.getData();
    data.points = this.actor.points;
    data.isL1 = this.actor.data.data.details.level === 1;
    data.abilityScores = this._formatAbilities(this.actor.data.data.attributes);
    data.resistances = this._formatResistances(this.actor.data.data.resistances);
    data.skillCategories = this._formatSkills(this.actor.data.data.skills);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Format ability scores for display on the Actor sheet.
   * @param {object} attributes
   * @return {object[]}
   * @private
   */
  _formatAbilities(attributes) {
    const points = this.actor.points.ability;
    return Object.entries(SYSTEM.ABILITIES).map(e => {
      let [a, ability] = e;
      const attr = mergeObject(attributes[a], ability);
      attr.id = a;
      attr.canIncrease = (points.pool > 0) || (points.available > 0);
      attr.canDecrease = (this.actor.data.data.details.level === 1) || (attr.increases > 0);
      return attr;
    });
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order
   * @param {Object} skills
   * @return {*}
   * @private
   */
  _formatSkills(skills) {
    const categories = duplicate(SYSTEM.SKILL_CATEGORIES);
    return Object.entries(duplicate(skills)).reduce((categories, e) => {
      let [id, c] = e;
      const skill = mergeObject(c, SYSTEM.SKILLS[id]);
      const cat = categories[skill.category];
      if ( !cat ) return categories;

      // Update skill data for rendering
      skill.icon = `systems/${SYSTEM.id}/${skill.icon}`;
      skill.attributes = skill.attributes.map(a => SYSTEM.ABILITIES[a]);
      skill.pips = Array.fromRange(5).map((v, i) => i < c.rank ? "trained" : "untrained");
      skill.css = [
        c.rank > 0 ? "trained" : "untrained",
        c.path ? "specialized" : "unspecialized"
      ].join(" ");
      skill.tooltips = {
        value: `Roll Bonus = [0.5 * (${skill.attributes[0].label} + ${skill.attributes[1].label})] + Skill Bonus + Enchantment Bonus`,
        passive: `Passive Bonus = ${SYSTEM.dice.passiveCheck} + Roll Bonus`
      };

      // Specialization status
      const path = skill.paths.find(p => p.id === skill.path);
      skill.rankName = SYSTEM.SKILL_RANKS[skill.rank].label;
      skill.pathName = path ? path.name : game.i18n.localize("SKILL.Unspecialized");

      // Add to category and return
      cat.skills = cat.skills || {};
      cat.skills[id] = skill;
      return categories;
    }, categories);
  }

  /* -------------------------------------------- */

  /**
   * Organize resistances data for rendering
   * @param {object} resistances    The Actor's resistances data
   * @return {object}               Resistances data organized by category
   * @private
   */
  _formatResistances(resistances) {
    const categories = duplicate(SYSTEM.DAMAGE_CATEGORIES);
    return Object.entries(duplicate(resistances)).reduce((categories, e) => {

      // Merge resistance data for rendering
      let [id, r] = e;
      const resist = mergeObject(r, SYSTEM.DAMAGE_TYPES[id]);

      // Add the resistance to its category
      const cat = categories[resist.type];
      cat.resists = cat.resists || {};
      cat.resists[id] = resist;
      return categories;
    }, categories);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Activate listeners for SkillSheet events
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Skill Controls
    html.find("a.control").click(this._onClickControl.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a Skill control
   * @param {Event} event   The originating click event
   * @private
   */
  async _onClickControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    switch ( a.dataset.action ) {
      case "abilityDecrease":
        return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, -1);
      case "abilityIncrease":
        return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, 1);

      case "skillIncrease":
        if ( skill.data.rank >= 5 ) return;
        if ( skill.nextRank.cost > this.actor.points.skill.available ) {
          return ui.notifications.error("You do not have sufficient Skill Points to advance this skill.");
        }
        if ( ( skill.data.rank >= 2) && !skill.data.path ) {
          return ui.notifications.error("Choose a progression path before advancing this skill further.");
        }
        item.update({"data.rank": skill.data.rank + 1});
        break;
      case "skillDecrease":
        if ( skill.data.rank > 0 ) item.update({"data.rank": skill.data.rank - 1});
        break;
      case "skillRoll":
        item.roll({passive: event.shiftKey});
        break;
    }


    const li = ctrl.closest(".skill");
    const skill = this.actor.skills[li.dataset.skill];
    const item = skill._id ? this.actor.getOwnedItem(skill._id) : await this.actor.createOwnedItem(skill);


  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(itemData) {
    switch (itemData.type) {
      case "ancestry":
        return this.actor.applyAncestry(itemData);
      case "background":
        return this.actor.applyBackground(itemData);
      case "skill":
        // return this.actor.applySkill(itemData);
    }
    return super._onDropItemCreate(itemData);
  }
}
