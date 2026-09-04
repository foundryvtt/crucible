import {ItemIdentifierField} from "./fields.mjs";

/**
 * Data schema, attributes, and methods specific to Background type Items.
 */
export default class CrucibleBackgroundItem extends foundry.abstract.TypeDataModel {

  /**
   * How many of each grant a Background is expected to provide. Training and Talents are capped at these numbers,
   * since a hero's whole starting allotment comes from them; Knowledge and Languages are advisory.
   * A single training point is half a rank at level 1, so each leaves a stub which one Talent completes.
   * @type {Readonly<Record<string, number>>}
   */
  static GRANTS = Object.freeze({
    training: 6,
    talents: 3,
    knowledge: 2,
    languages: 1
  });

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
      talents: new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item"}),
        level: new fields.NumberField({required: true, nullable: true, integer: true, initial: null})
      }), {max: this.GRANTS.talents}),
      training: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.PROFICIENCIES}),
        {max: this.GRANTS.training}),
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

    SYSTEM.TALENT.migrateTalentGrants(source);

    /** @deprecated since 0.10.3 */
    if ( source.training && !Array.isArray(source.training) && !(source.training instanceof Set) ) {
      source.training = Object.keys(source.training);
    }
    if ( source.skills ) {
      source.training = [...new Set([...(source.training ?? []), ...source.skills])];
      delete source.skills;
    }
    return source;
  }
}
