import {ItemIdentifierField} from "./fields.mjs";

/**
 * Define the data schema and functionality of a Taxonomy applied to Adversary creatures.
 */
export default class CrucibleTaxonomyItem extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const nullableInteger = {required: true, nullable: true, integer: true};
    const requiredInteger = {required: true, nullable: false, integer: true};
    return {
      description: new fields.HTMLField(),
      identifier: new ItemIdentifierField(),
      category: new fields.StringField({choices: SYSTEM.ACTOR.CREATURE_CATEGORIES, initial: "humanoid"}),
      abilities: new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
        obj[ability.id] = new fields.NumberField({...nullableInteger, initial: 2, min: 0, max: 6})
        return obj;
      }, {}), {validate: CrucibleTaxonomyItem.#validateAbilities}),
      movement: new fields.SchemaField({
        size: new fields.NumberField({...requiredInteger, min: 1, initial: 4}),
        stride: new fields.NumberField({...requiredInteger, min: 1, initial: 10})
      }),
      resistances: new fields.SchemaField(Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, damageType) => {
        obj[damageType.id] = new fields.SchemaField({
          value: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
          immune: new fields.BooleanField()
        });
        return obj;
      }, {}), {validate: CrucibleTaxonomyItem.#validateResistances}),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"})),
      characteristics: new fields.SchemaField({
        equipment: new fields.BooleanField(),
        spells: new fields.BooleanField()
      }),
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["TAXONOMY"];

  /* -------------------------------------------- */

  /**
   * Validate that ability scaling for the Taxonomy is balanced.
   * @param {object} abilities                          Ability choices
   * @param {DataFieldValidationOptions} [options={}]   Options which affect validation
   * @throws {Error}                                    An error if the ability choices are invalid
   */
  static #validateAbilities(abilities, options) {
    if ( options.partial === true ) return;
    const sum = Object.values(abilities).reduce((t, n) => t + n, 0);
    if ( sum !== 12 ) throw new Error(`The sum of initial ability values must equal 12. Currently ${sum}`);
  }

  /* -------------------------------------------- */

  /**
   * Validate that resistance scaling for the Taxonomy is balanced.
   * @param {Object<string, {value: number; immune: boolean}>} resistances                Resistance choices
   * @param {DataFieldValidationOptions} [options={}]   Options which affect validation
   * @throws {Error}                                    An error if the resistance choices are invalid
   */
  static #validateResistances(resistances, options) {
    if ( options.partial === true ) return;
    const sum = Object.values(resistances).reduce((t, n) => t + (n.immune ? 4 : n.value), 0);
    if ( sum !== 0 ) throw new Error(`The sum of resistance scaling values must equal zero. Currently ${sum}`);
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
    super.migrateData(source);

    const abilities = source.abilities;
    const sum = Object.values(abilities).reduce((t, n) => t + n, 0);
    /** @deprecated since 0.7.3 */
    if ( sum === 18 ) source.abilities = Object.keys(SYSTEM.ABILITIES).reduce((obj, a) => {
      obj[a] = 2;
      return obj;
    }, {});

    /** @deprecated since 0.7.3 */
    if ( source.size && !source.movement?.size ) {
      source.movement ||= {};
      source.movement.size = source.size;
      delete source.size;
    }

    /** @deprecated since 0.7.3 */
    if ( source.stride && !source.movement?.stride ) {
      source.movement ||= {};
      source.movement.stride = source.stride;
      delete source.stride;
    }

    /** @deprecated since 0.8.1 */
    for ( const damageType of Object.values(SYSTEM.DAMAGE_TYPES) ) {
      if ( Number.isNumeric(source.resistances[damageType.id]) ) {
        source.resistances[damageType.id] = {
          value: source.resistances[damageType.id],
          immune: false
        } 
      }
    }
  }
}
