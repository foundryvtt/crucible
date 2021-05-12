import { SYSTEM } from "../config/system.js";
import StandardCheck from "../dice/standard-check.js"


export default class CrucibleActor extends Actor {
  constructor(data, context) {
    super(data, context)

    /**
     * Track the equipment that the Actor is currently using
     * @type {{armor: Item, weapons: Item[], accessories: Item[]}}
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
    this._preparePoints(data);

    // Prepare Attributes
    this._prepareAttributes(data);

    // Prepare Skills
    this._prepareSkills(data);
  }

  /* -------------------------------------------- */

  /** @override */
  prepareEmbeddedEntities() {
    super.prepareEmbeddedEntities();
    this._prepareEquipment();
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
  _preparePoints(data) {
    const level = data.data.details.level = Math.clamped(data.data.details.level, 1, 24);
    this.points = {
      ability: { pool: 36, total: (level - 1), bought: null, spent: null, available: null },
      skill: { total: 2 + ((level-1) * 2), spent: null, available: null },
      talent: { total: 3 + ((level - 1) * 3), spent: null, available: null }
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare attributes, ability scores, and resource pools for the Actor.
   * @param {object} data       The actor data to prepare
   * @private
   */
  _prepareAttributes(data) {
    const attrs = data.data.attributes;
    const anc = data.data.details.ancestry;

    // Ability Scores
    let abilityPointsBought = 0;
    let abilityPointsSpent = 0;
    for ( let a in CONFIG.SYSTEM.ABILITIES ) {
      let ability = attrs[a];
      ability.initial = 1;
      if ( a === anc.primary ) ability.initial = 3;
      else if ( a === anc.secondary ) ability.initial = 2;
      ability.value = ability.initial + ability.base + ability.increases + ability.bonus;
      abilityPointsBought += Array.fromRange(ability.initial + ability.base + 1).reduce((a, v) => a + v);
      abilityPointsSpent += ability.increases;
      ability.cost = ability.value + 1;
    }

    // Track spent ability points
    const basePoints = this.data.data.details.ancestry ? 13 : 0;
    this.points.ability.bought = abilityPointsBought - basePoints;
    this.points.ability.pool = 36 - this.points.ability.bought;
    this.points.ability.spent = abilityPointsSpent;
    this.points.ability.available = this.points.ability.total - abilityPointsSpent;
  }

  /* -------------------------------------------- */

  /**
   * Classify the equipment that the Actor currently has equipped
   * @private
   */
  _prepareEquipment() {
    const {armor, weapon, accessory} = this.itemTypes;
    const equipment = {};

    // Identify equipped armor
    let armors = armor.filter(i => i.data.data.equipped);
    if ( armors.length > 1 ) {
      ui.notifications.warning(`Actor ${this.name} has more than one equipped armor.`);
      armors = armors[0];
    }
    equipment.armor = armors[0] || new Item.implementation(SYSTEM.ARMOR.UNARMORED_DATA, {parent: this});

    // TODO: Weapons can be up to two one-handed or one two-handed weapon
    equipment.weapons = weapon;

    // TODO: Accessories can be up to three equipped and attuned
    equipment.accessories = accessory;
    this.equipment = equipment;
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
    const lvl = data.data.details.level;
    const attrs = data.data.attributes;

    // Health
    const healthMod = ((2 * attrs.constitution.value) + attrs.strength.value + attrs.dexterity.value) / 4;
    attrs.health.max = (8 * lvl) + Math.round(healthMod * lvl);
    attrs.health.value = Math.clamped(attrs.health.value, 0, attrs.health.max);

    // Wounds
    attrs.wounds.max = 2 * attrs.health.max;
    attrs.wounds.value = Math.clamped(attrs.wounds.value, 0, attrs.wounds.max);

    // Morale
    const moraleMod = ((2 * attrs.charisma.value) + attrs.intellect.value + attrs.wisdom.value) / 4;
    attrs.morale.max = (8 * lvl) + Math.round(moraleMod * lvl);
    attrs.morale.value = Math.clamped(attrs.morale.value, 0, attrs.morale.max);

    // Madness
    attrs.madness.max = 2 * attrs.morale.max;
    attrs.madness.value = Math.clamped(attrs.madness.value, 0, attrs.madness.max);

    // Action
    attrs.action.max = 3;
    attrs.action.value = Math.clamped(attrs.action.value, 0, attrs.action.max);

    // Focus
    attrs.focus.max = lvl * 3;
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
  /*  Character Creation Methods                  */
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
    if ( (this.data.data.details.level !== 1) || (this.points.skill.spent > 0) || (this.points.ability.spent > 0) ) {
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
    if ( (this.data.data.details.level !== 1) || (this.points.skill.spent > 0) ) {
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
    const isPointBuy = this.data.data.details.level === 1;
    const attr = this.data.data.attributes[ability];
    if ( !attr ) return;

    // Case 1 - Point Buy
    if ( isPointBuy ) {
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
}