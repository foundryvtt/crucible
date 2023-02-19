import StandardCheck from "./standard-check.js";
import {RESOURCES, SYSTEM} from "../config/system.js";
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
 * @property {number} [resource]              The resource targeted
 * @property {string} type                    The type of damage
 * @property {boolean} [healing]              Is the damage provided as restorative healing?
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
    damage: undefined
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
    DEFLECT: 4,
    RESIST: 5,
    HIT: 6,
    EFFECTIVE: 7
  };

  /**
   * The localization labels used for each result in RESULT_TYPES
   * @enum {string}
   */
  static RESULT_TYPE_LABELS = {
    [this.RESULT_TYPES.MISS]: "ATTACK.ResultTypeMiss",
    [this.RESULT_TYPES.DODGE]: "ATTACK.ResultTypeDodge",
    [this.RESULT_TYPES.PARRY]: "ATTACK.ResultTypeParry",
    [this.RESULT_TYPES.BLOCK]: "ATTACK.ResultTypeBlock",
    [this.RESULT_TYPES.DEFLECT]: "ATTACK.ResultTypeDeflect",
    [this.RESULT_TYPES.RESIST]: "ATTACK.ResultTypeResist",
    [this.RESULT_TYPES.HIT]: "ATTACK.ResultTypeHit",
    [this.RESULT_TYPES.EFFECTIVE]: "ATTACK.ResultTypeEffective",
  }

  /**
   * The overflow damage amount produced by this attack roll
   * @returns {number}
   */
  get overflow() {
    return Math.max(this.total - this.data.dc, 0);
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _getChatCardData() {
    const cardData = super._getChatCardData();

    // Target
    if ( this.data.target ) {
      const target = fromUuidSync(this.data.target);
      cardData.target = {uuid: this.data.target, name: target.name};
    }

    // Defense label
    cardData.defenseType = SYSTEM.DEFENSES[this.data.defenseType].label;

    // Outcome label
    cardData.outcome = game.i18n.localize(this.constructor.RESULT_TYPE_LABELS[this.data.result]);

    // Damage type
    if ( this.data.damage?.total ) {
      cardData.damageLabel = game.i18n.localize(this.data.damage.healing ? "DICE.Healing" : "DICE.Damage");
      cardData.baseLabel = game.i18n.format("DICE.DamageBase", {type: cardData.damageLabel});
      if ( this.data.damage.healing ) cardData.damageType = SYSTEM.RESOURCES[this.data.damage.healing].label;
      else cardData.damageType = SYSTEM.DAMAGE_TYPES[this.data.damage.type].label;
    }
    cardData.hasMultiplier = this.data.damage?.multiplier !== 1;
    return cardData;
  }
}
