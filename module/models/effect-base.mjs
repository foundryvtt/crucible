export default class CrucibleBaseActiveEffect extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    // Damage Over Time
    schema.dot = new fields.SchemaField({
      health: new fields.NumberField({required: false, integer: true, nullable: false}),
      morale: new fields.NumberField({required: false, integer: true, nullable: false}),
      damageType: new fields.StringField({required: false, choices: SYSTEM.DAMAGE_TYPES, nullable: false})
    }, {nullable: true, initial: null});

    // Engagement (Flanking)
    schema.engagement = new fields.SchemaField({
      enemies: new fields.NumberField({required: true, integer: true, nullable: false}),
      allies: new fields.NumberField({required: true, integer: true, nullable: false}),
      flanked: new fields.NumberField({required: true, integer: true, nullable: false})
    }, {nullable: true, initial: null})
    
    // Maintained
    // TODO: Do we need anything else?
    schema.maintenance = new fields.SchemaField({
      cost: new fields.NumberField({required: true, integer: true, nullable: false})
    }, {nullable: true, initial: null});
    
    // Scene Regions (currently, Templates)
    // TODO: Once in v14, type: "Region"
    // TODO: Actually track these
    schema.regions = new fields.SetField(new fields.DocumentUUIDField({nullable: false}), {initial: []});

    // Shape-change
    // TODO: What do we want to store here?
    schema.shapechange = new fields.SchemaField({}, {nullable: true, initial: null});

    // Summons
    schema.summons = new fields.SetField(new fields.DocumentUUIDField({type: "Token", nullable: false}), {initial: []});

    return schema;
  }
}