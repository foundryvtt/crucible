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

    // Engagement (Flanked)
    schema.engagement = new fields.SchemaField({
      enemies: new fields.NumberField({required: true, integer: true, nullable: false}),
      allies: new fields.NumberField({required: true, integer: true, nullable: false}),
      flanked: new fields.NumberField({required: true, integer: true, nullable: false})
    }, {nullable: true, initial: null});

    return schema;
  }
}