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
      abilities: new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
        obj[ability.id] = new fields.NumberField({...nullableInteger, initial: 3, min: 0, max: 8})
        return obj;
      }, {}), {validate: CrucibleArchetypeItem.#validateAbilities}),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"}))
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ARCHETYPE"];

  /* -------------------------------------------- */

  /**
   * Validate that ability scaling for the Archetype is balanced.
   * @param {Object<number>} abilities
   */
  static #validateAbilities(abilities) {
    const sum = Object.values(abilities).reduce((t, n) => t + n, 0);
    if ( sum !== 18 ) throw new Error(`The sum of ability scaling values must equal 18. Currently ${sum}`);
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
