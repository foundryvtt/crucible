import {data} from "/scripts/foundry.mjs";

/**
 * A special StringField subclass used for item identifiers.
 */
export class ItemIdentifierField extends data.fields.StringField {

  /** @inheritdoc */
  static get _defaults() {
    return Object.assign(super._defaults, {
      blank: false,
      nullable: false,
      required: true,
      initial: ItemIdentifierField.#getInitial,
      validate: ItemIdentifierField.#validate
    });
  }

  /* -------------------------------------------- */

  /**
   * The regular expression required for a valid system identifier.
   * @type {RegExp}
   */
  static #IDENTIFIER_REGEX = /^[A-z0-9]+$/;

  /* -------------------------------------------- */

  /**
   * Generate an initial identifier for the item based on provided data.
   * @returns {string}
   */
  static #getInitial() {
    return foundry.utils.randomID(10);
  }

  /* -------------------------------------------- */

  /**
   * Validate that the identifier meets requirements.
   * @param {string} id
   * @returns {boolean}
   */
  static #validate(id) {
    return ItemIdentifierField.#IDENTIFIER_REGEX.test(id);
  }
}
