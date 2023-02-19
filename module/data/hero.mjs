import {SYSTEM} from "../config/system.js";
import CrucibleAncestry from "./ancestry.mjs";
import CrucibleBackground from "./background.mjs";

/**
 * Data schema, attributes, and methods specific to Hero type Actors.
 */
export default class CrucibleHero extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = {};

    // Ability Scores
    const abilityField = label => new fields.SchemaField({
      base: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 3}),
      increases: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
      bonus: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
    }, {validate: CrucibleHero.#validateAttribute, label});
    schema.abilities = new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
      obj[ability.id] = abilityField(ability.label);
      return obj;
    }, {}));

    // Advancement
    schema.advancement = new fields.SchemaField({
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 24, label: "ADVANCEMENT.Level"}),
      progress: new fields.NumberField({...requiredInteger, initial: 0, min: 0, label: "ADVANCEMENT.Progress"})
    });

    // Defenses
    const defenseField = label => new fields.SchemaField({
      bonus: new fields.NumberField({...requiredInteger, initial: 0})
    }, {label});
    schema.defenses = new fields.SchemaField(Object.values(SYSTEM.DEFENSES).reduce((obj, defense) => {
      if ( defense.id !== "physical" ) obj[defense.id] = defenseField(defense.label);
      return obj;
    }, {}));

    // Details
    schema.details = new fields.SchemaField({
      ancestry: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        ...CrucibleAncestry.defineSchema()
      }),
      background: new fields.SchemaField({
        name: new fields.StringField({blank: false}),
        ...CrucibleBackground.defineSchema()
      }),
      biography: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      })
    });

    // Resistances
    schema.resistances = new fields.SchemaField(Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, damageType) => {
      obj[damageType.id] = defenseField(damageType.label);
      return obj;
    }, {}));

    // Resource Pools
    const resourceField = label => new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
    }, {label});
    schema.resources = new fields.SchemaField(Object.values(SYSTEM.RESOURCES).reduce((obj, resource) => {
      obj[resource.id] = resourceField(resource.label);
      return obj
    }, {}));

    // Skills
    const skillField = label => new fields.SchemaField({
      rank: new fields.NumberField({...requiredInteger, initial: 0, max: 5}),
      path: new fields.StringField({required: false, initial: undefined, blank: false})
    }, {label});
    schema.skills = new fields.SchemaField(Object.values(SYSTEM.SKILLS).reduce((obj, skill) => {
      obj[skill.id] = skillField(skill.label);
      return obj;
    }, {}));

    // Status
    schema.status = new fields.ObjectField({nullable: true, initial: null});
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
  /*  Prepared Attributes                         */
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
    this.#prepareAdvancement();
    this.#prepareAbilities();
    this.#prepareSkills();
  }

  /* -------------------------------------------- */

  /**
   * Compute the available points which can be spent to advance this character
   */
  #prepareAdvancement() {
    const adv = this.advancement;
    const effectiveLevel = Math.max(adv.level, 1) - 1;

    // Initialize spendable points
    this.points = {
      ability: { pool: 9, total: effectiveLevel, bought: null, spent: null, available: null },
      skill: { total: 2 + (effectiveLevel*2), spent: null, available: null },
      talent: { total: 2 + (effectiveLevel*2), spent: 0, available: null }
    };

    // Compute required advancement
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
    for ( let a in CONFIG.SYSTEM.ABILITIES ) {
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
    points.requireInput = this.isL0 ? (points.pool > 0) : (points.available !== 0);
  }

  /* -------------------------------------------- */

  /**
   * Prepare Skills.
   */
  #prepareSkills() {

    // Populate all the skills
    const ranks = SYSTEM.SKILL_RANKS;
    const ancestry = this.details.ancestry;
    const background = this.details.background;
    let pointsSpent = 0;

    // Iterate over skills
    for ( let [id, skill] of Object.entries(this.skills) ) {
      const config = SYSTEM.SKILLS[id];

      // Skill Rank
      let base = 0;
      if ( ancestry.skills?.includes(id) ) base++;
      if ( background.skills?.includes(id) ) base++;
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
    this.#preparePhysicalDefenses();
    this.#prepareSaveDefenses();
    this.#prepareHealingThresholds();
    this.#prepareResistances();
  }

  /* -------------------------------------------- */

  /**
   * Prepare resources.
   */
  #prepareResources() {
    const level = this.advancement.level;
    const statuses = this.parent.statuses;
    const a = this.abilities;
    const r = this.resources;

    // Health
    r.health.max = (4 * (level + a.toughness.value)) + (2 * (a.strength.value + a.dexterity.value));
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Wounds
    r.wounds.max = 2 * r.health.max;
    r.wounds.value = Math.clamped(r.wounds.value, 0, r.wounds.max);

    // Morale
    r.morale.max = (4 * (level + a.presence.value)) + (2 * (a.intellect.value + a.wisdom.value));
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Madness
    r.madness.max = 2 * r.morale.max;
    r.madness.value = Math.clamped(r.madness.value, 0, r.madness.max);

    // Action
    r.action.max = level > 0 ? 3 : 0;
    if ( statuses.has("stunned") ) r.action.max -= 2;
    else if ( statuses.has("staggered") ) r.action.max -= 1;
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = level === 0 ? 0
      : Math.floor(level / 2) + Math.max(a.wisdom.value, a.presence.value, a.intellect.value);
    r.focus.value = Math.clamped(r.focus.value, 0, r.focus.max);
  }

  /* -------------------------------------------- */

  /**
   * Prepare Physical Defenses.
   */
  #preparePhysicalDefenses() {
    const {abilities, defenses} = this;
    const {equipment, statuses, talentIds} = this.parent;

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

    // Patient Deflection
    if ( talentIds.has("patientdeflectio") && equipment.weapons.unarmed ) {
      defenses.parry.bonus += Math.ceil(abilities.wisdom.value / 2);
    }

    // Unarmed Blocking
    if ( talentIds.has("unarmedblocking0") && equipment.weapons.unarmed ) {
      defenses.block.bonus += Math.ceil(abilities.toughness.value / 2);
    }

    // Compute total physical defenses
    const physicalDefenses = ["dodge", "parry", "block", "armor"];
    for ( let pd of physicalDefenses ) {
      let d = defenses[pd];
      d.total = d.base + d.bonus;
    }
    if ( statuses.has("enraged") ) defenses.parry.total = defenses.block.total = 0;
    defenses.physical = physicalDefenses.reduce((v, k) => v + defenses[k].total, 0);
  }

  /* -------------------------------------------- */

  /**
   * Prepare non-physical defenses.
   */
  #prepareSaveDefenses() {
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      let d = this.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + this.abilities[a].value, SYSTEM.PASSIVE_BASE);
      d.total = d.base + d.bonus;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare healing thresholds for Wounds and Madness.
   */
  #prepareHealingThresholds() {
    const d = this.defenses;
    const r = this.resources;
    const base = SYSTEM.PASSIVE_BASE;
    d.wounds = {base, total: base + Math.floor(r.wounds.value / 10)};
    d.madness = {base, total: base + Math.floor(r.madness.value / 10)};
  }

  /* -------------------------------------------- */

  /**
   * Prepare damage resistances.
   * Apply special talents which alter base resistances.
   */
  #prepareResistances() {
    const res = this.resistances;
    const {grimoire, talentIds} = this.parent;

    // Base Resistances
    for ( const r of Object.values(res) ) r.base = 0;

    // Ancestries
    const ancestry = this.details.ancestry;
    if ( ancestry.resistance ) res[ancestry.resistance].base += SYSTEM.ANCESTRIES.resistanceAmount;
    if ( ancestry.vulnerability ) res[ancestry.vulnerability].base -= SYSTEM.ANCESTRIES.resistanceAmount;

    // Nosferatu
    if ( talentIds.has("nosferatu0000000") ) res.radiant.base -= 10;

    // Thick Skin
    if ( talentIds.has("thickskin0000000") ) {
      res.bludgeoning.base += 2;
      res.slashing.base += 2;
      res.piercing.base += 2;
    }

    // Mental Fortress
    if ( talentIds.has("mentalfortress00") ) res.psychic.base += 5;

    // Snakeblood
    if ( talentIds.has("snakeblood000000") ) res.poison.base += 5;

    // Iterate over resistances
    const hasRunewarden = talentIds.has("runewarden000000");
    for ( let [id, r] of Object.entries(res) ) {
      if ( hasRunewarden && grimoire.runes.find(r => r.damageType === id) ) r.base += 5;
      r.total = r.base + r.bonus;
    }
  }
}
