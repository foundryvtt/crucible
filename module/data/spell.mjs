import CrucibleAction from "./action.mjs";
import {SYSTEM} from "../config/system.js";
import StandardCheck from "../dice/standard-check.js";
import SpellCastDialog from "../dice/spell-cast-dialog.mjs";

/**
 * Data and functionality that represents a Spell in the Crucible spellcraft system.
 *
 * @property {CrucibleRune} rune
 * @property {CrucibleGesture} gesture
 * @property {CrucibleInflection} inflection
 * @property {number} composition
 * @property {string} damageType
 */
export default class CrucibleSpell extends CrucibleAction {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    schema.rune = new fields.StringField({required: true, choices: SYSTEM.SPELL.RUNES});
    schema.gesture = new fields.StringField({required: true, choices: SYSTEM.SPELL.GESTURES});
    schema.inflection = new fields.StringField({required: false, choices: SYSTEM.SPELL.INFLECTIONS});
    schema.composition = new fields.NumberField({choices: Object.values(this.COMPOSITION_STATES)});
    schema.damageType = new fields.StringField({required: false, choices: SYSTEM.DAMAGE_TYPES, initial: undefined});
    return schema;
  }

  /**
   * Spell composition states.
   * @enum {number}
   */
  static COMPOSITION_STATES = {
    NONE: 0,
    COMPOSING: 1,
    COMPOSED: 2
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareData() {
    super._prepareData();

    // Spell Composition
    this.rune = SYSTEM.SPELL.RUNES[this.rune];
    this.gesture = SYSTEM.SPELL.GESTURES[this.gesture];
    this.inflection = SYSTEM.SPELL.INFLECTIONS[this.inflection];

    // Composed Spell Data
    if ( this.composition >= CrucibleSpell.COMPOSITION_STATES.COMPOSING ) {
      this.id = ["spell", this.rune.id, this.gesture.id, this.inflection?.id].filterJoin(".");
      this.nameFormat = this.gesture.nameFormat ?? this.rune.nameFormat;
      this.name = CrucibleSpell.#getName(this);
      this.img = this.rune.img;
    }

    // Derived Spell Attributes
    this.scaling = new Set([this.rune.scaling, this.gesture.scaling]);
    this.cost = CrucibleSpell.#prepareCost(this);
    this.defense = CrucibleSpell.#prepareDefense(this);
    this.damage = CrucibleSpell.#prepareDamage(this);
    this.target = CrucibleSpell.#prepareTarget(this);
    this.status = {};

    // Prepare for Actor
    if ( this.parent ) this.parent.prepareSpell(this);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareForActor() {
    super._prepareForActor();
    this.actor.prepareSpell(this);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the cost for the spell from its components.
   * @param {CrucibleSpell} spell     The spell being prepared
   * @returns {ActionCost}            Configured cost data
   */
  static #prepareCost(spell) {

    // Placeholder cost before composition
    if ( spell.composition === this.COMPOSITION_STATES.NONE ) {
      return {action: 1, focus: 1};
    }

    // Composed spell cost
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
   * @returns {DamageData}
   */
  static #prepareDamage(spell) {
    return {
      base: spell.gesture.damage.base ?? 0,
      bonus: spell.gesture.damage.bonus ?? 0,
      multiplier: 1,
      type: spell.damageType ?? spell.rune.damageType,
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

    // No target until composition is complete
    if ( spell.composition < this.COMPOSITION_STATES.COMPOSED ) return {type: "none"};

    // Specific targeting requirements for the composed spell
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
  static #getName({rune, gesture, inflection, nameFormat}={}) {
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
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  clone(updateData, context) {
    updateData.composition = CrucibleSpell.COMPOSITION_STATES.COMPOSING;
    return super.clone(updateData, context);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the default Cast Spell action, populated with the most recently cast spell components.
   * @param {CrucibleActor} actor       The Actor for whom the spell is being prepared
   * @param {object} spellData          Initial data for the spell
   * @returns {CrucibleSpell}           The constructed CrucibleSpell
   */
  static getDefault(actor, spellData) {
    const {runes, gestures} = actor.grimoire;
    const spellId = actor.getFlag("crucible", "lastSpell") || "";
    const [, rune, gesture, inflection] = spellId.split(".");
    spellData = foundry.utils.mergeObject(spellData, {
      rune: spellId ? rune : runes[0].id,
      gesture: spellId ? gesture : gestures[0].id,
      inflection: spellId ? inflection : undefined,
      composition: this.COMPOSITION_STATES.NONE
    });
    return new this(spellData, {actor});
  }

  /* -------------------------------------------- */

  /** @override */
  async configure(targets) {
    const pool = new StandardCheck(this.usage.bonuses);
    const spell = await SpellCastDialog.prompt({options: {
      action: this,
      actor: this.actor,
      pool,
      targets
    }});
    if ( spell === null ) return null;

    // Finalize composition
    this.updateSource({composition: CrucibleSpell.COMPOSITION_STATES.COMPOSED});

    // Re-acquire targets
    targets = this._acquireTargets();
    return {action: spell, targets};
  }


  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags() {
    const tags = super.getTags();
    const damageTypeLabel = this.damage.healing ? SYSTEM.RESOURCES[this.damage.healing].label
      : SYSTEM.DAMAGE_TYPES[this.damage.type].label;
    tags.action.damage = `${this.damage.base} ${damageTypeLabel}`;
    tags.action.scaling = Array.from(this.scaling).map(a => SYSTEM.ABILITIES[a].label).join("/");
    tags.action.defense = SYSTEM.DEFENSES[this.defense].label;
    tags.action.resource = SYSTEM.RESOURCES[this.rune.resource].label;
    return tags;
  }
}
