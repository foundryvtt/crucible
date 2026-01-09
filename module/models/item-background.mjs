import {ItemIdentifierField} from "./fields.mjs";

/**
 * Data schema, attributes, and methods specific to Background type Items.
 */
export default class CrucibleBackgroundItem extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({required: true, blank: true}),
      identifier: new ItemIdentifierField(),
      knowledge: new fields.SetField(new fields.StringField({choices: () => crucible.CONFIG.knowledge})),
      languages: new fields.SetField(new fields.StringField()),
      skills: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.SKILLS})),
      talents: new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item"}),
        level: new fields.NumberField({required: true, nullable: true, integer: true, initial: null})
      })),
      ui: new fields.SchemaField({
        color: new fields.ColorField()
      })
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["BACKGROUND"];

  /* -------------------------------------------- */
  /*        Deprecations and Compatibility        */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    source = super.migrateData(source);

    if ( source.talents?.length ) {
      if ( typeof source.talents[0] === "string") {
        source.talents = source.talents.map(t => ({item: t, level: null}));
      }
    }

    return source;
  }
}
