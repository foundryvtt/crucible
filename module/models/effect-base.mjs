/**
 * Active Effect subtype containing crucible-specific system schema.
 */
export default class CrucibleBaseActiveEffect extends foundry.data.ActiveEffectTypeDataModel {

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    return Object.assign(schema, {
      dot: new fields.ArrayField(new fields.SchemaField({
        amount: new fields.NumberField({required: true, integer: true, nullable: false, positive: true}),
        damageType: new fields.StringField({required: false, choices: SYSTEM.DAMAGE_TYPES, nullable: false}),
        resource: new fields.StringField({required: true, choices: SYSTEM.RESOURCES, nullable: false}),
        restoration: new fields.BooleanField()
      }), {nullable: false, initial: []}),
      magical: new fields.BooleanField(),
      maintenance: new fields.SchemaField({
        cost: new fields.NumberField({required: true, integer: true, nullable: false})
      }, {nullable: true, initial: null}),
      regions: new fields.SetField(new fields.DocumentUUIDField({type: "Region", nullable: false})),
      summons: new fields.SetField(new fields.DocumentUUIDField({type: "Token", nullable: false}))
    });
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "BASE_EFFECT"];
}
