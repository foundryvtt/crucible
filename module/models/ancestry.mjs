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
      description: new fields.HTMLField(),
      size: new fields.NumberField({required: true, integer: true, nullable: false, min: 1, initial: 3}),
      stride: new fields.NumberField({required: true, integer: true, nullable: false, min: 1, initial: 10}),
      primary: new fields.StringField({required: false, initial: undefined, choices: SYSTEM.ABILITIES}),
      secondary: new fields.StringField({required: false, initial: undefined, choices: SYSTEM.ABILITIES}),
      resistance: new fields.StringField({blank: true, choices: SYSTEM.DAMAGE_TYPES}),
      vulnerability: new fields.StringField({blank: true, choices: SYSTEM.DAMAGE_TYPES})
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ANCESTRY"];

  /* -------------------------------------------- */

  /** @inheritdoc */
  static validateJoint(data) {

    // Skip validation if this is a newly created item that has not yet been populated
    const isNew = !data.primary && !data.secondary;
    if ( isNew ) return;

    // Validate Abilities
    if ( data.primary === data.secondary ) {
      throw new Error(game.i18n.localize("ANCESTRY.WARNINGS.ABILITIES"));
    }

    // Validate Resistances
    if ( (data.resistance && (!data.vulnerability || (data.vulnerability === data.resistance)))
      || (data.vulnerability && (!data.resistance || (data.resistance === data.vulnerability)))) {
      throw new Error(game.i18n.localize("ANCESTRY.WARNINGS.RESISTANCES"));
    }
  }
}
