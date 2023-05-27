import CrucibleArchetype from "./archetype.mjs";
import CrucibleTaxonomy from "./taxonomy.mjs";
import {SYSTEM} from "../config/system.js";
import CrucibleAncestry from "./ancestry.mjs";

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
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
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
    const abilityLevel = level === 0 ? Math.round(-6 * (2 - factor)) : Math.round(level * factor);

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

    // Apply increases
    let spent = 0;
    for ( const o of order ) {
      const a = this.abilities[o.id];
      o.weight = o.weight / denom;
      o.raw = abilityLevel * o.weight;
      const d = o.increases = Math.floor(o.raw);
      spent += d;
      a.increases = d;
      a.value = o.weight ? Math.max(a.base + a.increases, 1) : 0;
    }

    // Allocate remainder
    let remainder = abilityLevel - spent;
    let n = 1;
    while ( remainder > 0 ) {
      for ( const o of order ) {
        const a = this.abilities[o.id];
        const nextWeight = (abilityLevel + n) * o.weight;
        if ( Math.floor(nextWeight) > a.increases ) {
          a.increases++;
          a.value++;
          remainder--
          if ( !remainder ) break;
        }
      }
      n++;
    }

    // Resistances
    const resistanceLevel = (6 + level) * factor;
    for ( const r of Object.keys(this.resistances) ) {
      const tr = taxonomy.resistances[r] || 0;
      this.resistances[r].base = tr === 0 ? 0 : Math.floor(resistanceLevel / Math.abs(tr)) * Math.sign(tr);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Skills.
   */
  #prepareSkills() {
    const ranks = SYSTEM.SKILL.RANKS;
    for ( let [id, skill] of Object.entries(this.skills) ) {
      const config = SYSTEM.SKILLS[id];
      skill.abilityBonus = this.parent.getAbilityBonus(config.abilities);
      skill.skillBonus = ranks[skill.rank].bonus;
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
  }

  /* -------------------------------------------- */

  /**
   * Prepare resource pools.
   */
  #prepareResources() {
    const {statuses} = this.parent;
    const threat = SYSTEM.THREAT_LEVELS[this.details.threat];
    const level = this.details.level * threat.scaling;
    const r = this.resources;
    const a = this.abilities;

    // Health
    r.health.max = (6 * level) + (4 * a.toughness.value) + (2 * a.strength.value);
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = (6 * level) + (4 * a.presence.value) + (2 * a.wisdom.value);
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = threat.actionMax;
    if ( statuses.has("stunned") ) r.action.max -= 2;
    else if ( statuses.has("staggered") ) r.action.max -= 1;
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil(level / 2) + Math.round((a.wisdom.value + a.presence.value + a.intellect.value) / 3);
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
