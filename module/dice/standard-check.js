import { SYSTEM } from "../config/system.js";
import { StandardCheckDialog } from "./standard-check-dialog.js";

/**
 * @typedef {Object} DiceCheckBonuses
 * @property {number} boons         A number of advantageous boons, up to a maximum of 6
 * @property {number} banes         A number of disadvantageous banes, up to a maximum of 6
 * @property {number} ability       The ability score which modifies the roll, up to a maximum of 12
 * @property {number} skill         The skill bonus which modifies the roll, up to a maximum of 12
 * @property {number} enchantment   An enchantment bonus which modifies the roll, up to a maximum of 6
 */

/**
 * @typedef {DiceCheckBonuses} StandardCheckData
 * @property {string} actorId       The ID of the actor rolling the check
 * @property {number} dc            The target difficulty of the check
 */

/**
 * The standard 3d8 dice pool check used by the system.
 * The rolled formula is determined by:
 *
 * @param {string|StandardCheckData} formula  This parameter is ignored
 * @param {StandardCheckData} [data]          An object of roll data, containing the following optional fields
 */
export default class StandardCheck extends Roll {
  constructor(formula, data) {
    if ( typeof formula === "object" ) {
      data = formula;
      formula = "";
    }
    super(formula, data);
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
    dc: 20,
    enchantment: 0,
    skill: 0
  };

  /* -------------------------------------------- */

  /**
   * The HTML template path used to render dice checks of this type
   * @type {string}
   */
  static htmlTemplate = `systems/${SYSTEM.id}/templates/dice/standard-check-chat.html`;

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
    for ( let [k, v] of Object.entries(data) ) {
      if ( v === undefined ) delete data[k];
    }
    data = Object.assign({}, this.constructor.defaultData, this.data || {}, data);
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

  /** @override */
  async render(chatOptions={}) {
    return renderTemplate(this.constructor.htmlTemplate, this._getChatCardData(chatOptions));
  }

  /* -------------------------------------------- */

  _getChatCardData(chatOptions) {
    const isPrivate = chatOptions.isPrivate;
    const cardData = {
      css: [SYSTEM.id, "standard-check"],
      data: this.data,
      defenseType: "DC",
      defenseValue: this.data.dc,
      diceTotal: this.dice.reduce((t, d) => t + d.total, 0),
      isGM: game.user.isGM,
      isPrivate: isPrivate,
      formula: this.formula,
      outcome: "Unknown",
      pool: this.dice.map(d => {
        return {
          denom: "d"+d.faces,
          result: isPrivate ? "?" : d.total
        }
      }),
      total: isPrivate ? "?" : this.total
    }

    // Successes and Failures
    if ( this.data.dc ) {
      if ( this.isSuccess ) {
        cardData.outcome = "Success";
        cardData.css.push("success");
        if ( this.isCriticalSuccess ) {
          cardData.outcome = "Critical " + cardData.outcome;
          cardData.css.push("critical");
        }
      }
      else {
        cardData.outcome = "Failure";
        cardData.css.push("failure");
        if ( this.isCriticalFailure ) {
          cardData.outcome = "Critical " + cardData.outcome;
          cardData.css.push("critical");
        }
      }
    }
    cardData.cssClass = cardData.css.join(" ");
    return cardData;
  }

  /* -------------------------------------------- */

  /**
   * Used to re-initialize the pool with different data
   * @param rollData
   */
  initialize(rollData) {
    this.data = this._prepareData(rollData);
    this.terms = this.constructor.parse("", this.data);
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
    if ( actor.testUserPermission(game.user, "OWNER", {exact: true}) ) {
      const sc = new this(check);
      sc.dialog({ title, flavor, rollMode }).render(true);
    }
  }
}

StandardCheck.PARTS = ["3d8", "@ability", "@skill", "@enchantment", "@circumstance"];
StandardCheck.FORMULA = StandardCheck.PARTS.join(" + ");
