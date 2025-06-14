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
      level: new fields.NumberField({...requiredInteger, initial: 1, min: -5, max: 24, label: "ADVANCEMENT.Level"}),
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
  /*  Properties                                  */
  /* -------------------------------------------- */

  /** @override */
  get isDead() {
    return this.resources.health.value === 0;
  }

  /** @override */
  get isInsane() {
    return false;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  _prepareBaseMovement() {
    const {size=4, stride=10} = this.details.taxonomy || {};
    const m = this.movement;
    m.baseSize = size;
    m.baseStride = stride;
  }

  /* -------------------------------------------- */

  /**
   * Prepare character details for the Adversary subtype specifically.
   * @override
   */
  _prepareDetails() {

    // Initialize default archetype and taxonomy data
    let {archetype, taxonomy} = this.details;
    const adv = this.advancement;
    archetype ||= CrucibleArchetypeItem.cleanData();
    taxonomy ||= CrucibleTaxonomyItem.cleanData();

    // Compute threat level
    const threatConfig = SYSTEM.THREAT_LEVELS[adv.threat];
    adv.threatFactor = threatConfig?.scaling || 1;
    adv.threatLevel = adv.level < 0 ? 1 / Math.abs(adv.level - 1) : adv.level;
    adv.threat = adv.threatLevel * adv.threatFactor;

    // TODO Temporary automatic skill progression
    this.advancement._autoSkillRank = Math.clamp(Math.ceil(adv.threatLevel / 6), 0, 4);
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
    const {level, threat} = this.advancement;
    let toSpend = level > 0 ? 5 + level : Math.ceil(6 * threat);

    // Assign base Taxonomy ability scores
    for ( const k in SYSTEM.ABILITIES ) {
      const a = this.abilities[k];
      a.base = taxonomy.abilities[k];
      a.increases = 0;
      a.value = a.base;
    }

    // Compute Archetype scaling
    const abilities = {};
    const total = {points: 0, points2: 0};
    for ( const k in SYSTEM.ABILITIES ) {
      const ability = {points: taxonomy.abilities[k] > 0 ? archetype.abilities[k] : 0};
      abilities[k] = ability;
      total.points += ability.points;
    }
    for ( const k in abilities ) abilities[k].weight = abilities[k].points / total.points;

    // Pass 1: Unconstrained Increases
    const nFull = Math.floor(toSpend / total.points);
    if ( nFull > 0 ) {
      for ( const [k, abl] of Object.entries(abilities) ) {
        const a = this.abilities[k];
        a.increases += (abl.points * nFull);
        a.value = a.base + a.increases;
      }
      toSpend -= (nFull * total.points);
    }
    if ( toSpend === 0 ) return;

    // Pass 2: Iterative Assignment
    const allocation = {};
    for ( const k in abilities ) {
      const w = abilities[k].weight;
      const v0 = toSpend * w;
      const t0 = Math.min(v0, (18 - this.abilities[k].value), abilities[k].points);
      const p0 = Math.floor(t0);

      // How many more points are needed to get another +1?
      const t1 = Math.min(v0 + 1, (18 - this.abilities[k].value), abilities[k].points);
      const p1 = Math.floor(t1);
      const needed = (p1 - t0) / w;
      allocation[k] = {w, v0, t0, p0, t1, p1, needed};
    }

    // Unambiguous allocation
    const remainder = [];
    for ( const k in allocation ) {
      const {p0, p1, needed} = allocation[k];
      const a = this.abilities[k];
      a.increases += p0;
      toSpend -= p0;
      a.value = a.base + a.increases;
      if ( (p1 > p0) && Number.isFinite(needed) ) remainder.push({ability: k, needed});
    }
    if ( toSpend === 0 ) return;

    // Sort remainder
    const tiebreaker = {toughness: 1, strength: 2, dexterity: 3, presence: 4, intellect: 5, wisdom: 6};
    remainder.sort((a, b) => {
      return (a.needed - b.needed) ||                                               // Fewest points needed
             (taxonomy.abilities[b.ability] - taxonomy.abilities[a.ability]) ||     // Taxonomy preference
             (tiebreaker[a.ability] - tiebreaker[b.ability]);                       // Heuristic tiebreaker
    });
    for ( const {ability} of remainder.slice(0, toSpend) ) {
      const a = this.abilities[ability];
      a.increases += 1;
      toSpend -= 1;
      a.value = a.base + a.increases;
    }
  }

  /* -------------------------------------------- */

  /**
   * Scale adversary resistances according to their threat level and taxonomy.
   * @param taxonomy
   */
  #scaleResistances(taxonomy) {
    for ( const r of Object.keys(this.resistances) ) {
      const tr = taxonomy.resistances[r] || 0;
      if ( tr === 0 ) {
        this.resistances[r].base = 0;
        continue;
      }
      const perLevel = tr < 0 ? (tr / 3) : (tr * 2 / 3);
      const base = this.advancement.threat * perLevel;
      this.resistances[r].base = base < 0 ? Math.floor(base) : Math.ceil(base);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single skill for the Adversary subtype specifically.
   * @override
   */
  _prepareSkill(config) {
    const skill = super._prepareSkill(config);
    skill.rank = this.advancement._autoSkillRank; // TODO verify or remove this
    return skill;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareMovement() {
    super._prepareMovement();
    this.movement.engagement += Math.max(this.movement.size - 3, 0);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getUnarmedWeapon() {
    if ( !this.details.taxonomy?.characteristics.equipment ) return null;
    return super._getUnarmedWeapon();
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
   * Prepare tags displayed about this adversary Actor.
   * @returns {Record<string, string>}
   */
  getTags() {
    const tags = {};
    tags.taxonomy = this.details.taxonomy?.name || "No Taxonomy";
    tags.archetype = this.details.archetype?.name || "No Archetype";
    tags.level = `Threat Level ${this.advancement.threat}`;
    return tags;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    super.migrateData(source);
    /** @deprecated since 0.7.3 */
    if ( source.details.archetype ) crucible.api.models.CrucibleArchetypeItem.migrateData(source.details.archetype);
    /** @deprecated since 0.7.3 */
    if ( source.details.taxonomy ) crucible.api.models.CrucibleArchetypeItem.migrateData(source.details.taxonomy);
  }
}
