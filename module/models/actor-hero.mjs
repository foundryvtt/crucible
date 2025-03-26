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
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 24, label: "ADVANCEMENT.Level"}),
      progress: new fields.NumberField({...requiredInteger, initial: 0, min: 0, label: "ADVANCEMENT.Progress"}),
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
        weight: new fields.StringField(),
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      })
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
    this.#prepareBaseMovement();
  }

  /* -------------------------------------------- */

  /**
   * Prepare base movement attributes that are defined by the Hero's Ancestry and bonuses.
   */
  #prepareBaseMovement() {
    const m = this.movement;
    const {size, stride} = this.details.ancestry.movement;
    m.size = size + m.sizeBonus;
    m.stride = stride + m.strideBonus;
    this.size = m.size; // TODO this shouldn't exist maybe?
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
    adv.progress = adv.progress ?? 0;
    adv.next = (2 * adv.level) + 1;
    adv.pct = Math.clamp(Math.round(adv.progress * 100 / adv.next), 0, 100);
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

    // Threat level
    this.advancement.threatLevel = this.advancement.level;
    this.advancement.threatFactor = 1;

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
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Apply an Ancestry item to this Hero Actor.
   * @param {CrucibleItem} ancestry     The ancestry Item to apply to the Actor.
   * @returns {Promise<void>}
   */
  async applyAncestry(ancestry) {
    const actor = this.parent;
    await actor._applyDetailItem(ancestry, {
      canApply: actor.isL0 && !actor.points.ability.spent,
      canClear: actor.isL0
    });
  }

  /* -------------------------------------------- */

  /**
   * Apply a Background item to this Hero Actor.
   * @param {CrucibleItem} background     The background Item to apply to the Actor.
   * @returns {Promise<void>}
   */
  async applyBackground(background) {
    const actor = this.parent;
    await actor._applyDetailItem(background, {
      canApply: actor.isL0,
      canClear: actor.isL0
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this Hero Actor.
   * @returns {Record<string, string>}
   */
  getTags() {
    const tags = {};
    tags.level = `Level ${this.advancement.level}`;
    tags.signatureName = this.details.signatureName || "Unspecialized";
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
