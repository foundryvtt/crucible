import CrucibleArchetype from "./archetype.mjs";
import CrucibleTaxonomy from "./taxonomy.mjs";
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
      level: new fields.NumberField({...requiredInteger, initial: 1, min: -11}),
      archetype: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleArchetype.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      stature: new fields.StringField({required: true, choices: SYSTEM.CREATURE_STATURES, initial: "medium"}),
      taxonomy: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleTaxonomy.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      threat: new fields.StringField({required: true, choices: SYSTEM.THREAT_LEVELS, initial: "normal"}),
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
      obj[skill.id] = skillField(skill.name);
      return obj;
    }, {}));

    // Movement Attributes
    schema.movement = new fields.SchemaField({
      stride: new fields.NumberField({...requiredInteger, initial: 4, min: 0}),
      engagement: new fields.NumberField({...requiredInteger, initial: 1, min: 0})
    });

    // Status
    schema.status = new fields.ObjectField({nullable: true, initial: null});
    return schema;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.status ||= {};
    this.#prepareDetails();
    this.#prepareSkills();
  }

  /* -------------------------------------------- */

  /**
   * Apply Archetype and Taxonomy scaling to automatically configure attributes and resistances.
   */
  #prepareDetails() {
    let {archetype, level, taxonomy, threat} = this.details;
    archetype ||= CrucibleArchetype.cleanData();
    taxonomy ||= CrucibleTaxonomy.cleanData();
    const factor = SYSTEM.THREAT_LEVELS[threat]?.scaling || 1;

    // Compute threat level
    let threatLevel = Math.floor(level * factor);
    let fractionLevel = threatLevel;
    if ( level === 0 ) {
      fractionLevel = 0;
      threatLevel = -12;
    }
    else if ( level < 0 ) {
      fractionLevel = 1 / (1 - level);
      threatLevel = 1 + Math.ceil(level / factor);
    }
    this.details.threatLevel = threatLevel;
    this.details.fractionLevel = fractionLevel;

    // Assign base taxonomy ability scores
    for ( const a of Object.keys(this.abilities) ) {
      this.abilities[a].base = taxonomy.abilities[a];
    }

    // Compute archetype scaling
    let denom = 0;
    const order = Object.keys(SYSTEM.ABILITIES).reduce((arr, k) => {
      const weight = this.abilities[k].base ? archetype.abilities[k] : 0; // Zero base gets zero weight
      denom += weight;
      arr.push({id: k, score: taxonomy.abilities[k] + archetype.abilities[k], weight});
      return arr;
    }, []).sort((a, b) => b.score - a.score);

    // Conservatively under-apply increases
    let spent = 0;
    for ( const o of order ) {
      const a = this.abilities[o.id];
      o.weight = o.weight / denom;
      let delta = Math.floor(threatLevel * o.weight);
      if ( o.weight === 0 ) delta = 0;            // Don't increase abilities with zero weight
      else if ( a.base + delta < 1 ) delta = 0;   // Don't decrease below 1
      o.increases = a.increases = delta;
      spent += delta;
    }

    // Allocate remainder
    let remainder = threatLevel - spent;
    let n = 1;
    while ( remainder > 0 ) {
      for ( const o of order ) {
        const a = this.abilities[o.id];
        const nextWeight = (threatLevel + n) * o.weight;
        if ( Math.floor(nextWeight) > a.increases ) {
          a.increases++;
          remainder--
          if ( !remainder ) break;
        }
      }
      n++;
    }

    // Compute total
    for ( const a of Object.values(this.abilities) ) {
      a.value = a.base + a.increases;
    }

    // Resistances
    const resistanceLevel = Math.max(6 + threatLevel, 0);
    for ( const r of Object.keys(this.resistances) ) {
      const tr = taxonomy.resistances[r] || 0;
      if ( tr === 0 ) {
        this.resistances[r].base = 0;
        continue;
      }
      const scaling = {
       1: 0.33,
       2: 0.66,
       3: 1
      }[Math.abs(tr)];
      this.resistances[r].base = Math.floor(resistanceLevel * scaling) * Math.sign(tr);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Skills for an Adversary.
   */
  #prepareSkills() {
    const skillRank = Math.ceil(this.details.fractionLevel / 6);
    for ( let [id, skill] of Object.entries(this.skills) ) {
      skill.rank = skillRank; // TODO for now adversaries get auto-rank progression
      const config = SYSTEM.SKILLS[id];
      skill.abilityBonus = this.parent.getAbilityBonus(config.abilities);
      skill.skillBonus = SYSTEM.SKILL.RANKS[skill.rank].bonus;
      skill.enchantmentBonus = 0;
      skill.score = skill.abilityBonus + skill.skillBonus + skill.enchantmentBonus;
      skill.passive = SYSTEM.PASSIVE_BASE + skill.score;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this.#prepareResources();
    this.parent._prepareDefenses();
    this.parent._prepareResistances();
    this.parent._prepareMovement();
  }

  /* -------------------------------------------- */

  /**
   * Prepare resource pools.
   */
  #prepareResources() {
    const {statuses} = this.parent;
    const threat = SYSTEM.THREAT_LEVELS[this.details.threat];
    const l = this.details.fractionLevel;
    const r = this.resources;
    const a = this.abilities;

    // Health
    r.health.max = Math.ceil(6 * l) + (4 * a.toughness.value) + (2 * a.strength.value);
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = Math.ceil(6 * l) + (4 * a.presence.value) + (2 * a.wisdom.value);
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = threat.actionMax;
    if ( this.details.level < 1 ) r.action.max -= 1;
    if ( statuses.has("stunned") ) r.action.max -= 2;
    else if ( statuses.has("staggered") ) r.action.max -= 1;
    r.action.max = Math.max(r.action.max, 0);
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil(l / 2) + Math.round((a.wisdom.value + a.presence.value + a.intellect.value) / 3);
    r.focus.value = Math.clamped(r.focus.value, 0, r.focus.max);
    this.parent.callTalentHooks("prepareResources", r);
  }


  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Apply an Archetype item to this Adversary Actor.
   * @param {CrucibleItem|object|null} item    An Item document, object of Item data, or null to clear the archetype
   * @returns {Promise<void>}
   */
  async applyArchetype(item) {
    return this.parent._applyDetailItem(item, "archetype", {canApply: true, canClear: true});
  }

  /* -------------------------------------------- */

  /**
   * Apply a Taxonomy item to this Adversary Actor.
   * @param {CrucibleItem|object|null} item    An Item document, object of Item data, or null to clear the taxonomy
   * @returns {Promise<void>}
   */
  async applyTaxonomy(item) {
    return this.parent._applyDetailItem(item, "taxonomy", {canApply: true, canClear: true});
  }
}
