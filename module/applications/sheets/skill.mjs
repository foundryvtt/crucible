import {SKILLS, SKILL_RANKS, SKILL_RANK_IDS} from "../../config/skills.js";

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
    context.skills = SKILLS;
    context.skill = SKILLS[context.data.system.skillId];
    context.ranks = this.#prepareRanks(context.data.system.ranks);
    context.paths = this.#preparePaths(context.data.system.paths);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare skill rank data for rendering.
   */
  #prepareRanks(rankData) {
    const ranks = foundry.utils.deepClone(SKILL_RANKS);
    for ( const [rankId, {description}] of Object.entries(rankData) ) {
      const r = ranks[SKILL_RANK_IDS[rankId]];
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
        const {label, rank:n} = SKILL_RANKS[SKILL_RANK_IDS[rankId]];
        rank.title = `${label} (Rank ${n})`;
      }
    }
    return pathData;
  }
}
