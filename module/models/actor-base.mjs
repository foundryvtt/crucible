import CrucibleAction from "./action.mjs";
import CruciblePhysicalItem from "./item-physical.mjs";

/**
 * @typedef CrucibleActorEquipment
 * @property {CrucibleItem} armor
 * @property {CrucibleActorEquippedWeapons} weapons
 * @property {CrucibleItem[]} toolbelt
 * @property {number} accessorySlots
 * @property {number} toolbeltSlots
 * @property {boolean} canFreeMove
 * @property {boolean} unarmored
 */

/**
 * @typedef CrucibleActorEquippedWeapons
 * @property {CrucibleItem} mainhand
 * @property {CrucibleItem} offhand
 * @property {number} freeHands
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
 * @property {string[]} runeIds
 * @property {string[]} gestureIds
 * @property {string[]} inflectionIds
 * @property {Map<string,CrucibleSpellcraftRune>} runes
 * @property {Map<string,CrucibleSpellcraftGesture>} gestures
 * @property {Map<string,CrucibleSpellcraftInflection>} inflections
 * @property {number} iconicSlots
 * @property {number} iconicFreeComponents
 * @property {CrucibleItem[]} iconicSpells
 */

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
        bonus: new fields.NumberField({...requiredInteger, initial: 0}),
        immune: new fields.BooleanField()
      }, {label: damageType.label});
      return obj;
    }, {}));

    // Resource Pools
    schema.resources = new fields.SchemaField(Object.values(SYSTEM.RESOURCES).reduce((obj, resource) => {
      const initial = resource.type === "active" ? 1 : 0; // Avoid starting as weakened, broken, etc...
      obj[resource.id] = new fields.SchemaField({
        value: new fields.NumberField({...requiredInteger, initial, min: 0, max: resource.max})
      }, {label: resource.label});
      return obj;
    }, {}));

    // Movement Attributes
    schema.movement = new fields.SchemaField({
      sizeBonus: new fields.NumberField({...requiredInteger, initial: 0}),
      strideBonus: new fields.NumberField({...requiredInteger, initial: 0}),
      engagementBonus: new fields.NumberField({...requiredInteger, initial: 0})
    });

    // Currency
    schema.currency = new fields.NumberField({...requiredInteger, min: 0, initial: 0});

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
  actions = this.actions;

  /**
   * Actor hook functions which apply to this Actor.
   * @type {Object<string, {item: CrucibleItem, fn: Function}[]>}
   */
  actorHooks = this.actorHooks;

  /**
   * Track the Items which are currently equipped for the Actor.
   * @type {CrucibleActorEquipment}
   */
  equipment = this.equipment;

  /**
   * The grimoire of known spellcraft components.
   * @type {CrucibleActorGrimoire}
   */
  grimoire = this.grimoire;

  /**
   * A set of Talent IDs which cannot be removed from this Actor because they come from other sources.
   * @type {Set<string>}
   */
  permanentTalentIds = this.permanentTalentIds;

  /**
   * Temporary roll bonuses this actor has outside the fields of its data model.
   * @type {{[damage]: Object<string, number>, [boons]: Object<string, DiceBoon>, [banes]: Object<string, DiceBoon>}}
   */
  rollBonuses = this.rollBonuses;

  /**
   * Prepared skill data for the Actor.
   * @type {Record<string, CrucibleActorSkill>}
   */
  skills = this.skills;

  /**
   * The IDs of purchased talents.
   * @type {Set<string>}
   */
  talentIds = this.talentIds;

  /**
   * The Talents owned by this Actor, organized according to node of the talent tree.
   * @type {Record<string, Set<string>>}
   */
  talentNodes = this.talentNodes;

  /**
   * Prepared training data for the Actor.
   * @type {Record<keyof TRAINING_TYPES, 0|1|2|3>}
   */
  training = this.training;

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
    const statuses = this.parent.statuses;
    return this.isDead || statuses.has("unconscious") || statuses.has("paralyzed") || statuses.has("asleep");
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
    this._prepareBaseMovement();
    this.details.progression = this._configureProgression(); // Affected by base size
    this._prepareBaseAbilities();
    this._prepareBaseDefenses();
  }

  /* -------------------------------------------- */

  /**
   * Clear derived Actor data, preserving references to existing objects.
   */
  #clear() {
    const createOrEmpty = name => {
      this[name] ||= {};
      for ( const k in this[name] ) delete this[name][k];
    };
    const objects = ["actions", "actorHooks", "equipment", "rollBonuses", "talentNodes", "training", "skills"];
    for ( const name of objects ) createOrEmpty(name);
    this.talentIds ||= new Set();
    this.talentIds.clear();
    this.grimoire ||= {runes: new Map(), gestures: new Map(), inflections: new Map(),
      runeIds: [], gestureIds: [], inflectionIds: [], iconicSlots: 0, iconicFreeComponents: 0, iconicSpells: []};
    this.grimoire.runes.clear();
    this.grimoire.gestures.clear();
    this.grimoire.inflections.clear();
    this.grimoire.runeIds.length = 0;
    this.grimoire.gestureIds.length = 0;
    this.grimoire.inflectionIds.length = 0;
    this.grimoire.iconicSlots = this.grimoire.iconicFreeComponents = 0;
    this.grimoire.iconicSpells.length = 0;
    this.permanentTalentIds ||= new Set();
    this.permanentTalentIds.clear();
    Object.assign(this.rollBonuses, {damage: {}, boons: {}, banes: {}});
    if ( this.status === null ) this.status = {};
  }

  /* -------------------------------------------- */

  /**
   * Prepare creature details for all Actor subtypes.
   * @protected
   */
  _prepareDetails() {}

  /* -------------------------------------------- */

  /**
   * Configure parameters of progression for this Actor type.
   * @protected
   */
  _configureProgression() {
    const {level, threat, threatFactor} = this.advancement;
    return {
      actionMax: 6,
      focusBonus: {1.5: 1, 2: 2}[threatFactor] || 0, // TODO unused. Remove this? Or implement it?
      healthPerLevel: 6,
      healthMultiplier: level < 1 ? threat : threatFactor,
      heroismMax: 3,
      madnessMultiplier: 1.5,
      moralePerLevel: 6,
      moraleMultiplier: level < 1 ? threat : threatFactor,
      woundsMultiplier: 1.5,
      abilityMin: 0,
      abilityMax: 12
    };
  }

  /* -------------------------------------------- */
  /*  Embedded Document Preparation               */
  /* -------------------------------------------- */

  /**
   * Prepare data which depends on prepared embedded Item documents for this Actor subtype.
   * @param {Record<string, CrucibleItem[]>} items
   */
  prepareItems(items) {

    // Register Talents
    this.#prepareTalents(items.talent);
    this._prepareTraining();

    // Equipment
    this._prepareEquipment(items);

    // Iconic Spells
    this.#prepareSpells(items.spell);
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
      if ( s?.talents ) {
        for ( const {item: uuid} of s.talents ) {
          const {documentId} = foundry.utils.parseUuid(uuid);
          maybePermanentTalentIds.add(documentId);
        }
      }
      if ( s?.skills ) {
        for ( const skillId of s.skills ) {
          const {documentId} = foundry.utils.parseUuid(SYSTEM.SKILLS[skillId]?.talents[1]);
          maybePermanentTalentIds.add(documentId);
        }
      }
    }

    // Iterate over talents
    for ( const t of talents ) {
      this.talentIds.add(t.id);
      if ( maybePermanentTalentIds.has(t.id) ) this.permanentTalentIds.add(t.id);
      const {nodes, training, gesture, inflection, rune, iconicSpells} = t.system;

      // Register hooks
      this.#registerActorHooks(t);

      // Register nodes
      for ( const node of nodes ) {
        this.talentNodes[node.id] ||= new Set();
        this.talentNodes[node.id].add(t.id);
        if ( node.type === "signature" ) signatureNames.add(t.name);
      }
      if ( !nodes.size ) this.permanentTalentIds.add(t.id); // Manual talents

      // Register training ranks
      if ( training.type ) {
        this.training[training.type] ??= 0;
        this.training[training.type] = Math.max(this.training[training.type], training.rank ?? 0);
      }

      // Register spellcraft knowledge
      if ( rune ) this.grimoire.runeIds.push(rune);
      if ( gesture ) this.grimoire.gestureIds.push(gesture);
      if ( inflection ) this.grimoire.inflectionIds.push(inflection);
      if ( iconicSpells ) this.grimoire.iconicSlots += iconicSpells;
    }

    // Compose Signature Name
    details.signatureName = Array.from(signatureNames).sort((a, b) => a.localeCompare(b)).join(" ");
  }

  /* -------------------------------------------- */

  /**
   * Prepare training ranks granted by owned talents or other features.
   * @protected
   */
  _prepareTraining() {}

  /* -------------------------------------------- */

  /**
   * Collect iconic spells owned by this Actor into the grimoire for later resolution.
   * Spellcraft component resolution, isKnown determination, and actor hook registration for iconic
   * spells all happen later in #finalizeGrimoire, after Active Effects have been applied.
   * @param {CrucibleItem[]} spells
   */
  #prepareSpells(spells) {
    for ( const spell of spells ) this.grimoire.iconicSpells.push(spell);
  }

  /* -------------------------------------------- */

  /**
   * Resolve the final grimoire state after Active Effects and the prepareGrimoire hook have been applied.
   * Converts intermediate component ID arrays into Maps of component instances, auto-grants the Touch
   * gesture when any rune is present, determines which iconic spells are known, and registers iconic
   * spell actor hooks.
   */
  #finalizeGrimoire() {
    const {RUNES, GESTURES, INFLECTIONS} = SYSTEM.SPELL;
    const g = this.grimoire;

    // Auto-grant the Touch gesture if any rune is known
    if ( g.runeIds.length ) g.gestureIds.push("touch");

    // Resolve component ID arrays into Maps of component instances (duplicate IDs are naturally deduplicated)
    for ( const id of g.runeIds ) {
      const rune = RUNES[id];
      if ( rune ) g.runes.set(id, rune);
    }
    for ( const id of g.gestureIds ) {
      const gesture = GESTURES[id];
      if ( gesture ) g.gestures.set(id, gesture);
    }
    for ( const id of g.inflectionIds ) {
      const inflection = INFLECTIONS[id];
      if ( inflection ) g.inflections.set(id, inflection);
    }

    // Determine which iconic spells are known and register their actor hooks.
    // Iconic spell actor hook registration occurs here, too late to be useful for most derived data hooks which
    // have already been called. That means the mere knowledge of iconic spells cannot be used to passively modify
    // actor stats like via the `prepareAbilities` hook.
    // This is a known flaw, BUT it's also not really intended. Iconic spells are expected to influence
    // actor behavior primarily through Action Hooks and Active Effect Hooks rather than actor-level hooks.
    // We don't have active effect hooks yet, but when we do I expect we can remove actor hooks from spells entirely.
    for ( const spell of g.iconicSpells ) {
      spell.system.isKnown = spell.system.canKnowSpell(g);
      this.#registerActorHooks(spell);
    }
  }

  /* -------------------------------------------- */

  /**
   * Classify the Items in the Actor's inventory to identify current equipment.
   * @param {Record<string, CrucibleItem[]>} items
   * @protected
   */
  _prepareEquipment(items) {
    this.equipment.accessorySlots ??= 3;
    this.equipment.toolbeltSlots ??= 3;

    // Step 1: Armor
    const armor = this._prepareArmor(items.armor);
    this.#registerActorHooks(armor);
    this.parent.callActorHooks("prepareArmor", armor);

    // Step 2: Accessories
    const accessories = this._prepareAccessories(items.accessory, this.equipment.accessorySlots);
    for ( const a of accessories ) this.#registerActorHooks(a);
    this.parent.callActorHooks("prepareAccessories", accessories);

    // Step 3: Weapons
    const weapons = this._prepareWeapons(items.weapon);
    if ( weapons.mainhand ) this.#registerActorHooks(weapons.mainhand);
    if ( weapons.offhand ) this.#registerActorHooks(weapons.offhand);
    this.parent.callActorHooks("prepareWeapons", weapons);

    // Step 4: Toolbelt
    const toolbelt = this._prepareToolbelt(items.consumable, items.tool, this.equipment.toolbeltSlots);
    this.parent.callActorHooks("prepareToolbelt", toolbelt);

    // Additional data
    const canFreeMove = this.#canFreeMove(armor);
    const unarmored = armor.system.category === "unarmored";
    Object.assign(this.equipment, {armor, weapons, accessories, toolbelt, canFreeMove, unarmored});
  }

  /* -------------------------------------------- */

  /**
   * Prepare the accessory Items that this Actor has equipped.
   * @param {CrucibleItem[]} accessoryItems   The accessory type Items in the Actor's inventory
   * @param {number} slots                    The maximum allowed accessory slots
   * @returns {CrucibleItem[]}                The accessory Items which are equipped
   * @protected
   */
  _prepareAccessories(accessoryItems, slots) {
    let equipped = accessoryItems.filter(i => i.system.equipped);
    if ( equipped.length > slots ) {
      console.warn(`Crucible | Actor [${this.parent.uuid}] ${this.name} has more than ${slots} equipped accessories.`);
      equipped = equipped.slice(0, slots);
    }
    return equipped;
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
   * Prepare the toolbelt Items that this Actor has equipped including both consumables and tools.
   * @param {CrucibleItem[]} consumableItems  The consumable type Items in the Actor's inventory
   * @param {CrucibleItem[]} toolItems        The tool type Items in the Actor's inventory
   * @param {number} slots                    The maximum allowed consumable slots
   * @returns {CrucibleItem[]}                The consumable Items which are equipped
   * @protected
   */
  _prepareToolbelt(consumableItems, toolItems, slots) {
    const equipped = [];
    for ( const item of consumableItems ) {
      if ( item.system.equipped ) equipped.push(item);
    }
    for ( const item of toolItems ) {
      if ( item.system.equipped ) equipped.push(item);
    }
    if ( equipped.length > slots ) {
      console.warn(`Crucible | Actor [${this.parent.uuid}] ${this.name} has more than ${slots} equipped consumables.`);
      return equipped.slice(0, slots);
    }
    return equipped;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether the Actor is able to use a free move once per round.
   * @param {CrucibleItem} armor    The equipped Armor item.
   * @returns {boolean}             Can the Actor use a free move?
   */
  #canFreeMove(armor) {
    if ( this.isWeakened ) return false;
    const statuses = this.parent.statuses;
    if ( statuses.has("prone") || statuses.has("slowed") ) return false;
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
    };

    // Identify equipped weapons which may populate weapon slots
    const equippedWeapons = {mh: [], oh: [], either: [], natural: []};
    const slots = SYSTEM.WEAPON.SLOTS;
    for ( const w of weaponItems ) {
      const {equipped, slot, properties} = w.system;
      if ( !equipped ) continue;
      if ( properties.has("natural") ) equippedWeapons.natural.unshift(w);
      else if ( [slots.MAINHAND, slots.TWOHAND].includes(slot) ) equippedWeapons.mh.unshift(w);
      else if ( slot === slots.OFFHAND ) equippedWeapons.oh.unshift(w);
      else if ( slot === slots.EITHER ) equippedWeapons.either.unshift(w);
    }
    equippedWeapons.either.sort((a, b) => b.system.damage.base - a.system.damage.base);
    equippedWeapons.natural.sort((a, b) => b.system.damage.base - a.system.damage.base);

    // Assign weapons to equipment slots
    const weapons = {natural: equippedWeapons.natural};
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
    if ( !weapons.mainhand && mhOpen ) weapons.mainhand = this._getUnarmedWeapon();
    const mh = weapons.mainhand;
    const mhCategory = mh?.config.category || {};
    if ( !weapons.offhand && ohOpen ) weapons.offhand = mhCategory.hands < 2 ? this._getUnarmedWeapon() : null;
    const oh = weapons.offhand;
    const ohCategory = oh?.config.category || {};

    // Weapon Set Metadata
    weapons.shield = (ohCategory.id === "shieldLight") || (ohCategory.id === "shieldHeavy");
    weapons.twoHanded = weapons.mainhand?.system.slot === slots.TWOHAND;
    weapons.melee = !(mhCategory.ranged && ohCategory.ranged);
    weapons.ranged = mhCategory.ranged || ohCategory.ranged;
    weapons.talisman = false;

    // Free Hand or Unarmed
    weapons.unarmed = (mhCategory?.id === "unarmed") && (ohCategory?.id === "unarmed");
    weapons.freeHands = weapons.spellHands = mhOpen + ohOpen;
    if ( ["talisman1", "talisman2"].includes(mhCategory.id) ) {
      weapons.spellHands += mhCategory.hands;
      weapons.talisman = true;
    }
    if ( "talisman1" === ohCategory.id ) {
      weapons.spellHands += 1;
      weapons.talisman = true;
    }

    // Multi weapon properties
    weapons.dualWield = weapons.unarmed || (mh?.id && oh?.id && !weapons.shield);
    weapons.dualMelee = weapons.dualWield && !mhCategory.ranged && !ohCategory.ranged;
    weapons.dualRanged = weapons.dualWield && mhCategory.ranged && ohCategory.ranged;
    weapons.hasChoice = weapons.dualWield || (weapons.natural.length > 0) || (weapons.melee && weapons.ranged);

    // Special Properties
    weapons.reload = mhCategory.reload || ohCategory.reload;
    weapons.slow = mh?.system.properties.has("oversized") ? 1 : 0;
    weapons.slow += oh?.system.properties.has("oversized") ? 1 : 0;
    return weapons;
  }

  /* -------------------------------------------- */

  /**
   * Get the default unarmed weapon used by this Actor if they do not have other weapons equipped.
   * @returns {CrucibleItem}
   */
  _getUnarmedWeapon() {
    const itemCls = /** @type {typeof CrucibleItem} */ getDocumentClass("Item");
    const data = foundry.utils.deepClone(SYSTEM.WEAPON.UNARMED_DATA);
    data.name = game.i18n.localize(data.name);
    if ( this.talentIds.has("martialartist000") ) data.system.quality = "fine"; // TODO move to talent hook
    const unarmed = new itemCls(data, {parent: this.parent});
    unarmed.prepareData(); // Needs to be explicitly called since we are in the middle of Actor preparation
    return unarmed;
  }

  /* -------------------------------------------- */

  /**
   * Perform derived preparation steps for equipped items that depend on final Actor data like ability
   * scores or training ranks.
   */
  #prepareEquippedItems() {
    const weapons = this.equipment.weapons;
    weapons.mainhand?.system.prepareEquippedData();
    weapons.offhand?.system.prepareEquippedData();
    for ( const w of weapons.natural ) w.system.prepareEquippedData();
  }

  /* -------------------------------------------- */
  /*  Derived Data Preparation                    */
  /* -------------------------------------------- */

  /**
   * Derived data preparation workflows for each Actor subtype.
   * @override
   */
  prepareDerivedData() {

    // Ability Scores
    this.parent.callActorHooks("prepareAbilities", this.abilities);
    this.#prepareFinalAbilities();

    // Movement and Size
    this.parent.callActorHooks("prepareMovement", this.movement);
    this._prepareFinalMovement();

    // Resource pools
    this.#prepareBaseResources();
    this.parent.callActorHooks("prepareResources", this.resources);
    this.#prepareFinalResources();

    // Defenses
    this.#preparePhysicalDefenses();
    this.#prepareSaveDefenses();
    this.parent.callActorHooks("prepareDefenses", this.defenses);
    this.#prepareFinalDefenses();

    // Resistances
    this.parent.callActorHooks("prepareResistances", this.resistances);
    this.#prepareFinalResistances();

    // Skills
    this.#prepareSkills();
    this.parent.callActorHooks("prepareSkills", this.skills);

    // Spellcraft
    this.parent.callActorHooks("prepareGrimoire", this.grimoire);
    this.#finalizeGrimoire();
    this.parent.callActorHooks("prepareSpells", this.grimoire);

    // Prepare Equipped Items
    this.#prepareEquippedItems();

    // Actions
    this.#prepareActions();
    this.parent.callActorHooks("prepareActions", this.actions);
  }

  /* -------------------------------------------- */
  /*  Ability Preparation                         */
  /* -------------------------------------------- */

  /**
   * Prepare ability scores for all Actor subtypes.
   * @protected
   */
  _prepareBaseAbilities() {}

  /* -------------------------------------------- */

  /**
   * Prepare final ability scores as the sum of initial, base, increases, and bonus components.
   * Scores are clamped between an allowed minimum and maximum value, configured per actor type.
   */
  #prepareFinalAbilities() {
    const {abilityMin, abilityMax} = this.details.progression;
    for ( const ability of Object.values(this.abilities) ) {
      const total = ability.initial + ability.base + ability.increases + ability.bonus;
      ability.value = Math.clamp(total, abilityMin, abilityMax);
    }
  }

  /* -------------------------------------------- */
  /*  Movement Preparation                        */
  /* -------------------------------------------- */

  /**
   * Prepare basic movement attributes for all Actor subtypes.
   * @protected
   */
  _prepareBaseMovement() {
    const m = this.movement;
    m.baseEngagement = 1;
    m.sizeBonus = m.strideBonus = m.engagementBonus = 0;
  }

  /* -------------------------------------------- */

  /**
   * Preparation of derived movement for all Actor subtypes.
   */
  _prepareFinalMovement() {
    const m = this.movement;

    // Size and Stride
    m.size = m.baseSize + m.sizeBonus;
    m.stride = m.free = m.baseStride + m.strideBonus;

    // Engagement
    const {mainhand, offhand} = this.parent.equipment.weapons;
    if ( mainhand && mainhand.system.properties.has("engaging") ) m.engagementBonus += 1;
    if ( offhand && offhand.system.properties.has("engaging") ) m.engagementBonus += 1;
    m.engagement = m.baseEngagement + m.engagementBonus;
  }

  /* -------------------------------------------- */
  /*  Resource Preparation                        */
  /* -------------------------------------------- */

  /**
   * Compute base and bonus values for every resource pool.
   */
  #prepareBaseResources() {
    const {resources: rs, abilities: a} = this;
    const level = this.advancement.level;
    const p = this.details.progression;

    // Health and Wounds
    const healthBase = Math.max(level, 1) * p.healthPerLevel;
    rs.health.base = Math.ceil((healthBase + (4 * a.toughness.value) + (2 * a.strength.value)) * p.healthMultiplier);
    if ( "wounds" in rs ) rs.wounds.base = Math.ceil(p.woundsMultiplier * rs.health.base);

    // Morale and Madness
    const moraleBase = Math.max(level, 1) * p.moralePerLevel;
    rs.morale.base = Math.ceil((moraleBase + (4 * a.presence.value) + (2 * a.wisdom.value)) * p.moraleMultiplier);
    if ( "madness" in rs ) rs.madness.base = Math.ceil(p.madnessMultiplier * rs.morale.base);

    // Resources
    rs.action.base = p.actionMax;
    rs.focus.base = Math.ceil((a.wisdom.value + a.presence.value + a.intellect.value) / 2);
    rs.heroism.base = p.heroismMax;

    // Initialize bonuses for each resource
    for ( const r of Object.values(rs) ) r.bonus = 0;
  }

  /* -------------------------------------------- */

  /**
   * Compute maximum and current values of every resource pool.
   */
  #prepareFinalResources() {
    const statuses = this.parent.statuses;
    const {resources} = this;

    // Apply status bonuses
    if ( statuses.has("stunned") ) resources.action.bonus -= 4;
    else if ( statuses.has("staggered") ) resources.action.bonus -= 2;
    if ( statuses.has("hastened") ) resources.action.bonus += 1;

    // Compute resource maximums
    for ( const r of Object.values(resources) ) r.max = Math.max(r.base + r.bonus, 0);

    // Specific logic for 0-ability actors
    if ( !this.abilities.toughness.value && !this.abilities.presence.value ) {
      resources.health.max = resources.morale.max = 0;
    } else if ( !this.abilities.toughness.value ) {
      resources.morale.max += resources.health.max;
      resources.health.max = 0;
    } else if ( !this.abilities.presence.value ) {
      resources.health.max += resources.morale.max;
      resources.morale.max = 0;
    }
    if ( !this.abilities.wisdom.value ) resources.heroism.max = 0;
    if ( !this.abilities.intellect.value ) resources.focus.max = 0;

    // Clamp resource values
    for ( const r of Object.values(resources) ) r.value = Math.clamp(r.value, 0, r.max);

    // Final status modifiers
    if ( this.isWeakened ) resources.action.max = Math.max(resources.action.max - 2, 0);
    if ( this.isIncapacitated ) resources.action.max = 0;
  }

  /* -------------------------------------------- */
  /*  Defense Preparation                         */
  /* -------------------------------------------- */

  /**
   * Prepare base defense data which may scale depending on actor details.
   * Initialize bonus values to zero which are eligible as targets for active effect application.
   * @protected
   */
  _prepareBaseDefenses() {
    for ( const d of Object.values(this.defenses) ) d.base = d.bonus = 0;
    this.defenses.wounds.base = this.defenses.madness.base = SYSTEM.PASSIVE_BASE;
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
    defenses.armor.bonus += armorData.armor.bonus;
    defenses.dodge.base = armorData.dodge.base;
    defenses.dodge.bonus += Math.max(abilities.dexterity.value - armorData.dodge.scaling, 0);
    defenses.dodge.max = defenses.dodge.base + (12 - armorData.dodge.scaling);

    // Block and Parry from equipped Weapons
    const weaponData = [];
    if ( equipment.weapons.mainhand ) weaponData.push(equipment.weapons.mainhand.system);
    if ( equipment.weapons.offhand ) weaponData.push(equipment.weapons.offhand.system);
    for ( const wd of weaponData ) {
      for ( const d of ["block", "parry"] ) defenses[d].base += wd.defense[d];
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare non-physical defenses.
   * Defense base is the system passive base of 12 with a penalty for creatures below level zero.
   */
  #prepareSaveDefenses() {
    const {equipment, talentIds} = this.parent;
    const base = SYSTEM.PASSIVE_BASE + Math.min(this.advancement.level, 0);
    for ( const [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      const d = this.defenses[k];
      d.base = base;
      if ( !this.parent.isIncapacitated ) d.base += this.parent.getAbilityBonus(sd.abilities);
      if ( (k !== "fortitude") && talentIds.has("monk000000000000") && equipment.unarmored ) d.bonus += 2; // TODO move to talent hooks
    }
  }

  /* -------------------------------------------- */

  /**
   * Compute total defenses as base + bonus.
   */
  #prepareFinalDefenses() {
    const {defenses, resources} = this;
    const {isIncapacitated, statuses} = this.parent;

    // Healing thresholds based on wounds and madness
    const wounds = resources.wounds?.value ?? ((resources.health.max - resources.health.value) * 2);
    const madness = resources.madness?.value ?? ((resources.morale.max - resources.morale.value) * 2);
    defenses.wounds.base += Math.floor(wounds / 10);
    defenses.madness.base += Math.floor(madness / 10);

    // Status effects which affect defenses
    if ( statuses.has("exposed") ) defenses.armor.base = Math.max(defenses.armor.base - 2, 0);

    // Compute defense totals
    for ( const defense of Object.values(defenses) ) {
      defense.total = defense.base + defense.bonus;
    }

    // Cannot parry or block while enraged
    if ( statuses.has("enraged") ) defenses.parry.total = defenses.block.total = 0;
    if ( statuses.has("exhausted") ) {
      defenses.dodge.total = Math.ceil(defenses.dodge.total / 2);
      defenses.reflex.total = Math.ceil(defenses.reflex.total / 2);
    }

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
  #prepareFinalResistances() {
    for ( const r of Object.values(this.resistances) ) r.total = r.immune ? Infinity : (r.base + r.bonus);
  }

  /* -------------------------------------------- */
  /*  Skill Preparation                           */
  /* -------------------------------------------- */

  /**
   * Prepare skills data for all Actor subtypes.
   */
  #prepareSkills() {
    for ( const [skillId, config] of Object.entries(SYSTEM.SKILLS) ) {
      this.skills[skillId] = this.#prepareSkill(config);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare a single Skill.
   * @param {CrucibleSkillConfig} config    System configuration data of the skill being configured
   * @returns {CrucibleActorSkill}
   */
  #prepareSkill(config) {
    const rank = this.training[config.id] ?? 0;
    const abilityBonus = this.parent.getAbilityBonus(config.abilities);
    const skillBonus = SYSTEM.TALENT.TRAINING_RANK_VALUES[rank].bonus;
    const enchantmentBonus = 0;
    const score = abilityBonus + skillBonus + enchantmentBonus;
    const passive = SYSTEM.PASSIVE_BASE + score;
    return {rank, abilityBonus, skillBonus, enchantmentBonus, score, passive};
  }

  /* -------------------------------------------- */
  /*  Action Preparation                          */
  /* -------------------------------------------- */

  /**
   * Prepare Actions which this Actor may actively use.
   */
  #prepareActions() {
    this.#prepareDefaultActions();
    for ( const item of this.parent.items ) {
      if ( item.system instanceof CruciblePhysicalItem ) this.#registerItemActions(item);
      else if ( (item.type === "talent") || (item.type === "spell") ) this.#registerItemActions(item);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare the set of default actions that every Actor can perform.
   */
  #prepareDefaultActions() {
    const w = this.equipment.weapons;
    for ( let ad of SYSTEM.ACTION.DEFAULT_ACTIONS ) {

      // Some actions are only conditionally added
      switch ( ad.id ) {
        case "cast":
          if ( !(this.grimoire.gestures.size && this.grimoire.runes.size) ) continue;
          break;
        case "reload":
          if ( !w.reload ) continue;
          break;
        case "throwWeapon":
          if ( !(w.mainhand?.system.canThrow() || w.offhand?.system.canThrow()) ) continue;
          break;
      }

      // Action data
      ad = foundry.utils.deepClone(ad);
      ad.tags ||= [];

      // Customize strike tags
      if ( ["strike", "reactiveStrike"].includes(ad.id) ) {
        if ( w.melee ) ad.tags.push("melee");
        if ( w.ranged ) ad.tags.push("ranged");
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
    if ( !item.system.schema.has("actions") ) return;
    if ( item.system.requiresInvestment && !item.system.invested ) return;
    for ( const action of item.actions ) {
      const actionId = item.type === "consumable" ? `${action.id}.${item.id}` : action.id;
      this.actions[actionId] = action.bind(this.parent);
    }
  }

  /* -------------------------------------------- */
  /*  Actor Hooks                                 */
  /* -------------------------------------------- */

  /**
   * Register actor hooks for a given Item.
   * @param {CrucibleItem} item         The Item registering the hook
   */
  #registerActorHooks(item) {
    const H = SYSTEM.ACTOR.HOOKS;
    if ( item.system.requiresInvestment && !item.system.invested ) return;

    // First register inline hooks
    for ( let {hook, fn} of item.system.actorHooks ) {
      const cfg = H[hook];
      if ( !cfg ) {
        console.error(new Error(`Invalid Actor hook name "${hook}" defined by Item "${item.uuid}"`));
        continue;
      }
      this.actorHooks[hook] ||= [];
      if ( typeof fn === "string" ) {
        try {
          // eslint-disable-next-line no-new-func
          fn = new Function("item", ...cfg.argNames, fn);
        } catch(err) {
          throw new Error(`Failed to parse Hook "${hook}" in Item "${item.uuid}"`, {cause: err});
        }
      }
      if ( !(fn instanceof Function) ) throw new Error(`Hook "${hook}" is not a function.`);
      this.actorHooks[hook].push({item, fn});
    }

    // Next register custom module hooks
    const identifier = item.system.identifier || item.id;
    const hooks = crucible.api.hooks[item.type]?.[identifier];
    if ( hooks ) {
      for ( const [hook, fn] of Object.entries(hooks) ) {
        if ( hook in SYSTEM.ACTOR.HOOKS ) {
          this.actorHooks[hook] ||= [];
          this.actorHooks[hook].push({item, fn});
        }
      }
    }
  }
}
