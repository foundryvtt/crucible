import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Ancestry type Items.
 */
export default class AncestryData extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      primary: new fields.StringField({required: true, choices: SYSTEM.ABILITIES}),
      secondary: new fields.StringField({required: true, choices: SYSTEM.ABILITIES}),
      skills: new fields.ArrayField(new fields.StringField({required: true, choices: SYSTEM.SKILLS}), {
        validate: AncestryData.#validateSkills
      }),
      resistance: new fields.StringField({blank: true, choices: SYSTEM.DAMAGE_TYPES}),
      vulnerability: new fields.StringField({blank: true, choices: SYSTEM.DAMAGE_TYPES})
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
      throw new Error(game.i18n.localize("ANCESTRY.SkillsWarning"));
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _validateModel(data) {
    if ( data.primary === data.secondary ) {
      throw new Error(game.i18n.localize("ANCESTRY.AbilityWarning"));
    }
    if ( !!data.resistance !== !!data.vulnerability ) {
      throw new Error(game.i18n.localize("ANCESTRY.ResistanceWarning"));
    }
  }
}
