import CrucibleAction from "./action.mjs";
import SpellCastDialog from "../dice/spell-cast-dialog.mjs";

/**
 * @typedef _CrucibleSpellActionData
 * @property {CrucibleSpellcraftRune} rune
 * @property {CrucibleSpellcraftGesture} gesture
 * @property {CrucibleSpellcraftInflection} inflection
 * @property {number} composition
 * @property {string} damageType
 */

/**
 * @typedef {CrucibleActionData & _CrucibleSpellActionData} CrucibleSpellActionData
 */

/**
 * Data and functionality that represents a Spell in the Crucible spellcraft system.
 * @mixes CrucibleSpellActionData
 */
export default class CrucibleSpellAction extends CrucibleAction {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    schema.rune = new fields.StringField({required: true, blank: true, choices: SYSTEM.SPELL.RUNES, initial: ""});
    schema.gesture = new fields.StringField({required: true, blank: true, choices: SYSTEM.SPELL.GESTURES, initial: ""});
    schema.inflection = new fields.StringField({required: true, blank: true, choices: SYSTEM.SPELL.INFLECTIONS, initial: ""});
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
  };

  /** @override */
  static dialogClass = SpellCastDialog;

  /**
   * Is this a Composed Spell?
   * @type {boolean}
   */
  get isComposed() {
    return this._source.tags.includes("composed");
  }

  /**
   * Is this an Iconic Spell?
   * @type {boolean}
   */
  get isIconic() {
    return this._source.tags.includes("iconicSpell");
  }

  /* -------------------------------------------- */
  /*  Action Lifecycle                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  * _tests() {
    if ( this.isComposed ) {
      const hooks = crucible.api.hooks.spellcraft;
      if ( hooks[this.rune.id] ) yield hooks[this.rune.id];
      if ( hooks[this.gesture.id] ) yield hooks[this.gesture.id];
      if ( hooks[this.inflection?.id] ) yield hooks[this.inflection.id];
    }
    yield* super._tests();
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeSource(data, options) {
    data = super._initializeSource(data, options);
    if ( data.tags?.includes("composed") ) data.id = this._getSpellId(data);
    return data;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  updateSource(changes, options) {
    if ( this.isComposed && (("rune" in changes) || ("gesture" in changes) || ("inflection" in changes)) ) {
      changes.id = this._getSpellId(changes);
    }
    return super.updateSource(changes, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareData() {
    super._prepareData();
    const {RUNES, GESTURES, INFLECTIONS} = SYSTEM.SPELL;
    const STATES = CrucibleSpellAction.COMPOSITION_STATES;

    // Spell Components
    if ( this.actor ) {
      this.rune = this.actor.grimoire.runes.get(this.rune) || RUNES[this.rune];
      this.gesture = this.actor.grimoire.gestures.get(this.gesture) || GESTURES[this.gesture];
      this.inflection = this.actor.grimoire.inflections.get(this.inflection) || INFLECTIONS[this.inflection];
    } else {
      this.rune = RUNES[this.rune];
      this.gesture = GESTURES[this.gesture];
      this.inflection = INFLECTIONS[this.inflection];
    }

    // Spells must have both a Rune and a Gesture to be composed
    if ( this.isIconic ) this.composition = STATES.COMPOSED;
    if ( !this.rune || !this.gesture ) this.composition = Math.min(this.composition, STATES.COMPOSING);

    // Common Attributes
    this.scaling = [this.rune.scaling, this.gesture.scaling];
    this.training = [this.rune.id];
    this.damage = CrucibleSpellAction.#prepareDamage.call(this);
    this.usage.defenseType ||= CrucibleSpellAction.#prepareDefense.call(this);

    // Composed Spells Only
    if ( this.isComposed ) {
      this.cost = CrucibleSpellAction.#prepareCost.call(this);
      this.target = {...this.gesture.target};
      this.range = this.gesture.range;
      if ( this.composition >= STATES.COMPOSING ) {
        this.nameFormat = this.gesture.nameFormat ?? this.rune.nameFormat;
        this.name = CrucibleSpellAction.getComposedName(this);
        this.img = this.rune.img;
        this.description = _loc("ACTION.DEFAULT_ACTIONS.Cast.Description"); // TODO make dynamic
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Create the unique identifier that represents this spell as a combination of rune, gesture, and inflection.
   * @param {Pick<CrucibleSpellActionData,"rune"|"gesture"|"inflection">} components
   * @returns {string}
   * @protected
   */
  _getSpellId({rune, gesture, inflection}={}) {
    rune ??= (this.rune?.id || "none");
    gesture ??= (this.gesture?.id || "none");
    inflection ??= (this.inflection?.id || "none");
    return ["spell", rune, gesture, inflection].filterJoin(".");
  }

  /* -------------------------------------------- */

  /**
   * Prepare the cost for the spell from its components.
   * @this {CrucibleSpellAction}  The spell being prepared
   * @returns {ActionCost}        Configured cost data
   */
  static #prepareCost() {
    const cost = {...this.gesture.cost};
    cost.hands = this.gesture.hands;
    if ( this.inflection ) {
      cost.action += this.inflection.cost.action;
      cost.focus += this.inflection.cost.focus;
      cost.heroism += this.inflection.cost.heroism;
      cost.hands += this.inflection.cost.hands;
    }
    return cost;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the defense against which this spell is tested.
   * @this {CrucibleSpellAction}  The spell being prepared
   * @returns {string}            The defense to test
   */
  static #prepareDefense() {
    if ( this.rune.restoration ) return {
      health: "wounds",
      wounds: "wounds",
      morale: "madness",
      madness: "madness"
    }[this.rune.resource];
    else return this.rune.defense;
  }

  /* -------------------------------------------- */

  /**
   * Prepare damage information for the spell from its components.
   * @this {CrucibleSpellAction}  The spell being prepared
   * @returns {DamageData}        Prepared damage data
   */
  static #prepareDamage() {
    return {
      base: this.gesture.damage.base ?? 0,
      bonus: this.gesture.damage.bonus ?? 0,
      multiplier: 1,
      type: this.damageType ?? this.rune.damageType,
      restoration: this.rune.restoration
    };
  }

  /* -------------------------------------------- */

  /**
   * Derive a display name for a composed spell from its resolved components.
   * @param {object} components                 Options for how the spell name is determined
   * @param {string} [components.id]              A predetermined spell ID string (spell.rune.gesture.inflection)
   * @param {CrucibleSpellcraftRune} components.rune
   * @param {CrucibleSpellcraftGesture} components.gesture
   * @param {CrucibleSpellcraftInflection} [components.inflection]
   * @param {number} [components.nameFormat]      One of SYSTEM.SPELL.NAME_FORMATS, otherwise rune.nameFormat
   * @param {{type: string}} [components.damage]  Spell damage configuration, if further disambiguation is needed
   * @returns {string}
   */
  static getComposedName({id, rune, gesture, inflection, nameFormat, damage}={}) {
    let name = "";
    if ( !rune || !gesture ) return name;

    // Custom spell name
    if ( id ) {
      const custom = SYSTEM.SPELL.COMPOSED_SPELL_NAMES[id];
      if ( typeof custom === "string" ) name = _loc(custom);
      else if ( typeof custom === "object" ) name = _loc(custom[damage?.type || rune.damageType]);
      if ( name ) return name;
    }

    // Default composed name
    nameFormat ||= rune.nameFormat;
    switch ( nameFormat ) {
      case SYSTEM.SPELL.NAME_FORMATS.NOUN:
        name = _loc("SPELL.NameFormatNoun", {rune, gesture});
        break;
      case SYSTEM.SPELL.NAME_FORMATS.ADJ:
        name = _loc("SPELL.NameFormatAdj", {rune: rune.adjective, gesture});
        break;
    }
    if ( inflection ) name = `${inflection.adjective} ${name}`;
    return name;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureUsage() {
    super._configureUsage();

    // Composed spells have dice by default that are disabled per-Gesture
    this.usage.hasDice ||= this.isComposed;

    // Iconic spells have dice by default only if they have an actionable target
    if ( this.isIconic && !this.usage.hasDice ) {
      const targetOther = this.target.scope > SYSTEM.ACTION.TARGET_SCOPES.SELF;
      const healSelf = ((this.target.scope === SYSTEM.ACTION.TARGET_SCOPES.SELF) && this.rune.restoration);
      this.usage.hasDice = targetOther || healSelf;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepare() {
    super._prepare();

    // Add Weapon cost
    if ( this.cost.weapon ) {
      const w = this.actor.equipment.weapons.mainhand;
      this.cost.action += (w?.system.actionCost || 0);
    }

    // Zero cost for un-composed spells
    this._trueCost = {...this.cost};
    if ( this.composition !== CrucibleSpellAction.COMPOSITION_STATES.COMPOSED ) {
      this.cost.action = this.cost.focus = this.cost.health = this.cost.hands = 0;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _canUse() {
    super._canUse();
    if ( this.inflection && this.actor.statuses.has("silenced") ) {
      throw new Error(_loc("SPELL.WARNINGS.CannotUseSilenced"));
    }
  }

  /* -------------------------------------------- */

  async _preActivate(targets) {
    await super._preActivate(targets);
    // By the time we are on the far side of the spell cast configuration window, the spell must be fully composed
    if ( this.composition !== CrucibleSpellAction.COMPOSITION_STATES.COMPOSED ) {
      throw new Error(_loc("SPELL.WARNINGS.CannotUseNotComposed"));
    }
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  acquireTargets(options={}) {
    if ( this.composition === CrucibleSpellAction.COMPOSITION_STATES.COMPOSING ) options.strict = false;
    return super.acquireTargets(options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  clone(updateData={}, context={}) {
    if ( !this.composition ) updateData.composition = CrucibleSpellAction.COMPOSITION_STATES.COMPOSING;
    return super.clone(updateData, context);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the default Cast Spell action, populated with the most recently cast spell components.
   * @param {CrucibleActor} actor       The Actor for whom the spell is being prepared
   * @param {object} spellData          Initial data for the spell
   * @returns {CrucibleSpellAction}     The constructed CrucibleSpellAction
   */
  static getDefault(actor, spellData={}) {

    // Repeat Last Spell
    const lastSpell = actor.flags.crucible?.lastSpell;
    if ( lastSpell ) {
      try {
        const last = this.fromId(lastSpell, {actor});
        last._canUse();
        return last;
      } catch(err) {
        console.warn(err);
      }
    }

    // Cast New Spell
    const rune = actor.grimoire.runes.keys().next().value;
    const gesture = "touch";
    Object.assign(spellData, {
      rune,
      gesture,
      inflection: undefined,
      composition: this.COMPOSITION_STATES.NONE,
      tags: ["spell", "composed"]
    });
    return new this(spellData, {actor});
  }

  /* -------------------------------------------- */

  /**
   * Obtain a Spell instance corresponding to a provided spell ID
   * @param {string} spellId          The provided spell ID in the format spell.{rune}.{gesture}.{inflection}
   * @param {object} [context]        Context data applied to the created spell
   * @returns {CrucibleSpellAction}   The constructed spell instance
   */
  static fromId(spellId, context={}) {
    const [spell, rune, gesture, inflection] = spellId.split(".").map(p => p === "none" ? "" : p);
    if ( spell !== "spell" ) throw new Error(`Invalid Spell ID: "${spellId}"`);
    return new this({
      id: spellId,
      rune,
      gesture,
      inflection,
      composition: this.COMPOSITION_STATES.COMPOSED,
      tags: ["spell", "composed"]
    }, context);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async configure(targets) {
    const result = await super.configure(targets);
    this.updateSource({composition: CrucibleSpellAction.COMPOSITION_STATES.COMPOSED});
    return result;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags() {
    const tags = super.getTags();

    // Variable Cost
    if ( this.composition === CrucibleSpellAction.COMPOSITION_STATES.NONE ) {
      if ( tags.activation.ap ) tags.activation.ap += "+";
      if ( tags.activation.fp ) tags.activation.fp += "+";
      if ( tags.activation.hp ) tags.activation.hp += "+";
    }

    delete tags.action.spell;
    tags.action.scaling = Array.from(this.scaling).map(a => SYSTEM.ABILITIES[a].label).join("/");
    if ( this.damage.healing ) tags.action.healing = _loc("ACTION.TagHealing");
    else tags.action.defense = SYSTEM.DEFENSES[this.usage.defenseType].label;
    tags.action.resource = SYSTEM.RESOURCES[this.rune.resource].label;

    // Show unmet for inflection if silenced
    if ( tags.context.inflection && this.actor?.statuses.has("silenced") ) {
      tags.context.inflection = {
        label: tags.context.inflection,
        unmet: true,
        tooltip: _loc("SPELL.WARNINGS.CannotUseSilenced")
      };
    }
    return tags;
  }
}
