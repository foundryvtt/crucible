import { SYSTEM } from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Ancestry type Items.
 */
export default class CrucibleAncestry extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({required: true, blank: true}),
      primary: new fields.StringField({required: false, initial: undefined, choices: SYSTEM.ABILITIES}),
      secondary: new fields.StringField({required: false, initial: undefined, choices: SYSTEM.ABILITIES}),
      skills: new fields.ArrayField(new fields.StringField({required: true, choices: SYSTEM.SKILLS})),
      resistance: new fields.StringField({blank: true, choices: SYSTEM.DAMAGE_TYPES}),
      vulnerability: new fields.StringField({blank: true, choices: SYSTEM.DAMAGE_TYPES})
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static validateJoint(data) {

    // Skip validation if this is a newly created item that has not yet been populated
    const isNew = !data.primary && !data.secondary && !data.skills.length;
    if ( isNew ) return;

    // Validate Abilities
    if ( data.primary === data.secondary ) {
      throw new Error(game.i18n.localize("ANCESTRY.AbilityWarning"));
    }

    // Validate Skills
    if ( (data.skills.length !== 2) || (data.skills[0] === data.skills[1]) ) {
      throw new Error(game.i18n.localize("ANCESTRY.SkillsWarning"));
    }

    // Validate Resistances
    if ( (data.resistance && (!data.vulnerability || (data.vulnerability === data.resistance)))
      || (data.vulnerability && (!data.resistance || (data.resistance === data.vulnerability)))) {
      throw new Error(game.i18n.localize("ANCESTRY.ResistanceWarning"));
    }
  }
}
