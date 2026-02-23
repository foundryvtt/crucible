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
 * A standardized ArrayField used when an Item contains Actor Hooks.
 */
export class ItemActorHooks extends fields.ArrayField {
  constructor(options, context) {
    const hookSchema = new fields.SchemaField({
      hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTOR.HOOKS}),
      fn: new fields.JavaScriptField({async: true, gmOnly: true})
    });
    super(hookSchema, options, context);
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
   */
  static #validate(id) {
    if ( !ItemIdentifierField.#IDENTIFIER_REGEX.test(id) ) {
      throw new Error(`Invalid Crucible identifier value "${id}" which must be alphanumeric without spaces or 
      special characters`);
    }
  }
}
