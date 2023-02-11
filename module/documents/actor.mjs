import { SYSTEM } from "../config/system.js";
import StandardCheck from "../dice/standard-check.js"
import AttackRoll from "../dice/attack-roll.mjs";
import ActionData from "../data/action.mjs";


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
    this._updateCachedResources();
  }

  /**
   * Track the Actions which this Actor has available to use
   * @type {Object<string, ActionData>}
   */
  actions = this["actions"];

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
   * Track the progression points which are available and spent
   * @type {{
   *   ability: {pool: number, total: number, bought: number, spent: number, available: number },
   *   skill: {total: number, spent: number, available: number },
   *   talent: {total: number, spent: number, available: number }
   * }}
   */
  points = this["points"];

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
  get attributes() {
    return this.system.attributes;
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
    return (this.attributes.health.value === 0) && (this.attributes.wounds.value < this.attributes.wounds.max);
  }

  /**
   * Is this Actor broken?
   * @type {boolean}
   */
  get isBroken() {
    return (this.attributes.morale.value === 0) && (this.attributes.madness.value < this.attributes.madness.max);
  }

  /**
   * Is this Actor dead?
   * @type {boolean}
   */
  get isDead() {
    if ( this.type === "npc" ) return this.attributes.health.value === 0;
    return this.attributes.wounds.value === this.attributes.wounds.max;
  }

  /**
   * Is this Actor insane?
   * @type {boolean}
   */
  get isInsane() {
    return this.attributes.madness.value === this.attributes.madness.max;
  }

  /**
   * Is this Actor currently in the active Combat encounter?
   * @type {boolean}
   */
  get inCombat() {
    if ( this.isToken ) return !!game.combat?.combatants.find(c => c.tokenId === this.token.id);
    return !!game.combat?.combatants.find(c => c.actorId === this.id);
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
  talentIds;

  /* -------------------------------------------- */
  /*  Actor Preparation
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    if ( this.type === "adversary" ) return;
    this.system.details.ancestry ||= {};
    this.system.details.background ||= {};

    // Prepare placeholder point totals
    this._prepareAdvancement();

    // Prepare Attributes
    this._prepareAttributes();

    // Prepare Skills
    this._prepareSkills();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareEmbeddedDocuments() {
    super.prepareEmbeddedDocuments();
    if ( this.type === "adversary" ) return;
    const items = this.itemTypes;
    this._prepareTalents(items);
    this.equipment = this._prepareEquipment(items);
    this._prepareActions();
  };

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    if ( this.type === "adversary" ) return;
    this._prepareResources();
    this._prepareDefenses();
  }

  /* -------------------------------------------- */

  /**
   * Compute the available points which can be spent to advance this character
   * @private
   */
  _prepareAdvancement() {
    const adv = this.system.advancement;
    adv.level = Math.clamped(adv.level, 0, 24);
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
   * Prepare attributes, ability scores, and resource pools for the Actor.
   * @private
   */
  _prepareAttributes() {
    const points = this.points.ability;
    const ancestry = this.ancestry;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in CONFIG.SYSTEM.ABILITIES ) {
      const ability = this.attributes[a];

      // Configure initial value
      ability.initial = 1;
      if ( a === ancestry.primary ) ability.initial = SYSTEM.ANCESTRIES.primaryAttributeStart;
      else if ( a === ancestry.secondary ) ability.initial = SYSTEM.ANCESTRIES.secondaryAttributeStart;
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
   * Classify the Items in the Actor's inventory to identify current equipment.
   * @returns {ActorEquipment}
   * @private
   */
  _prepareEquipment({armor, weapon, accessory}={}) {
    return {
      armor: this._prepareArmor(armor),
      weapons: this._prepareWeapons(weapon),
      accessories: {} // TODO: Equipped Accessories
    };
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

    // Populate unarmed weaponry for unused slots
    if ( !weapons.mainhand ) weapons.mainhand = this._getUnarmedWeapon();
    if ( !weapons.offhand ) weapons.offhand = this._getUnarmedWeapon();

    // Reference final weapon configurations
    const mh = weapons.mainhand;
    const mhCategory = mh.config.category;
    const oh = weapons.offhand;
    const ohCategory = oh.config.category;

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

    // Slow Weapons
    weapons.slow = mh.system.properties.has("slow") + oh.system.properties.has("slow");
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
    if ( this.talentIds.has("pugilist00000000") ) data.system.quality = "fine";
    if ( this.talentIds.has("martialartist000") ) data.system.enchantment = "minor";
    return new itemCls(data, {parent: this});
  }

  /* -------------------------------------------- */

  /**
   * Prepare Actions which the Actor may actively use
   * @private
   */
  _prepareActions() {
    this.actions = {};

    // Default actions that every character can do
    for ( let ad of SYSTEM.ACTION.DEFAULT_ACTIONS ) {
      const a = new ActionData(ad);
      if ( a.tags.has("spell") && !(this.grimoire.gestures.size && this.grimoire.runes.size) ) continue;
      this.actions[a.id] = a.prepareForActor(this);
    }

    // Actions that are unlocked through an owned Talent
    for ( let t of this.itemTypes.talent ) {
      for ( let a of t.actions ) {
        this.actions[a.id] = a.prepareForActor(this);
      }
    }
  }

  /* -------------------------------------------- */


  /**
   * Prepare Skills for the actor, translating the owned Items for skills and merging them with unowned skills.
   * Validate the number of points spent on skills, and the number of skill points remaining to be spent.
   * @private
   */
  _prepareSkills() {

    // Populate all the skills
    const ranks = SYSTEM.SKILL_RANKS;
    const ancestry = this.ancestry;
    const background = this.background;
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
      const attrs = config.attributes.map(a => this.attributes[a].value);
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

  /**
   * Prepare owned Talent items that the Actor has unlocked
   * @private
   */
  _prepareTalents({talent}={}) {
    this.talentIds = new Set();
    this.grimoire = {runes: new Set(), gestures: new Set(), inflections: new Set()};
    const points = this.points.talent;

    // Iterate over talents
    for ( const t of talent ) {
      this.talentIds.add(t.id);
      points.spent += 1; // TODO - every talent costs 1 for now

      // Register spellcraft knowledge
      if ( t.system.rune ) {
        this.grimoire.runes.add(SYSTEM.SPELL.RUNES[t.system.rune]);
        if ( !this.grimoire.gestures.size ) this.grimoire.gestures.add(SYSTEM.SPELL.GESTURES.touch);
      }
      if ( t.system.gesture ) this.grimoire.gestures.add(SYSTEM.SPELL.GESTURES[t.system.gesture]);
      if ( t.system.inflection ) this.grimoire.inflections.add(SYSTEM.SPELL.INFLECTIONS[t.system.inflection]);
    }

    // Warn if the Actor does not have a legal build
    points.available = points.total - points.spent;
    if ( points.available < 0) {
      ui.notifications?.warn(`Actor ${this.name} has more Talents unlocked than they have talent points available.`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare Defenses and Resistances data for the Actor
   * @private
   */
  _prepareDefenses() {
    const {attributes, defenses} = this.system;

    // Armor and Dodge from equipped Armor
    const armorData = this.equipment.armor.system;
    defenses.armor.base = armorData.armor.base;
    defenses.armor.bonus = armorData.armor.bonus;
    defenses.dodge.base = armorData.dodge.base;
    defenses.dodge.bonus = Math.max(attributes.dexterity.value - armorData.dodge.start, 0);
    defenses.dodge.max = defenses.dodge.base + (12 - armorData.dodge.start);

    // Block and Parry from equipped Weapons
    const weaponData = [this.equipment.weapons.mainhand.system];
    if ( !this.equipment.weapons.twoHanded ) weaponData.push(this.equipment.weapons.offhand.system);
    defenses.block = {base: 0, bonus: 0};
    defenses.parry = {base: 0, bonus: 0};
    for ( let wd of weaponData ) {
      for ( let d of ["block", "parry"] ) {
        defenses[d].base += wd.defense[d];
      }
    }

    // Patient Deflection
    if ( this.talentIds.has("patientdeflectio") && this.equipment.weapons.unarmed ) {
      defenses.parry.bonus += Math.ceil(attributes.wisdom.value / 2);
    }

    // Unarmed Blocking
    if ( this.talentIds.has("unarmedblocking0") && this.equipment.weapons.unarmed ) {
      defenses.block.bonus += Math.ceil(attributes.toughness.value / 2);
    }

    // Compute total physical defenses
    const physicalDefenses = ["dodge", "parry", "block", "armor"];
    defenses["physical"] = 0;
    for ( let pd of physicalDefenses ) {
      let d = defenses[pd];
      d.total = d.base + d.bonus;
      defenses.physical += d.total;
    }

    // Saves Defenses
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( k === "physical" ) continue;
      let d = this.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + this.attributes[a].value, SYSTEM.PASSIVE_BASE);
      d.total = d.base + d.bonus;
    }

    // Damage Resistances
    this._prepareResistances();
  }

  /* -------------------------------------------- */

  /**
   * Prepare derived resistance data for the Actor.
   * @private
   */
  _prepareResistances() {
    const ancestry = this.system.details.ancestry;
    const hasRunewarden = this.talentIds.has("runewarden000000");
    for ( let [id, r] of Object.entries(this.system.resistances) ) {

      // Ancestry Resistances
      if ( id === ancestry.resistance ) r.base = SYSTEM.ANCESTRIES.resistanceAmount;
      else if ( id === ancestry.vulnerability ) r.base = -SYSTEM.ANCESTRIES.resistanceAmount;

      // Runewarden
      if ( hasRunewarden && this.grimoire.runes.find(r => r.damageType === id) ) r.base += 5;
      r.total = r.base + r.bonus;
    }
  }

  /* -------------------------------------------- */

  getDefenses({armor}) {
    const attributes = this.system.attributes;
    const defenses = foundry.utils.deepClone(this.system.defenses);
    armor = armor || this.equipment.armor;

    // Physical defenses
    const armorData = armor.system;
    defenses.armor.base = armorData.armor.base;
    defenses.armor.bonus = armorData.armor.bonus;
    defenses.dodge.base = armorData.dodge.base;
    defenses.dodge.bonus = Math.max(attributes.dexterity.value - armorData.dodge.start, 0);
    defenses.dodge.max = defenses.dodge.base + (12 - armorData.dodge.start);

    // Compute total physical defenses
    const physicalDefenses = ["dodge", "parry", "block", "armor"];
    defenses["physical"] = 0;
    for ( let pd of physicalDefenses ) {
      let d = defenses[pd];
      d.total = d.base + d.bonus;
      defenses.physical += d.total;
    }
    return defenses;
  }

  /* -------------------------------------------- */

  /**
   * Compute the values of resource pools for the Actor based on their attributes and resource rolls.
   * @private
   */
  _prepareResources() {
    const lvl = this.system.advancement.level;
    const attrs = this.system.attributes;

    // Health
    attrs.health.max = (4 * (lvl + attrs.toughness.value)) + (2 * (attrs.strength.value + attrs.dexterity.value));
    attrs.health.value = Math.clamped(attrs.health.value, 0, attrs.health.max);

    // Wounds
    attrs.wounds.max = 2 * attrs.health.max;
    attrs.wounds.value = Math.clamped(attrs.wounds.value, 0, attrs.wounds.max);

    // Morale
    attrs.morale.max = (4 * (lvl + attrs.presence.value)) + (2 * (attrs.intellect.value + attrs.wisdom.value));
    attrs.morale.value = Math.clamped(attrs.morale.value, 0, attrs.morale.max);

    // Madness
    attrs.madness.max = 2 * attrs.morale.max;
    attrs.madness.value = Math.clamped(attrs.madness.value, 0, attrs.madness.max);

    // Action
    attrs.action.max = lvl > 0 ? 3 : 0;
    attrs.action.value = Math.clamped(attrs.action.value, 0, attrs.action.max);

    // Focus
    attrs.focus.max = lvl === 0 ? 0
      : Math.floor(lvl / 2) + Math.max(attrs.wisdom.value, attrs.presence.value, attrs.intellect.value);
    attrs.focus.value = Math.clamped(attrs.focus.value, 0, attrs.focus.max);
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
    const attrs = this.attributes;
    return Math.ceil(scaling.reduce((x, t) => x + attrs[t].value, 0) / scaling.length);
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

    // Create the check roll
    const sc = new StandardCheck({
      actorId: this.id,
      banes: banes,
      boons: boons,
      dc: dc,
      ability: skill.abilityBonus,
      skill: skill.skillBonus,
      enchantment: skill.enchantmentBonus,
      type: skillId,
      rollMode: rollMode,
    });

    // Prompt the user with a roll dialog
    const flavor = game.i18n.format("SKILL.RollFlavor", {name: this.name, skill: CONFIG.SYSTEM.SKILLS[skillId].name});
    if ( dialog ){
      const title = game.i18n.format("SKILL.RollTitle", {name: this.name, skill: CONFIG.SYSTEM.SKILLS[skillId].name});
      const response = await sc.dialog({title, flavor, rollMode});
      if ( response === null ) return null;
    }

    // Execute the roll to chat
    await sc.toMessage({flavor});
    return sc;
  }

  /* -------------------------------------------- */

  /**
   * Test the Actor's defense, determining which defense type is used to avoid an attack.
   * @param {string} defenseType
   * @param {number} rollTotal
   * @returns {AttackRoll.RESULT_TYPES}
   */
  testDefense(defenseType, rollTotal) {
    const d = this.system.defenses;

    // Physical Defense
    if ( defenseType === "physical" ) {

      // Hit
      if ( rollTotal > d.physical ) return AttackRoll.RESULT_TYPES.HIT;

      // Dodge
      const r = twist.random() * d.physical;
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

    // Save Defenses
    else {
      if ( rollTotal > d[defenseType].total ) return AttackRoll.RESULT_TYPES.EFFECTIVE;
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
    return action.use(this, {dialog: true, ...options});
  }

  /* -------------------------------------------- */

  /**
   * Cast a certain spell against a target
   * @param {ActionData} action
   * @param {CrucibleActor} target
   * @param {object} bonuses
   * @returns {Promise<void>}
   */
  async castSpell(action, target) {
    if ( !(target instanceof CrucibleActor) ) throw new Error("You must define a target Actor for the spell.");
    const spell = action.spell;

    // Create the Attack Roll instance
    const defense = action.spell.rune.defense;
    const roll = new AttackRoll({
      actorId: this.id,
      spellId: spell.id,
      target: target.uuid,
      ability: this.getAbilityBonus(Array.from(spell.scaling)),
      skill: 0,
      enchantment: 0,
      banes: action.bonuses.banes,
      boons: action.bonuses.boons,
      defenseType: defense,
      dc: target.defenses[defense].total
    });

    // Evaluate the result and record the result
    await roll.evaluate({async: true});
    const r = roll.data.result = target.testDefense(defense, roll.total);
    if ( (r === AttackRoll.RESULT_TYPES.HIT) || (r === AttackRoll.RESULT_TYPES.EFFECTIVE) ) {
      roll.data.damage = {
        overflow: roll.overflow,
        multiplier: 1,
        base: spell.gesture.damage.base,
        bonus: spell.gesture.damage.bonus ?? 0,
        resistance: target.resistances[spell.rune.damageType]?.total ?? 0,
        type: spell.rune.damageType
      };
      roll.data.damage.total = ActionData.computeDamage(roll.data.damage);
    }
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Restore all resource pools to their maximum value.
   * @returns {Promise<CrucibleActor>}
   */
  async rest() {
    if ( this.attributes.wounds.value === this.attributes.wounds.max ) return this;
    if ( this.attributes.madness.value === this.attributes.madness.max ) return this;
    return this.update(this._getRestData());
  }

  /* -------------------------------------------- */

  /**
   * Recover resources which replenish each round of combat.
   * @returns {Promise<CrucibleActor>}
   */
  async recover() {
    const updates = {
      "system.status": {
        hasMoved: false,
        hasAttacked: false,
        wasAttacked: false
      }
    }
    if ( !this.isIncapacitated ) updates["system.attributes.action.value"] = this.attributes.action.max;
    return this.update(updates);
  }

  /* -------------------------------------------- */

  /**
   * Prepare an object that replenishes all resource pools to their current maximum level
   * @returns {{}}
   * @private
   */
  _getRestData() {
    const updates = {};
    for ( let resource of Object.values(SYSTEM.RESOURCES) ) {
      const attr = this.attributes[resource.id];
      updates[`system.attributes.${resource.id}.value`] = resource.type === "reserve" ? 0 : attr.max;
    }
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Alter the resource pools of the actor using an object of change data
   * @param {Object<string, number>} changes      Changes where the keys are resource names and the values are deltas
   * @param {object} [updates]                    Other Actor updates to make as part of the same transaction
   * @returns {Promise<CrucibleActor>}            The updated Actor document
   */
  async alterResources(changes, updates={}) {
    const attrs = this.attributes;
    let tookWounds = false;
    let tookMadness = false;

    // Apply resource updates
    for ( let [resourceName, delta] of Object.entries(changes) ) {
      let resource = attrs[resourceName];
      const uncapped = resource.value + delta;
      let overflow = Math.min(uncapped, 0);

      // Overflow health onto wounds (double damage)
      if ( (resourceName === "health") && (overflow !== 0) ) {
        tookWounds = true;
        updates["system.attributes.wounds.value"] = Math.clamped(attrs.wounds.value - overflow, 0, attrs.wounds.max);
      }
      else if ( resourceName === "wounds" ) tookWounds = true;

      // Overflow morale onto madness (double damage)
      if ( (resourceName === "morale") && (overflow !== 0) ) {
        const madness = this.attributes.madness.value - overflow;
        updates["system.attributes.madness.value"] = Math.clamped(madness, 0, attrs.madness.max);
      }
      else if ( resourceName === "madness" ) tookMadness = true;

      // Regular update
      updates[`system.attributes.${resourceName}.value`] = Math.clamped(uncapped, 0, resource.max);
    }
    return this.update(updates);
  }

  /* -------------------------------------------- */

  /**
   * Toggle a named status active effect for the Actor
   * @param {string} statusId     The status effect ID to toggle
   * @param {boolean} active      Should the effect be active?
   * @param {boolean} overlay     Should the effect be an overlay?
   * @returns {Promise<ActiveEffect|null>}
   */
  async toggleStatusEffect(statusId, {active=true, overlay=false, createData={}}={}) {
    const effectData = CONFIG.statusEffects.find(e => e.id === statusId);
    if ( !effectData ) return;
    const existing = this.effects.find(e => e.getFlag("core", "statusId") === effectData.id);

    // No changes needed
    if ( !active && !existing ) return null;
    if ( active && existing ) return existing.update({"flags.core.overlay": overlay});

    // Remove an existing effect
    if ( !active && existing ) return existing.delete();

    // Add a new effect
    else if ( active ) {
      createData = foundry.utils.mergeObject(effectData, createData, {inplace: false});
      delete createData.id;
      createData.label = game.i18n.localize(effectData.label);
      createData["flags.core.statusId"] = effectData.id;
      createData["flags.core.overlay"] = overlay;
      const cls = getDocumentClass("ActiveEffect");
      await cls.create(createData, {parent: this});
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

    // Remove all Talent items
    const deleteIds = this.items.reduce((arr, i) => {
      if ( i.type === "talent" ) arr.push(i.id);
      return arr;
    }, []);
    await this.deleteEmbeddedDocuments("Item", deleteIds);
  }

  /* -------------------------------------------- */

  /**
   * Handle requests to add a new Talent to the Actor.
   * Confirm that the Actor meets the requirements to add the Talent, and if so create it on the Actor
   * @param {CrucibleItem} talent     The Talent item to add to the Actor
   * @param {object} [options]        Options which configure how the Talent is added
   * @param {boolean} [options.dialog]    Prompt the user with a confirmation dialog?
   * @returns {Promise<CrucibleItem>} The created talent Item
   */
  async addTalent(talent, {dialog=false}={}) {

    // Ensure the Talent is not already owned
    if ( this.items.find(i => (i.type === "talent") && (i.name === talent.name)) ) {
      const err = game.i18n.format("TALENT.AlreadyOwned", {name: talent.name});
      return ui.notifications.warn(err);
    }

    // Confirm that the Actor meets the requirements to add the Talent
    try {
      talent.system.assertPrerequisites(this);
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Confirm that the Actor has sufficient Talent points
    const points = this.points.talent;
    if ( !points.available ) {  // TODO - every talent costs 1 for now
      const err = game.i18n.format("TALENT.CannotAfford", {
        name: talent.name,
        cost: 1
      });
      return ui.notifications.warn(err);
    }

    // Confirmation dialog
    if ( dialog ) {
      const confirm = await Dialog.confirm({
        title: `Purchase Talent: ${talent.name}`,
        content: `<p>Spend 1 Talent Point to purchase <strong>${talent.name}</strong>?</p>`,
        defaultYes: false
      });
      if ( !confirm ) return;
    }

    // Create the talent
    return talent.constructor.create(talent.toObject(), {parent: this, keepId: true});
  }

  /* -------------------------------------------- */

  /**
   * When an Ancestry item is dropped on an Actor, apply its contents to the data model
   * @param {object|null} itemData  The ancestry data to apply to the Actor.
   * @return {CrucibleActor}        The updated Actor with the new Ancestry applied.
   */
  async applyAncestry(itemData) {

    // Clear an existing ancestry
    if ( !itemData ) {
      if ( this.isL0 ) return this.update({"system.details.ancestry": null});
      else throw new Error("Ancestry data not provided");
    }

    const ancestry = foundry.utils.deepClone(itemData.system);
    ancestry.name = itemData.name;

    // Only proceed if we are level 1 with no points already spent
    if ( !this.isL0 || (this.points.skill.spent > 0) || (this.points.ability.spent > 0) ) {
      const err = game.i18n.localize("ANCESTRY.ApplyError");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Update the Actor
    await this.update({"system.details.ancestry": ancestry});
    ui.notifications.info(game.i18n.format("ANCESTRY.Applied", {ancestry: ancestry.name, actor: this.name}));
    return this;
  }

  /* -------------------------------------------- */

  /**
   * When a Background item is dropped on an Actor, apply its contents to the data model
   * @param {object|null} itemData    The background data to apply to the Actor.
   * @return {CrucibleActor}          The updated Actor with the new Background applied.
   */
  async applyBackground(itemData) {

    // Clear an existing ancestry
    if ( !itemData ) {
      if ( this.isL0 ) return this.update({"system.details.background": null});
      else throw new Error("Background data not provided");
    }

    const background = foundry.utils.deepClone(itemData.system);
    background.name = itemData.name;

    // Only proceed if we are level 1 with no points already spent
    if ( !this.isL0 || (this.points.skill.spent > 0) ) {
      const err = game.i18n.localize("BACKGROUND.ApplyError");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Update the Actor
    await this.update({"system.details.background": background});
    ui.notifications.info(game.i18n.format("BACKGROUND.Applied", {background: background.name, actor: this.name}));
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Apply data from an Archetype Item to this Actor.
   * @param {CrucibleItem} item         The Archetype Item to apply
   * @return {Promise<CrucibleActor>}   The updated Actor with the Archetype applied
   */
  async applyArchetype(item) {
    const archetype = item.toObject().system;
    archetype.name = item.name;
    await this.update({"system.details.archetype": archetype});
    ui.notifications.info(game.i18n.format("ARCHETYPE.Applied", {archetype: item.name, actor: this.name}));
    return this;
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

    // Clone the actor and advance level
    const clone = this.clone();
    const level = Math.clamped(this.level + delta, 0, 24);
    const update = {"system.advancement.level": level};
    clone.updateSource(update);

    // Update resources and progress
    Object.assign(update, clone._getRestData());
    update["system.advancement.progress"] = delta > 0 ? 0 : clone.system.advancement.next;

    // Commit the update
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
    const attr = this.attributes[ability];
    if ( !attr || !delta ) return;

    // Can the ability be purchased?
    if ( !this.canPurchaseAbility(ability, delta) ) {
      return ui.notifications.warn(`WARNING.AbilityCannot${delta > 0 ? "Increase" : "Decrease"}`, {localize: true});
    }

    // Modify the ability
    if ( this.isL0 ) return this.update({[`system.attributes.${ability}.base`]: Math.max(attr.base + delta, 0)});
    else return this.update({[`system.attributes.${ability}.increases`]: attr.increases + delta});
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
    const attr = this.attributes[ability];
    if ( !attr || !delta ) return;

    // Case 1 - Point Buy
    if ( this.isL0 ) {
      if ( (delta > 0) && ((attr.base === 3) || !points.pool) ) return false;
      else if ( (delta < 0) && (attr.base === 0) ) return false;
      return true;
    }

    // Case 2 - Regular Increase
    else {
      if ( (delta > 0) && ((attr.value === 12) || !points.available) ) return false;
      else if ( (delta < 0) && (attr.increases === 0) ) return false;
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
        type: game.i18n.localize("ITEM.TypeArmor")
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
    let isOHFree = (weapons.mainhand.config.category.hands === 1) && !weapons.offhand.id;

    // Identify the items being requested
    const w1 = this.items.get(mainhandId ?? itemId, {strict: true});
    const w2 = this.items.get(offhandId);
    const updates = [];

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
      }
    }

    // Equip the primary weapon in the main-hand slot
    if ( w1.config.category.main && isMHFree ) {
      updates.push({_id: w1.id, "system.equipped": true});
    }

    // Equip the primary weapon in the off-hand slot
    else if ( w1.config.category.off && isOHFree ) {
      updates.push({_id: w1.id, "system.equipped": true});
    }

    // Failed to equip
    else {
      ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
        actor: this.name,
        item: w1.name,
        type: game.i18n.localize(`ACTION.Tag${w1.config.category.off ? "Off" : "Main"}Hand`)
      }));
    }

    // Apply the updates
    return this.updateEmbeddedDocuments("Item", updates);
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Prototype Token configuration
    if ( this.type === "hero" ) {
      this.updateSource({prototypeToken: {vision: true, actorLink: true, disposition: 1}});
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    this._displayScrollingStatus(data);
    this._replenishResources(data);
    this._applyAttributeStatuses(data);
    this._updateCachedResources();

    // Refresh talent tree
    const tree = game.system.tree;
    if ( tree.actor === this ) {
      const talentChange = (foundry.utils.hasProperty(data, "system.advancement.level") || ("items" in data));
      if ( talentChange ) tree.refresh();
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onCreateEmbeddedDocuments(...args) {
    super._onCreateEmbeddedDocuments(...args);
    const tree = game.system.tree;
    if ( tree.actor === this ) tree.refresh();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onDeleteEmbeddedDocuments(...args) {
    super._onDeleteEmbeddedDocuments(...args);
    const tree = game.system.tree;
    if ( tree.actor === this ) tree.refresh();
  }

  /* -------------------------------------------- */

  /**
   * Display changes to the Actor as scrolling combat text.
   * @private
   */
  _displayScrollingStatus(changed) {
    if ( !changed.system?.attributes ) return;
    const tokens = this.getActiveTokens(true);
    if ( !tokens.length ) return;
    for ( let [resourceName, prior] of Object.entries(this._cachedResources ) ) {
      if ( changed.system.attributes[resourceName]?.value === undefined ) continue;

      // Get change data
      const resource = SYSTEM.RESOURCES[resourceName];
      const attr = this.attributes[resourceName];
      const delta = attr.value - prior;
      if ( delta === 0 ) continue;
      const text = `${delta.signedString()} (${resource.label})`;
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
  async _applyAttributeStatuses(data) {
    const attrs = data?.system?.attributes || {};
    if ( ("health" in attrs) || ("wounds" in attrs) ) {
      await this.toggleStatusEffect("incapacitated", {active: this.isIncapacitated });
      await this.toggleStatusEffect("dead", {active: this.isDead});
    }
    if ( ("morale" in attrs) || ("madness" in attrs) ) {
      await this.toggleStatusEffect("broken", {active: this.isBroken});
      await this.toggleStatusEffect("insane", {active: this.isInsane});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the cached resources for this actor
   * @private
   */
  _updateCachedResources() {
    switch ( this.type ) {
      case "adversary":
        const r = this.system.resources;
        this._cachedResources = {
          health: r.health,
          morale: r.morale,
          action: r.action,
          focus: r.focus
        }
        break;
      case "hero":
        const a = this.attributes;
        this._cachedResources = {
          health: a.health.value,
          wounds: a.wounds.value,
          morale: a.morale.value,
          madness: a.madness.value,
          action: a.action.value,
          focus: a.focus.value
        }
        break;
    }
  }

  /* -------------------------------------------- */

  _replenishResources(data) {
    const levelChange = foundry.utils.hasProperty(data, "system.advancement.level");
    const attributeChange = Object.keys(SYSTEM.ABILITIES).some(k => foundry.utils.hasProperty(data, `system.attributes.${k}`));
    if ( this.isOwner && (levelChange || attributeChange) ) this.rest();
  }
}

