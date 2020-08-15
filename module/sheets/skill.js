import { SYSTEM } from "../config/system.js";

/**
 * An application for displaying skill progression paths and allowing an Actor to advance their skill progression.
 * @type {FormApplication}
 */
export default class SkillSheet extends FormApplication {
  constructor(actor, skillId) {
    super(actor);
    this.skill = actor.skills[skillId];
    this.config = CONFIG.SYSTEM.SKILLS[skillId];
  }

  /* -------------------------------------------- */

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 600,
      height: 520,
      classes: [SYSTEM.id, "sheet", "skill"],
      template: `systems/${SYSTEM.id}/templates/sheets/skill.html`,
      resizable: true,
      scrollY: [".sheet-body"]
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
    data.skill = this.skill;
    data.config = this.config;
    data.trainedRanks = this.skill.rank ? this.config.ranks.slice(1, this.skill.rank+1) : [this.config.ranks[0]];
    data.untrainedRanks = this.skill.rank ? this.config.ranks.slice(this.skill.rank+1) : this.config.ranks.slice(1);
    data.path = this.skill.path ? this.config.paths[this.skill.path] : null;
    if ( data.path ) {
      for ( let [i, r] of data.path.ranks.entries() ) {
        if ( !r ) continue;
        if ( i <= this.skill.rank ) data.trainedRanks[i-1] = r;
        if ( i > this.skill.rank ) data.untrainedRanks[i-1] = r;
      }
    }
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for SkillSheet events
   */
  activateListeners(html) {
    super.activateListeners(html);
  }
}
