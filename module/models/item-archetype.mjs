import {ItemIdentifierField} from "./fields.mjs";

/**
 * Define the data schema and functionality of an Archetype applied to Adversary creatures.
 */
export default class CrucibleArchetypeItem extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const nullableInteger = {required: true, nullable: true, integer: true};
    return {
      description: new fields.HTMLField(),
      identifier: new ItemIdentifierField(),
      abilities: new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
        obj[ability.id] = new fields.NumberField({...nullableInteger, initial: 2, min: 0, max: 6});
        return obj;
      }, {}), {validate: CrucibleArchetypeItem.#validateAbilities}),
      talents: new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item"}),
        level: new fields.NumberField({required: true, nullable: true, integer: true, initial: null})
      })),
      skills: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.SKILLS})),
      spells: new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item"}),
        level: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0})
      }), {validate: CrucibleArchetypeItem.#validateSpells}),
      equipment: new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item"}),
        quantity: new fields.NumberField({required: true, nullable: false, integer: true, initial: 1}),
        equipped: new fields.BooleanField()
      }))
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ARCHETYPE"];

  /* -------------------------------------------- */

  /**
   * Validate that ability scaling for the Archetype is balanced.
   * @param {object} abilities                          Ability choices
   * @param {DataFieldValidationOptions} [options={}]   Options which affect validation
   * @throws {Error}                                    An error if the ability choices are invalid
   */
  static #validateAbilities(abilities, options) {
    if ( options.partial === true ) return;
    const sum = Object.values(abilities).reduce((t, n) => t + n, 0);
    if ( sum !== 12 ) throw new Error(`The sum of ability scaling values must equal 12. Currently ${sum}`);
  }

  /* -------------------------------------------- */

  /**
   * Validate that the Archetype-granted spells contain no duplicates.
   * @param {object[]} spells                     Iconic Spells
   * @param {DataFieldValidationOptions} options  Options which affect validation
   * @throws {Error}                              An error if there are duplicate spells
   */
  static #validateSpells(spells, options) {
    if ( spells.length < 2 ) return;
    const uuids = new Set();
    for ( const s of spells ) {
      if ( uuids.has(s.item) ) throw new Error("There must not be duplicate spells on an archetype.");
      uuids.add(s.item);
    }
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * A convenience reference to the CrucibleActor to which this Taxonomy belongs.
   * @type {CrucibleActor}
   */
  get actor() {
    return this.parent.parent;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    source = super.migrateData(source);

    if ( source.talents?.length ) {
      if ( typeof source.talents[0] === "string") {
        source.talents = source.talents.map(t => ({item: t, level: null}));
      }
    }

    const abilities = source.abilities;
    if ( abilities ) {
      const sum = Object.values(abilities).reduce((t, n) => t + n, 0);
      /** @deprecated since 0.7.3 */
      if ( sum === 18 ) source.abilities = Object.keys(SYSTEM.ABILITIES).reduce((obj, a) => {
        obj[a] = 2;
        return obj;
      }, {});
    }
    return source;
  }
}
