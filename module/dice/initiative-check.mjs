import StandardCheck from "./standard-check.mjs";

/**
 * A special case of StandardCheck used specifically for initiative rolls.
 */
export default class InitiativeCheck extends StandardCheck {

  /**
   * Define the default data attributes for this type of Roll
   * @type {object}
   */
  static defaultData = {...super.defaultData,
    incapacitated: false,
    unaware: false,
    type: "initiative"
  };

  /* -------------------------------------------- */

  /** @override */
  static parse(_formula, data) {
    if ( data.incapacitated ) return foundry.dice.Roll.parse("0", data);
    else if ( data.unaware ) return foundry.dice.Roll.parse("1", data);
    return super.parse(_formula, data);
  }
}
