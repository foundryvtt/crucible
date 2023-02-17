import {SYSTEM} from "../config/system.js";

/**
 * Data and functionality that represents a Spell in the Crucible spellcraft system.
 */
export default class CrucibleSpell extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      description: new fields.HTMLField(),
      rune: new fields.StringField({required: true, choices: SYSTEM.SPELL.RUNES}),
      gesture: new fields.StringField({required: true, choices: SYSTEM.SPELL.GESTURES}),
      inflection: new fields.StringField({required: false, choices: SYSTEM.SPELL.INFLECTIONS})
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  _initialize(options) {
    super._initialize(options);
    this.id = ["spell", this.rune, this.gesture, this.inflection].filterJoin(".");
    this.rune = SYSTEM.SPELL.RUNES[this.rune];
    this.gesture = SYSTEM.SPELL.GESTURES[this.gesture];
    this.inflection = SYSTEM.SPELL.INFLECTIONS[this.inflection];
    this.nameFormat = this.gesture.nameFormat ?? this.rune.nameFormat;
    this.name ||= CrucibleSpell.#getDefaultName(this);
    this.img ||= this.rune.img;
    this.scaling = new Set([this.rune.scaling, this.gesture.scaling]);
    this.cost = CrucibleSpell.#prepareCost(this);
    this.defense = CrucibleSpell.#prepareDefense(this);
    this.damage = CrucibleSpell.#prepareDamage(this, options);
    this.target = CrucibleSpell.#prepareTarget(this);
    if ( this.parent ) this.parent.prepareSpell(this);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the cost for the spell from its components.
   * @param {CrucibleSpell} spell     The spell being prepared
   * @returns {ActionCost}            Configured cost data
   */
  static #prepareCost(spell) {
    const cost = {...spell.gesture.cost};
    if ( spell.inflection ) {
      cost.action += spell.inflection.cost.action;
      cost.focus += spell.inflection.cost.focus;
    }
    return cost;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the defense against which this spell is tested.
   * @param {CrucibleSpell} spell     The spell being prepared
   * @returns {string}                The defense to test
   */
  static #prepareDefense(spell) {
    if ( spell.rune.restoration ) return {
      health: "wounds",
      wounds: "wounds",
      morale: "madness",
      madness: "madness"
    }[spell.rune.resource];
    else return spell.rune.defense;
  }

  /* -------------------------------------------- */

  /**
   * Prepare damage information for the spell from its components.
   * @param {CrucibleSpell} spell     The spell being prepared
   * @param {object} options          Options which modify damage preparation
   * @param {string} [options.damageType]   A special damage type to apply to this spell
   * @returns {DamageData}
   */
  static #prepareDamage(spell, {damageType}={}) {
    return {
      base: spell.gesture.damage.base ?? 0,
      bonus: spell.gesture.damage.bonus ?? 0,
      multiplier: 1,
      type: damageType ?? spell.rune.damageType,
      healing: spell.rune.restoration ? spell.rune.resource : null
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare the target data for the Spell based on its components.
   * @param {CrucibleSpell} spell     The spell being prepared
   * @returns {ActionTarget}          Configured target data
   */
  static #prepareTarget(spell) {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    const target = {...spell.gesture.target};
    switch ( target.type ) {
      case "none":
        target.scope = scopes.NONE;
        break;
      case "self":
        target.scope = scopes.SELF;
        break;
      case "single":
        target.scope = scopes[spell.rune.restoration ? "ALLIES" : "ENEMIES"];
        break;
      default:
        target.scope = scopes.ALL;
        break;
    }
    return target;
  }

  /* -------------------------------------------- */

  /**
   * Prepare a default name for the spell if a custom name has not been designated.
   * @type {string}
   */
  static #getDefaultName({rune, gesture, inflection, nameFormat}={}) {
    let name = "";
    switch ( nameFormat ) {
      case SYSTEM.SPELL.NAME_FORMATS.NOUN:
        name = game.i18n.format("SPELL.NameFormatNoun", {rune, gesture});
        break;
      case SYSTEM.SPELL.NAME_FORMATS.ADJ:
        name = game.i18n.format("SPELL.NameFormatAdj", {rune: rune.adjective, gesture});
        break;
    }
    if ( inflection ) name = `${inflection.adjective} ${name}`;
    return name;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Obtain an object of tags which describe the Spell.
   * @returns {ActionTags}
   */
  getTags() {
    const tags = {
      activation: {},
      action: {},
      context: {}
    };

    // Activation Tags
    tags.activation.hands = `${this.gesture.hands}H`;
    if ( this.cost.action > 0 ) tags.activation.ap = `${this.cost.action}A`;
    if ( this.cost.focus > 0 ) tags.activation.fp = `${this.cost.focus}F`;
    if ( !(this.cost.action || this.cost.focus)) tags.activation.free = "Free";

    // Action Tags
    tags.action.damage = `${this.damage.base} ${SYSTEM.DAMAGE_TYPES[this.damage.type].label}`;
    tags.action.scaling = Array.from(this.scaling).map(a => SYSTEM.ABILITIES[a].label).join("/");
    tags.action.defense = SYSTEM.DEFENSES[this.defense].label;
    tags.action.resource = SYSTEM.RESOURCES[this.rune.resource].label;
    return tags;
  }
}
