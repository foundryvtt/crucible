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
    if ( !data.skills.length ) return;
    if ( (data.skills.length !== 4) || ((new Set(data.skills)).size !== 4) ) {
      throw new Error(game.i18n.localize("BACKGROUND.SkillsWarning"));
    }
  }
}
