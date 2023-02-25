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
   * @returns {DamageData}
   */
  static #prepareDamage(spell) {
    return {
      base: spell.gesture.damage.base ?? 0,
      bonus: spell.gesture.damage.bonus ?? 0,
      multiplier: 1,
      type: spell.damageType ?? spell.rune.damageType,
      restoration: spell.rune.restoration
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

  /** @inheritDoc */
  _prepareForActor() {
    super._prepareForActor();
    CrucibleSpell.#prepareGesture.call(this);

    // Zero cost for un-composed spells
    this._trueCost = {...this.cost};
    if ( this.composition !== CrucibleSpell.COMPOSITION_STATES.COMPOSED ) {
      this.cost.action = this.cost.focus = 0;
    }
  }

  /* -------------------------------------------- */

  /**
   * Customize the spell based on the Gesture used.
   * @this {CrucibleSpell}
   */
  static #prepareGesture() {
    const e = this.actor.equipment;
    const s = this.actor.system.status;
    const t = this.actor.talentIds;
    this.usage.context.hasDice = true; // Has dice by default

    // Specific Gesture handling
    switch ( this.gesture.id ) {

      // Gesture: Arrow:
      case "arrow":

        // Arcane Archer Signature
        if ( t.has("arcanearcher0000") && s.rangedAttack && !s.arcaneArcher ) {
          this.cost.action -= 1;
          this.usage.actorUpdates["system.status.arcaneArcher"] = true;
        }
        break;

      // Gesture: Strike
      case "strike":
        const mh = e.weapons.mainhand;
        this.scaling = new Set([...mh.config.category.scaling.split("."), this.rune.scaling]);
        this.target.distance = mh.config.category.ranged ? 10 : 1;

        // Spellblade Signature
        if ( t.has("spellblade000000") && s.meleeAttack && !s.spellblade ) {
          this.cost.action -= 1;
          this.usage.actorUpdates["system.status.spellblade"] = true;
        }
        break;

      // Gesture: Ward
      case "ward":
        // TODO
        if ( this.damage.healing ) {
          ui.notifications.warning("Gesture: Ward is not configured for healing Runes yet");
          break;
        }
        this.effects.push({
          _id: SYSTEM.EFFECTS.getEffectId("ward"),
          icon: this.gesture.img,
          duration: {rounds: 1},
          origin: this.actor.uuid,
          changes: [
            {
              key: `system.resistances.${this.damage.type}.bonus`,
              value: 6 + this.usage.bonuses.boons - this.usage.bonuses.banes,
              mode: CONST.ACTIVE_EFFECT_MODES.ADD
            }
          ]
        });
        this.usage.context.hasDice = false;
        break;

      // Gesture: Aspect
      case "aspect":
        // TODO
        if ( this.damage.healing ) {
          ui.notifications.warning("Gesture: Aspect is not configured for healing Runes yet");
          break;
        }
        this.effects.push({
          _id: SYSTEM.EFFECTS.getEffectId("aspect"),
          icon: this.gesture.img,
          duration: {rounds: 6},
          origin: this.actor.uuid,
          changes: [
            {
              key: `system.resistances.${this.damage.type}.bonus`,
              value: 2,
              mode: CONST.ACTIVE_EFFECT_MODES.ADD
            },
            {
              key: `rollBonuses.damage.${this.damage.type}`,
              value: 2,
              mode: CONST.ACTIVE_EFFECT_MODES.ADD
            }
          ]
        });
        this.usage.context.hasDice = false;
        break;
    }
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
    spellData = foundry.utils.mergeObject(spellData, {
      rune: runes.first()?.id,
      gesture: gestures.first()?.id,
      inflection: undefined,
      composition: this.COMPOSITION_STATES.NONE
    }, {inplace: false});
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

    // Re-test feasibility
    try {
      this._can();
    } catch(err) {
      ui.notifications.warn(err.message);
      return null;
    }

    // Re-acquire targets
    targets = this._acquireTargets();

    // Record last spell cast
    this.usage.actorFlags.lastSpell = this.id;
    return {action: spell, targets};
  }


  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags() {
    const tags = super.getTags();

    // Variable Cost
    if ( this.composition === CrucibleSpell.COMPOSITION_STATES.NONE ) {
      tags.activation.ap = "1A+";
      tags.activation.fp = "1F+"
    }

    delete tags.action.spell;
    tags.action.scaling = Array.from(this.scaling).map(a => SYSTEM.ABILITIES[a].label).join("/");
    if ( this.damage.healing ) tags.action.healing = "Healing";
    else tags.action.defense = SYSTEM.DEFENSES[this.defense].label;
    tags.action.resource = SYSTEM.RESOURCES[this.rune.resource].label;
    return tags;
  }
}
