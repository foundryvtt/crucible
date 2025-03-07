/**
 * Data schema, attributes, and methods specific to Group type Actors.
 */
export default class CrucibleGroupActor extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = {};

    // Group Members
    schema.members = new fields.ArrayField(new fields.SchemaField({
      actor: new fields.ForeignDocumentField(foundry.documents.BaseActor),
      quantity: new fields.NumberField({...requiredInteger, min: 1, initial: 1})
    }));

    // Movement Attributes
    schema.movement = new fields.SchemaField({
      pace: new fields.StringField({required: true, choices: SYSTEM.ACTOR.TRAVEL_PACES, initial: "normal"}),
      land: new fields.NumberField({required: true, nullable: false, min: 0, initial: 2, step: 0.5}),
      water: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0.5, step: 0.5}),
      air: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0, step: 0.5}),
    });

    // Description
    schema.details = new fields.SchemaField({
      biography: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      })
    });

    // Advancement
    schema.advancement = new fields.SchemaField({
      milestones: new fields.NumberField({...requiredInteger, min: 0, initial: 0})
    });
    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTOR.GROUP"];

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

}
