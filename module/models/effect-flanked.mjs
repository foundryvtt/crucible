/**
 * Active Effect subtype specific to "flanked" effect.
 */
export default class CrucibleFlankedActiveEffect extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*                  Data Schema                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    // Engagement
    schema.enemies = new fields.NumberField({required: true, integer: true, nullable: false}),
    schema.allies = new fields.NumberField({required: true, integer: true, nullable: false}),
    schema.flanked = new fields.NumberField({required: true, integer: true, nullable: false})

    return schema;
  }
}