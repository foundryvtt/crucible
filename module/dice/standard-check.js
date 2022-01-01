import { SYSTEM } from "../config/system.js";
import StandardCheckDialog from "./standard-check-dialog.js";

/**
 * @typedef {Object} DiceCheckBonuses
 * @property {number} [boons=0]               A number of advantageous boons, up to a maximum of 6
 * @property {number} [banes=0]               A number of disadvantageous banes, up to a maximum of 6
 * @property {number} [ability=0]             The ability score which modifies the roll, up to a maximum of 12
 * @property {number} [skill=0]               The skill bonus which modifies the roll, up to a maximum of 12
 * @property {number} [enchantment=0]         An enchantment bonus which modifies the roll, up to a maximum of 6
 * @property {string} [rollMode]              The rollMode which should be used if this check is displayed in chat
 */

/**
 * @typedef {DiceCheckBonuses} StandardCheckData
 * @property {string} actorId                 The ID of the actor rolling the check
 * @property {number} dc                      The target difficulty of the check
 * @property {string} type                    The type of check being performed
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
    skill: 0,
    type: "general",
    rollMode: undefined
  };

  /* -------------------------------------------- */

  /**
   * Which Dialog subclass should display a prompt for this Roll type?
   * @type {StandardCheckDialog}
   */
  static dialogClass = StandardCheckDialog;

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
  /*  Roll Configuration                          */
  /* -------------------------------------------- */

  /** @override */
  _prepareData(data={}) {
    const current = this.data || Object.assign({}, this.constructor.defaultData);
    for ( let [k, v] of Object.entries(data) ) {
      if ( v === undefined ) delete data[k];
    }
    data = foundry.utils.mergeObject(current, data, {insertKeys: false});
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
    if ( chatOptions.isPrivate ) return "";
    return renderTemplate(this.constructor.htmlTemplate, this._getChatCardData());
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data object used to render the StandardCheck object to an HTML template
   * @returns {object}      A prepared context object that is used to render the HTML template
   * @private
   */
  _getChatCardData() {
    const cardData = {
      css: [SYSTEM.id, "standard-check"],
      data: this.data,
      defenseType: "DC",
      defenseValue: this.data.dc,
      diceTotal: this.dice.reduce((t, d) => t + d.total, 0),
      isGM: game.user.isGM,
      formula: this.formula,
      outcome: "Unknown",
      pool: this.dice.map(d => ({denom: `d${d.faces}`, result: d.total})),
      total: this.total
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
   * @param {object} data
   */
  initialize(data) {
    this.data = this._prepareData(data);
    this.terms = this.constructor.parse("", this.data);
  }

  /* -------------------------------------------- */

  /**
   * Present a Dialog instance for this pool
   * @param {string} title      The title of the roll request
   * @param {string} flavor     Any flavor text attached to the roll
   * @param {string} rollMode   The requested roll mode
   * @returns {Promise<StandardCheck|null>}   The resolved check, or null if the dialog was closed
   */
  async dialog({title, flavor, rollMode}={}) {
    const options = {title, flavor, rollMode, pool: this};
    return this.constructor.dialogClass.prompt({title, options});
  }

  /* -------------------------------------------- */
  /*  Saving and Loading                          */
  /* -------------------------------------------- */

  /** @inheritdoc */
  toJSON() {
    const data = super.toJSON();
    data.data = this.data;
    return data;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async toMessage(messageData, options={}) {
    options.rollMode = options.rollMode || this.data.rollMode;
    return super.toMessage(messageData, options);
  }

  /* -------------------------------------------- */
  /*  Socket Interactions                         */
  /* -------------------------------------------- */

  /**
   * Dispatch a request to perform a roll
   * @param {string} title      The title of the roll request
   * @param {string} flavor     Any flavor text attached to the roll
   */
  request({title, flavor}={}) {
    game.socket.emit(`system.${SYSTEM.id}`, {
      action: "diceCheck",
      data: {
        title: title,
        flavor: flavor,
        check: this.data
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle a request to roll a standard check
   * @param {string} title              The title of the roll request
   * @param {string} flavor             Any flavor text attached to the roll
   * @param {StandardCheckData} check   Data for the handled check request
   */
  static async handle({title, flavor, check}={}) {
    const actor = game.actors.get(check.actorId);
    if ( actor.testUserPermission(game.user, "OWNER", {exact: true}) ) {
      const pool = new this(check);
      const response = await pool.dialog({title, flavor});
      if ( response === null ) return;
      return pool.toMessage({flavor});
    }
  }
}

StandardCheck.PARTS = ["3d8", "@ability", "@skill", "@enchantment", "@circumstance"];
StandardCheck.FORMULA = StandardCheck.PARTS.join(" + ");
