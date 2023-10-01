
/**
 * @typedef {Object} CrucibleActorSkill
 * @param {number} rank
 * @param {string} path
 * @param {number} [abilityBonus]
 * @param {number} [skillBonus]
 * @param {number} [enchantmentBonus]
 * @param {number} [score]
 * @param {number} [passive]
 * @param {number} [spent]
 * @param {number} [cost]
 */

/**
 * This class defines data schema, methods, and properties shared by all Actor subtypes in the Crucible system.
 *
 * @property {Object<string, CrucibleActorSkill>} skills
 */
export default class CrucibleActorType extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /**
   * Define shared schema elements used by every Actor sub-type in Crucible.
   * This method is extended by subclasses to add type-specific fields.
   * @override
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = {};

    // Ability Scores
    schema.abilities = new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
      obj[ability.id] = new fields.SchemaField({
        base: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 3}),
        increases: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
        bonus: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
      }, {label: ability.label});
      return obj;
    }, {}));

    // Defenses
    schema.defenses = new fields.SchemaField(Object.values(SYSTEM.DEFENSES).reduce((obj, defense) => {
      if ( defense.id !== "physical" ) obj[defense.id] = new fields.SchemaField({
        bonus: new fields.NumberField({...requiredInteger, initial: 0})
      }, {label: defense.label});
      return obj;
    }, {}));

    // Resistances
    schema.resistances = new fields.SchemaField(Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, damageType) => {
      obj[damageType.id] = new fields.SchemaField({
        bonus: new fields.NumberField({...requiredInteger, initial: 0})
      }, {label: damageType.label});
      return obj;
    }, {}));

    // Resource Pools
    schema.resources = new fields.SchemaField(Object.values(SYSTEM.RESOURCES).reduce((obj, resource) => {
      obj[resource.id] = new fields.SchemaField({
        value: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
      }, {label: resource.label});
      return obj
    }, {}));

    // Skills
    schema.skills = new fields.SchemaField(Object.values(SYSTEM.SKILLS).reduce((obj, skill) => {
      obj[skill.id] = new fields.SchemaField({
        rank: new fields.NumberField({...requiredInteger, initial: 0, max: 5}),
        path: new fields.StringField({required: false, initial: undefined, blank: false})
      }, {label: skill.name})
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

  /**
   * Base data preparation workflows used by all Actor subtypes.
   * @override
   */
  prepareBaseData() {
    this.status ||= {};
    this._prepareDetails();
    this._prepareAbilities();
    this._prepareSkills();
  }

  /* -------------------------------------------- */

  /**
   * Prepare creature details for all Actor subtypes.
   * @protected
   */
  _prepareDetails() {

  }

  /* -------------------------------------------- */

  /**
   * Prepare ability scores for all Actor subtypes.
   * @protected
   */
  _prepareAbilities() {

  }

  /* -------------------------------------------- */

  /**
   * Prepare skills data for all Actor subtypes.
   * @protected
   */
  _prepareSkills() {
    for ( const skill of Object.entries(this.skills) ) {
      this._prepareSkill(...skill);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single Skill for all Actor subtypes.
   * @param {string} skillId                The ID of the skill being configured
   * @param {CrucibleActorSkill} skill      Source data of the skill being configured
   * @protected
   */
  _prepareSkill(skillId, skill) {
    const config = SYSTEM.SKILLS[skillId];
    const r = skill.rank ||= 0;
    const ab = skill.abilityBonus = this.parent.getAbilityBonus(config.abilities);
    const sb = skill.skillBonus = SYSTEM.SKILL.RANKS[r].bonus;
    const eb = skill.enchantmentBonus = 0;
    const s = skill.score = ab + sb + eb;
    skill.passive = SYSTEM.PASSIVE_BASE + s;
  }

  /* -------------------------------------------- */

  /**
   * Derived data preparation workflows used by all Actor subtypes.
   * @override
   */
  prepareDerivedData() {
    this._prepareResources();
    this.parent.callTalentHooks("prepareResources", this.resources);
    this.parent._prepareDefenses();
    this.parent._prepareResistances();
    this.parent._prepareMovement();
  }

  /* -------------------------------------------- */

  /**
   * Preparation of resource pools for all Actor subtypes.
   * @protected
   */
  _prepareResources() {
    const {isIncapacitated, isWeakened, statuses} = this.parent;
    const {maxAction, threatLevel: l} = this.details;
    const r = this.resources;
    const a = this.abilities;

    // Health
    r.health.max = Math.max(Math.ceil(6 * l) + (4 * a.toughness.value) + (2 * a.strength.value), 6);
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = Math.max(Math.ceil(6 * l) + (4 * a.presence.value) + (2 * a.wisdom.value), 6);
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = maxAction ?? 3;
    if ( l < 1 ) r.action.max -= 1;
    if ( statuses.has("stunned") ) r.action.max -= 2;
    else if ( statuses.has("staggered") ) r.action.max -= 1;
    if ( this.status.impetus ) r.action.max += 1;
    if ( isWeakened ) r.action.max -= 1;
    if ( isIncapacitated ) r.action.max = 0;
    r.action.max = Math.max(r.action.max, 0);
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil((a.wisdom.value + a.presence.value + a.intellect.value) / 2);
    r.focus.value = Math.clamped(r.focus.value, 0, r.focus.max);
  }

  /* -------------------------------------------- */

}
