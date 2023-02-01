/**
 * Data schema, attributes, and methods specific to Archetype type Items.
 */
export default class ArchetypeData extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    return {
      attributes: new fields.SchemaField({
        strength: new fields.NumberField({...requiredInteger, initial: 4, min: 0, max: 6}),
        toughness: new fields.NumberField({...requiredInteger, initial: 4, min: 0, max: 6}),
        dexterity: new fields.NumberField({...requiredInteger, initial: 4, min: 0, max: 6}),
        intellect: new fields.NumberField({...requiredInteger, initial: 4, min: 0, max: 6}),
        presence: new fields.NumberField({...requiredInteger, initial: 4, min: 0, max: 6}),
        wisdom: new fields.NumberField({...requiredInteger, initial: 4, min: 0, max: 6})
      }, {validate: ArchetypeData.#validateAttributes}),
      resistances: new fields.SchemaField({
        bludgeoning: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        piercing: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        slashing: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        acid: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        fire: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        frost: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        lightning: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        psychic: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        radiant: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3}),
        unholy: new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3})
      }, {validate: ArchetypeData.#validateResistances})
    }
  }

  /* -------------------------------------------- */

  static #validateAttributes(attributes) {
    const sum = Object.values(attributes).reduce((t, n) => t + n, 0);
    if ( sum !== 24 ) throw new Error("The sum of archetype resistance scaling values must equal 24.");
  }

  /* -------------------------------------------- */

  static #validateResistances(resistances) {
    const sum = Object.values(resistances).reduce((t, n) => t + n, 0);
    if ( sum !== 0 ) throw new Error("The sum of archetype resistance scaling values must equal zero.");
  }
}
