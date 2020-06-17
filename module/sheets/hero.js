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
      resizable: false
    });
  }

  /* -------------------------------------------- */

  getData() {
    const data = super.getData();
    data.attributes = SYSTEM.attributes;
    data.points = this.actor.points;
    data.skillCategories = this._formatSkills(this.actor.skills);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order
   * @param {Object} skills
   * @return {*}
   * @private
   */
  _formatSkills(skills) {
    const categories = duplicate(SYSTEM.skills.categories);
    return Object.entries(duplicate(skills)).reduce((categories, e) => {
      let [id, c] = e;
      const skill = c.item;
      const cat = categories[skill.category.id];
      if ( !cat ) return categories;

      // Update skill data for rendering
      skill.attributes = skill.attributes.map(a => SYSTEM.attributes[a]);
      skill.pips = Array.fromRange(5).map((v, i) => i < skill.data.rank ? "trained" : "untrained");
      skill.css = [
        skill.data.rank > 0 ? "trained" : "untrained",
        skill.data.path ? "specialized" : "unspecialized"
      ].join(" ");

      // Values and tooltips
      skill.score = c.score;
      skill.passive = c.passive;
      skill.tooltips = {
        value: `Skill Bonus = [0.5 * (${skill.attributes[0].label} + ${skill.attributes[1].label})] + Rank Modifier + Equipment Bonus`,
        passive: `Passive Bonus = ${SYSTEM.passiveCheck} + Skill Bonus`
      };

      // Add to category and return
      cat.skills = cat.skills || {};
      cat.skills[id] = skill;
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

    // Activate tabs
    new Tabs(html.find(".tabs"), {
      initial: this["_tab"],
      callback: clicked => {
        this["_tab"] = clicked.data("tab");
      }
    });
    this._onInitScroll(html);

    // Record scroll positions
    html.find(".tab").scroll(this._onScrollTab.bind(this));

    // Skill Controls
    html.find(".skill-control").click(this._onClickSkillControl.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a Skill control
   * @param {Event} event   The originating click event
   * @private
   */
  async _onClickSkillControl(event) {
    event.preventDefault();

    // Obtain the Skill item being controlled
    const ctrl = event.currentTarget;
    const li = ctrl.closest(".skill");
    const skill = this.actor.skills[li.dataset.skill];
    const item = skill._id ? this.actor.getOwnedItem(skill._id) : await this.actor.createOwnedItem(skill);

    // Delegate to different action handlers
    switch ( ctrl.dataset.action ) {
      case "edit":
        item.sheet.render(true);
        break;
      case "increase":
        if ( skill.data.rank >= 5 ) return;
        if ( skill.nextRank.cost > this.actor.points.skill.available ) {
          return ui.notifications.error("You do not have sufficient Skill Points to advance this skill.");
        }
        if ( ( skill.data.rank >= 2) && !skill.data.path ) {
          return ui.notifications.error("Choose a progression path before advancing this skill further.");
        }
        item.update({"data.rank": skill.data.rank + 1});
        break;
      case "decrease":
        if ( skill.data.rank > 0 ) item.update({"data.rank": skill.data.rank - 1});
        break;
      case "roll":
        item.roll({passive: event.shiftKey});
        break;
    }
  }

  /* -------------------------------------------- */

  _onInitScroll(html) {
    for ( let [tab, scrollTop] of Object.entries(this._scroll) ) {
      if ( scrollTop ) html[0].querySelector(`.tab[data-tab="${tab}"]`).scrollTop = scrollTop;
    }
  }

  /* -------------------------------------------- */

  _onScrollTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this._scroll[tab] = event.currentTarget.scrollTop;
  }
}
