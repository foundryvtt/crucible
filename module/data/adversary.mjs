import CrucibleArchetype from "./archetype.mjs";
import {SYSTEM} from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Adversary type Actors.
 */
export default class CrucibleAdversary extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = {};

    // Ability Scores
    const abilityField = label => new fields.SchemaField({
      bonus: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
    }, {label});
    schema.abilities = new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
      obj[ability.id] = abilityField(ability.label);
      return obj;
    }, {}));

    // Defenses
    const defenseField = label => new fields.SchemaField({
      bonus: new fields.NumberField({...requiredInteger, initial: 0})
    }, {label});
    schema.defenses = new fields.SchemaField(Object.values(SYSTEM.DEFENSES).reduce((obj, defense) => {
      if ( defense.id !== "physical" ) obj[defense.id] = defenseField(defense.label);
      return obj;
    }, {}));

    // Details
    schema.details = new fields.SchemaField({
      archetype: new fields.SchemaField({
        name: new fields.StringField(),
        ...CrucibleArchetype.defineSchema()
      }, {required: false, initial: undefined}),
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
      category: new fields.StringField({required: true, choices: CrucibleAdversary.CATEGORIES, initial: "humanoid"}),
      threat: new fields.StringField({required: true, choices: CrucibleAdversary.THREATS, initial: "normal"}),
      biography: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      })
    });

    // Resistances
    schema.resistances = new fields.SchemaField(Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, damageType) => {
      obj[damageType.id] = defenseField(damageType.label);
      return obj;
    }, {}));

    // Resource Pools
    const resourceField = label => new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
    }, {label});
    schema.resources = new fields.SchemaField(Object.values(SYSTEM.RESOURCES).reduce((obj, resource) => {
      if ( resource.type === "active" ) obj[resource.id] = resourceField(resource.label);
      return obj
    }, {}));

    // Skills
    const skillField = label => new fields.SchemaField({
      rank: new fields.NumberField({...requiredInteger, initial: 0, max: 5})
    }, {label});
    schema.skills = new fields.SchemaField(Object.values(SYSTEM.SKILLS).reduce((obj, skill) => {
      obj[skill.id] = skillField(skill.label);
      return obj;
    }, {}));

    // Status
    schema.status = new fields.ObjectField({nullable: true, initial: null});
    return schema;
  }

  /* -------------------------------------------- */

  /**
   * The categories that an adversary may have
   * @enum {number}
   */
  static CATEGORIES = Object.freeze({
    beast: "CRUCIBLE.AdversaryCategoryBeast",
    humanoid: "CRUCIBLE.AdversaryCategoryHumanoid",
    undead: "CRUCIBLE.AdversaryCategoryUndead"
  });

  /**
   * The threat levels that an adversary may have.
   * @enum {number}
   */
  static THREATS = Object.freeze({
    minion: "CRUCIBLE.AdversaryThreatMinion",
    normal: "CRUCIBLE.AdversaryThreatNormal",
    elite: "CRUCIBLE.AdversaryThreatElite",
    boss: "CRUCIBLE.AdversaryThreatBoss"
  });

  /**
   * Multiplicative factors which adjust how threat levels interact with archetype scaling.
   * @enum {number}
   */
  static THREAT_SCALING = Object.freeze({
    minion: 0.75,
    normal: 1,
    elite: 1.25,
    boss: 1.5
  })

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    if ( this.details.archetype ) this.#applyArchetype();
  }

  /* -------------------------------------------- */

  /**
   * Apply an archetype to automatically configure attributes and resistances.
   */
  #applyArchetype() {
    const {archetype, level, threat} = this.details;
    const factor = CrucibleAdversary.THREAT_SCALING[threat] || 1;
    const effectiveLevel = (6 + level) * factor;

    // Scale abilities
    for ( const a of Object.keys(this.abilities) ) {
      const scale = archetype.abilities[a];
      this.abilities[a].value = (scale === null) ? 0 : Math.floor(effectiveLevel / scale);
    }

    // Scale resistances
    for ( const r of Object.keys(this.resistances) ) {
      const scale = archetype.resistances[r];
      this.resistances[r].base = scale === 0 ? 0 : Math.floor(effectiveLevel / Math.abs(scale)) * Math.sign(scale);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this.#prepareResources();
    this.#prepareSaveDefenses();
    this.#prepareResistances();
  }

  /* -------------------------------------------- */

  /**
   * Prepare resource pools.
   */
  #prepareResources() {
    const l = this.details.level;
    const r = this.resources;
    const a = this.abilities;

    // Health
    r.health.max = (4 * (l + a.toughness.value)) + (2 * (a.strength.value + a.dexterity.value));
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = (4 * (l + a.presence.value)) + (2 * (a.intellect.value + a.wisdom.value));
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = 3;
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.floor(l / 2) + Math.max(a.wisdom.value, a.presence.value, a.intellect.value);
    r.focus.value = Math.clamped(r.focus.value, 0, r.focus.max);
  }

  /* -------------------------------------------- */

  /**
   * Prepare non-physical defense scores.
   */
  #prepareSaveDefenses() {
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      let d = this.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + this.abilities[a].value, SYSTEM.PASSIVE_BASE);
      d.total = d.base + d.bonus;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare damage resistances.
   */
  #prepareResistances() {
    for ( const r of Object.values(this.resistances) ) {
      r.total = r.base + r.bonus;
    }
  }
}
