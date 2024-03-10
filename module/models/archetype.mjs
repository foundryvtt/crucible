/**
 * Define the data schema and functionality of an Archetype applied to Adversary creatures.
 */
export default class CrucibleArchetype extends foundry.abstract.DataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const nullableInteger = {required: true, nullable: true, integer: true};
    return {
      name: new fields.StringField(),
      description: new fields.HTMLField(),
      abilities: new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
        obj[ability.id] = new fields.NumberField({...nullableInteger, initial: 3, min: 0, max: 8})
        return obj;
      }, {}), {validate: CrucibleArchetype.#validateAbilities}),
      talents: new fields.SetField(new fields.StringField({required: true},
        {validate: CrucibleArchetype.#validateUuid}))
    }
  }

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

  /**
   * Validate that each entry in the talents Set is a UUID.
   * @param {string} uuid     The candidate value
   */
  static #validateUuid(uuid) {
    const {documentType, documentId} = foundry.utils.parseUuid(uuid);
    if ( CONST.DOCUMENT_TYPES.includes(documentType) || !foundry.data.validators.isValidId(documentId) ) {
      throw new Error(`"${uuid}" is not a valid Talent UUID string`);
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
}
