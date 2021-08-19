import { SYSTEM } from "../config/system.js";
import StandardCheck from "../dice/standard-check.js"


export default class CrucibleActor extends Actor {
  constructor(data, context) {
    super(data, context)

    /**
     * Track the Actions which this Actor has available to use
     * @type {Object<string, ActionData>}
     */
    this.actions;

    /**
     * Track the equipment that the Actor is currently using
     * @type {{
     *   armor: Item,
     *   weapons: {mainhand: Item, offhand: Item}
     *   accessories: Item[]
     * }}
     */
    this.equipment;

    /**
     * Track the progression points which are available and spent
     * @type {{
     *   ability: {pool: number, total: number, bought: number, spent: number, available: number },
     *   skill: {total: number, spent: number, available: number },
     *   talent: {total: number, spent: number, available: number }
     * }}
     */
    this.points;
  }

  /* -------------------------------------------- */

  get abilities() {
    return this.data.data.abilities;
  }

  get isL0() {
    return this.data.data.advancement.level === 0;
  }

  get skills() {
    return this.data.data.skills;
  }

  /* -------------------------------------------- */
  /*  Actor Preparation
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    const data = this.data;

    // Prepare placeholder point totals
    this._prepareAdvancement(data);

    // Prepare Attributes
    this._prepareAttributes(data);

    // Prepare Skills
    this._prepareSkills(data);

    // Prepare Talents
    this._prepareTalents(data);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareEmbeddedEntities() {
    super.prepareEmbeddedEntities();
    this._prepareEquipment();
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
   * @param {object} data       The actor data to prepare
   * @private
   */
  _prepareAdvancement(data) {
    const adv = data.data.advancement;
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
   * @param {object} data       The actor data to prepare
   * @private
   */
  _prepareAttributes(data) {
    const attrs = data.data.attributes;
    const points = this.points.ability;
    const ancestry = data.data.details.ancestry;
    const hasAncestry = ancestry.primary && ancestry.secondary;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in CONFIG.SYSTEM.ABILITIES ) {
      let ability = attrs[a];
      ability.initial = 1;
      if ( a === ancestry.primary ) ability.initial = 3;
      else if ( a === ancestry.secondary ) ability.initial = 2;
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
    points.hasUnspent = this.isL0 ? (points.pool > 0) : (points.available > 0);
  }

  /* -------------------------------------------- */

  /**
   * Classify the equipment that the Actor currently has equipped
   * @private
   */
  _prepareEquipment() {
    const {armor, weapon, accessory} = this.itemTypes;
    const equipment = {};
    const itemCls = getDocumentClass("Item");

    // Identify equipped armor
    let armors = armor.filter(i => i.data.data.equipped);
    if ( armors.length > 1 ) {
      ui.notifications.warn(`Actor ${this.name} has more than one equipped armor.`);
      armors = armors[0];
    }
    equipment.armor = armors[0] || new itemCls(SYSTEM.ARMOR.UNARMORED_DATA, {parent: this});

    // Identify equipped weapons
    const weapons = equipment.weapons = {};
    for ( let w of weapon ) {
      if ( !w.data.data.equipped ) continue;
      const category = w.data.category;

      // Off-hand already in use
      if ( category.off ) {
        if ( weapons.offhand ) {
          let warn = game.i18n.format("WEAPON.CannotEquipWarning", {actor: this.name, item: w.name, type: "off-hand"});
          console.warn(warn);
          continue;
        }
      }

      // Main-hand already in use
      else if ( category.main ) {
        if ( weapons.mainhand ) {
          let warn = game.i18n.format("WEAPON.CannotEquipWarning", {actor: this.name, item: w.name, type: "main-hand"});
          console.warn(warn);
          continue;
        }
      }

      // Two-handed weapon
      if ( category.hands === 2 ) {
        weapons.mainhand = w;
        weapons.offhand = w;
      }

      // Off-hand weapon
      else if ( category.off ) weapons.offhand = w;

      // Main-hand weapon
      else if ( category.main ) weapons.mainhand = w;
    }

    // Populate default unarmed weaponry
    if ( !weapons.mainhand ) equipment.weapons.mainhand = new itemCls(SYSTEM.WEAPON.UNARMED_DATA, {parent: this});
    if ( !weapons.offhand ) equipment.weapons.offhand = new itemCls(SYSTEM.WEAPON.UNARMED_DATA, {parent: this});

    // Flag equipment states
    const mh = weapons.mainhand;
    const oh = weapons.offhand;
    weapons.unarmed = !(mh.id || oh.id);
    weapons.twoHanded = mh.data.category.hands === 2;
    weapons.dualWield = (mh !== oh) && mh.id && oh.id;
    weapons.ranged = !!mh.data.category.ranged;
    weapons.dualMelee = weapons.dualWield && !(mh.data.category.ranged || oh.data.category.ranged);
    weapons.melee = !mh.data.category.ranged;
    weapons.dualRanged = !!mh.data.category.ranged && !!oh.data.category.ranged;

    // TODO: Accessories can be up to three equipped and attuned
    equipment.accessories = accessory;
    this.equipment = equipment;
  }

  /* -------------------------------------------- */

  /**
   * Prepare Actions which the Actor may actively use
   * @private
   */
  _prepareActions() {
    const talents = this.itemTypes.talent;
    this.actions = {};

    // Default actions that every character can do
    for ( let a of game.system.talents.defaultActions ) {
      this.actions[a.id] = a;
    }

    // Actions that are unlocked through an owned Talent
    for ( let t of talents ) {
      for ( let a of t.actions ) {
        this.actions[a.id] = a;
      }
    }
  }

  /* -------------------------------------------- */


  /**
   * Prepare Skills for the actor, translating the owned Items for skills and merging them with unowned skills.
   * Validate the number of points spent on skills, and the number of skill points remaining to be spent.
   * @private
   */
  _prepareSkills(data) {

    // Populate all the skills
    const ranks = SYSTEM.SKILL_RANKS;
    const ancestry = data.data.details.ancestry;
    const background = data.data.details.background;
    let pointsSpent = 0;

    // Iterate over skills
    for ( let [id, skill] of Object.entries(data.data.skills) ) {
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
      const attrs = config.attributes.map(a => data.data.attributes[a].value);
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
  _prepareTalents(data) {
    const points = this.points.talent;
    for ( let item of this.itemTypes.talent ) {
      points.spent += item.data.data.cost ?? 0;
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

    // Compute defensive attributes
    const armorData = this.equipment.armor.data.data;
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

    // Saves
    for ( let [k, sd] of Object.entries(SYSTEM.SAVE_DEFENSES) ) {
      let d = defenses[k];
      const abilities = sd.abilities.map(a => data.data.attributes[a]);
      d.base = Math.ceil(0.5 * (abilities[0].value + abilities[1].value));
      d.total = d.base + d.bonus;
    }

    // Damage Resistances
    const ancestry = data.data.details.ancestry;
    for ( let [id, r] of Object.entries(data.data.resistances) ) {
      if ( id === ancestry.resistance ) r.base = 3;
      else if ( id === ancestry.vulnerability ) r.base = -3;
      r.total = r.base + r.bonus;
    }
  }

  /* -------------------------------------------- */

  getDefenses({armor}) {
    const attributes = this.data.data.attributes;
    const defenses = duplicate(this.data.data.defenses);
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
    const healthMod = ((2 * attrs.constitution.value) + attrs.strength.value + attrs.dexterity.value) / 4;
    attrs.health.max = (12 * lvl) + Math.round(healthMod * lvl);
    attrs.health.value = Math.clamped(attrs.health.value, 0, attrs.health.max);

    // Wounds
    attrs.wounds.max = 2 * attrs.health.max;
    attrs.wounds.value = Math.clamped(attrs.wounds.value, 0, attrs.wounds.max);

    // Morale
    const moraleMod = ((2 * attrs.charisma.value) + attrs.intellect.value + attrs.wisdom.value) / 4;
    attrs.morale.max = (12 * lvl) + Math.round(moraleMod * lvl);
    attrs.morale.value = Math.clamped(attrs.morale.value, 0, attrs.morale.max);

    // Madness
    attrs.madness.max = 2 * attrs.morale.max;
    attrs.madness.value = Math.clamped(attrs.madness.value, 0, attrs.madness.max);

    // Action
    attrs.action.max = 3;
    attrs.action.value = Math.clamped(attrs.action.value, 0, attrs.action.max);

    // Focus
    attrs.focus.max = lvl * 2;
    attrs.focus.value = Math.clamped(attrs.focus.value, 0, attrs.focus.max);
  }

  /* -------------------------------------------- */
  /*  Dice Rolling Methods                        */
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
  rollSkill(skillId, {banes=0, boons=0, dc=null, rollMode=null, dialog=false}={}) {
    const skill = this.data.data.skills[skillId];
    if ( !skill ) throw new Error(`Invalid skill ID ${skillId}`);

    // Create the check roll
    const sc = new StandardCheck("", {
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
   * Use an available Action.
   * @param {object} [options]    Options which configure action usage
   * @returns {Promise<Roll[]>}
   */
  async useAction(actionId, {banes=0, boons=0, dc=null, rollMode=null, dialog=false}={}) {
    const action = this.actions[actionId];
    if ( !action ) throw new Error(`Action ${actionId} does not exist in Actor ${this.id}`);

    // Determine whether the action can be used based on its tags
    for ( let tag of action.tags ) {
      const at = SYSTEM.TALENT.ACTION_TAGS[tag];
      if ( !at ) continue;
      if ( (at.canActivate instanceof Function) && !at.canActivate(this, action) ) {
        return ui.notifications.warn(`${this.name} cannot use action ${action.name} which requires tag ${at.label}.`);
      }
    }

    // Determine whether the action can be activated
    const attrs = this.data.data.attributes;
    if ( action.actionCost > attrs.action.value ) {
      return ui.notifications.warn(`${this.name} has insufficient Action Points to use ${action.name}.`);
    }
    if ( action.focusCost > attrs.focus.value ) {
      return ui.notifications.warn(`${this.name} has insufficient Focus Points to use ${action.name}.`);
    }

    // Display that the action is being used
    const html = await action.getHTML();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({actor: this}),
      content: html
    });

    // Activate the action
    const promises = [];
    for ( let tag of action.tags ) {
      switch (tag) {
        case "mainhand":
        case "twoHanded":
          promises.push(this.equipment.weapons.mainhand.roll());
          break;
        case "offhand":
          promises.push(this.equipment.weapons.offhand.roll());
          break;
        default:
          console.warn(`No tags defined which determine how to use Action ${actionId}`);
      }
    }

    // Perform post-roll callbacks
    const rolls = await Promise.all(promises);
    for ( let tag of action.tags ) {
      const at = SYSTEM.TALENT.ACTION_TAGS[tag];
      if ( at.postActivate instanceof Function ) {
        await at.postActivate(this, action, rolls);
      }
    }

    // Incur the cost of the action that was performed
    await this.update({
      "data.attributes.action.value": this.data.data.attributes.action.value - action.actionCost,
      "data.attributes.focus.value": this.data.data.attributes.focus.value - action.focusCost
    });
    return rolls;
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
    const talent = new Item(itemData, {parent: this});

    // Ensure the Talent is not already owned
    if ( this.items.find(i => (i.data.type === "talent") && (i.name === talent.name)) ) {
      const err = game.i18n.format("TALENT.AlreadyOwned", {name: talent.name});
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Confirm that the Actor meets the requirements to add the Talent
    for ( let [k, v] of Object.entries(talent.requirements) ) {
      const current = foundry.utils.getProperty(this.data.data, k);
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
    if ( points.available < talent.data.cost ) {
      const err = game.i18n.format("TALENT.CannotAfford", {
        name: talent.name,
        cost: talent.data.cost
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
    if ( !this.L0 || (this.points.skill.spent > 0) ) {
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
   * @param {string} mainhandId   The owned Item id of the Weapon to equip in the mainhand slot
   * @param {string} offhandId    The owned Item id of the Weapon to equip in the offhand slot
   * @param {boolean} [equipped]  Are these  the weapon being equipped (true), or unequipped (false)
   * @param {boolean} [offhand]   Prefer equipping a one-handed weapon in the off-hand slot
   * @return {Promise}            A Promise which resolves once the weapon has been equipped or un-equipped
   */
  async equipWeapon({mainhandId, offhandId, equipped=true}={}) {
    const weapons = this.equipment.weapons;
    const mainhand = this.items.get(mainhandId);
    const offhand = this.items.get(offhandId);
    const updates = [];

    // Un-equip the current main-hand
    let mainhandOpen = !weapons.mainhand.id;
    if ( mainhand && (mainhand === weapons.mainhand) && !equipped ) {
      mainhandOpen = true;
      updates.push({_id: mainhand.id, "data.equipped": false});
    }

    // Un-equip the current off-hand
    let offhandOpen = !weapons.offhand.id;
    if ( offhand && (offhand === weapons.offhand) && !equipped ) {
      offhandOpen = true;
      updates.push({_id: offhand.id, "data.equipped": false});
    }

    // Equip a new main-hand
    if ( mainhand && equipped ) {
      if ( !mainhandOpen ) {
        let warn = game.i18n.format("WEAPON.CannotEquipWarning", {actor: this.name, item: mainhand.name, type: "main-hand"});
        ui.notifications.warn(warn);
      }
      else updates.push({_id: mainhand.id, "data.equipped": true});
    }

    // Equip a new off-hand
    if ( offhand && equipped ) {
      if ( !offhandOpen ) {
        let warn = game.i18n.format("WEAPON.CannotEquipWarning", {actor: this.name, item: offhand.name, type: "off-hand"});
        ui.notifications.warn(warn);
      }
      else updates.push({_id: offhand.id, "data.equipped": true});
    }

    // Apply the updates
    return this.updateEmbeddedDocuments("Item", updates);
  }
}

