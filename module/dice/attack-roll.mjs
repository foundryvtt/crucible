import StandardCheck from "./standard-check.js";
import {SYSTEM} from "../config/system.js";

export default class AttackRoll extends StandardCheck {

  /** @override */
  static defaultData = foundry.utils.mergeObject(StandardCheck.defaultData, {
    result: 0,
    damage: {}
  })

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
    HIT: 5
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
    [this.RESULT_TYPES.HIT]: "ATTACK.ResultTypeHit",
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

  _getChatCardData(chatOptions) {
    const cardData = super._getChatCardData(chatOptions);
    cardData.outcome = game.i18n.localize(this.constructor.RESULT_TYPE_LABELS[this.data.result]);
    cardData.defenseType = "Defense";
    if ( this.data.damage.total ) {
      cardData.damageType = SYSTEM.DAMAGE_TYPES[this.data.damage.type].label;
    }
    return cardData;
  }

  /* -------------------------------------------- */



}
