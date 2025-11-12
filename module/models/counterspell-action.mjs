import CounterspellDialog from "../dice/counterspell-dialog.mjs";
import CrucibleAction from "./action.mjs";

/**
 * Data and functionality that represents a Counterspell in the Crucible spellcraft system.
 * 
 * @property {CrucibleSpellcraftRune} rune
 * @property {CrucibleSpellcarftGesture} gesture
 */
export default class CrucibleCounterspellAction extends CrucibleAction {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    schema.rune = new fields.StringField({required: true, choices: SYSTEM.SPELL.RUNES});
    schema.gesture = new fields.StringField({required: true, choices: SYSTEM.SPELL.GESTURES});
    schema.composition = new fields.NumberField({choices: Object.values(this.COMPOSITION_STATES)});
    return schema;
  }

  /**
   * Counter composition states.
   * @enum {number}
   */
  static COMPOSITION_STATES = {
    NONE: 0,
    COMPOSING: 1,
    COMPOSED: 2
  }

  /** @override */
  static dialogClass = CounterspellDialog;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeSource(data, options) {
    data = super._initializeSource(data, options);
    data.id = this.getCounterspellId(data);
    return data;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  updateSource(changes, options) {
    if ( ("rune" in changes) || ("gesture" in changes) ) {
      changes.id = this.getCounterspellId(changes);
    }
    return super.updateSource(changes, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareData() {
    super._prepareData();

    this.rune = SYSTEM.SPELL.RUNES[this.rune];
    this.gesture = SYSTEM.SPELL.GESTURES[this.gesture];

    // Derived Attributes
    this.scaling = new Set([this.rune.scaling, this.gesture.scaling]);
    this.range = this.gesture.range;
    this.range.maximum = Math.max(this.range.maximum ?? 0, this.gesture.target.size ?? 0);
    this.damage = {
      base: 0
    }
  }

  // TODO: Hands check

  /* -------------------------------------------- */

  getCounterspellId({rune, gesture}={}) {
    return "counterspell";
    rune ??= (this.rune?.id || "none");
    gesture ??= (this.gesture?.id || "none");
    return ["counterspell", rune, gesture].filterJoin(".");
  }

  /* -------------------------------------------- */

  _prepare() {
    this.usage.hasDice = true; // Counterspell always rolls
    super._prepare();
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  acquireTargets(options={}) {
    if ( this.composition === CrucibleCounterspellAction.COMPOSITION_STATES.COMPOSING ) options.strict = false;
    const targets = super.acquireTargets(options);
    const target = targets[0];
    const lastAction = ChatMessage.implementation.getLastAction({actor: target?.actor});
    if ( !lastAction || !lastAction.tags.has("spell") ) {
      target.error = "You can only counterspell the caster of the last action, and that must action must be a spell!";
      if (options.strict) throw new Error(target.error);
    }
    return targets;
  }

  /**
   * Prepare the default Counterspell action.
   * @param {CrucibleActor} actor           The Actor for whom the counterspell is being prepared
   * @param {object} counterspellData       Initial data for the counterspell
   * @returns {CrucibleCounterspellAction}  The constructed CrucibleCounterspellAction
   */
  static getDefault(actor, counterspellData={}) {
    const {runes, gestures} = actor.grimoire;
    const rune = runes.first()?.id;
    const gesture = gestures.first()?.id;
    Object.assign(counterspellData, {
      rune,
      gesture
    });
    return new this(counterspellData, {actor});
  }
}