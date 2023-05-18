import CrucibleArchetype from "./archetype.mjs";
import CrucibleTaxonomy from "./taxonomy.mjs";
import {SYSTEM} from "../config/system.js";

/**
 * Data schema, attributes, and methods specific to Adversary type Actors.
 */
export default class CrucibleAdversary extends foundry.abstract.TypeDataModel {

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
      bonus: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
    }, {label});
    schema.abilities = new fields.SchemaField(Object.values(SYSTEM.ABILITIES).reduce((obj, ability) => {
      obj[ability.id] = abilityField(ability.label);
      return obj;
    }, {}));

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
      level: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
      archetype: new fields.EmbeddedDataField(CrucibleArchetype),
      stature: new fields.StringField({required: true, choices: SYSTEM.CREATURE_STATURES, initial: "medium"}),
      taxonomy: new fields.EmbeddedDataField(CrucibleTaxonomy),
      threat: new fields.StringField({required: true, choices: SYSTEM.THREAT_LEVELS, initial: "normal"}),
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
      if ( resource.type === "active" ) obj[resource.id] = resourceField(resource.label);
      return obj
    }, {}));

    // Skills
    const skillField = label => new fields.SchemaField({
      rank: new fields.NumberField({...requiredInteger, initial: 0, max: 5})
    }, {label});
    schema.skills = new fields.SchemaField(Object.values(SYSTEM.SKILLS).reduce((obj, skill) => {
      obj[skill.id] = skillField(skill.name);
      return obj;
    }, {}));

    // Status
    schema.status = new fields.ObjectField({nullable: true, initial: null});
    return schema;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.status ||= {};
    this.#prepareDetails();
    this.#prepareSkills();
  }

  /* -------------------------------------------- */

  /**
   * Apply Archetype and Taxonomy scaling to automatically configure attributes and resistances.
   */
  #prepareDetails() {
    const {archetype, level, taxonomy, threat} = this.details;
    const factor = SYSTEM.THREAT_LEVELS[threat]?.scaling || 1;
    const abilityLevel = level === 0 ? Math.round(-6 * (2 - factor)) : Math.round(level * factor);

    // Assign base taxonomy ability scores
    for ( const a of Object.keys(this.abilities) ) {
      this.abilities[a].base = taxonomy.abilities[a];
    }

    // Compute archetype scaling
    let denom = 0;
    const order = Object.keys(SYSTEM.ABILITIES).reduce((arr, k) => {
      const weight = this.abilities[k].base ? archetype.abilities[k] : 0; // Zero base gets zero weight
      denom += weight;
      arr.push({id: k, score: taxonomy.abilities[k] + archetype.abilities[k], weight});
      return arr;
    }, []).sort((a, b) => b.score - a.score);

    // Apply increases
    let spent = 0;
    for ( const o of order ) {
      const a = this.abilities[o.id];
      o.weight = o.weight / denom;
      o.raw = abilityLevel * o.weight;
      const d = o.increases = Math.floor(o.raw);
      spent += d;
      a.increases = d;
      a.value = o.weight ? Math.max(a.base + a.increases, 1) : 0;
    }

    // Allocate remainder
    let remainder = abilityLevel - spent;
    let n = 1;
    while ( remainder > 0 ) {
      for ( const o of order ) {
        const a = this.abilities[o.id];
        const nextWeight = (abilityLevel + n) * o.weight;
        if ( Math.floor(nextWeight) > a.increases ) {
          a.increases++;
          a.value++;
          remainder--
          if ( !remainder ) break;
        }
      }
      n++;
    }

    // Resistances
    const resistanceLevel = (6 + level) * factor;
    for ( const r of Object.keys(this.resistances) ) {
      const tr = taxonomy.resistances[r] || 0;
      this.resistances[r].base = tr === 0 ? 0 : Math.floor(resistanceLevel / Math.abs(tr)) * Math.sign(tr);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Skills.
   */
  #prepareSkills() {
    const ranks = SYSTEM.SKILL.RANKS;
    for ( let [id, skill] of Object.entries(this.skills) ) {
      const config = SYSTEM.SKILLS[id];
      skill.abilityBonus = this.parent.getAbilityBonus(config.abilities);
      skill.skillBonus = ranks[skill.rank].bonus;
      skill.enchantmentBonus = 0;
      skill.score = skill.abilityBonus + skill.skillBonus + skill.enchantmentBonus;
      skill.passive = SYSTEM.PASSIVE_BASE + skill.score;
    }
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
   * Prepare resource pools.
   */
  #prepareResources() {
    const statuses = this.parent.statuses;
    const threat = SYSTEM.THREAT_LEVELS[this.details.threat];
    const level = this.details.level * threat.scaling;
    const r = this.resources;
    const a = this.abilities;

    // Health
    r.health.max = (6 * level) + (4 * a.toughness.value) + (2 * a.strength.value);
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = (6 * level) + (4 * a.presence.value) + (2 * a.wisdom.value);
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = threat.actionMax;
    if ( statuses.has("stunned") ) r.action.max -= 2;
    else if ( statuses.has("staggered") ) r.action.max -= 1;
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil(level / 2) + Math.round((a.wisdom.value + a.presence.value + a.intellect.value) / 3);
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
   * Prepare non-physical defense scores.
   */
  #prepareSaveDefenses() {
    const {equipment, talentIds} = this.parent;
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      let d = this.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + this.abilities[a].value, SYSTEM.PASSIVE_BASE);
      if ( (k !== "fortitude") && talentIds.has("monk000000000000") && equipment.unarmored ) d.bonus += 2;
      d.total = d.base + d.bonus;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare healing thresholds for Wounds and Madness.
   */
  #prepareHealingThresholds() {
    const base = SYSTEM.PASSIVE_BASE;
    const d = this.defenses;
    d.wounds = {base, total: base};
    if ( this.parent.talentIds.has("resilient0000000") ) d.wounds.total -= 1;
    d.madness = {base, total: base};
    if ( this.parent.talentIds.has("carefree00000000") ) d.madness.total -= 1;
  }

  /* -------------------------------------------- */

  /**
   * Prepare damage resistances.
   * Apply special talents which alter base resistances.
   */
  #prepareResistances() {
    const res = this.resistances;
    const {grimoire, talentIds} = this.parent;

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
      if ( hasRunewarden && (SYSTEM.DAMAGE_TYPES[id].type !== "physical")
        && grimoire.runes.find(r => r.damageType === id)) r.base += 5;
      r.total = r.base + r.bonus;
    }
  }
}
