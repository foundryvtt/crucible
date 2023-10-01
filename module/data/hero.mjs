import CrucibleActorType from "./actor-type.mjs";
import CrucibleAncestry from "./ancestry.mjs";
import CrucibleBackground from "./background.mjs";

/**
 * Data schema, attributes, and methods specific to Hero type Actors.
 */
export default class CrucibleHero extends CrucibleActorType {

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
      abilityField.options.validate = CrucibleHero.#validateAttribute;
    }

    // Advancement
    schema.advancement = new fields.SchemaField({
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 24, label: "ADVANCEMENT.Level"}),
      progress: new fields.NumberField({...requiredInteger, initial: 0, min: 0, label: "ADVANCEMENT.Progress"})
    });

    // Details
    schema.details = new fields.SchemaField({
      ancestry: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleAncestry.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      background: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        img: new fields.StringField(),
        ...CrucibleBackground.defineSchema()
      }, {required: true, nullable: true, initial: null}),
      biography: new fields.SchemaField({
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
   *   ability: {pool: number, total: number, bought: number, spent: number, available: number },
   *   skill: {total: number, spent: number, available: number },
   *   talent: {total: number, spent: number, available: number }
   * }}
   */
  points;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.status ||= {};
    this.#prepareDetails();
    this.#prepareAdvancement();
    this.#prepareAbilities();
    this.#prepareSkills();
  }

  /* -------------------------------------------- */

  #prepareDetails() {
    const a = this.details.ancestry ||= this.schema.getField("details.ancestry").initialize({});
    this.details.background ||= this.schema.getField("details.background").initialize({});

    // Threat level, for comparison vs. adversaries
    this.details.threatLevel = this.details.fractionLevel = this.advancement.level;

    // Base Resistances
    const res = this.resistances;
    for ( const r of Object.values(res) ) r.base = 0;
    if ( a.resistance ) res[a.resistance].base += SYSTEM.ANCESTRIES.resistanceAmount;
    if ( a.vulnerability ) res[a.vulnerability].base -= SYSTEM.ANCESTRIES.resistanceAmount;
  }

  /* -------------------------------------------- */

  /**
   * Compute the available points which can be spent to advance this character
   */
  #prepareAdvancement() {
    const adv = this.advancement;
    const effectiveLevel = Math.max(adv.level, 1) - 1;
    this.points = {
      ability: { pool: 9, total: effectiveLevel, bought: null, spent: null, available: null },
      skill: { total: 2 + (effectiveLevel*2), spent: null, available: null },
      talent: { total: 2 + (effectiveLevel*2), spent: 0, available: null }
    };
    adv.progress = adv.progress ?? 0;
    adv.next = (2 * adv.level) + 1;
    adv.pct = Math.clamped(Math.round(adv.progress * 100 / adv.next), 0, 100);
  }

  /* -------------------------------------------- */

  /**
   * Prepare ability scores.
   */
  #prepareAbilities() {
    const points = this.points.ability;
    const ancestry = this.details.ancestry;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in SYSTEM.ABILITIES ) {
      const ability = this.abilities[a];

      // Configure initial value
      ability.initial = 1;
      if ( a === ancestry.primary ) ability.initial = SYSTEM.ANCESTRIES.primaryAbilityStart;
      else if ( a === ancestry.secondary ) ability.initial = SYSTEM.ANCESTRIES.secondaryAbilityStart;
      ability.value = Math.clamped(ability.initial + ability.base + ability.increases + ability.bonus, 0, 12);

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
   * Prepare Skills for a Protagonist.
   */
  #prepareSkills() {

    // Populate all the skills
    const ranks = SYSTEM.SKILL.RANKS;
    const background = this.details.background;
    let pointsSpent = 0;

    // Iterate over skills
    for ( let [id, skill] of Object.entries(this.skills) ) {
      const config = SYSTEM.SKILLS[id];

      // Skill Rank
      let base = 0;
      if ( background?.skills.has(id) ) base++;
      skill.rank = Math.max(skill.rank || 0, base);

      // Point Cost
      const rank = ranks[skill.rank];
      skill.spent = rank.spent - base;
      pointsSpent += skill.spent;
      const next = ranks[skill.rank + 1] || {cost: null};
      skill.cost = next.cost;

      // Bonuses
      const attrs = config.abilities.map(a => this.abilities[a].value);
      skill.abilityBonus = Math.ceil(0.5 * (attrs[0] + attrs[1]));
      skill.skillBonus = ranks[skill.rank].bonus;
      skill.enchantmentBonus = 0;
      skill.score = skill.abilityBonus + skill.skillBonus + skill.enchantmentBonus;
      skill.passive = SYSTEM.PASSIVE_BASE + skill.score;
    }

    // Update available skill points
    const points = this.points;
    points.skill.spent = pointsSpent;
    points.skill.available = points.skill.total - points.skill.spent;
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
   * Prepare resources.
   */
  #prepareResources() {
    const level = this.advancement.level;
    const {status, statuses, isIncapacitated, isWeakened} = this.parent;
    const a = this.abilities;
    const r = this.resources;

    // Health
    r.health.max = (6 * level) + (4 * a.toughness.value) + (2 * a.strength.value);
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Wounds
    r.wounds.max = Math.ceil(1.5 * r.health.max);
    r.wounds.value = Math.clamped(r.wounds.value, 0, r.wounds.max);

    // Morale
    r.morale.max = (6 * level) + (4 * a.presence.value) + (2 * a.wisdom.value);
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Madness
    r.madness.max = Math.ceil(1.5 * r.morale.max);
    r.madness.value = Math.clamped(r.madness.value, 0, r.madness.max);

    // Action
    r.action.max = level > 0 ? 3 : 0;
    if ( statuses.has("stunned") ) r.action.max -= 2;
    else if ( statuses.has("staggered") ) r.action.max -= 1;
    if ( status.impetus ) r.action.max += 1;
    if ( isWeakened ) r.action.max -= 1;
    if ( isIncapacitated ) r.action.max = 0;
    r.action.max = Math.max(r.action.max, 0);
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil((a.wisdom.value + a.presence.value + a.intellect.value) / 2);
    r.focus.value = Math.clamped(r.focus.value, 0, r.focus.max);
    this.parent.callTalentHooks("prepareResources", r);
  }

  /* -------------------------------------------- */
  /*  Hero Specific Helper Methods                */
  /* -------------------------------------------- */

  /**
   * Apply an Ancestry item to this Hero Actor.
   * @param {object|null} itemData  The ancestry data to apply to the Actor.
   * @returns {Promise<void>}
   */
  async applyAncestry(itemData) {
    const actor = this.parent;
    await actor._applyDetailItem(itemData, "ancestry", {
      canApply: actor.isL0 && !actor.points.ability.spent,
      canClear: actor.isL0
    });
  }

  /* -------------------------------------------- */

  /**
   * Apply a Background item to this Hero Actor.
   * @param {object|null} itemData    The background data to apply to the Actor.
   * @returns {Promise<void>}
   */
  async applyBackground(itemData) {
    const actor = this.parent;
    await actor._applyDetailItem(itemData, "background", {
      canApply: actor.isL0 && !actor.points.skill.spent,
      canClear: actor.isL0
    });
  }
}
