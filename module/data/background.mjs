import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Background type Items.
 */
export default class CrucibleBackground extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({required: true, blank: true}),
      skills: new fields.ArrayField(new fields.StringField({required: true, choices: SYSTEM.SKILLS}))
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static validateJoint(data) {

    // Skip validation if this is a newly created item that has not yet been populated
    if ( !data.skills.length ) return;

    // Validate Skills
    if ( (data.skills.length !== 2) || (data.skills[0] === data.skills[1]) ) {
      throw new Error(game.i18n.localize("BACKGROUND.SkillsWarning"));
    }
  }
}
