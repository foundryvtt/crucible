import CrucibleBaseActor from "./actor-base.mjs";
import CrucibleTaxonomyItem from "./item-taxonomy.mjs";
import CrucibleArchetypeItem from "./item-archetype.mjs";

/**
 * Data schema, attributes, and methods specific to Adversary type Actors.
 */
export default class CrucibleAdversaryActor extends CrucibleBaseActor {

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
        ...CrucibleArchetypeItem.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      taxonomy: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleTaxonomyItem.defineSchema()
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
    archetype ||= CrucibleArchetypeItem.cleanData();
    taxonomy ||= CrucibleTaxonomyItem.cleanData();

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
    const maxA = this.advancement.threatLevel <= 0 ? Math.max(...Object.values(archetype.abilities)) : undefined;
    for ( const k in SYSTEM.ABILITIES ) {
      const w = this.advancement.threatLevel > 0 ? archetype.abilities[k] : (maxA + 1 - archetype.abilities[k]);
      weights[k] = Math.pow(w, 2);
      wTotal += weights[k];
    }

    // Pass 1: Unconstrained Increases
    let spent = 0;
    for ( const k in SYSTEM.ABILITIES ) {
      weights[k] /= wTotal;
      const a = this.abilities[k];
      a.desired = a.base + (toSpend * weights[k]);
      let d = Math.round(Math.abs(toSpend) * weights[k]) * Math.sign(toSpend);
      a.increases = Math.clamp(d, 1 - a.value, 18 - a.value);
      a.value = a.base + a.increases;
      spent += a.increases;
    }
    if ( spent === toSpend ) return;

    // Pass 2: Iterative Assignment
    const delta = Math.sign(toSpend - spent);
    const order = [];
    for ( const k in SYSTEM.ABILITIES ) {
      const a = this.abilities[k];
      const capped = delta > 0 ? a.value === 18 : a.value === 1;
      if ( !capped ) order.push([k, a.desired, a.value]);
    }
    while ( spent !== toSpend ) {
      if ( !order.length ) break;                                           // No uncapped abilities remaining
      if ( delta > 0 ) order.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]))  // Increase farthest below desired value
      else order.sort((a, b) => (a[1] - a[2]) - (b[1] - b[2]));             // Reduce farthest above desired value
      const target = order[0];
      const a = this.abilities[target[0]];
      a.increases += delta;
      target[2] = a.value += delta;
      const capped = delta > 0 ? a.value === 18 : a.value === 1;
      if ( capped ) order.shift();
      spent += delta;
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
    return this.parent._applyDetailItem(item, {canApply: true, canClear: true});
  }

  /* -------------------------------------------- */

  /**
   * Apply a Taxonomy item to this Adversary Actor.
   * @param {CrucibleItem|object|null} item    An Item document, object of Item data, or null to clear the taxonomy
   * @returns {Promise<void>}
   */
  async applyTaxonomy(item) {
    return this.parent._applyDetailItem(item, {canApply: true, canClear: true});
  }

  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this Hero Actor.
   * @returns {Record<string, string>}
   */
  getTags() {
    const tags = {};
    tags.level = `Threat Level ${this.advancement.threatLevel}`;
    tags.archetype = this.details.archetype?.name || "No Archetype";
    tags.taxonomy = this.details.taxonomy?.name || "No Taxonomy";
    return tags;
  }
}
