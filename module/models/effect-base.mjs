/**
 * Active Effect subtype containing crucible-specific system schema.
 */
export default class CrucibleBaseActiveEffect extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*                  Data Schema                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    // Damage Over Time
    schema.dot = new fields.ArrayField(new fields.SchemaField({
      amount: new fields.NumberField({required: true, integer: true, nullable: false, positive: true}),
      damageType: new fields.StringField({required: false, choices: SYSTEM.DAMAGE_TYPES, nullable: false}),
      resource: new fields.StringField({required: true, choices: SYSTEM.RESOURCES, nullable: false}),
      restoration: new fields.BooleanField()
    }), {nullable: false, initial: []});

    // Maintained
    // TODO: Do we need anything else?
    schema.maintenance = new fields.SchemaField({
      cost: new fields.NumberField({required: true, integer: true, nullable: false})
    }, {nullable: true, initial: null});

    // Scene Regions (currently, Templates)
    // TODO: Once in v14, type: "Region"
    // TODO: Actually track these
    schema.regions = new fields.SetField(new fields.DocumentUUIDField({nullable: false}), {initial: []});

    // Summons
    schema.summons = new fields.SetField(new fields.DocumentUUIDField({type: "Token", nullable: false}), {initial: []});

    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "BASE_EFFECT"];
}
