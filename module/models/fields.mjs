import {data} from "/scripts/foundry.mjs";
import CrucibleAction from "./action.mjs";
import {SYSTEM} from "../config/system.mjs";

/* -------------------------------------------- */

/**
 * A standardized ArrayField used when an Item contains Actions.
 */
export class ItemActionsField extends data.fields.ArrayField {
  constructor(options, context) {
    super(new data.fields.EmbeddedDataField(CrucibleAction), options, context);
  }
}

/* -------------------------------------------- */

/**
 * A standardized ArrayField used when an Item contains Actor Hooks.
 */
export class ItemActorHooks extends data.fields.ArrayField {
  constructor(options, context) {
    const hookSchema = new data.fields.SchemaField({
      hook: new data.fields.StringField({required: true, blank: false, choices: SYSTEM.ACTOR.HOOKS}),
      fn: new data.fields.JavaScriptField({async: true, gmOnly: true})
    });
    super(hookSchema, options, context);
  }
}

/* -------------------------------------------- */

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
    if ( !ItemIdentifierField.#IDENTIFIER_REGEX.test(id) ) {
      throw new Error(`Invalid Crucible identifier value "${id}" which must be alphanumeric without spaces or 
      special characters`);
    }
  }
}
