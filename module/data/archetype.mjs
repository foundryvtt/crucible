import {SYSTEM} from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Archetype type Items.
 */
export default class CrucibleArchetype extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const nullableInteger = {required: true, nullable: true, integer: true};
    const requiredInteger = {required: true, nullable: false, integer: true};
    return {
      abilities: new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
        obj[ability.id] = new fields.NumberField({...nullableInteger, initial: 4, min: 2, max: 6})
        return obj;
      }, {}), {validate: CrucibleArchetype.#validateAbilities}),
      resistances: new fields.SchemaField(Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, damageType) => {
        obj[damageType.id] = new fields.NumberField({...requiredInteger, initial: 0, min: -3, max: 3});
        return obj;
      }, {}), {validate: CrucibleArchetype.#validateResistances})
    }
  }

  /* -------------------------------------------- */

  static #validateAbilities(abilities) {
    const sum = Object.values(abilities).reduce((t, n) => t + (n ?? 8), 0);
    if ( sum !== 24 ) throw new Error(`The sum of ability scaling values must equal 24. Currently ${sum}`);
  }

  /* -------------------------------------------- */

  static #validateResistances(resistances) {
    const sum = Object.values(resistances).reduce((t, n) => t + n, 0);
    if ( sum !== 0 ) throw new Error(`The sum of resistance scaling values must equal zero. Currently ${sum}`);
  }
}
