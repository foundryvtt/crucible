import StandardCheck from "./standard-check.mjs";
import ActionUseDialog from "./action-use-dialog.mjs";


/**
 * @typedef {StandardCheckData} AttackRollData
 * @param {string} [itemId]                   The id of the Item being used to make the attack
 * @param {string} [defenseType=physical]     The defense type being attacked, a value in SYSTEM.DEFENSES
 * @param {number} [result]                   The result code in AttackRoll.RESULT_TYPES, undefined before evaluation
 * @param {DamageData} [damage]               The resolved damage of the roll, undefined before evaluation
 */

/**
 * @typedef {Object} DamageData
 * @property {number} overflow                The attack check result in excess of the defense threshold
 * @property {number} multiplier              The overflow multiplier value
 * @property {number} base                    The base damage amount
 * @property {number} bonus                   An additive damage bonus
 * @property {number} resistance              A subtracted resistance threshold
 * @property {string} type                    The type of damage
 * @property {number} [resource]              The resource targeted
 * @property {boolean} [restoration]          Is this damage applied as restoration?
 */

/**
 * A special case of the 3d8 dice pool that is used to make attacks against a target defense value.
 * @extends {StandardCheck}
 *
 * @param {string|StandardCheckData} formula  This parameter is ignored
 * @param {StandardCheckData} [data]          An object of roll data, containing the following optional fields
 */
export default class AttackRoll extends StandardCheck {

  /** @override */
  static defaultData = foundry.utils.mergeObject(StandardCheck.defaultData, {
    target: undefined,
    defenseType: "physical",
    result: undefined,
    damage: undefined,
    index: undefined,
    newTarget: false  // TODO it would be good to handle this a different way
  });

  /**
   * Which Dialog subclass should display a prompt for this Roll type?
   * @type {ActionUseDialog}
   */
  static dialogClass = ActionUseDialog;

  /**
   * The possible result types which can occur from an attack roll
   * @enum {number}
   */
  static RESULT_TYPES = {
    MISS: 0,
    DODGE: 1,
    PARRY: 2,
    BLOCK: 3,
    ARMOR: 4,
    RESIST: 5,
    GLANCE: 6,
    HIT: 7
  };

  /**
   * The localization labels used for each result in RESULT_TYPES
   * @enum {string}
   */
  static RESULT_TYPE_LABELS = {
    [this.RESULT_TYPES.MISS]: "ATTACK.RESULT_TYPES.Miss",
    [this.RESULT_TYPES.DODGE]: "ATTACK.RESULT_TYPES.Dodge",
    [this.RESULT_TYPES.PARRY]: "ATTACK.RESULT_TYPES.Parry",
    [this.RESULT_TYPES.BLOCK]: "ATTACK.RESULT_TYPES.Block",
    [this.RESULT_TYPES.ARMOR]: "ATTACK.RESULT_TYPES.Armor",
    [this.RESULT_TYPES.RESIST]: "ATTACK.RESULT_TYPES.Resist",
    [this.RESULT_TYPES.GLANCE]: "ATTACK.RESULT_TYPES.Glance",
    [this.RESULT_TYPES.HIT]: "ATTACK.RESULT_TYPES.Hit",
  }

  /**
   * The overflow damage amount produced by this attack roll
   * @returns {number}
   */
  get overflow() {
    return this.total - this.data.dc;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareChatRenderContext({flavor, isPrivate=false}={}) {
    const cardData = await super._prepareChatRenderContext();
    cardData.cssClass += ` ${this.#getResultClass()}`;

    // Target
    if ( this.data.target ) {
      const target = fromUuidSync(this.data.target);
      cardData.target = {uuid: this.data.target, name: target?.name ?? "Unknown"};
    }

    // Defense label
    const dt = this.data.defenseType;
    if ( dt in SYSTEM.DEFENSES ) cardData.defenseType = SYSTEM.DEFENSES[dt].label;
    else if ( dt in SYSTEM.SKILLS ) cardData.defenseType = SYSTEM.SKILLS[dt].label;
    else cardData.defenseType = "DC";

    // Outcome label
    cardData.outcome = game.i18n.localize(this.constructor.RESULT_TYPE_LABELS[this.data.result]);
    return cardData;
  }

  /* -------------------------------------------- */

  /**
   * Get the attack roll result CSS class.
   * @returns {string}
   */
  #getResultClass() {
    const results = this.constructor.RESULT_TYPES;
    const result = Object.entries(results).find(e => e[1] === this.data.result);
    if ( (result[1] === results.GLANCE) && !this.data.damage.total )  return "miss";
    else return result[0].toLowerCase();
  }
}
