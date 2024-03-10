
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

    // Resource pools
    this._prepareResources();
    this.parent.callTalentHooks("prepareResources", this.resources);

    // Defenses
    this.#prepareDefenses();
    this.parent.callTalentHooks("prepareDefenses", this.defenses);
    this.#prepareTotalDefenses();

    // Resistances
    this.parent.callTalentHooks("prepareResistances", this.resistances);
    this.#prepareTotalResistances();

    // Movement
    this.#prepareMovement();
    this.parent.callTalentHooks("prepareMovement", this.movement);
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
    r.health.value = Math.clamp(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = Math.max(Math.ceil(6 * l) + (4 * a.presence.value) + (2 * a.wisdom.value), 6);
    r.morale.value = Math.clamp(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = maxAction ?? 12;
    if ( l < 1 ) r.action.max -= 4;
    if ( statuses.has("stunned") ) r.action.max -= 6;
    else if ( statuses.has("staggered") ) r.action.max -= 3;
    if ( this.status.impetus ) r.action.max += 1;
    if ( isWeakened ) r.action.max -= 6;
    if ( isIncapacitated ) r.action.max = 0;
    r.action.max = Math.max(r.action.max, 0);
    r.action.value = Math.clamp(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil((a.wisdom.value + a.presence.value + a.intellect.value) / 2);
    r.focus.value = Math.clamp(r.focus.value, 0, r.focus.max);
  }

  /* -------------------------------------------- */

  /**
   * Preparation of defenses for all Actor subtypes.
   * @private
   */
  #prepareDefenses() {
    this.#preparePhysicalDefenses();
    this.#prepareSaveDefenses();
    this.#prepareHealingThresholds();
  }

  /* -------------------------------------------- */

  /**
   * Prepare Physical Defenses.
   */
  #preparePhysicalDefenses() {
    const {equipment} = this.parent;
    const {abilities, defenses} = this;

    // Armor and Dodge from equipped Armor
    const armorData = equipment.armor.system;
    defenses.armor.base = armorData.armor.base;
    defenses.armor.bonus = armorData.armor.bonus;
    defenses.dodge.base = armorData.dodge.base;
    defenses.dodge.bonus = Math.max(abilities.dexterity.value - armorData.dodge.start, 0);
    defenses.dodge.max = defenses.dodge.base + (12 - armorData.dodge.start);

    // Block and Parry from equipped Weapons
    const weaponData = [equipment.weapons.mainhand.system];
    if ( !equipment.weapons.twoHanded ) weaponData.push(equipment.weapons.offhand.system);
    defenses.block = {base: 0, bonus: 0};
    defenses.parry = {base: 0, bonus: 0};
    for ( let wd of weaponData ) {
      for ( let d of ["block", "parry"] ) {
        defenses[d].base += wd.defense[d];
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare non-physical defenses.
   */
  #prepareSaveDefenses() {

    // Defense base is the system passive base of 12
    const l = this.details.threatLevel;
    let base = SYSTEM.PASSIVE_BASE;
    const {equipment, talentIds} = this.parent;

    // Adversary save penalty plus further reduction for threat level below zero
    let penalty = 0;
    if ( this.parent.type === "adversary" ) {
      penalty = 2;
      if ( l < 1 ) penalty += (1 - l);
    }

    // Prepare save defenses
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      let d = this.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + this.abilities[a].value, base);
      if ( this.parent.isIncapacitated ) d.base = base;
      d.bonus = 0 - penalty;
      if ( (k !== "fortitude") && talentIds.has("monk000000000000") && equipment.unarmored ) d.bonus += 2;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare healing thresholds for Wounds and Madness.
   */
  #prepareHealingThresholds() {
    const { defenses, resources } = this;
    const wounds = resources.wounds?.value ?? ((resources.health.max - resources.health.value) * 2);
    defenses.wounds = {base: SYSTEM.PASSIVE_BASE + Math.floor(wounds / 10), bonus: 0};
    const madness = resources.madness?.value ?? ((resources.morale.max - resources.morale.value) * 2);
    defenses.madness = {base: SYSTEM.PASSIVE_BASE + Math.floor(madness / 10), bonus: 0};
  }

  /* -------------------------------------------- */

  /**
   * Compute total defenses as base + bonus.
   */
  #prepareTotalDefenses() {
    const defenses = this.defenses;
    const {isIncapacitated, statuses} = this.parent;

    // Compute defense totals
    for ( const defense of Object.values(defenses) ) {
      defense.total = defense.base + defense.bonus;
    }

    // Cannot parry or block while enraged
    if ( statuses.has("enraged") ) defenses.parry.total = defenses.block.total = 0;

    // Cannot dodge, block, or parry while incapacitated
    if ( isIncapacitated ) defenses.dodge.total = defenses.parry.total = defenses.block.total = 0;

    // Aggregate total Physical Defense
    defenses.physical = {
      total: defenses.armor.total + defenses.dodge.total + defenses.parry.total + defenses.block.total
    };
  }

  /* -------------------------------------------- */

  /**
   * Preparation of resistances for all Actor subtypes.
   */
  #prepareTotalResistances() {
    for ( const r of Object.values(this.resistances) ) r.total = r.base + r.bonus;
  }

  /* -------------------------------------------- */

  /**
   * Preparation of movement for all Actor subtypes.
   */
  #prepareMovement() {
    const movement = this.movement;

    // Stride and free movement
    movement.free = (movement.stride * 4)

    const stature = this.details.stature;
    movement.engagement = SYSTEM.CREATURE_STATURES[stature]?.engagement ?? 1;
    const {shield, offhand} = this.parent.equipment.weapons;
    if ( shield && offhand.system.properties.has("engaging") ) movement.engagement += 1;
  }
}
