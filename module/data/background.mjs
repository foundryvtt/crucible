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
      skills: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.SKILLS})),
      talents: new fields.SetField(new fields.StringField({required: true},
        {validate: CrucibleBackground.#validateUuid}))
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static validateJoint(data) {
    if ( !data.skills.length && !data.talents.length ) return; // Newly created backgrounds
    if ( (data.skills.length !== 4) || ((new Set(data.skills)).size !== 4) ) {
      throw new Error(game.i18n.localize("BACKGROUND.SkillsWarning"));
    }
    if ( data.talents.length > 1 ) {
      throw new Error(game.i18n.localize("BACKGROUND.TalentNumberError"));
    }
  }

  /* -------------------------------------------- */

  static #validateUuid(uuid) {
    const {documentType, documentId} = foundry.utils.parseUuid(uuid);
    if ( CONST.DOCUMENT_TYPES.includes(documentType) || !foundry.data.validators.isValidId(documentId) ) {
      throw new Error(`"${uuid}" is not a valid Talent UUID string`);
    }
  }
}
