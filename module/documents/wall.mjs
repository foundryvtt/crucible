export default class CrucibleWall extends foundry.documents.WallDocument {
  /**
   * The fields which can edit the bash & pick difficulties of a door-type Wall document.
   * @type {foundry.data.fields.SchemaField}
   */
  static get doorSchema() {
    return CrucibleWall.#getDoorSchema();
  }

  static #doorSchema;

  /**
   * The default DCs for methods of unlocking a door.
   * @type {Record<string, number>}
   */
  static #DEFAULT_UNLOCK_DCS = {
    bash: 20,
    pick: 15
  };

  /* -------------------------------------------- */

  /**
   * Get the fields which edit the bash & pick difficulties of a door-type Wall document, localized on first use.
   * @returns {foundry.data.fields.SchemaField}
   */
  static #getDoorSchema() {
    if ( CrucibleWall.#doorSchema ) return CrucibleWall.#doorSchema;
    const {SchemaField, NumberField} = foundry.data.fields;
    const schema = new SchemaField({
      bash: new NumberField({required: true, integer: true, min: 0, initial: CrucibleWall.#DEFAULT_UNLOCK_DCS.bash}),
      pick: new NumberField({required: true, integer: true, min: 0, initial: CrucibleWall.#DEFAULT_UNLOCK_DCS.pick})
    });
    foundry.helpers.Localization.localizeSchema(schema, ["WALL"]);
    return CrucibleWall.#doorSchema = schema;
  }

  /* -------------------------------------------- */

  /**
   * The DCs for each method for unlocking this wall, if it were a door.
   * @returns {Record<string, number>}
   */
  get unlockDCs() {
    return {
      bash: this.getFlag("crucible", "bash") ?? CrucibleWall.#DEFAULT_UNLOCK_DCS.bash,
      pick: this.getFlag("crucible", "pick") ?? CrucibleWall.#DEFAULT_UNLOCK_DCS.pick
    };
  }
}
