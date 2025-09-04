import CrucibleBaseActor from "./actor-base.mjs";
import CrucibleAncestryItem from "./item-ancestry.mjs";
import CrucibleBackgroundItem from "./item-background.mjs";

/**
 * Data schema, attributes, and methods specific to Hero type Actors.
 */
export default class CrucibleHeroActor extends CrucibleBaseActor {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = super.defineSchema();

    // Extra validation for abilities
    for ( const abilityField of Object.values(schema.abilities.fields) ) {
      abilityField.options.validate = CrucibleHeroActor.#validateAttribute;
    }

    // Advancement
    schema.advancement = new fields.SchemaField({
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 24}),
      milestones: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
      talentNodes: new fields.SetField(new fields.StringField({required: true, blank: false})) // TODO temporary
    });

    // Details
    schema.details = new fields.SchemaField({
      ancestry: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleAncestryItem.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      background: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleBackgroundItem.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      biography: new fields.SchemaField({
        appearance: new fields.HTMLField(),
        age: new fields.StringField(),
        height: new fields.StringField(),
        pronouns: new fields.StringField(),
        weight: new fields.StringField(),
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      }),
      knowledges: new fields.SetField(new fields.StringField({choices: () => crucible.CONFIG.knowledge})),
      languages: new fields.SetField(new fields.StringField({blank: false}))
    });
    return schema;
  }

  /* -------------------------------------------- */

  /**
   * Validate an attribute field
   * @param {{base: number, increases: number, bonus: number}} attr     The attribute value
   */
  static #validateAttribute(attr) {
    if ( (attr.base + attr.increases) > 12 ) throw new Error(`Attribute base + bonus cannot exceed 12`);
  }

  /* -------------------------------------------- */
  /*  Derived Attributes                          */
  /* -------------------------------------------- */

  /**
   * Advancement points that are available to spend and have been spent.
   * @type {{
   *   ability: {pool: number, total: number, bought: number, spent: number, available: number},
   *   talent: {total: number, spent: number, available: number}
   * }}
   */
  points;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.#prepareAdvancement();
    super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareBaseMovement() {
    const {size=4, stride=10} = this.details.ancestry.movement;
    const m = this.movement;
    m.baseSize = size;
    m.baseStride = stride;
  }

  /* -------------------------------------------- */

  /**
   * Compute the available points which can be spent to advance this character.
   */
  #prepareAdvancement() {
    const adv = this.advancement;
    const effectiveLevel = Math.max(adv.level, 1) - 1;
    this.points = {
      ability: {pool: 9, total: effectiveLevel, bought: 0, spent: 0, available: 0},
      talent: {total: 3 + (effectiveLevel*3), spent: 0, available: 0}
    };
    const level = SYSTEM.ACTOR.LEVELS[adv.level];
    if ( !level ) throw new Error(`Invalid character level ${adv.level} not in SYSTEM.ACTOR.LEVELS`);
    adv.progress = Math.max(adv.milestones - level.milestones.start, 0);
    adv.next = level.milestones.next;
    adv.required = level.milestones.required;
    adv.pct = Math.clamp(Math.round(adv.progress * 100 / Math.max(adv.required, 1)), 0, 100);
  }

  /* -------------------------------------------- */

  /**
   * Prepare character details for the Hero subtype specifically.
   * @override
   */
  _prepareDetails() {

    // Default Ancestry data
    if ( !this.details.ancestry ) {
      const ancestryDefaults = crucible.api.models.CrucibleAncestryItem.schema.getInitialValue();
      this.details.ancestry = this.schema.getField("details.ancestry").initialize(ancestryDefaults);
    }

    // Default Background data
    this.details.background ||= this.schema.getField("details.background").initialize({});

    // Add Background languages
    this.details.languages = this.details.languages.union(this.details.background.languages ?? new Set());

    // Add Background knowledge
    this.details.knowledges = this.details.knowledges.union(this.details.background.knowledge ?? new Set());

    // Threat level
    const adv = this.advancement;
    Object.assign(adv, {threatFactor: 1, threatLevel: adv.level, threat: adv.level});

    // Base Resistances
    const res = this.resistances;
    for ( const r of Object.values(res) ) r.base = 0;

    // Ancestry Resistances
    const {resistance, vulnerability} = this.details.ancestry.resistances;
    if ( resistance ) res[resistance].base += SYSTEM.ANCESTRIES.resistanceAmount;
    if ( vulnerability ) res[vulnerability].base -= SYSTEM.ANCESTRIES.resistanceAmount;
  }

  /* -------------------------------------------- */

  /**
   * Prepare abilities data for the Hero subtype specifically.
   * @override
   */
  _prepareAbilities() {
    const points = this.points.ability;
    const {primary, secondary} = this.details.ancestry.abilities;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in SYSTEM.ABILITIES ) {
      const ability = this.abilities[a];

      // Configure initial value
      ability.initial = 1;
      if ( a === primary ) ability.initial = SYSTEM.ANCESTRIES.primaryAbilityStart;
      else if ( a === secondary ) ability.initial = SYSTEM.ANCESTRIES.secondaryAbilityStart;
      ability.value = Math.clamp(ability.initial + ability.base + ability.increases + ability.bonus, 0, 12);

      // Track points spent
      abilityPointsBought += ability.base;
      abilityPointsSpent += ability.increases;
    }

    // Track spent ability points
    points.bought = abilityPointsBought;
    points.pool = 9 - points.bought;
    points.spent = abilityPointsSpent;
    points.available = points.total - abilityPointsSpent;
    points.requireInput = (this.advancement.level === 0) ? (points.pool > 0) : (points.available !== 0);
  }

  /* -------------------------------------------- */

  /**
   * Preparation of resource pools for the Hero subtype specifically.
   * @inheritDoc
   */
  _prepareResources() {
    super._prepareResources();
    const r = this.resources;

    // Wounds
    r.wounds.max = Math.ceil(1.5 * r.health.max);
    r.wounds.value = Math.clamp(r.wounds.value, 0, r.wounds.max);

    // Madness
    r.madness.max = Math.ceil(1.5 * r.morale.max);
    r.madness.value = Math.clamp(r.madness.value, 0, r.madness.max);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareItems(items) {
    super.prepareItems(items);
    const points = this.points.talent;
    points.spent = Math.max(this.talentIds.size - this.permanentTalentIds.size, 0) + this.advancement.talentNodes.size;
    points.available = points.total - points.spent;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Apply an Ancestry item to this Hero Actor.
   * @param {CrucibleItem} ancestry         The ancestry Item to apply to the Actor.
   * @param {object} options                Options which customize how the ancestry is applied
   * @param {boolean} [options.force=false]   Force the ancestry to be applied even if criteria are not met
   * @returns {Promise<void>}
   */
  async applyAncestry(ancestry, {force=false}={}) {
    const actor = this.parent;
    await actor._applyDetailItem(ancestry, {
      type: "ancestry",
      canApply: (actor.isL0 && !actor.points.ability.spent) || force,
      canClear: actor.isL0 || force
    });
  }

  /* -------------------------------------------- */

  /**
   * Apply a Background item to this Hero Actor.
   * @param {CrucibleItem} background       The background Item to apply to the Actor.
   * @param {object} options                Options which customize how the background is applied
   * @param {boolean} [options.force=false]   Force the background to be applied even if criteria are not met
   * @returns {Promise<void>}
   */
  async applyBackground(background, {force=false}={}) {
    const actor = this.parent;
    await actor._applyDetailItem(background, {
      type: "background",
      canApply: actor.isL0 || force,
      canClear: actor.isL0 || force
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this Hero Actor.
   * @returns {Record<string, string>}
   */
  getTags(scope="full") {
    const tags = {};
    tags.level = `Level ${this.advancement.level}`;
    if ( scope === "short" ) return tags;
    if ( this.details.signatureName ) tags.signatureName = this.details.signatureName;
    return tags;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    super.migrateData(source);
    if ( source.details?.ancestry ) CrucibleAncestryItem.migrateData(source.details.ancestry);
  }
}
