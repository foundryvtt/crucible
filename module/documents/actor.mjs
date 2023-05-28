import { SYSTEM } from "../config/system.js";
import StandardCheck from "../dice/standard-check.mjs"
import AttackRoll from "../dice/attack-roll.mjs";
import CrucibleAction from "../data/action.mjs";
import CrucibleSpell from "../data/spell.mjs";

/**
 * @typedef {Object} ActorEquippedWeapons
 * @property {CrucibleItem} mainhand
 * @property {CrucibleItem} offhand
 * @property {boolean} freehand
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
 * @typedef {Object} ActorEquipment
 * @property {CrucibleItem} armor
 * @property {ActorEquippedWeapons} weapons
 * @property {CrucibleItem[]} accessories
 */

/**
 * @typedef {Object}   ActorRoundStatus
 * @property {boolean} hasMoved
 * @property {boolean} hasAttacked
 * @property {boolean} wasAttacked
 */

/**
 * The Actor document subclass in the Crucible system which extends the behavior of the base Actor class.
 */
export default class CrucibleActor extends Actor {
  constructor(data, context) {
    super(data, context);
    this.#updateCachedResources();
  }

  /**
   * Track the Actions which this Actor has available to use
   * @type {Object<string, CrucibleAction>}
   */
  actions = this["actions"];

  /**
   * Temporary roll bonuses this actor has outside the fields of its data model.
   * @type {{
   *   damage: Object<string, number>
   * }}
   */
  rollBonuses = this.rollBonuses;

  /**
   * Track the Items which are currently equipped for the Actor.
   * @type {ActorEquipment}
   */
  equipment = this.equipment;

  /**
   * The spellcraft components known by this Actor
   * @type {{runes: Set<CrucibleRune>, inflections: Set<CrucibleInflection>, gestures: Set<CrucibleGesture>}}
   */
  grimoire = this.grimoire;

  /**
   * @typedef {Object} CrucibleActorTraining
   * @property {number} unarmed
   * @property {number} heavy
   * @property {number} finesse
   * @property {number} balanced
   * @property {number} ranged
   */

  /**
   * Trained skill bonuses which the character has.
   * @type {CrucibleActorTraining}
   */
  training = this.training;

  /**
   * The ancestry of the Actor.
   * @returns {*}
   */
  get ancestry() {
    return this.system.details.ancestry;
  }

  /**
   * The prepared object of actor attributes
   * @type {object}
   */
  get abilities() {
    return this.system.abilities;
  }

  /**
   * The background of the Actor.
   * @returns {*}
   */
  get background() {
    return this.system.details.background;
  }

  /**
   * The prepared object of actor defenses
   * @type {object}
   */
  get defenses() {
    return this.system.defenses;
  }

  /**
   * A convenience reference to the Actor level.
   * @type {number}
   */
  get level() {
    return this.system.advancement.level;
  }

  /**
   * Is this actor currently "level zero"
   * @returns {boolean}
   */
  get isL0() {
    return this.system.advancement.level === 0;
  }

  get points() {
    return this.system.points;
  }

  /**
   * The prepared object of actor resistances
   * @returns {object}
   */
  get resistances() {
    return this.system.resistances;
  }

  /**
   * The prepared object of actor skills
   * @returns {object}
   */
  get skills() {
    return this.system.skills;
  }

  /**
   * The prepared object of actor status data
   * @returns {ActorRoundStatus}
   */
  get status() {
    return this.system.status;
  }

  /**
   * Is this Actor incapacitated?
   * @type {boolean}
   */
  get isIncapacitated() {
    return this.system.resources.health.value === 0;
  }

  /**
   * Is this Actor broken?
   * @type {boolean}
   */
  get isBroken() {
    return this.system.resources.morale.value === 0;
  }

  /**
   * Is this Actor dead?
   * @type {boolean}
   */
  get isDead() {
    if ( this.type === "adversary" ) return this.system.resources.health.value === 0;
    return this.system.resources.wounds.value === this.system.resources.wounds.max;
  }

  /**
   * Is this Actor insane?
   * @type {boolean}
   */
  get isInsane() {
    if ( this.type === "adversary" ) return false;
    return this.system.resources.madness.value === this.system.resources.madness.max;
  }

  /**
   * Is this Actor currently in the active Combat encounter?
   * @type {boolean}
   */
  get combatant() {
    if ( this.isToken ) return game.combat?.combatants.find(c => c.tokenId === this.token.id);
    return game.combat?.combatants.find(c => c.actorId === this.id);
  }

  /**
   * Track resource values prior to updates to capture differential changes.
   * @enum {number}
   */
  _cachedResources;

  /**
   * The IDs of purchased talents
   * @type {Set<string>}
   */
  talentIds = this.talentIds || new Set();

  /**
   * Talent hook functions which apply to this Actor based on their set of owned Talents.
   * @type {Object<string, {talent: CrucibleTalent, fn: Function}>}
   */
  talentHooks = {};

  /**
   * A set of Talent IDs which cannot be removed from this Actor because they come from other sources.
   * @type {Set<string>}
   */
  permanentTalentIds;

  /**
   * Currently active status effects
   * @type {Set<string>}
   */
  statuses = this.statuses || new Set();

  /* -------------------------------------------- */
  /*  Actor Preparation
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.rollBonuses = {damage: {}};
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareEmbeddedDocuments() {
    super.prepareEmbeddedDocuments();
    const items = this.itemTypes;
    this._prepareTalents(items);
    this._prepareEffects();
    this.training = CrucibleActor.#prepareTraining(this);
    this.equipment = this._prepareEquipment(items);
    this._prepareActions();
  };

  /* -------------------------------------------- */

  /**
   * Compute the levels of equipment training that an Actor has.
   * @param {CrucibleActor} actor       The Actor being prepared
   * @returns {CrucibleActorTraining}   Prepared training ranks in various equipment categories
   */
  static #prepareTraining(actor) {
    const training = {
      unarmed: 0,
      heavy: 0,
      finesse: 0,
      balanced: 0,
      projectile: 0,
      mechanical: 0,
      shield: 0,
      talisman: 0
    };
    actor.callTalentHooks("prepareTraining", training);
    return training;
  }

  /* -------------------------------------------- */

  /**
   * Classify the Items in the Actor's inventory to identify current equipment.
   * @returns {ActorEquipment}
   * @private
   */
  _prepareEquipment({armor, weapon, accessory}={}) {
    const equipment = {
      armor: this._prepareArmor(armor),
      weapons: this._prepareWeapons(weapon),
      accessories: {} // TODO: Equipped Accessories
    };

    // Flag some equipment-related statuses
    equipment.canFreeMove = CrucibleActor.#canFreeMove(this, equipment.armor);
    equipment.unarmored = equipment.armor.system.category === "unarmored"
    return equipment;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether the Actor is able to use a free move once per round.
   * @param {CrucibleActor} actor   The Actor being evaluated
   * @param {CrucibleItem} armor    The equipped Armor item.
   * @returns {boolean}             Can the Actor use a free move?
   */
  static #canFreeMove(actor, armor) {
    if ( actor.statuses.has("prone") ) return false;
    if ( (armor.system.category === "heavy") && !actor.talentIds.has("armoredefficienc") ) return false;
    return true;
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
      ui.notifications.warn(`Actor ${this.name} has more than one equipped armor.`);
      armors = armors[0];
    }
    return armors[0] || this._getUnarmoredArmor();
  }

  /* -------------------------------------------- */

  /**
   * Get the default unarmored Armor item used by this Actor if they do not have other equipped armor.
   * @returns {CrucibleItem}
   * @private
   */
  _getUnarmoredArmor() {
    const itemCls = getDocumentClass("Item");
    return new itemCls(SYSTEM.ARMOR.UNARMORED_DATA, {parent: this});
  }

  /* -------------------------------------------- */

  /**
   * Prepare the Armor item that this Actor has equipped.
   * @param {CrucibleItem[]} weaponItems      The Weapon type Items in the Actor's inventory
   * @returns {EquippedWeapons}               The currently equipped weaponry for the Actor
   * @private
   */
  _prepareWeapons(weaponItems) {
    const warnSlotInUse = (item, type) => {
      const w = game.i18n.format("WARNING.CannotEquipSlotInUse", {actor: this.name, item: item.name, type});
      console.warn(w);
    }

    // Identify main-hand and off-hand weapons
    const weapons = {};
    const equippedWeapons = {mh: [], oh: [], either: []};
    for ( let w of weaponItems ) {
      if ( !w.system.equipped ) continue;
      const category = w.config.category;
      if ( (w.hands === 2) ) {
        equippedWeapons.mh.unshift(w);
        equippedWeapons.oh.unshift(w);
      }
      else if ( category.main && !category.off ) equippedWeapons.mh.push(w);
      else if ( category.off && !category.main ) equippedWeapons.oh.push(w);
      else equippedWeapons.either.push(w);
    }
    equippedWeapons.either.sort((a, b) => b.system.damage.base - a.system.damage.base);

    // Assign equipped weapons
    for ( const w of equippedWeapons.mh ) {
      if ( weapons.mainhand ) warnSlotInUse(w, "mainhand");
      else weapons.mainhand = w;
    }
    for ( const w of equippedWeapons.oh ) {
      if ( weapons.offhand ) warnSlotInUse(w, "offhand");
      else weapons.offhand = w;
    }
    for ( const w of equippedWeapons.either ) {
      if ( !weapons.mainhand ) weapons.mainhand = w;
      else if ( !weapons.offhand ) weapons.offhand = w;
      else warnSlotInUse(w, "mainhand");
    }

    // Mainhand Weapon
    if ( !weapons.mainhand ) weapons.mainhand = this._getUnarmedWeapon();
    const mh = weapons.mainhand;
    const mhCategory = mh.config.category;
    mh.system.actionBonuses.skill = this.training[mhCategory.training];

    // Offhand Weapon
    if ( !weapons.offhand ) weapons.offhand =  mhCategory.hands < 2 ? this._getUnarmedWeapon() : null;
    const oh = weapons.offhand;
    const ohCategory = oh?.config.category || {};
    if ( oh ) oh.system.actionBonuses.skill = this.training[ohCategory.training];

    // Free Hand or Unarmed
    weapons.freehand = (mhCategory.id === "unarmed") || (ohCategory.id === "unarmed");
    weapons.unarmed = (mhCategory.id === "unarmed") && (ohCategory.id === "unarmed");

    // Shield
    weapons.shield = (ohCategory.id === "shieldLight") || (ohCategory.id === "shieldHeavy");

    // Two-Handed
    weapons.twoHanded = mhCategory.hands === 2;

    // Melee vs. Ranged
    weapons.melee = !mhCategory.ranged;
    weapons.ranged = !!mhCategory.ranged;

    // Dual Wielding
    weapons.dualWield = weapons.unarmed || ((mhCategory.hands === 1) && mh.id && (oh.id && !weapons.shield));
    weapons.dualMelee = weapons.dualWield && !(mhCategory.ranged || ohCategory.ranged);
    weapons.dualRanged = (mhCategory.hands === 1) && mhCategory.ranged && ohCategory.ranged;

    // Special Properties
    weapons.talisman = ["talisman1", "talisman2"].includes(mhCategory.id) || ("talisman1" === ohCategory.id);
    weapons.reload = mhCategory.reload || ohCategory.reload;
    weapons.slow = mh.system.properties.has("oversized") ? mhCategory.hands : 0;
    weapons.slow += oh?.system.properties.has("oversized") ? 1 : 0;
    return weapons;
  }

  /* -------------------------------------------- */

  /**
   * Get the default unarmed weapon used by this Actor if they do not have other weapons equipped.
   * @returns {CrucibleItem}
   * @private
   */
  _getUnarmedWeapon() {
    const itemCls = getDocumentClass("Item");
    const data = foundry.utils.deepClone(SYSTEM.WEAPON.UNARMED_DATA);
    if ( this.talentIds.has("martialartist000") ) data.system.quality = "fine";
    return new itemCls(data, {parent: this});
  }

  /* -------------------------------------------- */

  /**
   * Prepare Actions which the Actor may actively use
   * @private
   */
  _prepareActions() {
    this.actions = {};
    const w = this.equipment.weapons;

    // Default actions that every character can do
    for ( let ad of SYSTEM.ACTION.DEFAULT_ACTIONS ) {
      if ( (ad.id === "cast") && !(this.grimoire.gestures.size && this.grimoire.runes.size) ) continue;
      if ( (ad.id === "reload") && !w.reload ) continue;
      if ( (ad.id === "refocus") && !w.talisman ) continue;
      const action = ad.tags.includes("spell")
        ? CrucibleSpell.getDefault(this, ad)
        : new CrucibleAction(ad, {actor: this});
      this.actions[action.id] = action;
    }

    // Actions that are unlocked through an owned Talent
    for ( let talent of this.itemTypes.talent ) {
      for ( const action of talent.actions ) {
        this.actions[action.id] = action.bind(this);
      }
    }

    // Most recently cast spell
    if ( this.actions.cast ) {
      const spellId = this.getFlag("crucible", "lastSpell") || "";
      if ( spellId ) {
        const [, rune, gesture, inflection] = spellId.split(".");
        const lastSpell = this.actions.cast.clone({rune, gesture, inflection}, {actor: this});
        this.actions[lastSpell.id] = lastSpell;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare current Active Effects.
   * @private
   */
  _prepareEffects() {
    this.statuses = new Set();
    for ( const effect of this.effects ) {
      for ( const status of effect.statuses ) this.statuses.add(status);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare owned Talent items that the Actor has unlocked
   * @private
   */
  _prepareTalents({talent}={}) {
    this.talentIds = new Set();
    this.talentHooks = {};
    this.grimoire = {runes: new Set(), gestures: new Set(), inflections: new Set()};
    const details = this.system.details;
    const signatureNames = [];

    // Identify permanent talents from a background, taxonomy, archetype, etc...
    this.permanentTalentIds = new Set();
    if ( details.background ) {
      details.background.talents = details.background.talents.map(uuid => {
        const talentId = foundry.utils.parseUuid(uuid)?.documentId;
        if ( talentId ) this.permanentTalentIds.add(talentId);
        return talentId;
      });
    }

    // Iterate over talents
    for ( const t of talent ) {
      this.talentIds.add(t.id);

      // Register hooks
      for ( const hook of t.system.actorHooks ) CrucibleActor.#registerTalentHook(this, talent, hook);

      // Register signatures
      if ( t.system.node?.type === "signature" ) signatureNames.push(t.name);

      // Register spellcraft knowledge
      if ( t.system.rune ) {
        this.grimoire.runes.add(SYSTEM.SPELL.RUNES[t.system.rune]);
        this.grimoire.gestures.add(SYSTEM.SPELL.GESTURES.touch);
      }
      if ( t.system.gesture ) this.grimoire.gestures.add(SYSTEM.SPELL.GESTURES[t.system.gesture]);
      if ( t.system.inflection ) this.grimoire.inflections.add(SYSTEM.SPELL.INFLECTIONS[t.system.inflection]);
    }

    // Compose Signature Name
    details.signatureName = signatureNames.sort((a, b) => a.localeCompare(b)).join(" ");

    // Warn if the Actor does not have a legal build
    if ( this.type === "hero" ) {
      const points = this.system.points.talent;
      points.spent = this.talentIds.size - this.permanentTalentIds.size;
      points.available = points.total - points.spent;
      if ( points.available < 0) {
        ui.notifications?.warn(`Actor ${this.name} has more Talents unlocked than they have talent points available.`);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation Helpers                    */
  /* -------------------------------------------- */

  /**
   * Prepare defense data for the Actor.
   * Defines shared logic used by both HeroData and AdversaryData
   * @internal
   */
  _prepareDefenses() {
    CrucibleActor.#preparePhysicalDefenses(this);
    CrucibleActor.#prepareSaveDefenses(this);
    CrucibleActor.#prepareHealingThresholds(this);
    this.callTalentHooks("prepareDefenses", this.system.defenses);
    CrucibleActor.#prepareTotalDefenses(this);
  }

  /* -------------------------------------------- */

  /**
   * Prepare Physical Defenses.
   */
  static #preparePhysicalDefenses(actor) {
    const {equipment} = actor;
    const {abilities, defenses} = actor.system;

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
  static #prepareSaveDefenses(actor) {
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( sd.type !== "save" ) continue;
      let d = actor.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + actor.abilities[a].value, SYSTEM.PASSIVE_BASE);
      // TODO
      if ( (k !== "fortitude") && actor.talentIds.has("monk000000000000") && actor.equipment.unarmored ) d.bonus += 2;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare healing thresholds for Wounds and Madness.
   */
  static #prepareHealingThresholds(actor) {
    const { defenses, resources } = actor.system;
    const wounds = resources.wounds?.value ?? ((resources.health.max - resources.health.value) * 2);
    defenses.wounds = {base: SYSTEM.PASSIVE_BASE + Math.floor(wounds / 10), bonus: 0};
    const madness = resources.madness?.value ?? ((resources.morale.max - resources.morale.value) * 2);
    defenses.madness = {base: SYSTEM.PASSIVE_BASE + Math.floor(madness / 10), bonus: 0};
  }

  /* -------------------------------------------- */

  /**
   * Compute total defenses as base + bonus.
   */
  static #prepareTotalDefenses(actor) {
    const defenses = actor.system.defenses;

    // Cannot parry or block while enraged
    if ( actor.statuses.has("enraged") ) defenses.parry.total = defenses.block.total = 0;

    // Compute defense totals
    for ( const defense of Object.values(defenses) ) {
      defense.total = defense.base + defense.bonus;
    }
    defenses.physical = {
      total: defenses.armor.total + defenses.dodge.total + defenses.parry.total + defenses.block.total
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare resistance data for the Actor.
   * Defines shared logic used by both HeroData and AdversaryData.
   * @internal
   */
  _prepareResistances() {
    const resistances = this.system.resistances;
    this.callTalentHooks("prepareResistances", resistances);
    for ( const r of Object.values(resistances) ) {
      r.total = r.base + r.bonus;
    }
  }

  /* -------------------------------------------- */
  /*  Talent Hooks                                */
  /* -------------------------------------------- */

  /**
   * Register a hooked function declared by a Talent item.
   * @param {CrucibleActor} actor   The Actor being prepared
   * @param {CrucibleItem} talent   The Talent registering the hook
   * @param {object} data           Registered hook data
   * @param {string} data.hook        The hook name
   * @param {string} data.fn          The hook function
   * @private
   */
  static #registerTalentHook(actor, talent, {hook, fn}={}) {
    const hookConfig = SYSTEM.ACTOR_HOOKS[hook];
    if ( !hookConfig ) throw new Error(`Invalid Actor hook name "${hook}" defined by Talent "${talent.id}"`);
    actor.talentHooks[hook] ||= [];
    actor.talentHooks[hook].push({talent, fn: new Function("actor", ...hookConfig.argNames, fn)});
  }

  /* -------------------------------------------- */

  /**
   * Call all talent hooks registered for a certain event name.
   * Each registered function is called in sequence.
   * @param {string} hook     The hook name to call.
   * @param {...*} args       Arguments passed to the hooked function
   */
  callTalentHooks(hook, ...args) {
    const hooks = this.talentHooks[hook] ||= [];
    for ( const {talent, fn} of hooks ) {
      console.debug(`Calling ${hook} hook for Talent ${talent.name}`);
      try {
        fn(this, ...args);
      } catch(err) {
        err.message = `Talent ${talent.name} declared a ${hook} which failed to be evaluated:\n ${err.message}`;
        console.error(err);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Dice Rolling Methods                        */
  /* -------------------------------------------- */

  /**
   * Compute the ability score bonus for a given scaling mode
   * @param {string[]} scaling    How is the ability bonus computed?
   * @returns {number}            The ability bonus
   */
  getAbilityBonus(scaling) {
    const abilities = this.system.abilities;
    return Math.ceil(scaling.reduce((x, t) => x + abilities[t].value, 0) / scaling.length);
  }

  /* -------------------------------------------- */

  /**
   * Get the number of additional boons or banes you have when attacking a target.
   * @param {CrucibleActor} target  The target being attacked
   * @param {object} options        Options which customize boons and banes
   * @param {string} [options.attackType]   A value in weapon, spell, or skill
   * @param {boolean} [options.ranged]      Is this a ranged attack? or a melee attack?
   * @param {string} [options.defenseType]  The defense type being tested
   * @returns {{boons: number, banes: number}}  The number of additional boons and banes
   */
  getTargetBoons(target, {attackType, ranged=false, defenseType="physical"}={}) {
    let boons = 0;
    let banes = 0;

    // Exposed
    if ( target.statuses.has("exposed") && (attackType !== "skill") ) boons += 2;

    // Guarded
    if ( target.statuses.has("guarded") && (attackType !== "skill") ) banes += 1;

    // Prone
    if ( target.statuses.has("prone") && (attackType !== "skill") ) {
      if ( ranged ) banes += 2;
      else boons += 2;
    }
    return {boons, banes};
  }

  /* -------------------------------------------- */

  /**
   * Get a creature's effective resistance against a certain damage type dealt to a certain resource.
   * @param {string} resource       The resource targeted in SYSTEM.RESOURCES
   * @param {string} damageType     The damage type dealt in SYSTEM.DAMAGE_TYPES
   */
  getResistance(resource, damageType) {
    let r = this.resistances[damageType]?.total ?? 0;
    if ( (resource === "morale") && ( this.statuses.has("resolute") ) ) r += 5;
    return r;
  }

  /* -------------------------------------------- */

  /**
   * Roll a skill check for a given skill ID.
   *
   * @param {string} skillId      The ID of the skill to roll a check for, for example "stealth"
   * @param {number} [banes]      A number of banes applied to the roll, default is 0
   * @param {number} [boons]      A number of boons applied to the roll, default is 0
   * @param {number} [dc]         A known target DC
   * @param {string} [rollMode]   The roll visibility mode to use, default is the current dropdown choice
   * @param {boolean} [dialog]    Display a dialog window to further configure the roll. Default is false.
   *
   * @return {StandardCheck}      The StandardCheck roll instance which was produced.
   */
  async rollSkill(skillId, {banes=0, boons=0, dc, rollMode, dialog=false}={}) {
    const skill = this.system.skills[skillId];
    if ( !skill ) throw new Error(`Invalid skill ID ${skillId}`);

    // Prepare check data
    const rollData = {
      actorId: this.id,
      banes: banes,
      boons: boons,
      dc: dc,
      ability: skill.abilityBonus,
      skill: skill.skillBonus,
      enchantment: skill.enchantmentBonus,
      type: skillId,
      rollMode: rollMode,
    };

    // Apply talent hooks
    this.callTalentHooks("prepareStandardCheck", rollData);
    this.callTalentHooks("prepareSkillCheck", skill, rollData);

    // Create the check roll
    const sc = new StandardCheck(rollData);

    // Prompt the user with a roll dialog
    const flavor = game.i18n.format("SKILL.RollFlavor", {name: this.name, skill: CONFIG.SYSTEM.SKILLS[skillId].name});
    if ( dialog ){
      const title = game.i18n.format("SKILL.RollTitle", {name: this.name, skill: CONFIG.SYSTEM.SKILLS[skillId].name});
      const response = await sc.dialog({title, flavor, rollMode});
      if ( response === null ) return null;
    }

    // Execute the roll to chat
    await sc.toMessage({
      flavor,
      flags: {
        crucible: {
          skill: skillId
        }
      }
    });
    return sc;
  }

  /* -------------------------------------------- */

  /**
   * Test the Actor's defense, determining which defense type is used to avoid an attack.
   * @param {string} defenseType      The defense type to test
   * @param {number} rollTotal        The rolled total
   * @param {number} [dc]             An explicit DC to test
   * @returns {AttackRoll.RESULT_TYPES}
   */
  testDefense(defenseType, rollTotal, dc) {
    const d = this.system.defenses;

    // Physical Defense
    if ( defenseType === "physical" ) {
      dc = d.physical.total;

      // Hit
      if ( rollTotal > dc ) return AttackRoll.RESULT_TYPES.HIT;

      // Dodge
      const r = twist.random() * d.physical.total;
      const dodge = d.dodge.total;
      if ( r <= dodge ) return AttackRoll.RESULT_TYPES.DODGE;

      // Parry
      const parry = dodge + d.parry.total;
      if ( r <= parry ) return AttackRoll.RESULT_TYPES.PARRY;

      // Block
      const block = dodge + d.block.total;
      if ( r <= block ) return AttackRoll.RESULT_TYPES.BLOCK;

      // Armor
      return AttackRoll.RESULT_TYPES.DEFLECT;
    }

    // Other Defenses
    else {
      if ( defenseType ) dc = d[defenseType].total;
      if ( rollTotal > dc ) return AttackRoll.RESULT_TYPES.EFFECTIVE;
      else return AttackRoll.RESULT_TYPES.RESIST;
    }
  }

  /* -------------------------------------------- */

  /**
   * Use an available Action.
   * @param {string} actionId     The action to use
   * @param {object} [options]    Options which configure action usage
   * @returns {Promise<Roll[]>}
   */
  async useAction(actionId, options={}) {
    const action = this.actions[actionId];
    if ( !action ) throw new Error(`Action ${actionId} does not exist in Actor ${this.id}`);
    return action.use({dialog: true, ...options});
  }

  /* -------------------------------------------- */

  /**
   * Cast a certain spell against a target.
   * @param {CrucibleSpell} spell
   * @param {CrucibleActor} target
   * @returns {Promise<void>}
   */
  async castSpell(spell, target) {
    if ( !(target instanceof CrucibleActor) ) throw new Error("You must define a target Actor for the spell.");
    if ( !spell.usage.hasDice ) return;

    // Modify boons and banes against this target
    const defenseType = spell.defense;
    let {boons, banes} = spell.usage.bonuses;
    const targetBoons = this.getTargetBoons(target, {
      attackType: "spell",
      defenseType,
      ranged: spell.gesture.target.distance > 1
    });
    boons += targetBoons.boons;
    banes += targetBoons.banes;

    // Prepare Roll Data
    const rollData = {
      actorId: this.id,
      spellId: spell.id,
      target: target.uuid,
      ability: this.getAbilityBonus(Array.from(spell.scaling)),
      skill: 0,
      enchantment: 0,
      banes, boons,
      defenseType,
      dc: target.defenses[defenseType].total
    }

    // Call talent hooks
    this.callTalentHooks("prepareStandardCheck", rollData);
    this.callTalentHooks("prepareSpellAttack", spell, target, rollData);
    target.callTalentHooks("defendSpellAttack", spell, this, rollData);

    // Create the Attack Roll instance
    const roll = new AttackRoll(rollData);

    // Evaluate the result and record the result
    await roll.evaluate({async: true});
    const r = roll.data.result = target.testDefense(defenseType, roll.total);

    // Deflection and Avoidance
    const {HIT, DEFLECT, EFFECTIVE} = AttackRoll.RESULT_TYPES;
    if ( ![HIT, DEFLECT, EFFECTIVE].includes(r) ) return roll;
    if ( (r === DEFLECT) && roll.isCriticalFailure ) return roll;

    // Structure damage
    roll.data.damage = {
      overflow: roll.overflow,
      multiplier: spell.damage.multiplier ?? 1,
      base: spell.damage.base,
      bonus: (spell.damage.bonus ?? 0) + (this.rollBonuses.damage?.[spell.damage.type] ?? 0),
      resistance: target.getResistance(spell.rune.resource, spell.damage.type),
      resource: spell.rune.resource,
      type: spell.damage.type,
      restoration: spell.damage.restoration
    };
    roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
    return roll;
  }

  /* -------------------------------------------- */

  async skillAttack(action, target) {

    // Prepare Roll Data
    const {bonuses, defenseType, restoration, resource, skillId} = action.usage;
    const rollData = Object.assign({}, bonuses, {
      actorId: this.id,
      type: skillId,
      target: target.uuid,
    });

    // Conventional defense
    if ( defenseType in target.defenses ) {
      Object.assign(rollData, {defenseType, dc: target.defenses[defenseType].total});
    }

    // Opposed skill
    else {
      Object.assign(rollData, {defenseType: skillId, dc: target.skills[skillId].passive});
    }

    // Apply talent hooks
    this.callTalentHooks("prepareStandardCheck", rollData);
    this.callTalentHooks("prepareSkillAttack", action, target, rollData);
    target.callTalentHooks("defendSkillAttack", action, this, rollData);

    // Create and evaluate the skill attack roll
    const roll = new game.system.api.dice.AttackRoll(rollData);
    await roll.evaluate();
    roll.data.result = target.testDefense(defenseType, roll.total, rollData.dc);

    // Create resulting damage
    if ( roll.data.result === AttackRoll.RESULT_TYPES.EFFECTIVE ) {
      roll.data.damage = {
        overflow: roll.overflow,
        multiplier: bonuses.multiplier,
        base: bonuses.skill + (bonuses.base ?? 0),
        bonus: bonuses.damageBonus,
        resistance: target.getResistance(resource, bonuses.damageType),
        type: bonuses.damageType,
        resource: resource,
        restoration
      };
      roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
    }
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Restore all resource pools to their maximum value.
   * @param {object} updateData     Additional update data to include in the rest operation
   * @returns {Promise<CrucibleActor>}
   */
  async rest(updateData, {allowDead=false}={}) {
    if ( (this.isDead || this.isInsane) && !allowDead ) return this;
    return this.update(foundry.utils.mergeObject(this._getRestData(), updateData));
  }

  /* -------------------------------------------- */

  /**
   * Prepare an object that replenishes all resource pools to their current maximum level
   * @returns {{}}
   * @private
   */
  _getRestData() {
    const updates = {};
    for ( let [id, resource] of Object.entries(this.system.resources) ) {
      const cfg = SYSTEM.RESOURCES[id];
      updates[`system.resources.${id}.value`] = cfg.type === "reserve" ? 0 : resource.max;
    }
    updates["system.status"] = null;
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Alter the resource pools of the actor using an object of change data
   * @param {Object<string, number>} deltas       Changes where the keys are resource names and the values are deltas
   * @param {object} [updates]                    Other Actor updates to make as part of the same transaction
   * @param {object} [options]                    Options which are forwarded to the update method
   * @param {boolean} [options.reverse]             Reverse the direction of change?
   * @param {string} [options.statusText]           Custom status text displayed on the Token.
   * @returns {Promise<CrucibleActor>}            The updated Actor document
   */
  async alterResources(deltas, updates={}, {reverse=false, statusText}={}) {
    const r = this.system.resources;

    // Apply resource updates
    const changes = {};
    for ( let [resourceName, delta] of Object.entries(deltas) ) {
      if ( !(resourceName in changes) ) changes[resourceName] = {value: 0};
      let resource = r[resourceName];
      if ( reverse ) delta *= -1;

      // Frightened and Diseased
      if ( (resourceName === "morale") && this.statuses.has("frightened") ) delta = Math.min(delta, 0);
      else if ( (resourceName === "health") && this.statuses.has("diseased") ) delta = Math.min(delta, 0);

      // Handle overflow
      const uncapped = resource.value + delta;
      const overflow = Math.min(uncapped, 0);

      // Health overflows into Wounds
      if ( (resourceName === "health") && (overflow !== 0) && ("wounds" in r) ) {
        changes.wounds ||= {value: r.wounds.value};
        changes.wounds.value -= overflow;
      }

      // Morale overflows into Madness
      else if ( (resourceName === "morale") && (overflow !== 0) && ("madness" in r) ) {
        changes.madness ||= {value: r.madness.value};
        changes.madness.value -= overflow;
      }

      // Regular updates
      changes[resourceName].value = uncapped;
    }

    // Constrain and merge changes
    for ( const [id, obj] of Object.entries(changes) ) {
      obj.value = Math.clamped(obj.value, 0, r[id].max);
    }
    updates = foundry.utils.mergeObject(updates, {"system.resources": changes});
    return this.update(updates, {statusText});
  }

  /* -------------------------------------------- */

  /**
   * Toggle a named status active effect for the Actor
   * @param {string} statusId     The status effect ID to toggle
   * @param {boolean} active      Should the effect be active?
   * @param {boolean} overlay     Should the effect be an overlay?
   * @returns {Promise<ActiveEffect|undefined>}
   */
  async toggleStatusEffect(statusId, {active=true, overlay=false}={}) {
    const effectData = CONFIG.statusEffects.find(e => e.id === statusId);
    if ( !effectData ) return;
    const existing = this.effects.find(e => e.statuses.has(effectData.id));

    // No changes needed
    if ( !active && !existing ) return;
    if ( active && existing ) return existing.update({"flags.core.overlay": overlay});

    // Remove an existing effect
    if ( !active && existing ) return existing.delete();

    // Add a new effect
    else if ( active ) {
      const createData = foundry.utils.mergeObject(effectData, {
        _id: SYSTEM.EFFECTS.getEffectId(statusId),
        label: game.i18n.localize(effectData.label),
        statuses: [statusId]
      });
      if ( overlay ) createData["flags.core.overlay"] = true;
      await ActiveEffect.create(createData, {parent: this, keepId: true});
    }
  }

  /* -------------------------------------------- */
  /*  Action Outcome Management                   */
  /* -------------------------------------------- */

  /**
   * Deal damage to a target. This method requires ownership of the target Actor.
   * Applies resource changes to both the initiating Actor and to affected Targets.
   * @param {CrucibleActionOutcome} outcome     The Action outcome
   * @param {object} [options]                  Options which affect how damage is applied
   * @param {boolean} [options.reverse]           Reverse damage instead of applying it
   */
  async applyActionOutcome(outcome, {reverse=false}={}) {
    const wasIncapacitated = this.isIncapacitated;
    const wasBroken = this.isBroken;

    // Apply changes to the Actor
    await this.alterResources(outcome.resources, outcome.actorUpdates, {reverse});
    await this.#applyOutcomeEffects(outcome, reverse);

    // Record target state changes
    if ( this.isIncapacitated && !wasIncapacitated ) outcome.incapacitated = true;
    if ( this.isBroken && !wasBroken ) outcome.broken = true;
  }

  /* -------------------------------------------- */

  /**
   * Apply or reverse ActiveEffect changes occurring through an action outcome.
   * @param {CrucibleActionOutcome} outcome     The action outcome
   * @param {boolean} reverse                   Reverse the effects instead of applying them?
   * @returns {Promise<void>}
   */
  async #applyOutcomeEffects(outcome, reverse=false) {

    // Reverse effects
    if ( reverse ) {
      const deleteEffectIds = outcome.effects.reduce((arr, e) => {
        if ( this.effects.has(e._id) ) arr.push(e._id);
        return arr;
      }, []);
      await this.deleteEmbeddedDocuments("ActiveEffect", deleteEffectIds);
      return;
    }

    // Don't apply effects if there was not a successful roll
    if ( outcome.rolls.length && !outcome.rolls.some(r => r.isSuccess) ) return;

    // Create new effects or update existing ones
    const toCreate = [];
    const toUpdate = [];
    for ( const effectData of outcome.effects ) {
      const existing = this.effects.get(effectData._id);
      if ( existing ) {
        effectData.duration ||= {};
        effectData.duration.startRound = game.combat?.round || null;
        toUpdate.push(effectData);
      }
      else toCreate.push(effectData);
    }
    await this.updateEmbeddedDocuments("ActiveEffect", toUpdate);
    await this.createEmbeddedDocuments("ActiveEffect", toCreate, {keepId: true});
  }

  /* -------------------------------------------- */

  /**
   * Additional steps taken when this Actor deals damage to other targets.
   * @param {CrucibleAction} action                The action performed
   * @param {CrucibleActionOutcomes} outcomes      The action outcomes that occurred
   */
  onDealDamage(action, outcomes) {
    const status = this.system.status;
    const self = outcomes.get(this);
    const updates = self.actorUpdates;
    for ( const o of outcomes.values() ) {
      if ( o === self ) continue;

      // Battle Focus // TODO revisit this
      if ( (o.criticalSuccess || o.incapacitated) && this.talentIds.has("battlefocus00000")
        && !(status.battleFocus || updates.system?.status?.battleFocus) ) {
        self.resources.focus = (self.resources.focus || 0) + 1;
        foundry.utils.setProperty(updates, "system.status.battleFocus", true);
      }

      // Blood Frenzy // TODO revisit this
      if ( o.criticalSuccess && this.talentIds.has("bloodfrenzy00000")
        && !(status.bloodFrenzy || updates.system?.status?.bloodFrenzy) ) {
        self.resources.action = (self.resources.action || 0) + 1;
        foundry.utils.setProperty(updates, "system.status.bloodFrenzy", true);
      }

      // Critical Hit Effects
      if ( o.criticalSuccess ) this.#applyCriticalEffects(action, o);
    }
  }

  /* -------------------------------------------- */

  /**
   * Add effects which occur on critical hits to the effects applied by an action outcome.
   * @param {CrucibleAction} action             The action being performed
   * @param {CrucibleActionOutcome} outcome     The action outcome which resulted in a critical hit
   */
  #applyCriticalEffects(action, outcome) {
    const {mainhand, offhand} = this.equipment.weapons;

    // Poisoner
    if ( this.talentIds.has("poisoner00000000") && this.effects.get(SYSTEM.EFFECTS.getEffectId("poisonBlades")) ) {
      outcome.effects.push(SYSTEM.EFFECTS.poisoned(this, outcome.target))
    }

    // Bloodletter
    if ( this.talentIds.has("bloodletter00000") ) {
      const damageTypes = new Set(["piercing", "slashing"]);
      if ( (action.tags.has("mainhand") && damageTypes.has(mainhand.system.damageType))
        || (action.tags.has("offhand") && damageTypes.has(offhand.system.damageType)) ) {
        const damageType = mainhand.system.damageType;
        outcome.effects.push(SYSTEM.EFFECTS.bleeding(this, outcome.target, {damageType}));
      }
    }

    // Concussive Blows
    if ( this.talentIds.has("concussiveblows0") ) {
      if ( (action.tags.has("mainhand") && (mainhand.system.damageType === "bludgeoning"))
        || (action.tags.has("offhand") && (offhand.system.damageType === "bludgeoning")) ) {
        outcome.effects.push(SYSTEM.EFFECTS.staggered(this, outcome.target));
      }
    }

    // Spell Runes
    const runeEffects = {
      dustbinder000000: {rune: "earth", effectName: "corroding"},
      lightbringer0000: {rune: "illumination", effectName: "irradiated"},
      mesmer0000000000: {rune: "control", effectName: "confusion"},
      necromancer00000: {rune: "death", effectName: "decay"},
      pyromancer000000: {rune: "flame", effectName: "burning"},
      rimecaller000000: {rune: "frost", effectName: "chilled"},
      surgeweaver00000: {rune: "lightning", effectName: "shocked"},
      voidcaller000000: {rune: "shadow", effectName: "entropy"},
      mender0000000000: {rune: "life", effectName: "mending"},
      inspirator000000: {rune: "spirit", effectName: "inspired"}
    }
    for ( const [talentId, {rune, effectName}] of Object.entries(runeEffects) ) {
      if ( this.talentIds.has(talentId) && (action.rune?.id === rune) ) {
        outcome.effects.push(SYSTEM.EFFECTS[effectName](this, outcome.target));
      }
    }
  }

  /* -------------------------------------------- */
  /*  Combat Encounters and Turn Order            */
  /* -------------------------------------------- */

  /**
   * Actions that occur at the beginning of an Actor's turn in Combat.
   * This method is only called for one User who has ownership permission over the Actor.
   * @returns {Promise<CrucibleActor>}
   */
  async onBeginTurn() {

    // Clear system statuses
    await this.update({"system.status": null});

    // Remove Active Effects which expire at the start of a turn
    await this.expireEffects(true);

    // Apply damage-over-time before recovery
    await this.applyDamageOverTime();

    // Recover resources
    const resources = {};
    const updates = {};
    if ( !this.isIncapacitated ) {
      const r = this.system.resources;
      resources.action = r.action.max;
      if ( this.talentIds.has("lesserregenerati") && !this.isIncapacitated ) resources.health = 1;
      if ( this.talentIds.has("irrepressiblespi") && !this.isBroken ) resources.morale = 1;
    }
    await this.alterResources(resources, updates);
  }

  /* -------------------------------------------- */

  /**
   * Actions that occur at the end of an Actor's turn in Combat.
   * This method is only called for one User who has ownership permission over the Actor.
   * @returns {Promise<void>}
   */
  async onEndTurn() {

    // Conserve Effort
    if ( this.talentIds.has("conserveeffort00") && this.system.resources.action.value ) {
      await this.alterResources({focus: 1}, {}, {statusText: "Conserve Effort"});
    }

    // Remove active effects which expire at the end of a turn
    await this.expireEffects(false);
  }

  /* -------------------------------------------- */

  /**
   * Apply damage over time effects which are currently active on the Actor.
   * Positive damage-over-time is applied as damage and is mitigated by resistance or amplified by vulnerability.
   * Negative damage-over-time is applied as healing and is unaffected by resistances or vulnerabilities.
   * @returns {Promise<void>}
   */
  async applyDamageOverTime() {
    for ( const effect of this.effects ) {
      const dot = effect.flags.crucible?.dot;
      if ( !dot ) continue;

      // Categorize damage
      const damage = {};
      for ( const r of Object.keys(SYSTEM.RESOURCES) ) {
        let v = dot[r];
        if ( !v ) continue;
        if (  v > 0 ) v = Math.clamped(v - this.resistances[dot.damageType].total, 0, 2 * v);
        damage[r] ||= 0;
        damage[r] -= v;
      }
      if ( foundry.utils.isEmpty(damage) ) return;
      await this.alterResources(damage, {}, {statusText: effect.label});
    }
  }

  /* -------------------------------------------- */

  /**
   * Expire active effects whose durations have concluded at the end of the Actor's turn.
   * @param {boolean} start       Is it the start of the turn (true) or the end of the turn (false)
   * @returns {Promise<void>}
   */
  async expireEffects(start=true) {
    const toDelete = [];
    for ( const effect of this.effects ) {
      if ( this.#isEffectExpired(effect, start) ) toDelete.push(effect.id);
    }
    await this.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  }

  /* -------------------------------------------- */

  /**
   * Test whether an ActiveEffect is expired.
   * @param {ActiveEffect} effect       The effect being tested
   * @param {boolean} start             Is it the start of the round?
   * @returns {boolean}
   */
  #isEffectExpired(effect, start=true) {
    const {startRound, rounds} = effect.duration;
    if ( !Number.isNumeric(rounds) ) return false;
    const isSelf = effect.origin === this.uuid;
    const remaining = (startRound + rounds) - game.combat.round;

    // Self effects expire at the beginning of your next turn
    if ( isSelf ) return start && (remaining <= 0);

    // Effects from others expire at the end of your turn
    else {
      if ( start ) return remaining < 0;
      else return remaining <= 0;
    }
  }

  /* -------------------------------------------- */
  /*  Character Creation Methods                  */
  /* -------------------------------------------- */

  /**
   * Toggle display of the Talent Tree.
   */
  async toggleTalentTree(active) {
    const tree = game.system.tree;
    if ( (tree.actor === this) && (active !== true) ) return game.system.tree.close();
    else if ( active !== false ) return game.system.tree.open(this);
  }

  /* -------------------------------------------- */

  /**
   * Reset all Talents for the Actor.
   * @param {object} [options]        Options which modify how talents are reset
   * @param {boolean} [options.dialog]    Present the user with a confirmation dialog?
   * @returns {Promise<void>}         A Promise which resolves once talents are reset or the dialog is declined
   */
  async resetTalents({dialog=true}={}) {

    // Prompt for confirmation
    if ( dialog ) {
      const confirm = await Dialog.confirm({
        title: `Reset Talents: ${this.name}`,
        content: `<p>Are you sure you wish to reset all Talents?</p>`,
        defaultYes: false
      });
      if ( !confirm ) return;
    }

    // Remove all non-permanent talents
    const deleteIds = this.items.reduce((arr, i) => {
      if ( (i.type === "talent") && !this.permanentTalentIds.has(i.id) ) arr.push(i.id);
      return arr;
    }, []);
    await this.deleteEmbeddedDocuments("Item", deleteIds);
  }

  /* -------------------------------------------- */

  /**
   * Re-sync all Talent data on this actor with updated source data.
   * @returns {Promise<void>}
   */
  async syncTalents() {
    const updates = [];
    const packIds = [CONFIG.SYSTEM.COMPENDIUM_PACKS.talent, CONFIG.SYSTEM.COMPENDIUM_PACKS.talentExtensions];
    for ( const packId of packIds ) {
      const pack = game.packs.get(packId);
      for ( const item of this.itemTypes.talent ) {
        const talent = pack.get(item.id);
        if ( talent ) updates.push(talent.toObject());
      }
    }
    return this.updateEmbeddedDocuments("Item", updates, {diff: false, recursive: false, noHook: true});
  }

  /* -------------------------------------------- */

  /**
   * Handle requests to add a new Talent to the Actor.
   * Confirm that the Actor meets the requirements to add the Talent, and if so create it on the Actor
   * @param {CrucibleItem} talent     The Talent item to add to the Actor
   * @param {object} [options]        Options which configure how the Talent is added
   * @param {boolean} [options.dialog]    Prompt the user with a confirmation dialog?
   * @returns {Promise<CrucibleItem|null>} The created talent Item or null if no talent was added
   */
  async addTalent(talent, {dialog=false}={}) {

    // Ensure the Talent is not already owned
    if ( this.items.find(i => (i.type === "talent") && (i.name === talent.name)) ) {
      const err = game.i18n.format("TALENT.AlreadyOwned", {name: talent.name});
      ui.notifications.warn(err);
      return null;
    }

    // Confirm that the Actor meets the requirements to add the Talent
    try {
      talent.system.assertPrerequisites(this);
    } catch(err) {
      ui.notifications.warn(err.message);
      return null;
    }

    // Confirm that the Actor has sufficient Talent points
    const points = this.points.talent;
    if ( !points.available ) {  // TODO - every talent costs 1 for now
      const err = game.i18n.format("TALENT.CannotAfford", {
        name: talent.name,
        cost: 1
      });
      ui.notifications.warn(err);
      return null;
    }

    // Confirmation dialog
    if ( dialog ) {
      const confirm = await Dialog.confirm({
        title: `Purchase Talent: ${talent.name}`,
        content: `<p>Spend 1 Talent Point to purchase <strong>${talent.name}</strong>?</p>`,
        defaultYes: false
      });
      if ( !confirm ) return null;
    }

    // Create the talent
    return talent.constructor.create(talent.toObject(), {parent: this, keepId: true});
  }

  /* -------------------------------------------- */

  /**
   * Advance the Actor a certain number of levels (or decrease level with a negative delta).
   * When advancing in level, resources are restored and advancement progress is reset.
   * @param {number} delta                The number of levels to advance or decrease
   * @returns {Promise<CrucibleActor>}    The modified Actor
   */
  async levelUp(delta=1) {
    if ( delta === 0 ) return;

    // Confirm that character creation is complete
    if ( this.isL0 ) {
      const steps = [
        this.system.details.ancestry?.name,
        this.system.details.background?.name,
        !this.points.ability.requireInput,
        !this.points.skill.available,
        !this.points.talent.available
      ];
      if ( !steps.every(k => k) ) return ui.notifications.warn("WALKTHROUGH.LevelZeroIncomplete", {localize: true});
    }

    // Commit the update
    const level = Math.clamped(this.level + delta, 0, 24);
    const update = {"system.advancement.level": level};
    return this.update(update);
  }

  /* -------------------------------------------- */

  /**
   * Purchase an ability score increase or decrease for the Actor
   * @param {string} ability      The ability id to increase
   * @param {number} delta        A number in [-1, 1] for the direction of the purchase
   * @return {Promise}
   */
  async purchaseAbility(ability, delta=1) {
    delta = Math.sign(delta);
    const a = this.system.abilities[ability];
    if ( !a || !delta ) return;

    // Can the ability be purchased?
    if ( !this.canPurchaseAbility(ability, delta) ) {
      return ui.notifications.warn(`WARNING.AbilityCannot${delta > 0 ? "Increase" : "Decrease"}`, {localize: true});
    }

    // Modify the ability
    if ( this.isL0 ) return this.update({[`system.abilities.${ability}.base`]: Math.max(a.base + delta, 0)});
    else return this.update({[`system.abilities.${ability}.increases`]: a.increases + delta});
  }

  /* -------------------------------------------- */

  /**
   * Test whether this Actor can modify an ability score in a certain direction.
   * @param {string} ability      A value in ABILITIES
   * @param {number} delta        A number in [-1, 1] for the direction of the purchase
   * @returns {boolean}           Can the ability score be changed?
   */
  canPurchaseAbility(ability, delta=1) {
    delta = Math.sign(delta);
    const points = this.points.ability;
    const a = this.system.abilities[ability];
    if ( !a || !delta ) return;

    // Case 1 - Point Buy
    if ( this.isL0 ) {
      if ( (delta > 0) && ((a.base === 3) || !points.pool) ) return false;
      else if ( (delta < 0) && (a.base === 0) ) return false;
      return true;
    }

    // Case 2 - Regular Increase
    else {
      if ( (delta > 0) && ((a.value === 12) || !points.available) ) return false;
      else if ( (delta < 0) && (a.increases === 0) ) return false;
      return true;
    }
  }

  /* -------------------------------------------- */

  /**
   * Purchase a skill rank increase or decrease for the Actor
   * @param {string} skillId      The skill id to increase
   * @param {number} delta        A number in [-1, 1] for the direction of the purchase
   * @return {Promise}
   */
  async purchaseSkill(skillId, delta=1) {
    delta = Math.sign(delta);
    const skill = this.system.skills[skillId];
    if ( !skill ) return;

    // Assert that the skill can be purchased
    try {
      this.canPurchaseSkill(skillId, delta, true);
    } catch (err) {
      return ui.notifications.warn(err);
    }

    // Adjust rank
    const rank = skill.rank + delta;
    const update = {[`system.skills.${skillId}.rank`]: rank};
    if ( rank === 3 ) update[`system.skills.${skillId}.path`] = null;
    return this.update(update);
  }

  /* -------------------------------------------- */

  /**
   * Test whether this Actor can modify a Skill rank in a certain direction.
   * @param {string} skillId      A skill in SKILLS
   * @param {number} delta        A number in [-1, 1] for the direction of the purchase
   * @param {boolean} strict      In strict mode an error message is thrown if the skill cannot be changed
   * @returns {boolean}           In non-strict mode, a boolean for whether the rank can be purchased
   * @throws                      In strict mode, an error if the skill cannot be purchased
   */
  canPurchaseSkill(skillId, delta=1, strict=false) {
    delta = Math.sign(delta);
    const skill = this.system.skills[skillId];
    if ( !skill || (delta === 0) ) return false;

    // Must Choose Background first
    if ( !this.ancestry.name || !this.background.name ) {
      if ( strict ) throw new Error(game.i18n.localize("WARNING.SkillRequireAncestryBackground"));
      return false;
    }

    // Decreasing Skill
    if ( delta < 0 ) {
      if ( skill.rank === 0 ) {
        if ( strict ) throw new Error("Cannot decrease skill rank");
        return false;
      }
      return true;
    }

    // Maximum Rank
    if ( skill.rank === 5 ) {
      if ( strict ) throw new Error("Skill already at maximum");
      return false;
    }

    // Require Specialization
    if ( (skill.rank === 3) && !skill.path ) {
      if ( strict ) throw new Error(game.i18n.localize(`SKILL.ChoosePath`));
      return false;
    }

    // Cannot Afford
    const p = this.points.skill;
    if ( p.available < skill.cost ) {
      if ( strict ) throw new Error(game.i18n.format(`SKILL.CantAfford`, {cost: skill.cost, points: p.available}));
      return false;
    }

    // Can purchase
    return true;
  }

  /* -------------------------------------------- */


  /**
   * Apply actor detail data.
   * This is an internal helper method not intended for external use.
   * @param {CrucibleItem|object|null} item    An Item document, object of Item data, or null to clear data
   * @param {string} type                     The data type, either "archetype" or "taxonomy"
   * @param {object} [options]                Options which affect how details are applied
   * @param {boolean} [options.canApply]        Allow new detail data to be applied?
   * @param {boolean} [options.canClear]        Allow the prior data to be cleared if null is passed?
   * @returns {Promise<void>}
   * @internal
   */
  async _applyDetailItem(item, type, {canApply=true, canClear=false}={}) {
    if ( !(type in this.system.details) ) {
      throw new Error(`Incorrect detail item type ${type} for Actor type ${this.type}`);
    }
    if ( (item === null) && !canClear ) {
      throw new Error(`You are not allowed to clear ${type} data from Actor ${this.name}`);
    }
    if ( item && !canApply ) {
      throw new Error(`You are not allowed to apply ${type} data to Actor ${this.name}`);
    }
    if ( item && (item.type !== type) ) throw new Error(`You must provide a "${type}" item.`);

    // Prepare data
    const key = `system.details.${type}`;
    const updateData = {};
    let message;

    // Remove existing talents
    const existing = this.system.details[type];
    if ( existing?.talents?.size ) {
      const deleteIds = Array.from(existing.talents).filter(id => this.items.has(id));
      await this.deleteEmbeddedDocuments("Item", deleteIds);
    }

    // Clear the detail data
    if ( item === null ) updateData[key] = null;

    // Add new detail data
    else {
      const itemData = item instanceof Item ? item.toObject() : foundry.utils.deepClone(item);
      const detail = updateData[key] = Object.assign(itemData.system, {name: itemData.name, img: itemData.img});
      if ( detail.talents?.length ) {
        updateData.items = [];
        for ( const uuid of detail.talents ) {
          const doc = await fromUuid(uuid);
          if ( doc ) updateData.items.push(doc.toObject());
        }
      }
      message = game.i18n.format("ACTOR.AppliedDetailItem", {name: detail.name, type, actor: this.name});
    }

    // Perform the update
    await this.update(updateData, {keepEmbeddedIds: true});
    if ( message ) ui.notifications.info(message);
  }

  /* -------------------------------------------- */

  /**
   * View actor detail data as an editable item.
   * This is an internal helper method not intended for external use.
   * @param {string} type         The data type, either "archetype" or "taxonomy"
   * @param {object} [options]    Options that configure how the data is viewed
   * @param {boolean} [options.editable]    Is the detail item editable?
   * @returns {Promise<void>}
   * @internal
   */
  async _viewDetailItem(type, {editable=false}={}) {
    if ( !(type in this.system.details) ) {
      throw new Error(`Incorrect detail item type ${type} for Actor type ${this.type}`);
    }
    const data = this.toObject().system.details[type];

    // View current data
    if ( data?.name ) {
      const cls = getDocumentClass("Item");
      const item = new cls({
        name: data.name,
        img: data.img,
        type: type,
        system: foundry.utils.deepClone(data)
      }, {parent: this});
      item.sheet.render(true, {editable});
      return;
    }

    // Browse compendium pack
    const pack = game.packs.get(SYSTEM.COMPENDIUM_PACKS[type]);
    pack.render(true);
  }

  /* -------------------------------------------- */
  /*  Equipment Management Methods                */
  /* -------------------------------------------- */

  /**
   * Equip an owned armor Item.
   * @param {string} itemId       The owned Item id of the Armor to equip
   * @param {boolean} [equipped]  Is the armor being equipped (true), or unequipped (false)
   * @return {Promise}            A Promise which resolves once the armor has been equipped or un-equipped
   */
  async equipArmor({itemId, equipped=true}={}) {
    const current = this.equipment.armor;
    const item = this.items.get(itemId);

    // Modify the currently equipped armor
    if ( current === item ) {
      if ( equipped ) return current;
      else return current.update({"system.equipped": false});
    }

    // Cannot equip armor
    if ( current.id ) {
      return ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
        actor: this.name,
        item: item.name,
        type: game.i18n.localize("TYPES.Item.armor")
      }));
    }

    // Equip new armor
    return item.update({"system.equipped": true});
  }

  /* -------------------------------------------- */

  /**
   * Equip an owned weapon Item.
   * @param {string} itemId       The owned Item id of the Weapon to equip. The slot is automatically determined.
   * @param {string} [mainhandId] The owned Item id of the Weapon to equip specifically in the mainhand slot.
   * @param {string} [offhandId]  The owned Item id of the Weapon to equip specifically in the offhand slot.
   * @param {boolean} [equipped]  Are these weapons being equipped (true), or unequipped (false).
   * @return {Promise}            A Promise which resolves once the weapon has been equipped or un-equipped
   */
  async equipWeapon({itemId, mainhandId, offhandId, equipped=true}={}) {
    const weapons = this.equipment.weapons;
    let isMHFree = !weapons.mainhand.id;
    let isOHFree = (weapons.mainhand.config.category.hands < 2) && !weapons.offhand.id;

    // Identify the items being requested
    const w1 = this.items.get(mainhandId ?? itemId, {strict: true});
    const w2 = this.items.get(offhandId);
    const updates = [];
    let actionCost = 0;
    const actorUpdates = {};

    // Handle un-equipping weapons which are currently equipped
    if ( !equipped ) {
      if ( (w1 === weapons.mainhand) || (w1 === weapons.offhand) ) {
        updates.push({_id: w1.id, "system.equipped": false});
      }
      if ( w2 && (w2 === weapons.offhand) ) {
        updates.push({_id: w2.id, "system.equipped": false});
      }
      return this.updateEmbeddedDocuments("Item", updates);
    }

    // Equip a secondary weapon that can only go in an offhand slot
    if ( w2 ) {
      if ( !w2.config.category.off ) {
        ui.notifications.warn(game.i18n.format("WARNING.CannotEquipInvalidCategory", {
          actor: this.name,
          item: w2.name,
          type: game.i18n.localize("ACTION.TagOffhand")
        }));
      }
      if ( !isOHFree ) {
        ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
          actor: this.name,
          item: w2.name,
          type: game.i18n.localize("ACTION.TagOffhand")
        }));
      }
      else {
        isOHFree = false;
        updates.push({_id: w2.id, "system.equipped": true});
        actionCost += w2.system.properties.has("ambush") ? 0 : 1;
      }
    }

    // Equip the primary weapon in the main-hand slot
    if ( w1.config.category.main && isMHFree ) {
      updates.push({_id: w1.id, "system.equipped": true});
      actionCost += w1.system.properties.has("ambush") ? 0 : 1;
    }

    // Equip the primary weapon in the off-hand slot
    else if ( w1.config.category.off && isOHFree ) {
      updates.push({_id: w1.id, "system.equipped": true});
      actionCost += w1.system.properties.has("ambush") ? 0 : 1;
    }

    // Failed to equip
    else {
      ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
        actor: this.name,
        item: w1.name,
        type: game.i18n.localize(`ACTION.Tag${w1.config.category.off ? "Off" : "Main"}Hand`)
      }));
    }

    // Adjust action cost
    if ( this.talentIds.has("preparedness0000") && !this.system.status.hasMoved ) {
      actionCost -= 1;
      actorUpdates["system.status.hasMoved"] = true;
    }

    // Apply the updates
    if ( this.combatant ) {
      if ( this.system.resources.action.value < actionCost ) {
        return ui.notifications.warn("WARNING.CannotEquipActionCost", {localize: true});
      }
      await this.alterResources({action: -actionCost}, actorUpdates);
    }
    await this.updateEmbeddedDocuments("Item", updates);
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @override */
  _applyDefaultTokenSettings(data, {fromCompendium=false}={}) {
    const defaults = foundry.utils.deepClone(game.settings.get("core", DefaultTokenConfig.SETTING));
    defaults.bar1 = {attribute: "resources.health"};
    defaults.bar2 = {attribute: "resources.morale"};
    switch ( data.type ) {
      case "hero":
        Object.assign(defaults, {vision: true, actorLink: true, disposition: 1});
        break;
      case "adversary":
        Object.assign(defaults, {vision: false, actorLink: false, disposition: -1});
        break;
    }
    return this.updateSource({prototypeToken: defaults});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(data, options, user) {
    await super._preUpdate(data, options, user);

    // Restore resources when level changes
    const restProperties = this.type === "hero" ? ["system.advancement.level"]
      : ["system.details.level", "system.details.threat"]
    if ( restProperties.some(p => foundry.utils.hasProperty(data, p)) ) {
      const clone = this.clone();
      clone.updateSource(data);
      Object.assign(data, clone._getRestData());
      if ( this.type === "hero" ) {
        data["system.advancement.progress"] = clone.level > this.level ? 0 : clone.system.advancement.next;
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    this.#displayScrollingStatus(data, options);
    if ( game.userId === userId ) {    // Follow-up updates only made by the initiating user
      this.#replenishResources(data);
      this.#applyResourceStatuses(data);
    }
    this.#updateCachedResources();

    // Refresh talent tree
    const tree = game.system.tree;
    if ( tree.actor === this ) {
      const talentChange = (foundry.utils.hasProperty(data, "system.advancement.level") || ("items" in data));
      if ( talentChange ) tree.refresh();
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onCreateDescendantDocuments(...args) {
    super._onCreateDescendantDocuments(...args);
    const tree = game.system.tree;
    if ( tree.actor === this ) tree.refresh();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onDeleteDescendantDocuments(...args) {
    super._onDeleteDescendantDocuments(...args);
    const tree = game.system.tree;
    if ( tree.actor === this ) tree.refresh();
  }

  /* -------------------------------------------- */

  /**
   * Display changes to the Actor as scrolling combat text.
   */
  #displayScrollingStatus(changed, {statusText}={}) {
    if ( !changed.system?.resources ) return;
    const tokens = this.getActiveTokens(true);
    if ( !tokens.length ) return;
    for ( let [resourceName, prior] of Object.entries(this._cachedResources ) ) {
      if ( changed.system.resources[resourceName]?.value === undefined ) continue;

      // Get change data
      const resource = SYSTEM.RESOURCES[resourceName];
      const attr = this.system.resources[resourceName];
      const delta = attr.value - prior;
      if ( delta === 0 ) continue;
      const text = `${delta.signedString()} ${statusText ?? resource.label}`;
      const pct = Math.clamped(Math.abs(delta) / attr.max, 0, 1);
      const fontSize = (24 + (24 * pct)) * (canvas.dimensions.size / 100).toNearest(0.25); // Range between [24, 48]
      const healSign = resource.type === "active" ? 1 : -1;
      const fillColor = resource.color[Math.sign(delta) === healSign ? "heal" : "high"];

      // Display for all tokens
      for ( let token of tokens ) {
        canvas.interface.createScrollingText(token.center, text, {
          anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
          fontSize: fontSize,
          fill: fillColor,
          stroke: 0x000000,
          strokeThickness: 4,
          jitter: 0.5
        });
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply status effect changes when attribute pools change
   * @param {object} data     The data which changed
   * @returns {Promise<void>}
   * @private
   */
  async #applyResourceStatuses(data) {
    const r = data?.system?.resources || {};
    if ( ("health" in r) || ("wounds" in r) ) {
      await this.toggleStatusEffect("incapacitated", {active: this.isIncapacitated && !this.isDead });
      await this.toggleStatusEffect("dead", {active: this.isDead});
    }
    if ( ("morale" in r) || ("madness" in r) ) {
      await this.toggleStatusEffect("broken", {active: this.isBroken && !this.isInsane });
      await this.toggleStatusEffect("insane", {active: this.isInsane});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the cached resources for this actor.
   * @private
   */
  #updateCachedResources() {
    this._cachedResources = Object.entries(this.system.resources).reduce((obj, [id, {value}]) => {
      obj[id] = value;
      return obj;
    }, {});
  }

  /* -------------------------------------------- */

  #replenishResources(data) {
    const levelChange = foundry.utils.hasProperty(data, "system.advancement.level");
    const attributeChange = Object.keys(SYSTEM.ABILITIES).some(k => {
      return foundry.utils.hasProperty(data, `system.abilities.${k}`);
    });
    if ( this.isOwner && (levelChange || attributeChange) ) this.rest();
  }
}
