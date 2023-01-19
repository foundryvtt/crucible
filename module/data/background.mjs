import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Background type Items.
 */
export default class BackgroundData extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({required: true, blank: true}),
      skills: new fields.ArrayField(new fields.StringField({required: true, choices: SYSTEM.SKILLS}), {
        validate: BackgroundData.#validateSkills
      }),
      talent: new fields.StringField({required: false})
    };
  }

  /* -------------------------------------------- */

  /**
   * Validate that only 2 skills are chosen
   * @param {string[]} skills     The chosen skills
   * @returns {boolean}           Is the array valid
   */
  static #validateSkills(skills) {
    if ( (skills.length !== 2) || (skills[0] === skills[1]) ) {
      throw new Error(game.i18n.localize("BACKGROUND.SkillsWarning"));
    }
  }
}
