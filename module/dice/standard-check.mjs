import StandardCheckDialog from "./standard-check-dialog.mjs";

/**
 * @typedef {Object} DiceBoon
 * @property {string} [id]                    An identifier for the source of boon or bane. This is auto-populated.
 * @property {string} label                   A string label for the source of the boon or bane.
 * @property {number} number                  The number of boons or banes applied by this source.
 */

/**
 * @typedef {Object} DiceCheckBonuses
 * @property {Object<string, DiceBoon>} [boons] An object of advantageous boons applied to the roll.
 *                                            Keys of the object are identifiers for sources of boons.
 * @property {Object<string, DiceBoon>} [banes] An object of disadvantageous banes applied to the roll.
 *                                            Keys of the object are identifiers for sources of banes.
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
 * @property {number} totalBoons              The computed total number of boons applied to the roll
 * @property {number} totalBanes              The computed total number of banes applied to the roll
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
      formula = ""; // Replaced later
    }
    super(formula, data);
    this.actor = game.actors.get(this.data.actorId);
  }

  /* -------------------------------------------- */

  /**
   * Define the default data attributes for this type of Roll
   * @type {object}
   */
  static defaultData = {
    actorId: null,
    ability: 0,
    banes: {},
    boons: {},
    dc: 20,
    enchantment: 0,
    skill: 0,
    type: "general",
    criticalSuccessThreshold: undefined,
    criticalFailureThreshold: undefined,
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
  static CHAT_TEMPLATE = "systems/crucible/templates/dice/standard-check-chat.hbs";

  /* -------------------------------------------- */

  /**
   * The Actor performing the check.
   * @type {CrucibleActor}
   */
  actor;

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
    return this.total > (this.data.dc + (this.data.criticalSuccessThreshold ?? 6));
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
    return this.total <= (this.data.dc - (this.data.criticalFailureThreshold ?? 6));
  }

  /* -------------------------------------------- */
  /*  Roll Configuration                          */
  /* -------------------------------------------- */

  /** @override */
  _prepareData(data={}) {
    if ( ("boons" in data) && (typeof data.boons !== "object") ) {
      console.warn("StandardCheck received boons passed as a number instead of an object");
      data.boons = {special: {label: "Special", number: Number.isNumeric(data.boons) ? data.boons : 0}};
    }
    if ( ("banes" in data) && (typeof data.banes !== "object") ) {
      data.banes = {special: {label: "Special", number: Number.isNumeric(data.banes) ? data.banes : 0}};
      console.warn("StandardCheck received boons passed as a number instead of an object");
    }
    const current = this.data || foundry.utils.deepClone(this.constructor.defaultData);
    for ( let [k, v] of Object.entries(data) ) {
      if ( v === undefined ) delete data[k];
    }
    data = foundry.utils.mergeObject(current, data, {insertKeys: false});
    StandardCheck.#configureData(data);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Configure the provided data used to customize this type of Roll
   * @param {object} data     The initially provided data object
   * @returns {object}        The configured data object
   */
  static #configureData(data) {

    // Bonuses
    data.dc = Math.max(data.dc, 0);
    data.ability = Math.clamp(data.ability, 0, 12);
    data.skill = Math.clamp(data.skill, -4, 12);
    data.enchantment = Math.clamp(data.enchantment, 0, 6);

    // Boons and Banes
    data.totalBoons = StandardCheck.#prepareBoons(data.boons);
    data.totalBanes = StandardCheck.#prepareBoons(data.banes);
  }

  /* -------------------------------------------- */

  /**
   * Prepare an object of boons or banes to compute the total which apply to the roll.
   * @param {Object<string, DiceBoon>} boons    Boons applied to the roll
   * @returns {number}                          The total number of applied boons
   */
  static #prepareBoons(boons) {
    let total = 0;
    for ( const [id, boon] of Object.entries(boons) ) {
      boon.id = id;
      boon.number ??= 1;
      if ( (total + boon.number) > SYSTEM.dice.MAX_BOONS ) {
        boon.number = SYSTEM.dice.MAX_BOONS - total;
      }
      total += boon.number;
    }
    return total;
  }

  /* -------------------------------------------- */

  /** @override */
  static parse(_, data) {

    // Configure the pool
    const pool = [8, 8, 8];

    // Apply boons from the left
    let d = 0;
    for (let i = 0; i < data.totalBoons; i++) {
      pool[d] = pool[d] + SYSTEM.dice.DIE_STEP;
      if (pool[d] === SYSTEM.dice.MAX_DIE) d++;
    }

    // Apply banes from the right
    d = 2;
    for (let i = 0; i < data.totalBanes; i++) {
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
  async _prepareChatRenderContext({flavor, isPrivate=false}={}) {
    const cardData = {
      cssClass: [SYSTEM.id, "dice-roll", "standard-check"],
      data: this.data,
      defenseType: "DC",
      defenseValue: this.data.dc,
      diceTotal: this.dice.reduce((t, d) => t + d.total, 0),
      isPrivate,
      isGM: game.user.isGM,
      flavor,
      formula: this.formula,
      outcome: "Unknown",
      pool: this.dice.map(d => ({denom: `d${d.faces}`, result: d.total})),
      total: this.total
    }

    // Successes and Failures
    if ( this.data.dc ) {
      if ( this.isSuccess ) {
        cardData.outcome = "Success";
        cardData.cssClass.push("success");
        if ( this.isCriticalSuccess ) {
          cardData.outcome = "Critical " + cardData.outcome;
          cardData.cssClass.push("critical");
        }
      }
      else {
        cardData.outcome = "Failure";
        cardData.cssClass.push("failure");
        if ( this.isCriticalFailure ) {
          cardData.outcome = "Critical " + cardData.outcome;
          cardData.cssClass.push("critical");
        }
      }
    }

    // Damage Resistance or Vulnerability
    if ( Number.isNumeric(this.data.damage?.total) ) {
      cardData.resistanceLabel = this.data.damage.resistance < 0 ? "DICE.DamageVulnerability": "DICE.DamageResistance";
      cardData.resistanceValue = Math.abs(this.data.damage.resistance);
    }
    cardData.cssClass = cardData.cssClass.join(" ");
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
   * @param {boolean} request   Display the request tray
   * @param {string} rollMode   The requested roll mode
   * @returns {Promise<{roll:StandardCheck, rollMode: string}|null>}
   */
  async dialog({title, flavor, request, rollMode}={}) {
    return this.constructor.dialogClass.prompt({
      window: {title},
      flavor,
      request,
      rollMode,
      roll: this
    });
  }

  /* -------------------------------------------- */

  /**
   * Construct a StandardCheck instance from a CrucibleAction which involves dice rolls.
   * @param {CrucibleAction} action   The action from which to construct the check
   * @returns {StandardCheck}         The constructed check instance
   */
  static fromAction(action) {
    let {boons, banes, bonuses} = action.usage;
    return new this({boons, banes, ...bonuses});
  }

  /* -------------------------------------------- */
  /*  Saving and Loading                          */
  /* -------------------------------------------- */

  /** @inheritdoc */
  toJSON() {
    const data = super.toJSON();
    data.data = foundry.utils.deepClone(this.data);
    return data;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async toMessage(messageData, options={}) {
    options.rollMode = options.rollMode || this.data.rollMode;
    messageData.content ||= "";
    this.#addDiceSoNiceEffects();
    return super.toMessage(messageData, options);
  }

  /* -------------------------------------------- */

  /**
   * Augment the Roll with custom DiceSoNice module effects.
   */
  #addDiceSoNiceEffects() {
    for ( const die of this.dice ) {
      if ( die.faces > 8 ) die.options.sfx = {
        specialEffect: "PlayAnimationBright",
        options: {muteSound: true}
      };
      if ( die.faces < 8 ) die.options.sfx = {
        specialEffect: "PlayAnimationDark",
        options: {muteSound: true}
      };
    }
  }

  /* -------------------------------------------- */
  /*  Socket Interactions                         */
  /* -------------------------------------------- */

  /**
   * Dispatch a request to perform a roll
   * @param {string} title      The title of the roll request
   * @param {string} flavor     Any flavor text attached to the roll
   * @param {User} user         The user making the request
   * @param {User} actorId      The actor ID for whom the check is being requested (defaults to the current roll actor)
   */
  request({user, title, flavor, actorId}={}) {
    const data = foundry.utils.deepClone(this.data);
    if ( actorId ) data.actorId = actorId;
    return user.query('rollSkillRequest', { title, flavor, check: data });
  }

  /* -------------------------------------------- */

  /**
   * Handle a request to roll a standard check
   * @param {string} title              The title of the roll request
   * @param {string} flavor             Any flavor text attached to the roll
   * @param {StandardCheckData} check   Data for the handled check request
   */
  static handle = async({title, flavor, check}={}) => {
    const actor = game.actors.get(check.actorId);
    if ( actor.testUserPermission(game.user, "OWNER", {exact: true}) ) {
      const pool = new this(check);
      const response = await pool.dialog({title, flavor});
      if ( response === null ) return;
      return pool.toMessage({flavor});
    }
  }
}

StandardCheck.PARTS = ["3d8", "@ability", "@skill", "@enchantment"];
StandardCheck.FORMULA = StandardCheck.PARTS.join(" + ");
