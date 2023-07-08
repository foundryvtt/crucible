/**
 * Define the data schema and functionality of a Taxonomy applied to Adversary creatures.
 */
export default class CrucibleTaxonomy extends foundry.abstract.TypeDataModel {

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
      category: new fields.StringField({choices: SYSTEM.ADVERSARY.TAXONOMY_CATEGORIES, initial: "humanoid"}),
      abilities: new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
        obj[ability.id] = new fields.NumberField({...nullableInteger, initial: 3, min: 0, max: 6})
        return obj;
      }, {}), {validate: CrucibleTaxonomy.#validateAbilities}),
      resistances: new fields.SchemaField(Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, damageType) => {
        obj[damageType.id] = new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3});
        return obj;
      }, {}), {validate: CrucibleTaxonomy.#validateResistances})
    }
  }

  /* -------------------------------------------- */

  /**
   * Validate that ability scaling for the Taxonomy is balanced.
   * @param {Object<number>} abilities
   */
  static #validateAbilities(abilities) {
    const sum = Object.values(abilities).reduce((t, n) => t + n, 0);
    if ( sum !== 18 ) throw new Error(`The sum of initial ability values must equal 18. Currently ${sum}`);
  }

  /* -------------------------------------------- */

  /**
   * Validate that resistance scaling for the Taxonomy is balanced.
   * @param {Object<number>} resistances
   */
  static #validateResistances(resistances) {
    const sum = Object.values(resistances).reduce((t, n) => t + n, 0);
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
}
