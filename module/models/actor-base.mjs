/**
 * @typedef CrucibleActorEquipment
 * @property {CrucibleItem} armor
 * @property {CrucibleActorEquippedWeapons} weapons
 * @property {CrucibleItem[]} accessories
 */

/**
 * @typedef CrucibleActorEquippedWeapons
 * @property {CrucibleItem} mainhand
 * @property {CrucibleItem} offhand
 * @property {boolean} freehand
 * @property {number} spellHands
 * @property {boolean} unarmed
 * @property {boolean} shield
 * @property {boolean} twoHanded
 * @property {boolean} melee
 * @property {boolean} ranged
 * @property {boolean} dualWield
 * @property {boolean} dualMelee
 * @property {boolean} dualRanged
 * @property {boolean} slow
 */

/**
 * @typedef CrucibleActorSkill
 * @property {number} rank
 * @property {number} abilityBonus
 * @property {number} skillBonus
 * @property {number} enchantmentBonus
 * @property {number} score
 * @property {number} passive
 */

/**
 * @typedef CrucibleActorGrimoire
 * @property {Set<CrucibleSpellcraftRune>} runes
 * @property {Set<CrucibleSpellcraftGesture>} gestures
 * @property {Set<CrucibleSpellcraftInflection>} inflections
 * @property {number} iconicSlots
 * @property {CrucibleItem[]} iconicSpells
 */

import CrucibleAction from "./action.mjs";

/**
 * This class defines data schema, methods, and properties shared by all Actor subtypes in the Crucible system.
 */
export default class CrucibleBaseActor extends foundry.abstract.TypeDataModel {

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
        value: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: resource.max})
      }, {label: resource.label});
      return obj
    }, {}));

    // Movement Attributes
    schema.movement = new fields.SchemaField({
      sizeBonus: new fields.NumberField({...requiredInteger, initial: 0}),
      strideBonus: new fields.NumberField({...requiredInteger, initial: 0}),
      engagementBonus: new fields.NumberField({...requiredInteger, initial: 0})
    });

    // Status
    schema.status = new fields.ObjectField({nullable: true, initial: null});
    schema.favorites = new fields.SetField(new fields.StringField({blank: false}));
    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTOR"];

  /* -------------------------------------------- */
  /*  Derived Data Attributes                     */
  /* -------------------------------------------- */

  /**
   * Track the Actions which this Actor has available to use
   * @type {Object<string, CrucibleAction>}
   */
  actions = this["actions"];

  /**
   * Talent hook functions which apply to this Actor based on their set of owned Talents.
   * @type {Object<string, {talent: CrucibleItem, fn: Function}[]>}
   */
  actorHooks = this["actorHooks"];

  /**
   * Track the Items which are currently equipped for the Actor.
   * @type {CrucibleActorEquipment}
   */
  equipment = this["equipment"];

  /**
   * The grimoire of known spellcraft components.
   * @type {CrucibleActorGrimoire}
   */
  grimoire = this["grimoire"];

  /**
   * A set of Talent IDs which cannot be removed from this Actor because they come from other sources.
   * @type {Set<string>}
   */
  permanentTalentIds = this["permanentTalentIds"];

  /**
   * Temporary roll bonuses this actor has outside the fields of its data model.
   * @type {{[damage]: Object<string, number>, [boons]: Object<string, DiceBoon>, [banes]: Object<string, DiceBoon>}}
   */
  rollBonuses = this["rollBonuses"];

  /**
   * Prepared skill data for the Actor.
   * @type {Record<string, CrucibleActorSkill>}
   */
  skills = this["skills"];

  /**
   * The IDs of purchased talents.
   * @type {Set<string>}
   */
  talentIds = this["talentIds"];

  /**
   * The Talents owned by this Actor, organized according to node of the talent tree.
   * @type {Record<string, Set<string>>}
   */
  talentNodes = this["talentNodes"];

  /**
   * Prepared training data for the Actor.
   * @type {Record<keyof TRAINING_TYPES, 0|1|2|3>}
   */
  training = this["training"];

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Is this Actor weakened?
   * @type {boolean}
   */
  get isWeakened() {
    return this.resources.health.value === 0;
  }

  /**
   * Is this Actor broken?
   * @type {boolean}
   */
  get isBroken() {
    return this.resources.morale.value === 0;
  }

  /**
   * Is this Actor dead?
   * @type {boolean}
   */
  get isDead() {
    return this.resources.wounds.value === this.resources.wounds.max;
  }

  /**
   * Is this Actor incapacitated and unable to act?
   * @type {boolean}
   */
  get isIncapacitated() {
    return this.isDead || this.parent.statuses.has("unconscious") || this.parent.statuses.has("paralyzed");
  }

  /**
   * Is this Actor insane?
   * @type {boolean}
   */
  get isInsane() {
    return this.resources.madness.value === this.resources.madness.max;
  }

  /**
   * Does the Actor currently have a free move available?
   * @returns {boolean}
   */
  get hasFreeMove() {
    return this.equipment.canFreeMove && !this.parent.status.hasMoved;
  }

  /* -------------------------------------------- */
  /*  Base Data Preparation                       */
  /* -------------------------------------------- */

  /**
   * Base data preparation workflows for each Actor subtype.
   * @override
   */
  prepareBaseData() {
    this.#clear();
    this._prepareDetails();
    this._prepareAbilities();
    this._prepareBaseMovement();
  }

  /* -------------------------------------------- */

  /**
   * Clear derived Actor data, preserving references to existing objects.
   */
  #clear() {
    const createOrEmpty = name => {
      this[name] ||= {};
      for ( const k in this[name] ) delete this[name][k];
    }
    const objects = ["actions", "actorHooks", "equipment", "rollBonuses", "talentNodes", "training", "skills"];
    for ( const name of objects ) createOrEmpty(name);
    this.talentIds ||= new Set();
    this.talentIds.clear();
    this.grimoire ||= {runes: new Set(), gestures: new Set(), inflections: new Set(), iconicSlots: 0, iconicSpells: []};
    this.grimoire.runes.clear();
    this.grimoire.gestures.clear();
    this.grimoire.inflections.clear();
    this.grimoire.iconicSlots = 0;
    this.grimoire.iconicSpells.length = 0;
    this.permanentTalentIds ||= new Set();
    this.permanentTalentIds.clear();
    Object.assign(this.rollBonuses, {damage: {}, boons: {}, banes: {}});
    if ( this.status === null ) this.status = {};
  }

  /* -------------------------------------------- */

  /**
   * Prepare basic movement attributes for all Actor subtypes.
   * @protected
   */
  _prepareBaseMovement() {}

  /* -------------------------------------------- */

  /**
   * Prepare creature details for all Actor subtypes.
   * @protected
   */
  _prepareDetails() {}

  /* -------------------------------------------- */

  /**
   * Prepare ability scores for all Actor subtypes.
   * @protected
   */
  _prepareAbilities() {}

  /* -------------------------------------------- */
  /*  Embedded Document Preparation               */
  /* -------------------------------------------- */

  /**
   * Prepare embedded Item documents for this Actor subtype.
   * @param {Record<string, CrucibleItem[]>} items
   */
  prepareItems(items) {
    this.#prepareTalents(items.talent);
    this.#prepareSkills();
    this.parent.callActorHooks("prepareTraining", this.training); // FIXME maybe delete this hook?
    this.#prepareSpells(items.spell);
    this.#prepareEquipment(items);
  }

  /* -------------------------------------------- */

  /**
   * Prepare owned Talent items that the Actor has unlocked
   * @param {CrucibleItem[]} talents
   */
  #prepareTalents(talents) {
    const details = this.details;
    const signatureNames = new Set();

    // Identify permanent talents from a background, taxonomy, archetype, etc...
    const permanentTalentSources = [details.ancestry, details.background, details.taxonomy, details.archetype];
    const maybePermanentTalentIds = new Set();
    for ( const s of permanentTalentSources ) {
      if ( !s?.talents ) continue;
      for ( const uuid of s.talents ) {
        const {documentId} = foundry.utils.parseUuid(uuid);
        maybePermanentTalentIds.add(documentId);
      }
    }

    // Iterate over talents
    for ( const t of talents ) {
      this.talentIds.add(t.id);
      if ( maybePermanentTalentIds.has(t.id) ) this.permanentTalentIds.add(t.id);
      const {actorHooks, nodes, training, gesture, inflection, rune, iconicSpells} = t.system;

      // Register hooks
      for ( const hook of actorHooks ) this._registerActorHook(t, hook);

      // Register nodes
      for ( const node of nodes ) {
        this.talentNodes[node.id] ||= new Set();
        this.talentNodes[node.id].add(t.id);
        if ( node.type === "signature" ) signatureNames.add(t.name);
      }

      // Register training ranks
      if ( training.type ) {
        this.training[training.type] ??= 0;
        this.training[training.type] = Math.max(this.training[training.type], training.rank ?? 0);
      }

      // Register spellcraft knowledge
      if ( rune ) {
        this.grimoire.runes.add(SYSTEM.SPELL.RUNES[rune]);
        this.grimoire.gestures.add(SYSTEM.SPELL.GESTURES.touch);
      }
      if ( gesture ) this.grimoire.gestures.add(SYSTEM.SPELL.GESTURES[gesture]);
      if ( inflection ) this.grimoire.inflections.add(SYSTEM.SPELL.INFLECTIONS[inflection]);
      if ( iconicSpells ) this.grimoire.iconicSlots += iconicSpells;
    }

    // Compose Signature Name
    details.signatureName = Array.from(signatureNames).sort((a, b) => a.localeCompare(b)).join(" ");
  }

  /* -------------------------------------------- */

  /**
   * Prepare skills data for all Actor subtypes.
   */
  #prepareSkills() {
    for ( const [skillId, config] of Object.entries(SYSTEM.SKILLS) ) {
      this.skills[skillId] = this._prepareSkill(config);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare iconic spells known by this Actor.
   * @param {CrucibleItem[]} spells
   */
  #prepareSpells(spells) {
    for ( const spell of spells ) {
      spell.system.isKnown = spell.system.canKnowSpell(this.grimoire);
      this.grimoire.iconicSpells.push(spell);
      for ( const hook of spell.system.actorHooks ) this._registerActorHook(spell, hook);
    }
  }

  /* -------------------------------------------- */

  /**
   * Classify the Items in the Actor's inventory to identify current equipment.
   * @param {Record<string, CrucibleItem[]>} items
   * @param {CrucibleItem[]} items.armor
   * @param {CrucibleItem[]} items.weapon
   * @param {CrucibleItem[]} items.accessory
   * @returns {CrucibleActorEquipment}
   */
  #prepareEquipment({armor: armorItems, weapon: weaponItems, accessory: accessoryItems}={}) {
    const armor = this._prepareArmor(armorItems);
    const weapons = this._prepareWeapons(weaponItems);
    const accessories = []; // TODO Equipped Accessories
    const canFreeMove = this.#canFreeMove(armor);
    const unarmored = armor.system.category === "unarmored";
    Object.assign(this.equipment, {armor, weapons, accessories, canFreeMove, unarmored});
  }

  /* -------------------------------------------- */

  /**
   * Prepare the Armor item that this Actor has equipped.
   * @param {CrucibleItem[]} armorItems       The armor type Items in the Actor's inventory
   * @returns {CrucibleItem}                  The armor Item which is equipped
   * @private
   */
  _prepareArmor(armorItems) {
    let armors = armorItems.filter(i => i.system.equipped);
    if ( armors.length > 1 ) {
      console.warn(`Crucible | Actor [${this.parent.uuid}] ${this.name} has more than one equipped armor.`);
      armors = armors[0];
    }
    return armors[0] || crucible.api.models.CrucibleArmorItem.getUnarmoredArmor(this.parent);
  }

  /* -------------------------------------------- */

  /**
   * Determine whether the Actor is able to use a free move once per round.
   * @param {CrucibleItem} armor    The equipped Armor item.
   * @returns {boolean}             Can the Actor use a free move?
   */
  #canFreeMove(armor) {
    if ( this.parent.isWeakened ) return false;
    if ( this.parent.statuses.has("prone") ) return false;
    return (armor.system.category !== "heavy") || this.talentIds.has("armoredefficienc");
  }

  /* -------------------------------------------- */

  /**
   * Prepare the Armor item that this Actor has equipped.
   * @param {CrucibleItem[]} weaponItems      The Weapon type Items in the Actor's inventory
   * @returns {CrucibleActorEquippedWeapons}  The currently equipped weaponry for the Actor
   * @private
   */
  _prepareWeapons(weaponItems) {
    const slotInUse = (item, type) => {
      item.updateSource({"system.equipped": false});
      const w = game.i18n.format("WARNING.CannotEquipSlotInUse", {actor: this.parent.name, item: item.name, type});
      console.warn(w);
    }

    // Identify equipped weapons which may populate weapon slots
    const equippedWeapons = {mh: [], oh: [], either: []};
    const slots = SYSTEM.WEAPON.SLOTS;
    for ( let w of weaponItems ) {
      const {equipped, slot} = w.system;
      if ( !equipped ) continue;
      if ( [slots.MAINHAND, slots.TWOHAND].includes(slot) ) equippedWeapons.mh.unshift(w);
      else if ( slot === slots.OFFHAND ) equippedWeapons.oh.unshift(w);
      else if ( slot === slots.EITHER ) equippedWeapons.either.unshift(w);
    }
    equippedWeapons.either.sort((a, b) => b.system.damage.base - a.system.damage.base);

    // Assign weapons to equipment slots
    const weapons = {};
    let mhOpen = true;
    let ohOpen = true;

    // Mainhand Weapon
    for ( const w of equippedWeapons.mh ) {
      if ( !mhOpen ) slotInUse(w, "mainhand");
      else {
        weapons.mainhand = w;
        mhOpen = false;
        if ( w.system.slot === slots.TWOHAND ) ohOpen = false;
      }
    }

    // Offhand Weapon
    for ( const w of equippedWeapons.oh ) {
      if ( !ohOpen ) slotInUse(w, "offhand");
      else {
        weapons.offhand = w;
        ohOpen = false;
      }
    }

    // Either-hand Weapons
    for ( const w of equippedWeapons.either ) {
      if ( mhOpen ) {
        weapons.mainhand = w;
        w.system.slot = slots.MAINHAND;
        mhOpen = false;
      }
      else if ( ohOpen ) {
        weapons.offhand = w;
        w.system.slot = slots.OFFHAND;
        ohOpen = false;
      }
      else slotInUse(w, "mainhand");
    }

    // Final weapon preparation
    if ( !weapons.mainhand ) weapons.mainhand = this.#getUnarmedWeapon();
    const mh = weapons.mainhand;
    const mhCategory = mh.config.category;
    if ( !weapons.offhand ) weapons.offhand =  mhCategory.hands < 2 ? this.#getUnarmedWeapon() : null;
    const oh = weapons.offhand;
    const ohCategory = oh?.config.category || {};
    mh.system.prepareEquippedData();
    oh?.system.prepareEquippedData();

    // Range
    const ranges = [mh.system.range];
    if ( oh ) ranges.push(oh.system.range);
    weapons.maxRange = Math.max(...ranges);

    // Free Hand or Unarmed
    const mhFree = ["unarmed", "natural"].includes(mhCategory.id);
    const ohFree = ["unarmed", "natural"].includes(ohCategory.id);
    weapons.freehand = mhFree || ohFree;
    weapons.unarmed = mhFree && ohFree;

    // Hands available for spellcasting
    weapons.spellHands = mhFree + ohFree;
    if ( ["talisman1", "talisman2"].includes(mhCategory.id) ) {
      weapons.spellHands += mhCategory.hands;
      weapons.talisman = true;
    }
    if ( "talisman1" === ohCategory.id ) {
      weapons.spellHands += 1;
      weapons.talisman = true;
    }

    // Shield
    weapons.shield = (ohCategory.id === "shieldLight") || (ohCategory.id === "shieldHeavy");

    // Two-Handed
    weapons.twoHanded = weapons.mainhand.system.slot === slots.TWOHAND;

    // Melee vs. Ranged
    weapons.melee = !mhCategory.ranged;
    weapons.ranged = !!mhCategory.ranged;

    // Dual Wielding
    weapons.dualWield = weapons.unarmed || ((mhCategory.hands === 1) && mh.id && (oh.id && !weapons.shield));
    weapons.dualMelee = weapons.dualWield && !(mhCategory.ranged || ohCategory.ranged);
    weapons.dualRanged = (mhCategory.hands === 1) && mhCategory.ranged && ohCategory.ranged;

    // Special Properties
    weapons.reload = mhCategory.reload || ohCategory.reload;
    weapons.slow = mh.system.properties.has("oversized") ? 1 : 0;
    weapons.slow += oh?.system.properties.has("oversized") ? 1 : 0;

    // Strong Grip
    if ( this.talentIds.has("stronggrip000000") && weapons.twoHanded ) {
      weapons.freehand = true;
      if ( mhCategory.id !== "talisman2" ) weapons.spellHands += 1;
    }
    return weapons;
  }

  /* -------------------------------------------- */

  /**
   * Get the default unarmed weapon used by this Actor if they do not have other weapons equipped.
   * @returns {CrucibleItem}
   */
  #getUnarmedWeapon() {
    const itemCls = getDocumentClass("Item");
    const data = foundry.utils.deepClone(SYSTEM.WEAPON.UNARMED_DATA);
    if ( this.talentIds.has("martialartist000") ) data.system.quality = "fine";
    const unarmed = new itemCls(data, {parent: this.parent});
    unarmed.prepareData(); // Needs to be explicitly called since we are in the middle of Actor preparation
    return unarmed;
  }

  /* -------------------------------------------- */
  /*  Derived Data Preparation                    */
  /* -------------------------------------------- */

  /**
   * Derived data preparation workflows for each Actor subtype.
   * @override
   */
  prepareDerivedData() {

    // Movement and Size
    this._prepareMovement();
    this.parent.callActorHooks("prepareMovement", this.movement);

    // Resource pools
    this._prepareResources();
    this.parent.callActorHooks("prepareResources", this.resources);

    // Defenses
    this.#prepareDefenses();
    this.parent.callActorHooks("prepareDefenses", this.defenses);
    this.#prepareTotalDefenses();

    // Resistances
    this.parent.callActorHooks("prepareResistances", this.resistances);
    this.#prepareTotalResistances();

    // Actions
    this.#prepareActions();
    this.parent.callActorHooks("prepareActions", this.actions);
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single Skill.
   * @param {CrucibleSkillConfig} config    System configuration data of the skill being configured
   * @returns {CrucibleActorSkill}
   * @protected
   */
  _prepareSkill(config) {
    const rank = this.training[config.id] ?? 0;
    const abilityBonus = this.parent.getAbilityBonus(config.abilities);
    const skillBonus = SYSTEM.TALENT.TRAINING_RANK_VALUES[rank].bonus;
    const enchantmentBonus = 0;
    const score = abilityBonus + skillBonus + enchantmentBonus;
    const passive = SYSTEM.PASSIVE_BASE + score;
    return {rank, abilityBonus, skillBonus, enchantmentBonus, score, passive};
  }

  /* -------------------------------------------- */

  /**
   * Preparation of resource pools for all Actor subtypes.
   * @protected
   */
  _prepareResources() {
    const {isIncapacitated, isWeakened, statuses} = this.parent;
    const {level: l, threatFactor, maxAction=6} = this.advancement;
    const r = this.resources;
    const a = this.abilities;

    // Health
    let levelBase = Math.max(Math.ceil(6 * l), 6);
    r.health.max = (levelBase + (4 * a.toughness.value) + (2 * a.strength.value)) * threatFactor;
    r.health.value = Math.clamp(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = (levelBase + (4 * a.presence.value) + (2 * a.wisdom.value)) * threatFactor;
    r.morale.value = Math.clamp(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = maxAction + (r.action.bonus || 0);
    if ( statuses.has("stunned") ) r.action.max -= 4;
    else if ( statuses.has("staggered") ) r.action.max -= 2;
    if ( this.status.impetus ) r.action.max += 1;
    if ( isWeakened ) r.action.max -= 2;
    if ( isIncapacitated ) r.action.max = 0;
    r.action.max = Math.max(r.action.max, 0);
    r.action.value = Math.clamp(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.ceil((a.wisdom.value + a.presence.value + a.intellect.value) / 2);
    r.focus.value = Math.clamp(r.focus.value, 0, r.focus.max);

    // Heroism
    r.heroism.max = 3;
    r.heroism.value = Math.clamp(r.heroism.value, 0, 3);
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
    const {equipment, statuses} = this.parent;
    const {abilities, defenses} = this;

    // Armor and Dodge from equipped Armor
    const armorData = equipment.armor.system;
    defenses.armor.base = armorData.armor.base;
    defenses.armor.bonus = armorData.armor.bonus;
    defenses.dodge.base = armorData.dodge.base;
    defenses.dodge.bonus = Math.max(abilities.dexterity.value - armorData.dodge.scaling, 0);
    defenses.dodge.max = defenses.dodge.base + (12 - armorData.dodge.scaling);

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

    // Status Conditions
    if ( statuses.has("exposed") ) defenses.armor.base = Math.max(defenses.armor.base - 2, 0);
  }

  /* -------------------------------------------- */

  /**
   * Prepare non-physical defenses.
   */
  #prepareSaveDefenses() {
    const {equipment, talentIds} = this.parent;

    // Defense base is the system passive base of 12
    const base = SYSTEM.PASSIVE_BASE;
    const penalty = Math.min(this.advancement.level, 0);

    // Prepare save defenses
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      let d = this.defenses[k];
      d.base = base;
      if ( !this.parent.isIncapacitated ) d.base += this.parent.getAbilityBonus(sd.abilities);
      d.bonus = penalty;
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
   * Preparation of derived movement for all Actor subtypes.
   */
  _prepareMovement() {
    const m = this.movement;
    m.size = m.baseSize + m.sizeBonus;
    m.stride = m.baseStride + m.strideBonus;
    m.free = m.stride;
    m.engagement = 1; // Default engagement is size-2 with a minimum of 1.
    const {shield, offhand} = this.parent.equipment.weapons;
    if ( shield && offhand.system.properties.has("engaging") ) m.engagement += 1;
  }

  /* -------------------------------------------- */

  /**
   * Prepare Actions which this Actor may actively use.
   */
  #prepareActions() {
    this.#prepareDefaultActions();
    const items = this.parent.itemTypes;
    for ( const item of items.talent ) this.#registerItemActions(item);
    for ( const item of items.weapon ) {
      if ( item.system.equipped ) this.#registerItemActions(item);
    }
    for ( const item of items.armor ) {
      if ( item.system.equipped ) this.#registerItemActions(item);
    }
    for ( const item of items.spell ) this.#registerItemActions(item);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the set of default actions that every Actor can perform.
   */
  #prepareDefaultActions() {
    const w = this.equipment.weapons;
    for ( let ad of SYSTEM.ACTION.DEFAULT_ACTIONS ) {
      if ( (ad.id === "cast") && !(this.grimoire.gestures.size && this.grimoire.runes.size) ) continue;
      if ( (ad.id === "reload") && !w.reload ) continue;
      if ( (ad.id === "refocus") && !w.talisman ) continue;
      ad = foundry.utils.deepClone(ad);
      ad.tags ||= [];

      // Customize strike tags
      if ( ["strike", "reactiveStrike"].includes(ad.id) ) {
        if ( w.melee ) ad.tags.push("melee");
        if ( w.ranged ) ad.tags.push("ranged");
        ad.tags.push(w.twoHanded ? "twohand" : "mainhand");
      }

      // Create the action
      const action = new CrucibleAction(ad, {actor: this.parent});
      action._initialize({});
      this.actions[action.id] = action;
    }
  }

  /* -------------------------------------------- */

  /**
   * Register and bind Actions provided by an Item.
   * @param {CrucibleItem} item
   */
  #registerItemActions(item) {
    for ( const action of item.actions ) {
      this.actions[action.id] = action.bind(this.parent);
    }
  }

  /* -------------------------------------------- */
  /*  Actor Hooks                                 */
  /* -------------------------------------------- */

  /**
   * Register a hooked function declared by a Talent item.
   * @param {CrucibleItem} talent   The Talent registering the hook
   * @param {object} data           Registered hook data
   * @param {string} data.hook        The hook name
   * @param {string} data.fn          The hook function
   * @internal
   */
  _registerActorHook(talent, {hook, fn}={}) {
    const hookConfig = SYSTEM.ACTOR.HOOKS[hook];
    if ( !hookConfig ) throw new Error(`Invalid Actor hook name "${hook}" defined by Talent "${talent.id}"`);
    this.actorHooks[hook] ||= [];
    this.actorHooks[hook].push({talent, fn: new Function("actor", ...hookConfig.argNames, fn)});
  }
}
