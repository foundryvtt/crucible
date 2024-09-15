import * as SKILL from "../../config/skills.mjs";
import {ABILITIES} from "../../config/attributes.mjs";

/**
 * The application used to view and edit a skill page in the system journal.
 */
export default class SkillPageSheet extends JournalPageSheet {

  /** @inheritDoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.classes.push("crucible", "skill-sheet");
    options.viewClasses.push("crucible", "skill");
    options.scrollY = [".scrollable"];
    return options;
  }

  /** @inheritDoc */
  get template() {
    return `systems/crucible/templates/sheets/skill-${this.isEditable ? "edit" : "view"}.hbs`;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options={}) {
    const context = await super.getData(options);
    context.skills = SKILL.SKILLS;
    context.skill = SKILL.SKILLS[context.data.system.skillId];
    context.tags = this.#getTags(context.skill);
    context.ranks = this.#prepareRanks(context.data.system.ranks);
    context.paths = this.#preparePaths(context.data.system.paths);
    return context;
  }

  /* -------------------------------------------- */

  #getTags(skill) {
    if ( !skill?.category ) return {};
    const c = SKILL.CATEGORIES[skill.category];
    const a1 = ABILITIES[skill.abilities[0]];
    const a2 = ABILITIES[skill.abilities[1]];
    return [
      {type: "category", label: c.label, color: c.color.css + "50"},
      {type: "ability", label: a1.label, color: a1.color.css + "50"},
      {type: "ability", label: a2.label, color: a2.color.css + "50"}
    ]
  }

  /* -------------------------------------------- */

  /**
   * Prepare skill rank data for rendering.
   */
  #prepareRanks(rankData) {
    const ranks = foundry.utils.deepClone(SKILL.RANKS);
    for ( const [rankId, {description}] of Object.entries(rankData) ) {
      const r = ranks[SKILL.RANK_IDS[rankId]];
      r.title = `${r.label} (Rank ${r.rank})`;
      r.description = description;
    }
    return ranks;
  }

  /* -------------------------------------------- */

  /**
   * Prepare specialization path data for rendering.
   */
  #preparePaths(pathData) {
    for ( const [i, path] of Object.values(pathData).entries() ) {
      path.title = `Specialization Path ${i+1}`;
      for ( const [rankId, rank] of Object.entries(path.ranks) ) {
        const {label, rank:n} = SKILL.RANKS[SKILL.RANK_IDS[rankId]];
        rank.title = `${label} (Rank ${n})`;
      }
    }
    return pathData;
  }
}
