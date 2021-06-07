import { SYSTEM } from "../config/system.js";
import { StandardCheckDialog } from "./standard-check-dialog.js";

/**
 * The standard 3d8 dice pool check used by the system.
 * The rolled formula is determined by:
 *
 * @param {object} rollData     An object of roll data, containing the following optional fields
 * @param {string} actorId      The ID of the actor rolling the check
 * @param {number} dc           The target difficulty of the check
 * @param {number} boons        A number of advantageous boons, up to a maximum of 6
 * @param {number} banes        A number of disadvantageous banes, up to a maximum of 6
 * @param {number} ability      The ability score which modifies the roll, up to a maximum of 12
 * @param {number} skill        The skill bonus which modifies the roll, up to a maximum of 12
 * @param {number} enchantment  An enchantment bonus which modifies the roll, up to a maximum of 6
 */
export default class StandardCheck extends Roll {
  constructor(...args) {
    if ( typeof args[0] === "object" ) args.unshift(""); // Allow for formula to be omitted
    super(...args);
    this.data.id = this.data.id || foundry.utils.randomID(16);
  }

  /* -------------------------------------------- */

  /**
   * Define the default data attributes for this type of Roll
   * @type {object}
   */
  static defaultData = {
    actorId: null,
    ability: 0,
    banes: 0,
    boons: 0,
    circumstance: 0,
    dc: 15,
    enchantment: 0,
    skill: 0
  };

  /* -------------------------------------------- */

  /**
   * Did this check result in a success?
   * @returns {boolean}
   */
  get isSuccess() {
    if ( !this._evaluated ) return undefined;
    return this.total > this.data.dc;
  }

  /* -------------------------------------------- */

  /**
   * Did this check result in a critical success?
   * @returns {boolean}
   */
  get isCriticalSuccess() {
    if ( !this._evaluated ) return undefined;
    return this.total > (this.data.dc + 6);
  }

  /* -------------------------------------------- */

  /**
   * Did this check result in a failure?
   * @returns {boolean}
   */
  get isFailure() {
    if ( !this._evaluated ) return undefined;
    return this.total <= this.data.dc;
  }

  /* -------------------------------------------- */

  /**
   * Did this check result in a critical failure?
   * @returns {boolean}
   */
  get isCriticalFailure() {
    if ( !this._evaluated ) return undefined;
    return this.total <= (this.data.dc - 6);
  }

  /* -------------------------------------------- */

  dialog(options) {
    return new StandardCheckDialog(this, options);
  }

  /* -------------------------------------------- */
  /*  Roll Configuration                          */
  /* -------------------------------------------- */

  /** @override */
  _prepareData(data={}) {
    const defaults = this.constructor.defaultData;
    data = foundry.utils.mergeObject(defaults, data);
    this._configureData(data);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Configure the provided data used to customize this type of Roll
   * @param {object} data     The initially provided data object
   * @returns {object}        The configured data object
   * @private
   */
  _configureData(data) {
    data.banes = Math.clamped(data.banes, 0, SYSTEM.dice.MAX_BOONS);
    data.boons = Math.clamped(data.boons, 0, SYSTEM.dice.MAX_BOONS);
    data.dc = Math.max(data.dc, 0);
    data.ability = Math.clamped(data.ability, 0, 12);
    data.skill = Math.clamped(data.skill, -4, 12);
    data.enchantment = Math.clamped(data.enchantment, 0, 6);
    data.circumstance = data.boons - data.banes;
  }

  /* -------------------------------------------- */

  /** @override */
  static parse(_, data) {

    // Configure the pool
    const pool = [8, 8, 8];

    // Apply boons from the left
    let d = 0;
    for (let i = 0; i < data.boons; i++) {
      pool[d] = pool[d] + SYSTEM.dice.DIE_STEP;
      if (pool[d] === SYSTEM.dice.MAX_DIE) d++;
    }

    // Apply banes from the right
    d = 2;
    for (let i = 0; i < data.banes; i++) {
      pool[d] = pool[d] - SYSTEM.dice.DIE_STEP;
      if (pool[d] === SYSTEM.dice.MIN_DIE) d--;
    }

    // Construct the formula
    const terms = pool.map(p => `1d${p}`).concat([data.ability, data.skill]);
    if ( data.enchantment > 0 ) terms.push(data.enchantment);
    const formula = terms.join(" + ");
    return super.parse(formula, data);
  }

  /* -------------------------------------------- */

  async render(chatOptions={}) {
    const isPrivate = chatOptions.isPrivate;
    const css = [SYSTEM.id, "standard-check"];

    // Determine outcome
    let outcome = "Unknown";
    if ( this.data.dc ) {
      if ( this.isSuccess ) {
        outcome = "Success";
        css.push("success");
        if ( this.isCriticalSuccess ) {
          css.push("critical");
          outcome = "Critical " + outcome;
        }
      }
      else {
        outcome = "Failure";
        css.push("failure");
        if ( this.isCriticalFailure ) {
          css.push("critical");
          outcome = "Critical " + outcome;
        }
      }
    }

    // Render chat card
    return renderTemplate(`systems/${SYSTEM.id}/templates/dice/standard-check-chat.html`, {
      cssClass: css.join(" "),
      data: this.data,
      dc: this.data.dc || "?",
      diceTotal: this.dice.reduce((t, d) => t + d.total, 0),
      isGM: game.user.isGM,
      isPrivate: isPrivate,
      formula: this.formula,
      outcome: outcome,
      pool: this.dice.map(d => {
        return {
          denom: "d"+d.faces,
          result: isPrivate ? "?" : d.total
        }
      }),
      total: isPrivate ? "?" : this.total
    });
  }

  /* -------------------------------------------- */

  /**
   * Used to re-initialize the pool with different data
   * @param rollData
   */
  initialize(rollData) {

    // Prepare new roll data
    this.data = this._prepareData(rollData);

    // Re-prepare formula and terms
    const terms = this.pool.map(p => `1d${p}`).concat([this.data.ability, this.data.skill]);
    if ( this.data.enchantment > 0 ) terms.push(this.data.enchantment);
    this._formula = terms.join(" + ");
    this.terms = this.constructor.parse(this._formula);
  }

  /* -------------------------------------------- */
  /*  Saving and Loading                          */
  /* -------------------------------------------- */

  /** @override */
  toJSON() {
    const data = super.toJSON();
    data.data = this.data;
    return data;
  }

  /* -------------------------------------------- */
  /*  Socket Interactions                         */
  /* -------------------------------------------- */

  /**
   * Handle a request to roll a standard check
   * @param data
   */
  static handle(data) {
    const {title, flavor, rollMode, check} = data;
    const actor = game.actors.get(check.actorId);
    if ( actor.hasPerm(game.user, "OWNER", true) ) {
      const sc = new this(check);
      sc.dialog({ title, flavor, rollMode }).render(true);
    }
  }
}

StandardCheck.PARTS = ["3d8", "@ability", "@skill", "@enchantment", "@circumstance"];
StandardCheck.FORMULA = StandardCheck.PARTS.join(" + ");
