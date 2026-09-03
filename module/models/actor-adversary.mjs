import CrucibleBaseActor from "./actor-base.mjs";
import CrucibleTaxonomyItem from "./item-taxonomy.mjs";
import CrucibleArchetypeItem from "./item-archetype.mjs";
import {allocatePoints} from "../advancement.mjs";

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

    // Adversaries may possess supernatural presence on the battlefield, counting as more than one flanker
    schema.movement.extendFields({
      flankingStrength: new fields.NumberField({...requiredInteger, initial: 1, persisted: false})
    });

    // Advancement
    schema.advancement = new fields.SchemaField({
      level: new fields.NumberField({...requiredInteger, initial: 1, min: -5, max: 24, label: "ADVANCEMENT.Level"}),
      rank: new fields.StringField({required: true, choices: SYSTEM.THREAT_RANKS, initial: "normal"}),
      important: new fields.BooleanField({required: true, initial: false})
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
      }),
      knowledge: new fields.SetField(new fields.StringField({blank: false})),
      languages: new fields.SetField(new fields.StringField({blank: false}))
    });

    // Adversaries do not track ability or training advancement, both being derived from Taxonomy and Archetype
    for ( const abilityField of Object.values(schema.abilities.fields) ) {
      delete abilityField.fields.base;
      delete abilityField.fields.increases;
    }
    delete schema.training.element.fields.increases;
    return schema;
  }

  /**
   * The Handlebars template path used to render an @Embed block for adversaries.
   */
  static EMBED_TEMPLATE = "systems/crucible/templates/embeds/actor-adversary.hbs";

  /**
   * The order in which abilities claim a point when automatic allocation would otherwise be tied.
   * @type {string[]}
   */
  static #ABILITY_PRIORITY = ["toughness", "strength", "dexterity", "presence", "intellect", "wisdom"];

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /** @override */
  get usesReserveResources() {
    return this.advancement.important;
  }

  /** @override */
  get isDead() {
    if ( !this.abilities.toughness.value ) return false;
    return super.isDead;
  }

  /** @override */
  get isBroken() {
    if ( !this.abilities.presence.value ) return false;
    return super.isBroken;
  }

  /** @override */
  get isIncapacitated() {
    if ( !this.abilities.toughness.value && this.isBroken ) return true;
    return super.isIncapacitated;
  }

  /**
   * The number of training points this Adversary allocates according to Archetype preference.
   * Beneath level 1 the award decays along the same reciprocal curve as {@link CrucibleAdversaryActor#advancement}
   * threatLevel, so the weakest creatures still train a little rather than dropping to nothing at once.
   * @type {number}
   */
  get trainingBudget() {
    const {level} = this.advancement;
    const perLevel = SYSTEM.PROFICIENCY.ADVERSARY_POINTS_PER_LEVEL;
    return level >= 1 ? perLevel * level : Math.ceil(perLevel / (2 - level));
  }

  /* -------------------------------------------- */

  /**
   * Does this Adversary use physical equipment?
   * @type {boolean}
   */
  get usesEquipment() {
    return (this.abilities.strength.value > 0) && !!this.details.taxonomy?.characteristics.equipment;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureProgression() {
    const config = super._configureProgression();
    const {rank} = this.advancement;
    const threatConfig = SYSTEM.THREAT_RANKS[rank];
    const expectedSize = this.movement.baseSize + this.movement.sizeBonus;
    Object.assign(config, {
      actionMax: threatConfig.actionMax,
      heroismMax: threatConfig.heroismMax,
      healthPerLevel: expectedSize + 2,
      moralePerLevel: expectedSize + 2,
      abilityMax: 18,
      talentTraining: false // Talent counts vary too widely between Archetypes to serve as a progression basis
    });

    // Cap reserve pools for Important adversaries using the Normal threat baseline
    if ( this.advancement.important && (config.healthMultiplier > 1) ) {
      config.woundsMultiplier /= config.healthMultiplier;
      config.madnessMultiplier /= config.moraleMultiplier;
    }
    return config;
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareBaseAbilities() {
    const {archetype, taxonomy: tax} = this.details;
    const {level, threat} = this.advancement;
    const {abilityMax} = this.details.progression;
    const budget = level > 0 ? 5 + level : Math.ceil(6 * threat);
    const weights = {};
    const caps = {};
    for ( const k in SYSTEM.ABILITIES ) {
      const a = this.abilities[k];
      a.base = tax.abilities[k];
      a.initial = a.increases = 0;
      a.value = a.base;
      weights[k] = a.base > 0 ? archetype.abilities[k] : 0; // An ability the Taxonomy denies can never be raised
      caps[k] = Math.max(abilityMax - a.base, 0);
    }
    const order = CrucibleAdversaryActor.#ABILITY_PRIORITY.toSorted((a, b) => tax.abilities[b] - tax.abilities[a]);
    const increases = allocatePoints(budget, weights, {caps, order});
    for ( const k in SYSTEM.ABILITIES ) {
      const a = this.abilities[k];
      a.increases = increases[k];
      a.value = a.base + a.increases;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareBaseDefenses() {
    super._prepareBaseDefenses();
    const taxonomy = this.details.taxonomy;
    for ( const [r, res] of Object.entries(this.resistances) ) {
      const tr = taxonomy.resistances[r].value || 0;
      res.immune ||= taxonomy.resistances[r].immune;
      if ( tr === 0 ) {
        res.base = 0;
        continue;
      }
      const perLevel = tr < 0 ? (tr / 3) : (tr * 2 / 3);
      const base = this.advancement.threat * perLevel;
      res.base = base < 0 ? Math.floor(base) : Math.ceil(base);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareBaseMovement() {
    super._prepareBaseMovement();
    const {size=4, stride=10} = this.details.taxonomy?.movement || {};
    this.movement.baseSize = size;
    this.movement.baseStride = stride;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareFinalMovement() {
    super._prepareFinalMovement();

    // Add a size-based bonus to base engagement
    const m = this.movement;
    const sizeBonus = Math.ceil(Math.max(m.size - 4, 0) / 2);
    m.baseEngagement += sizeBonus;
    m.engagement = m.baseEngagement + m.engagementBonus;
  }

  /* -------------------------------------------- */

  /**
   * Prepare character details for the Adversary subtype specifically.
   * @override
   */
  _prepareDetails() {

    // Initialize default archetype and taxonomy data
    this.details.archetype ||= CrucibleArchetypeItem.cleanData();
    this.details.taxonomy ||= CrucibleTaxonomyItem.cleanData();

    // Compute threat level
    const adv = this.advancement;
    const threatConfig = SYSTEM.THREAT_RANKS[adv.rank];
    adv.threatFactor = threatConfig?.scaling || 1;
    adv.threatLevel = adv.level < 0 ? 1 / Math.abs(adv.level - 1) : adv.level;
    adv.threat = adv.threatLevel * adv.threatFactor;

    // Automatic training and maximum action configuration
    this.advancement.autoTrainingRank = Math.clamp(1 + Math.floor(adv.threatLevel / 6), 0, SYSTEM.PROFICIENCY.RANK_MAX);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareTraining() {
    super._prepareTraining();

    // Automatic natural weapon training if the taxonomy does not use equipment
    if ( !this.usesEquipment ) {
      const {required} = SYSTEM.PROFICIENCY.RANK_VALUES[this.advancement.autoTrainingRank];
      const natural = this.training.natural;
      natural.initial = Math.max(natural.initial, required);
    }

    // Allocate the level-scaled training budget according to Archetype preference
    const {trainingCap} = this.details.progression;
    const weights = {};
    const caps = {};
    for ( const id in SYSTEM.PROFICIENCIES ) {
      weights[id] = this.details.archetype?.training?.[id] ?? 0;
      caps[id] = Math.max(trainingCap - this.training[id].initial, 0);
    }
    const increases = allocatePoints(this.trainingBudget, weights, {caps});
    for ( const id in SYSTEM.PROFICIENCIES ) this.training[id].increases = increases[id];
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareEquipment(items) {
    if ( !this.usesEquipment ) {
      this.equipment.accessorySlots = 0;
      this.equipment.toolbeltSlots = 0;
    }
    return super._prepareEquipment(items);
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
    return this.parent._applyDetailItem(item, {type: "archetype", canApply: true, canClear: true});
  }

  /* -------------------------------------------- */

  /**
   * Apply a Taxonomy item to this Adversary Actor.
   * @param {CrucibleItem|object|null} item    An Item document, object of Item data, or null to clear the taxonomy
   * @returns {Promise<void>}
   */
  async applyTaxonomy(item) {
    return this.parent._applyDetailItem(item, {type: "taxonomy", canApply: true, canClear: true});
  }

  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this adversary Actor.
   * @param {string} scope
   * @returns {Record<string, string>}
   */
  getTags(scope="full") {
    const tags = {};
    tags.level = _loc("ACTOR.ADVERSARY.ThreatLevelSpecific", {threat: this.advancement.threat});
    if ( scope === "short" ) return tags;
    tags.taxonomy = this.details.taxonomy?.name || _loc("ACTOR.ADVERSARY.NoTaxonomy");
    tags.archetype = this.details.archetype?.name || _loc("ACTOR.ADVERSARY.NoArchetype");
    return tags;
  }

  /* -------------------------------------------- */

  /** @override */
  async toEmbed(config, _options) {
    const block = new foundry.applications.elements.HTMLDocumentEmbedElement();
    block.className = "block actor";
    config.inline ??= false; // Never use figures

    // Prepare actor data
    const actor = this.parent;
    const rank = actor.system.advancement.rank || "normal";
    const rankName = rank !== "normal" ? SYSTEM.THREAT_RANKS[rank]?.label : "";
    const context = {
      name: actor.name,
      img: config.image === "token" ? actor.prototypeToken.texture.src : actor.img,
      link: actor.toAnchor().outerHTML,
      count: config.count,
      threat: [actor.system.advancement.threatLevel, rankName ? `(${rankName})` : ""].filterJoin(" "),
      subtitle: [this.details.taxonomy?.name || "Unknown", this.details.archetype?.name || "Unknown"].join(" "),
      readaloud: await CONFIG.ux.TextEditor.enrichHTML(this.details.biography.appearance, {
        relativeTo: actor,
        secrets: actor.isOwner
      })
    };

    // Render the Embed
    block.innerHTML = await foundry.applications.handlebars.renderTemplate(this.constructor.EMBED_TEMPLATE, context);
    return block;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    source = super.migrateData(source);
    /** @deprecated since 0.7.3 */
    if ( source.details?.archetype ) crucible.api.models.CrucibleArchetypeItem.migrateData(source.details.archetype);
    /** @deprecated since 0.7.3 */
    if ( source.details?.taxonomy ) crucible.api.models.CrucibleTaxonomyItem.migrateData(source.details.taxonomy);
    /** @deprecated since 0.7.4 */
    if ( source.advancement?.threat ) {
      source.advancement.rank = source.advancement.threat;
      delete source.advancement.threat;
    }
    return source;
  }
}
