import { SYSTEM } from "../config/system.js";

/**
 * An application for displaying skill progression paths and allowing an Actor to advance their skill progression.
 * @type {BaseEntitySheet}
 */
export default class SkillSheet extends BaseEntitySheet {
  constructor(actor, skillId, options) {
    super(actor, options);
    this.skillId = skillId;
    this.config = CONFIG.SYSTEM.SKILLS[skillId];
  }

  /* -------------------------------------------- */

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 600,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "skill"],
      template: `systems/${SYSTEM.id}/templates/sheets/skill.html`,
      resizable: true,
      scrollY: [".sheet-body"],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return game.i18n.format("SKILL.SheetTitle", {actor: this.object.name, skill: this.config.name});
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.skill = this.object.skills[this.skillId];
    data.config = this.config;
    data.choosePath = data.skill.rank === 3;
    data.displayPath = data.skill.path && !data.choosePath;

    // Categorize skill ranks
    data.trainedRanks = [];
    data.untrainedRanks = [];
    for ( let [i, r] of this.config.ranks.entries() ) {
        r.label = `${SYSTEM.SKILL_RANKS[i].label} ${this.config.name}`;
      if ( data.skill.rank >= i ) {
        if ( (data.skill.rank === 0) || (i !== 0) ) data.trainedRanks[i] = r;
      }
      else data.untrainedRanks[i] = r;
    }

    // Add path progression
    data.path = data.skill.path ? this.config.paths[data.skill.path] : null;
    if ( data.path ) {
      for ( let [i, r] of data.path.ranks.entries() ) {
        if ( !r ) continue;
        r.label = `${SYSTEM.SKILL_RANKS[i].label} ${data.path.name}`;
        if ( data.skill.rank >= i ) data.trainedRanks[i] = r;
        else data.untrainedRanks[i] = r;
      }
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  _getUpdateData(updateData={}) {
    return mergeObject({[`data.skills.${this.skillId}.path`]: this.form.path.value}, updateData);
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("a.control").click(this._onClickControl.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on buttons on the Skill sheet
   * @param {MouseEvent} event    The left-click event
   * @private
   */
  _onClickControl(event) {
    const btn = event.currentTarget;
    switch ( btn.dataset.action ) {
      case "increase":
        return this.object.purchaseSkill(this.skillId, 1);
      case "decrease":
        return this.object.purchaseSkill(this.skillId, -1);
    }
  }
}
