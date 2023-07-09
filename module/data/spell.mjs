import CrucibleAction from "./action.mjs";
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

  /** @override */
  static dialogClass = SpellCastDialog;

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
      this.description = "Weave arcana to create a work of spellcraft." // TODO make dynamic
    }

    // Derived Spell Attributes
    this.scaling = new Set([this.rune.scaling, this.gesture.scaling]);
    this.cost = CrucibleSpell.#prepareCost.call(this);
    this.defense = CrucibleSpell.#prepareDefense.call(this);
    this.damage = CrucibleSpell.#prepareDamage.call(this);
    this.target = CrucibleSpell.#prepareTarget.call(this);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the cost for the spell from its components.
   * @this {CrucibleSpell}      The spell being prepared
   * @returns {ActionCost}      Configured cost data
   */
  static #prepareCost() {
    const cost = {...this.gesture.cost};
    cost.hands = this.gesture.hands;
    if ( this.inflection ) {
      cost.action += this.inflection.cost.action;
      cost.focus += this.inflection.cost.focus;
    }
    return cost;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the defense against which this spell is tested.
   * @this {CrucibleSpell}      The spell being prepared
   * @returns {string}          The defense to test
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
   * @this {CrucibleSpell}      The spell being prepared
   * @returns {DamageData}      Prepared damage data
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
   * Prepare the target data for the Spell based on its components.
   * @this {CrucibleSpell}      The spell being prepared
   * @returns {ActionTarget}    Configured target data
   */
  static #prepareTarget() {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    const target = {...this.gesture.target};

    // Restoration runes should affect allies
    if ( this.rune.restoration ) target.scope ??= scopes.ALLIES;

    // Specific targeting requirements for the composed spell
    switch ( target.type ) {
      case "none":
        target.scope ??= scopes.NONE;
        break;
      case "self":
      case "summon":
        target.scope ??= scopes.SELF;
        break;
      default:
        target.scope ??= scopes.ENEMIES;
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
  _prepare() {
    super._prepare();
    CrucibleSpell.#prepareGesture.call(this);

    // Blood Magic
    if ( this.actor.talentIds.has("bloodmagic000000") ) {
      this.cost.health = (this.cost.focus * 10);
      this.cost.focus = 0;
    }

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
    const mh = e.weapons.mainhand;
    const s = this.actor.system.status;
    const t = this.actor.talentIds;
    this.usage.hasDice = true; // Spells involve dice rolls by default
    switch ( this.gesture.id ) {

      /* -------------------------------------------- */
      /*  Gesture: Arrow                              */
      /* -------------------------------------------- */
      case "arrow":

        // Weapon range
        if ( mh.config.category.ranged ) this.target.distance = mh.system.range;

        // Arcane Archer Signature
        if ( t.has("arcanearcher0000") && mh.config.category.ranged ) {
          this.target.distance = Math.max(this.target.distance, mh.system.range);
          this.cost.hands = 0;
          if ( s.rangedAttack && !s.arcaneArcher ) {
            this.cost.action -= 1;
            this.usage.actorUpdates["system.status.arcaneArcher"] = true;
          }
        }
        break;

      /* -------------------------------------------- */
      /*  Gesture: Create                             */
      /* -------------------------------------------- */
      case "create":
        this.tags.add("summon");

        // Identify summoned Actor
        const summonUUIDs = SYSTEM.SPELL.CREATION_SUMMONS;
        this.usage.summon = summonUUIDs[this.rune.id] || summonUUIDs.fallback;

        // Add summon effect
        let effectId = SYSTEM.EFFECTS.getEffectId("create")
        if ( t.has("conjurer00000000") ) {
          const effectIds = ["conjurercreate1", "conjurercreate2", "conjurercreate3"].map(id => SYSTEM.EFFECTS.getEffectId(id));
          effectId = effectIds.find(id => !this.actor.effects.has(id)) || effectIds[0];
        }
        this.effects.push({
          _id: effectId,
          icon: this.img,
          duration: {rounds: 10},
          origin: this.actor.uuid
        });
        this.usage.hasDice = false;
        break;

      /* -------------------------------------------- */
      /*  Gesture: Strike                             */
      /* -------------------------------------------- */
      case "strike":
        this.tags.add("melee");

        // Weapon range
        if ( mh.config.category.melee ) this.target.distance = mh.system.range;

        // Weapon scaling and bonus damage
        this.scaling = new Set([...mh.config.category.scaling.split("."), this.rune.scaling]);
        this.damage.bonus = mh.system.damage.bonus;

        // Spellblade Signature
        if ( t.has("spellblade000000") && s.meleeAttack && !s.spellblade ) {
          this.cost.action -= 1;
          this.usage.actorUpdates["system.status.spellblade"] = true;
        }
        break;

      /* -------------------------------------------- */
      /*  Gesture: Ward                               */
      /* -------------------------------------------- */
      case "ward":
        this.usage.hasDice = false;

        // TODO: Enable healing wards
        if ( this.damage.healing ) {
          ui.notifications.warning("Gesture: Ward is not configured for healing Runes yet");
          break;
        }

        // Shield Ward
        if ( t.has("shieldward000000") && e.weapons.shield ) this.cost.hands = 0;

        // Configure Ward effect
        let resistance = 6;
        if ( this.actor.talentIds.has("runewarden000000") ) {
          resistance += Math.ceil(this.actor.abilities.wisdom.value / 2);
        }
        this.effects.push({
          _id: SYSTEM.EFFECTS.getEffectId("ward"),
          icon: this.gesture.img,
          duration: {rounds: 1},
          origin: this.actor.uuid,
          changes: [
            {
              key: `system.resistances.${this.damage.type}.bonus`,
              value: resistance,
              mode: CONST.ACTIVE_EFFECT_MODES.ADD
            }
          ]
        });
        break;

      /* -------------------------------------------- */
      /*  Gesture: Aspect                             */
      /* -------------------------------------------- */
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
        this.usage.hasDice = false;
        break;
    }
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  acquireTargets(options={}) {
    if ( this.composition === CrucibleSpell.COMPOSITION_STATES.COMPOSING ) options.strict = false;
    return super.acquireTargets(options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  clone(updateData={}, context) {
    if ( !this.composition ) updateData.composition = CrucibleSpell.COMPOSITION_STATES.COMPOSING;
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

  /**
   * Obtain a Spell instance corresponding to a provided spell ID
   * @param {string} spellId      The provided spell ID in the format spell.{rune}.{gesture}.{inflection}
   * @param {object} [context]    Context data applied to the created spell
   * @returns {CrucibleSpell}     The constructed spell instance
   */
  static fromId(spellId, context={}) {
    const [spell, rune, gesture, inflection] = spellId.split(".");
    if ( spell !== "spell" ) throw new Error(`Invalid Spell ID: "${spellId}"`);
    return new this({
      id: spellId,
      rune,
      gesture,
      inflection,
      composition: this.COMPOSITION_STATES.COMPOSED,
      tags: ["spell"]
    }, context);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async configure(targets) {
    const result = await super.configure(targets);
    this.updateSource({composition: CrucibleSpell.COMPOSITION_STATES.COMPOSED});
    return result;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags() {
    const tags = super.getTags();

    // Variable Cost
    if ( this.composition === CrucibleSpell.COMPOSITION_STATES.NONE ) {
      if ( tags.activation.ap ) tags.activation.ap += "+";
      if ( tags.activation.fp ) tags.activation.fp += "+";
      if ( tags.activation.hp ) tags.activation.hp += "+";
    }

    delete tags.action.spell;
    tags.action.scaling = Array.from(this.scaling).map(a => SYSTEM.ABILITIES[a].label).join("/");
    if ( this.damage.healing ) tags.action.healing = "Healing";
    else tags.action.defense = SYSTEM.DEFENSES[this.defense].label;
    tags.action.resource = SYSTEM.RESOURCES[this.rune.resource].label;
    return tags;
  }

  /* -------------------------------------------- */
  /*  Animation                                   */
  /* -------------------------------------------- */

  /** @override */
  _getAnimationPreset() {
    return {
      id: `crucible.spell.${this.gesture.id}`,
      rune: this.rune.id
    }
  }
}
