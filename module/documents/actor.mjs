import { SYSTEM } from "../config/system.js";
import StandardCheck from "../dice/standard-check.js"
import AttackRoll from "../dice/attack-roll.mjs";
import ActionData from "../data/action.mjs";

/**
 * @typedef {Object}   ActorRoundStatus
 * @property {boolean} hasMoved
 * @property {boolean} hasAttacked
 * @property {boolean} wasAttacked
 */

/**
 * The Actor document subclass in the Crucible system which extends the behavior of the base Actor class.
 * @extends {Actor}
 */
export default class CrucibleActor extends Actor {

  /** @inheritdoc */
  _initialize() {
    super._initialize();
    this._updateCachedResources();
  }

  /**
   * Track the Actions which this Actor has available to use
   * @type {Object<string, ActionData>}
   */
  actions = this["actions"];

  /**
   * Track the equipment that the Actor is currently using
   * @type {{
   *   armor: Item,
   *   weapons: {mainhand: Item, offhand: Item}
   *   accessories: Item[]
   * }}
   */
  equipment = this["equipment"];

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
    return this.data.data.details.ancestry;
  }

  /**
   * The prepared object of actor attributes
   * @type {object}
   */
  get attributes() {
    return this.data.data.attributes;
  }

  /**
   * The background of the Actor.
   * @returns {*}
   */
  get background() {
    return this.data.data.details.background;
  }

  /**
   * The prepared object of actor defenses
   * @type {object}
   */
  get defenses() {
    return this.data.data.defenses;
  }

  /**
   * Is this actor currently "level zero"
   * @returns {boolean}
   */
  get isL0() {
    return this.data.data.advancement.level === 0;
  }

  /**
   * The prepared object of actor resistances
   * @returns {object}
   */
  get resistances() {
    return this.data.data.resistances;
  }

  /**
   * The prepared object of actor skills
   * @returns {object}
   */
  get skills() {
    return this.data.data.skills;
  }

  /**
   * The prepared object of actor status data
   * @returns {ActorRoundStatus}
   */
  get status() {
    return this.data.data.status;
  }

  /**
   * A more semantic reference to the system data.data object
   * @type {object}
   */
  get systemData() {
    return this.data.data;
  }

  /* -------------------------------------------- */
  /*  Actor Preparation
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {

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
    const items = this.itemTypes;
    this._prepareTalents(items);
    this._prepareEquipment(items);
    this._prepareActions();
  };

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this._prepareResources(this.data);
    this._prepareDefenses(this.data);
  }

  /* -------------------------------------------- */

  /**
   * Compute the available points which can be spent to advance this character
   * @private
   */
  _prepareAdvancement() {
    const adv = this.systemData.advancement;
    adv.level = Math.clamped(adv.level, 0, 24);
    const effectiveLevel = Math.max(adv.level, 1) - 1;

    // Initialize spendable points
    this.points = {
      ability: { pool: 36, total: effectiveLevel, bought: null, spent: null, available: null },
      skill: { total: 2 + (effectiveLevel*2), spent: null, available: null },
      talent: { total: 3 + (effectiveLevel*3), spent: 0, available: null }
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
    const hasAncestry = ancestry.primary && ancestry.secondary;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in CONFIG.SYSTEM.ABILITIES ) {
      let ability = this.attributes[a];
      ability.initial = 1;
      if ( a === ancestry.primary ) ability.initial = SYSTEM.ANCESTRIES.primaryAttributeStart;
      else if ( a === ancestry.secondary ) ability.initial = SYSTEM.ANCESTRIES.secondaryAttributeStart;
      ability.value = ability.initial + ability.base + ability.increases + ability.bonus;
      abilityPointsBought += Array.fromRange(ability.initial + ability.base + 1).reduce((a, v) => a + v);
      abilityPointsSpent += ability.increases;
      ability.cost = ability.value + 1;
    }

    // Track spent ability points
    const basePoints = hasAncestry ? 13 : 6;
    points.bought = abilityPointsBought - basePoints;
    points.pool = 36 - points.bought;
    points.spent = abilityPointsSpent;
    points.available = points.total - abilityPointsSpent;
    points.requireAttention = this.isL0 ? (points.pool > 0) : (points.available !== 0);
  }

  /* -------------------------------------------- */

  /**
   * Classify the equipment that the Actor currently has equipped
   * @private
   */
  _prepareEquipment({armor, weapon, accessory}={}) {
    const equipment = {};
    const itemCls = getDocumentClass("Item");
    const warnSlotInUse = (item, type) => {
      const w = game.i18n.format("WARNING.CannotEquipSlotInUse", {actor: this.name, item: item.name, type});
      console.warn(w);
    }

    // Identify equipped armor
    let armors = armor.filter(i => i.data.data.equipped);
    if ( armors.length > 1 ) {
      ui.notifications.warn(`Actor ${this.name} has more than one equipped armor.`);
      armors = armors[0];
    }
    equipment.armor = armors[0] || new itemCls(SYSTEM.ARMOR.UNARMORED_DATA, {parent: this});

    // Classify equipped weapons
    const weapons = equipment.weapons = {};
    const equippedWeapons = {mh: [], oh: [], either: []};
    for ( let w of weapon ) {
      if ( !w.data.data.equipped ) continue;
      const category = w.config.category;
      if ( (w.hands === 2) ) {
        equippedWeapons.mh.unshift(w);
        equippedWeapons.oh.unshift(w);
      }
      else if ( category.main && !category.off ) equippedWeapons.mh.push(w);
      else if ( category.off && !category.main ) equippedWeapons.oh.push(w);
      else equippedWeapons.either.push(w);
    }

    // Assign equipped weapons
    for ( let w of equippedWeapons.mh ) {
      if ( weapons.mainhand ) warnSlotInUse(w, "mainhand");
      else weapons.mainhand = w;
    }
    for ( let w of equippedWeapons.oh ) {
      if ( weapons.offhand ) warnSlotInUse(w, "offhand");
      else weapons.offhand = w;
    }
    for ( let w of equippedWeapons.either ) {
      if ( !weapons.mainhand ) weapons.mainhand = w;
      else if ( !weapons.offhand ) weapons.offhand = w;
      else warnSlotInUse(w, "mainhand");
    }

    // Populate unarmed weaponry for unused slots
    if ( !weapons.mainhand ) equipment.weapons.mainhand = new itemCls(SYSTEM.WEAPON.UNARMED_DATA, {parent: this});
    if ( !weapons.offhand ) equipment.weapons.offhand = new itemCls(SYSTEM.WEAPON.UNARMED_DATA, {parent: this});

    // Reference final weapon configurations
    const mh = weapons.mainhand;
    const mhCategory = mh.config.category;
    const oh = weapons.offhand;
    const ohCategory = oh.config.category;

    // Assign equipment state flags
    equipment.unarmored = equipment.armor.data.data.category === "unarmored";
    weapons.unarmed = (mhCategory.id === "unarmed") && (ohCategory.id === "unarmed");
    weapons.shield = ohCategory.id === "shield";
    weapons.twoHanded = mhCategory.hands === 2;
    weapons.melee = !mhCategory.ranged;
    weapons.ranged = !!mhCategory.ranged;

    // Dual Wielding States
    weapons.dualWield = weapons.unarmed || ((mhCategory.hands === 1) && mh.id && (oh.id && !weapons.shield));
    weapons.dualMelee = weapons.dualWield && !(mhCategory.ranged || ohCategory.ranged);
    weapons.dualRanged = (mhCategory.hands === 1) && mhCategory.ranged && ohCategory.ranged;

    // TODO: Up to three? equipped accessories
    equipment.accessories = accessory;
    this.equipment = equipment;
  }

  /* -------------------------------------------- */

  /**
   * Prepare Actions which the Actor may actively use
   * @private
   */
  _prepareActions() {
    this.actions = {};

    // Default actions that every character can do
    for ( let ad of SYSTEM.TALENT.DEFAULT_ACTIONS ) {
      const a = new ActionData(ad);
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
      if ( ancestry.skills.includes(id) ) base++;
      if ( background.skills.includes(id) ) base++;
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
    const points = this.points.talent;
    for ( let item of talent ) {
      points.spent += item.systemData.cost;
    }
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
  _prepareDefenses(data) {
    const {attributes, defenses} = data.data;

    // Armor and Dodge from equipped Armor
    const armorData = this.equipment.armor.data.data;
    defenses.armor.base = armorData.armor.base;
    defenses.armor.bonus = armorData.armor.bonus;
    defenses.dodge.base = armorData.dodge.base;
    defenses.dodge.bonus = Math.max(attributes.dexterity.value - armorData.dodge.start, 0);
    defenses.dodge.max = defenses.dodge.base + (12 - armorData.dodge.start);

    // Block and Parry from equipped Weapons
    const weaponData = [this.equipment.weapons.mainhand.data.data];
    if ( !this.equipment.weapons.twoHanded ) weaponData.push(this.equipment.weapons.offhand.data.data);
    defenses.block = {base: 0, bonus: 0};
    defenses.parry = {base: 0, bonus: 0};
    for ( let wd of weaponData ) {
      for ( let d of ["block", "parry"] ) {
        defenses[d].base += wd[d].base;
        defenses[d].bonus += wd[d].bonus;
      }
    }

    // Compute total physical defenses
    const physicalDefenses = ["dodge", "parry", "block", "armor"];
    defenses["physical"] = 0;
    for ( let pd of physicalDefenses ) {
      let d = defenses[pd];
      d.total = d.base + d.bonus;
      defenses.physical += d.total;
    }

    // Saves
    for ( let [k, sd] of Object.entries(SYSTEM.SAVE_DEFENSES) ) {
      let d = defenses[k];
      const abilities = sd.abilities.map(a => data.data.attributes[a]);
      d.base = abilities[0].value + abilities[1].value;
      d.total = d.base + d.bonus;
    }

    // Damage Resistances
    const ancestry = data.data.details.ancestry;
    for ( let [id, r] of Object.entries(data.data.resistances) ) {
      if ( id === ancestry.resistance ) r.base = SYSTEM.ANCESTRIES.resistanceAmount;
      else if ( id === ancestry.vulnerability ) r.base = -SYSTEM.ANCESTRIES.resistanceAmount;
      r.total = r.base + r.bonus;
    }
  }

  /* -------------------------------------------- */

  getDefenses({armor}) {
    const attributes = this.data.data.attributes;
    const defenses = foundry.utils.deepClone(this.data.data.defenses);
    armor = armor || this.equipment.armor;

    // Physical defenses
    const armorData = armor.data.data;
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
   * @param {object} data
   * @private
   */
  _prepareResources(data) {
    const lvl = data.data.advancement.level;
    const attrs = data.data.attributes;

    // Health
    const healthMod = (2 * attrs.constitution.value) + attrs.strength.value + attrs.dexterity.value;
    attrs.health.max = healthMod * lvl;
    attrs.health.value = Math.clamped(attrs.health.value, 0, attrs.health.max);

    // Wounds
    attrs.wounds.max = 2 * attrs.health.max;
    attrs.wounds.value = Math.clamped(attrs.wounds.value, 0, attrs.wounds.max);

    // Morale
    const moraleMod = (2 * attrs.charisma.value) + attrs.intellect.value + attrs.wisdom.value;
    attrs.morale.max = moraleMod * lvl;
    attrs.morale.value = Math.clamped(attrs.morale.value, 0, attrs.morale.max);

    // Madness
    attrs.madness.max = 2 * attrs.morale.max;
    attrs.madness.value = Math.clamped(attrs.madness.value, 0, attrs.madness.max);

    // Action
    attrs.action.max = lvl > 0 ? 3 : 0;
    attrs.action.value = Math.clamped(attrs.action.value, 0, attrs.action.max);

    // Focus
    attrs.focus.max = lvl * 2;
    attrs.focus.value = Math.clamped(attrs.focus.value, 0, attrs.focus.max);
  }

  /* -------------------------------------------- */
  /*  Dice Rolling Methods                        */
  /* -------------------------------------------- */

  /**
   * Compute the ability score bonus for a given scaling mode
   * @param {string} scaling      How is the ability bonus computed?
   * @returns {number}            The ability bonus
   */
  getAbilityBonus(scaling) {

    // Single-attribute scaling mode
    const attrs = this.attributes;
    if ( scaling in attrs ) return attrs[scaling].value;

    // Hybrid-attribute scaling mode
    const terms = scaling.split(".");
    return Math.ceil(terms.reduce((x, t) => x + attrs[t].value, 0) / terms.length);
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
  rollSkill(skillId, {banes=0, boons=0, dc, rollMode, dialog=false}={}) {
    const skill = this.data.data.skills[skillId];
    if ( !skill ) throw new Error(`Invalid skill ID ${skillId}`);

    // Create the check roll
    const sc = new StandardCheck({
      actorId: this.id,
      type: skillId,
      banes: banes,
      boons: boons,
      dc: dc,
      ability: skill.abilityBonus,
      skill: skill.skillBonus,
      enchantment: skill.enchantmentBonus,
      rollMode: rollMode
    });

    // Execute the roll
    const flavor = game.i18n.format("SKILL.RollFlavor", {name: this.name, skill: CONFIG.SYSTEM.SKILLS[skillId].name});
    if ( dialog ){
      const title = game.i18n.format("SKILL.RollTitle", {name: this.name, skill: CONFIG.SYSTEM.SKILLS[skillId].name});
      sc.dialog({ title, flavor, rollMode }).render(true);
    }
    else {
      sc.toMessage({ flavor }, { rollMode });
    }
    return sc;
  }

  /* -------------------------------------------- */

  /**
   * Test the Actor's defense, determining which defense type is used to avoid an attack.
   * @returns {AttackRoll.RESULT_TYPES}
   */
  testPhysicalDefense(attackRoll) {
    const d = this.data.data.defenses;

    // Hit
    if ( attackRoll > d.physical ) return AttackRoll.RESULT_TYPES.HIT;

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
   * Restore all resource pools to their maximum value.
   * @returns {Promise<CrucibleActor>}
   */
  async rest() {
    if ( this.attributes.wounds.value === this.attributes.wounds.max ) return this;
    if ( this.attributes.madness.value === this.attributes.madness.max ) return this;
    await this.toggleStatusEffect("unconscious", {active: false});
    return this.update(this._getRestData());
  }

  /* -------------------------------------------- */

  /**
   * Recover resources which replenish each round of combat.
   * @returns {Promise<CrucibleActor>}
   */
  async recover() {
    return this.update({
      "data.attributes.action.value": this.attributes.action.max,
      "data.status": {
        hasMoved: false,
        hasAttacked: false,
        wasAttacked: false
      }
    });
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
      updates[`data.attributes.${resource.id}.value`] = resource.type === "reserve" ? 0 : attr.max;
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
        updates["data.attributes.wounds.value"] = Math.clamped(attrs.wounds.value - overflow, 0, attrs.wounds.max);
      }
      else if ( resourceName === "wounds" ) tookWounds = true;

      // Overflow morale onto madness (double damage)
      if ( (resourceName === "morale") && (overflow !== 0) ) {
        const madness = this.attributes.madness.value - overflow;
        updates["data.attributes.madness.value"] = Math.clamped(madness, 0, attrs.madness.max);
      }
      else if ( resourceName === "madness" ) tookMadness = true;

      // Regular update
      updates[`data.attributes.${resourceName}.value`] = Math.clamped(uncapped, 0, resource.max);
    }
    await this.update(updates);

    // Flag status effects
    const isDead = attrs.wounds.value === this.attributes.wounds.max
    await this.toggleStatusEffect("unconscious", {active: (this.attributes.health.value === 0) && !isDead});
    await this.toggleStatusEffect("dead", {active: isDead});
    let isBroken = attrs.morale.value === 0;
    let isInsane = attrs.madness.value === attrs.madness.max;
    return this;
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
   * Handle requests to add a new Talent to the Actor.
   * Confirm that the Actor meets the requirements to add the Talent, and if so create it on the Actor
   * @param {object} itemData     Talent data requested to be added to the Actor
   * @returns {Promise<Item>}     The created talent Item
   */
  async addTalent(itemData) {
    const Item = getDocumentClass("Item");
    itemData.data.rank = 1;
    const talent = new Item(itemData, {parent: this});

    // Ensure the Talent is not already owned
    if ( this.items.find(i => (i.data.type === "talent") && (i.name === talent.name)) ) {
      const err = game.i18n.format("TALENT.AlreadyOwned", {name: talent.name});
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Confirm that the Actor meets the requirements to add the Talent
    for ( let [k, v] of Object.entries(talent.systemData.prerequisites) ) {
      const current = foundry.utils.getProperty(this.systemData, k);
      if ( current < v.value ) {
        const err = game.i18n.format("TALENT.MissingRequirement", {
          name: talent.name,
          requirement: v.label,
          requires: v.value
        });
        ui.notifications.warn(err);
        throw new Error(err);
      }
    }

    // Confirm that the Actor has sufficient Talent points
    const points = this.points.talent;
    if ( points.available < talent.rank.cost ) {
      const err = game.i18n.format("TALENT.CannotAfford", {
        name: talent.name,
        cost: talent.rank.cost
      });
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Create the talent
    return Item.create(itemData, {parent: this});
  }

  /* -------------------------------------------- */

  /**
   * When an Ancestry item is dropped on an Actor, apply its contents to the data model
   * @param {object} itemData     The ancestry data to apply to the Actor.
   * @return {CrucibleActor}      The updated Actor with the new Ancestry applied.
   */
  async applyAncestry(itemData) {
    const ancestry = duplicate(itemData.data);
    ancestry.name = itemData.name;

    // Only proceed if we are level 1 with no points already spent
    if ( !this.isL0 || (this.points.skill.spent > 0) || (this.points.ability.spent > 0) ) {
      const err = game.i18n.localize("ANCESTRY.ApplyError");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Update the Actor
    await this.update({"data.details.ancestry": ancestry});
    ui.notifications.info(game.i18n.format("ANCESTRY.Applied", {ancestry: ancestry.name, actor: this.name}));
    return this;
  }

  /* -------------------------------------------- */

  /**
   * When a Background item is dropped on an Actor, apply its contents to the data model
   * @param {object} itemData     The background data to apply to the Actor.
   * @return {CrucibleActor}      The updated Actor with the new Background applied.
   */
  async applyBackground(itemData) {
    const background = duplicate(itemData.data);
    background.name = itemData.name;

    // Only proceed if we are level 1 with no points already spent
    if ( !this.isL0 || (this.points.skill.spent > 0) ) {
      const err = game.i18n.localize("BACKGROUND.ApplyError");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Update the Actor
    await this.update({"data.details.background": background});
    ui.notifications.info(game.i18n.format("BACKGROUND.Applied", {background: background.name, actor: this.name}));
    return this;
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
    const points = this.points.ability;
    const attr = this.data.data.attributes[ability];
    if ( !attr ) return;

    // Case 1 - Point Buy
    if ( this.isL0 ) {
      const canAfford = (delta <= 0) || (attr.cost <= points.pool);
      if ( !canAfford ) {
        return ui.notifications.warn(game.i18n.format(`ABILITY.CantAfford`, {cost: attr.cost, points: points.pool}));
      }
      return this.update({[`data.attributes.${ability}.base`]: Math.max(attr.base + delta, 0)});
    }

    // Case 2 - Regular Increase
    else {
      if (((delta < 0) && !points.spent) || ((delta > 0) && !points.available)) return false;
      const base = attr.initial + attr.base;
      const target = Math.clamped(attr.increases + delta, 0, 12 - base);
      return this.update({[`data.attributes.${ability}.increases`]: target});
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
    const points = this.points.skill;
    const skill = this.data.data.skills[skillId];
    if ( !skill ) return;

    // Decrease
    if ( delta < 0 ) {
      if ( skill.rank === 0 ) return;
      const update = {};
      if ( skill.rank === 3 ) update[`data.skills.${skillId}.path`] = null;
      update[`data.skills.${skillId}.rank`] = skill.rank - 1;
      return this.update(update);
    }

    // Increase
    else if ( delta > 0 ) {
      if ( skill.rank === 5 ) return;
      if ( (skill.rank === 3) && !skill.path ) {
        return ui.notifications.warn(game.i18n.localize(`SKILL.ChoosePath`));
      }
      if ( points.available < skill.cost ) {
        return ui.notifications.warn(game.i18n.format(`SKILL.CantAfford`, {cost: skill.cost, points: points.available}));
      }
      return this.update({[`data.skills.${skillId}.rank`]: skill.rank + 1});
    }
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
    const updates = [];

    // Un-equip the current armor
    if ( item && (current === item) && !equipped ) {
      updates.push({_id: current.id, "data.equipped": false});
    }

    // Equip a new piece of armor
    if ( item && equipped ) {
      updates.push({_id: item.id, "data.equipped": true});
    }

    // Apply the updates
    return this.updateEmbeddedDocuments("Item", updates);
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
    let isOHFree = !weapons.offhand.id;

    // Identify the items being requested
    const w1 = this.items.get(mainhandId ?? itemId, {strict: true});
    const w2 = this.items.get(offhandId);
    const updates = [];

    // Handle un-equipping weapons which are currently equipped
    if ( !equipped ) {
      if ( (w1 === weapons.mainhand) || (w1 === weapons.offhand) ) {
        updates.push({_id: w1.id, "data.equipped": false});
      }
      if ( w2 && (w2 === weapons.offhand) ) {
        updates.push({_id: w2.id, "data.equipped": false});
      }
      return this.updateEmbeddedDocuments("Item", updates);
    }

    // Equip a secondary weapon that can only go in an offhand slot
    if ( w2 ) {
      if ( !w2.config.category.off ) {
        ui.notifications.warn(game.i18n.format("WARNING.CannotEquipInvalidCategory", {
          actor: this.name,
          item: w2.name,
          type: "offhand"
        }));
      }
      if ( !isOHFree ) {
        ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
          actor: this.name,
          item: w2.name,
          type: "offhand"
        }));
      }
      else {
        isOHFree = false;
        updates.push({_id: w2.id, "data.equipped": true});
      }
    }

    // Equip the primary weapon in the main-hand slot
    if ( w1.config.category.main && isMHFree ) {
      updates.push({_id: w1.id, "data.equipped": true});
    }

    // Equip the primary weapon in the off-hand slot
    else if ( w1.config.category.off && isOHFree ) {
      updates.push({_id: w1.id, "data.equipped": true});
    }

    // Failed to equip
    else {
      ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
        actor: this.name,
        item: w1.name,
        type: w1.config.category.off ? "offhand" : "mainhand"
      }));
    }

    // Apply the updates
    return this.updateEmbeddedDocuments("Item", updates);
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    this._displayScrollingStatus(data);
    super._onUpdate(data, options, userId);
    this._updateCachedResources();
    this._replenishResources(data);
  }

  /* -------------------------------------------- */

  /**
   * Display changes to the Actor as scrolling combat text.
   * @private
   */
  _displayScrollingStatus(changed) {
    if ( !changed.data?.attributes ) return;
    const tokens = this.getActiveTokens(true);
    if ( !tokens.length ) return;
    for ( let [resourceName, prior] of Object.entries(this._cachedResources ) ) {
      if ( changed.data.attributes[resourceName]?.value === undefined ) continue;

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
        token.hud.createScrollingText(text, {
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
   * Update the cached resources for this actor
   * @private
   */
  _updateCachedResources() {
    const a = this.attributes;
    this._cachedResources = {
      health: a.health.value,
      wounds: a.wounds.value,
      morale: a.morale.value,
      madness: a.madness.value,
      action: a.action.value,
      focus: a.focus.value
    }
  }

  /* -------------------------------------------- */

  _replenishResources(data) {
    const levelChange = foundry.utils.hasProperty(data, "data.advancement.level");
    const attributeChange = Object.keys(SYSTEM.ABILITIES).some(k => foundry.utils.hasProperty(data, `data.attributes.${k}`));
    if ( levelChange || attributeChange ) this.rest();
  }
}

