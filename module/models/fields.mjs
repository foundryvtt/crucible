import CrucibleAction from "./action.mjs";
import CrucibleCounterspellAction from "./counterspell-action.mjs";
import {SYSTEM} from "../const/system.mjs";
const {fields} = foundry.data;

/* -------------------------------------------- */

/**
 * A field embedding a CrucibleAction OR subtype thereof as appropriate
 */
export class CrucibleActionField extends fields.EmbeddedDataField {
  constructor(model=CrucibleAction, options={}) {
    super(model, options);
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( value?.id === "counterspell" ) return new CrucibleCounterspellAction(value, {parent: model, ...options});
    return super.initialize(value, model, options);
  }

  /** @override */
  clean(value, options={}) {
    if ( value?.id === "counterspell" ) {
      return CrucibleCounterspellAction.schema.clean(value, options);
    }
    return super.clean(value, options);
  }
}

/* -------------------------------------------- */

/**
 * A special StringField subclass used for item identifiers.
 */
export class ItemIdentifierField extends fields.StringField {

  /** @inheritdoc */
  static get _defaults() {
    return Object.assign(super._defaults, {
      blank: false,
      nullable: false,
      required: true,
      maxLength: Infinity,
      initial: ItemIdentifierField.#getInitial
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

  /** @override */
  _validateType(value) {
    if ( !ItemIdentifierField.#IDENTIFIER_REGEX.test(value) ) {
      throw new Error(_loc("ITEM.WARNINGS.InvalidIdentifier", {id: value}));
    }
    if ( value.length > this.maxLength ) {
      throw new Error(`Identifier "${value}" exceeds the maximum length of ${this.maxLength} characters.`);
    }
  }
}
