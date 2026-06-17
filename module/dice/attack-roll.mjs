import StandardCheck from "./standard-check.mjs";
import ActionUseDialog from "./action-use-dialog.mjs";


/**
 * @typedef {StandardCheckData} AttackRollData
 * @property {string} itemId                  The id of the Item being used to make the attack
 * @property {string} defenseType             The defense type being attacked, a value in SYSTEM.DEFENSES
 * @property {number} criticalSuccessThreshold  The threshold for critical success
 * @property {number} criticalFailureThreshold  The threshold for critical failure
 * @property {string} resource                The resource targeted by damage (e.g. "health", "morale")
 * @property {string} damageType              The type of damage dealt (e.g. "slashing", "fire")
 * @property {number} damageBonus             Additive damage bonus
 * @property {number} multiplier              Damage overflow multiplier
 * @property {number} [result]                The result code in AttackRoll.RESULT_TYPES, undefined before evaluation
 * @property {DamageData} [damage]            The resolved damage of the roll, undefined before evaluation
 */

/**
 * @typedef DamageData
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
    newTarget: false,  // TODO it would be good to handle this a different way
    multiplier: 1,
    damageBonus: 0,
    resource: "health",
    damageType: undefined
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
    [this.RESULT_TYPES.HIT]: "ATTACK.RESULT_TYPES.Hit"
  };

  /**
   * The overflow damage amount produced by this attack roll
   * @returns {number}
   */
  get overflow() {
    return this.total - this.data.dc;
  }

  /* -------------------------------------------- */

  /**
   * Resolve this attack roll against a target's defense, structuring the resulting damage.
   * @param {CrucibleActor} actor                The attacking actor
   * @param {CrucibleActor} target               The defending actor
   * @param {object} [params]                    Damage resolution parameters supplied by the caller
   * @param {number} [params.multiplier=1]       Overflow multiplier
   * @param {number} [params.base=0]             Base damage before overflow
   * @param {number} [params.bonus=0]            Additive damage bonus
   * @param {string} [params.resource="health"]  The resource damaged
   * @param {string} [params.damageType]         The damage type dealt
   * @param {boolean} [params.restoration=false] Resolve the result as restoration rather than damage?
   * @returns {number}                           The resolved result type in {@link AttackRoll.RESULT_TYPES}
   */
  resolveDamage(actor, target, {multiplier=1, base=0, bonus=0, resource="health", damageType, restoration=false}={}) {
    const result = this.data.result = target.testDefense(this.data.defenseType, this);
    if ( result < AttackRoll.RESULT_TYPES.GLANCE ) {
      delete this.data.damage;
      return result;
    }
    this.data.damage = {
      overflow: this.overflow,
      multiplier, base, bonus,
      resistance: target.getResistance(resource, damageType, restoration),
      resource,
      type: damageType
    };
    this.data.damage.total = crucible.api.models.CrucibleAction.computeDamage(this.data.damage);
    return result;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareChatRenderContext({flavor, isPrivate=false, ...options}={}) {
    const cardData = await super._prepareChatRenderContext({flavor, isPrivate, ...options});
    if ( isPrivate ) return cardData;
    cardData.cssClass += ` ${this.#getResultClass()}`;

    // Target
    if ( this.data.target ) {
      const target = fromUuidSync(this.data.target);
      cardData.target = {uuid: this.data.target, name: target?.name ?? "Unknown"};
    }

    // Target defense and DC
    const dt = this.data.defenseType;
    const defense = SYSTEM.DEFENSES[dt];
    if ( defense ) cardData.defenseType = defense.shortLabel ?? defense.label;
    else if ( dt in SYSTEM.SKILLS ) cardData.defenseType = SYSTEM.SKILLS[dt].label;
    else cardData.defenseType = _loc("DICE.DC");
    if ( game.user.isGM ) cardData.targetLabel = `${cardData.defenseType} ${cardData.dc}`;

    // Roll result
    const isCritHit = (this.data.result === this.constructor.RESULT_TYPES.HIT) && this.isCriticalSuccess;
    const outcomeKey = isCritHit ? "ATTACK.RESULT_TYPES.CriticalHit"
      : this.constructor.RESULT_TYPE_LABELS[this.data.result];
    cardData.outcome = _loc(outcomeKey);
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
    if ( (result[1] === results.GLANCE) && !this.data.damage.total ) return "miss";
    else return result[0].toLowerCase();
  }
}
