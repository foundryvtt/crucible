import { SYSTEM } from "../../config/system.js";

/**
 * An application for displaying skill progression paths and allowing an Actor to advance their skill progression.
 * TODO move to apps, this isn't a document
 * @type {DocumentSheet}
 */
export default class SkillConfig extends DocumentSheet {
  constructor(actor, skillId, options) {
    super(actor, options);
    this.skillId = skillId;
    this.config = CONFIG.SYSTEM.SKILLS[skillId];
  }

  /* -------------------------------------------- */

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
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
    const context = super.getData();
    context.skill = this.object.skills[this.skillId];
    context.config = this.config;
    context.choosePath = context.skill.rank === 3;
    context.displayPath = context.skill.path && !context.choosePath;

    // Categorize skill ranks
    context.trainedRanks = [];
    context.untrainedRanks = [];
    for ( let [i, r] of this.config.ranks.entries() ) {
        r.label = `${SYSTEM.SKILL.RANKS[i].label} ${this.config.name}`;
      if ( context.skill.rank >= i ) {
        if ( (context.skill.rank === 0) || (i !== 0) ) context.trainedRanks[i] = r;
      }
      else context.untrainedRanks[i] = r;
    }

    // Add path progression
    context.path = context.skill.path ? this.config.paths[context.skill.path] : null;
    if ( context.path ) {
      for ( let [i, r] of context.path.ranks.entries() ) {
        if ( !r ) continue;
        r.label = `${SYSTEM.SKILL.RANKS[i].label} ${context.path.name}`;
        if ( context.skill.rank >= i ) context.trainedRanks[i] = r;
        else context.untrainedRanks[i] = r;
      }
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData={}) {
    return foundry.utils.mergeObject({[`data.skills.${this.skillId}.path`]: this.form.path.value}, updateData);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
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
