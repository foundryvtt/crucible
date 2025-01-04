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

    // Advancement
    schema.advancement = new fields.SchemaField({
      level: new fields.NumberField({...requiredInteger, initial: 0, min: -5, max: 24, label: "ADVANCEMENT.Level"}),
      threat: new fields.StringField({required: true, choices: SYSTEM.THREAT_LEVELS, initial: "normal"})
    });

    // Details
    schema.details = new fields.SchemaField({
      archetype: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleArchetype.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      taxonomy: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleTaxonomy.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      biography: new fields.SchemaField({
        appearance: new fields.HTMLField(),
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

  /** @override */
  prepareBaseData() {
    this.size = (this.details.taxonomy?.size || 3) + this.details.size;
    this.#prepareBaseMovement();
    super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /**
   * Prepare base movement attributes that are defined by the Adversary's Taxonomy.
   */
  #prepareBaseMovement() {
    const m = this.movement;
    const {size=3, stride=10} = this.details.taxonomy || {};
    m.size = size + m.sizeBonus;
    m.stride = stride + m.strideBonus;
  }

  /* -------------------------------------------- */

  /**
   * Prepare character details for the Adversary subtype specifically.
   * @override
   */
  _prepareDetails() {

    // Initialize default archetype and taxonomy data
    let {archetype, taxonomy} = this.details;
    let {level, threat} = this.advancement;
    archetype ||= CrucibleArchetype.cleanData();
    taxonomy ||= CrucibleTaxonomy.cleanData();

    // Compute threat level
    const threatConfig = SYSTEM.THREAT_LEVELS[threat];
    this.advancement.threatFactor = threatConfig?.scaling || 1;
    let threatLevel = Math.floor(level * this.advancement.threatFactor);
    if ( level === 0 ) threatLevel = -6;
    else if ( level < 0 ) threatLevel = Math.floor(level / this.advancement.threatFactor);
    this.advancement.threatLevel = threatLevel;

    // TODO: Automatic skill progression rank (temporary)
    this.advancement._autoSkillRank = Math.clamp(Math.ceil(threatLevel / 6), 0, 5);
    this.advancement.maxAction = threatConfig.actionMax;

    // Scale attributes
    this.#scaleAbilities(taxonomy, archetype);
    this.#scaleResistances(taxonomy);
  }

  /* -------------------------------------------- */

  /**
   * Scale adversary abilities according to their threat level, taxonomy, and archetype.
   * @param taxonomy
   * @param archetype
   */
  #scaleAbilities(taxonomy, archetype) {

    // Assign base Taxonomy ability scores
    for ( const k in SYSTEM.ABILITIES ) {
      const a = this.abilities[k];
      a.base = taxonomy.abilities[k];
      a.increases = 0;
      a.value = a.base;
    }

    // Identify points to spend
    let toSpend = this.advancement.threatLevel - 1;

    // Compute Archetype scaling weights
    const weights = {};
    let wTotal = 0;
    for ( const k in SYSTEM.ABILITIES ) {
      const w = archetype.abilities[k];
      weights[k] = Math.pow(w, 2);
      wTotal += weights[k];
    }

    const delta = Math.sign(toSpend);

    for (let i = 0; i < Math.abs(toSpend); i++) {
      let mostDivergingWeightedScore = Infinity * delta;
      let mostDivergingAbility;
      for ( const ability in SYSTEM.ABILITIES ) {
        const score = this.abilities[ability].value;
        const weightedScore = score / weights[ability];
        if (
          (toSpend > 0 && weightedScore < mostDivergingWeightedScore && score < 18) 
          || (toSpend < 0 && weightedScore > mostDivergingWeightedScore && score > 1)
        ) {
          mostDivergingWeightedScore = weightedScore;
          mostDivergingAbility = ability;
        }
      }
      this.abilities[mostDivergingAbility].increases += delta;
      this.abilities[mostDivergingAbility].value += delta;
    }
  }

  /* -------------------------------------------- */

  /**
   * Scale adversary resistances according to their threat level and taxonomy.
   * @param taxonomy
   */
  #scaleResistances(taxonomy) {
    const resistanceLevel = Math.max(6 + this.advancement.threatLevel, 0);
    for ( const r of Object.keys(this.resistances) ) {
      const tr = taxonomy.resistances[r] || 0;
      if ( tr === 0 ) {
        this.resistances[r].base = 0;
        continue;
      }
      const scaling = {1: 0.33, 2: 0.66, 3: 1}[Math.abs(tr)];
      this.resistances[r].base = Math.floor(resistanceLevel * scaling) * Math.sign(tr);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single skill for the Adversary subtype specifically.
   * @override
   */
  _prepareSkill(skillId, skill) {
    skill.rank = this.advancement._autoSkillRank;
    super._prepareSkill(skillId, skill);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareMovement() {
    super._prepareMovement();
    this.movement.engagement += Math.max(this.movement.size - 3, 0);
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
