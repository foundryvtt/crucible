import CrucibleActorType from "./actor-type.mjs";
import CrucibleArchetype from "./archetype.mjs";
import CrucibleTaxonomy from "./taxonomy.mjs";

/**
 * Data schema, attributes, and methods specific to Adversary type Actors.
 */
export default class CrucibleAdversary extends CrucibleActorType {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = super.defineSchema();

    // Details
    schema.details = new fields.SchemaField({
      level: new fields.NumberField({...requiredInteger, initial: 1, min: -5}),
      archetype: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleArchetype.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      size: new fields.NumberField({required: true, integer: true, nullable: false, min: 1, initial: 3}),
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

    // Adversaries do not track ability advancement
    for ( const abilityField of Object.values(schema.abilities.fields) ) {
      delete abilityField.fields.base;
      delete abilityField.fields.increases;
    }

    // Adversaries only use active resource pools
    for ( const resource of Object.values(SYSTEM.RESOURCES) ) {
      if ( resource.type !== "active" ) delete schema.resources.fields[resource.id];
    }
    return schema;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Prepare character details for the Adversary subtype specifically.
   * @override
   */
  _prepareDetails() {

    // Initialize default archetype and taxonomy data
    let {archetype, level, taxonomy, threat} = this.details;
    archetype ||= CrucibleArchetype.cleanData();
    taxonomy ||= CrucibleTaxonomy.cleanData();

    // Compute threat level
    const threatConfig = SYSTEM.THREAT_LEVELS[threat];
    const factor = threatConfig?.scaling || 1;
    let threatLevel = Math.ceil(level * factor);
    let fractionLevel = threatLevel;
    if ( level === 0 ) {
      fractionLevel = 0;
      threatLevel = -6;
    }
    else if ( level < 0 ) {
      fractionLevel = 1 / (1 - level);
      threatLevel = 1 + Math.ceil(level / factor);
    }
    this.details.threatLevel = threatLevel;
    this.details.fractionLevel = fractionLevel;

    // TODO: Automatic skill progression rank (temporary)
    this.details._autoSkillRank = Math.min(Math.ceil(this.details.fractionLevel / 6), 5);

    // Maximum Action pool size
    this.details.maxAction = threatConfig.actionMax;

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
    const toSpend = threatLevel - 1;
    let spent = 0;
    for ( const o of order ) {
      const a = this.abilities[o.id];
      o.weight = o.weight / denom;
      let delta = Math.floor(toSpend * o.weight);
      if ( o.weight === 0 ) delta = 0;            // Don't increase abilities with zero weight
      else if ( a.base + delta < 1 ) delta = 0;   // Don't decrease below 1
      o.increases = a.increases = delta;
      spent += delta;
    }

    // Allocate remainder
    let remainder = toSpend - spent;
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
   * Prepare a single skill for the Adversary subtype specifically.
   * @override
   */
  _prepareSkill(skillId, skill) {
    skill.rank = this.details._autoSkillRank;
    super._prepareSkill(skillId, skill);
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
