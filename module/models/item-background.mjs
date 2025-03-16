/**
 * Data schema, attributes, and methods specific to Background type Items.
 */
export default class CrucibleBackgroundItem extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({required: true, blank: true}),
      skills: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.SKILLS}), {
        validate: CrucibleBackgroundItem.#validateSkills}),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"}))
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["BACKGROUND"];

  /* -------------------------------------------- */

  /**
   * Validate that the Skills assigned to this Background are appropriate.
   * @param {string[]} skills     The assigned skill IDs
   * @throws {Error}              An error if too many skills are assigned
   */
  static #validateSkills(skills) {
    if ( skills.length > 4 ) throw new Error(game.i18n.localize("BACKGROUND.ERRORS.SKILLS_NUMBER"));
  }
}
