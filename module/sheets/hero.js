import { SYSTEM } from "../config/system.js";
import SkillConfig from "./skill.js";

/**
 * The ActorSheet class which is used to display a hero character
 * @extends {ActorSheet}
 */
export default class HeroSheet extends ActorSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 760,
      height: 780,
      classes: [SYSTEM.id, "sheet", "actor"],
      template: `systems/${SYSTEM.id}/templates/sheets/hero.html`,
      resizable: false,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}],
      scrollY: [".tab.attributes", ".tab.skills"]
    });
  }

  /**
   * Lock sections of the character sheet to prevent them from being inadvertently edited
   * @type {{abilities: boolean, defenses: boolean, resistances: boolean, resources: boolean}}
   * @private
   */
  _sectionLocks = {
    abilities: true,
    defenses: true,
    resistances: true,
    resources: false
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const context = super.getData();
    const systemData = context.systemData = context.data.data;

    // Character
    context.hasAncestry = !!systemData.details.ancestry.name;
    if ( !context.hasAncestry ) systemData.details.ancestry.name = "No Ancestry";
    context.hasBackground = !!systemData.details.background.name;
    if ( !context.hasBackground ) systemData.details.background.name = "No Background";

    // Equipment
    context.items = this._formatItems(this.actor.items);
    const eqp = this.actor.equipment;
    context.armorCategory = SYSTEM.ARMOR.CATEGORIES[eqp.armor.data.data.category].label;
    context.armorTag = eqp.armor.getTags().defenses;
    context.mainhandTag = eqp.weapons.mainhand.data.data.damage;
    context.showOffhand = !eqp.weapons.twoHanded;
    context.offhandTag = eqp.weapons.offhand.data.data.damage;

    // Leveling
    context.isL0 = this.actor.isL0;
    context.points = this.actor.points;

    // Abilities
    context.abilityScores = this._formatAttributes(systemData.attributes);

    // Resources
    this._formatResources(systemData.attributes);

    // Resistances
    context.resistances = this._formatResistances(systemData.resistances);

    // Skills
    context.skillCategories = this._formatSkills(systemData.skills);

    // Talents
    context.talents = this.actor.itemTypes.talent.sort((a, b) => a.name.localeCompare(b.name));

    // Actions
    context.actions = Object.values(context.actor.actions).map(a => {
      return {id: a.id, name: a.name, img: a.img, tags: a.getActivationTags()}
    });

    // Section locks
    this._updateSectionLocks();
    context.sectionLocks = this._sectionLocks;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Format ability scores for display on the Actor sheet.
   * @param {object} attributes
   * @return {object[]}
   * @private
   */
  _formatAttributes(attributes) {
    const points = this.actor.points.ability;
    return Object.entries(SYSTEM.ABILITIES).map(e => {
      let [a, ability] = e;
      const attr = foundry.utils.mergeObject(attributes[a], ability);
      attr.id = a;
      attr.canIncrease = (attr.value < 12) && (this.actor.isL0 ? (points.pool > 0) : (points.available > 0));
      attr.canDecrease = this.actor.isL0 ? (attr.value > attr.initial) : (attr.value > attr.initial + attr.base)
      return attr;
    });
  }

  /* -------------------------------------------- */

  _formatItems(items) {

    // Define placeholder structure
    const sections = {
      talents: {},
      inventory: {
        equipment: {
          label: "Equipment",
          items: []
        },
        consumables: {
          label: "Consumables",
          items: []
        },
        backpack: {
          label: "Backpack",
          items: []
        }
      },
      grimoire: {
        runes: {
          label: "Runes",
          items: []
        },
        gestures: {
          label: "Gestures",
          items: []
        },
        metamagic: {
          label: "Metamagic",
          items: []
        }
      }
    };

    // Iterate over items and organize them
    for ( let i of items ) {
      const data = duplicate(i.data);
      data.showStack = data.data?.quantity && (data.data.quantity !== 1);
      data.tags = i.getTags();
      switch(data.type) {
        case "armor": case "weapon":
          data.cssClass = [data.data.equipped ? "equipped" : "unequipped"];
          if ( data.data.equipped ) sections.inventory.equipment.items.push(data);
          else sections.inventory.backpack.items.push(data);
      }
    }

    // Sort each array
    for ( let section of Object.values(sections) ) {
      for ( let heading of Object.values(section) ) {
        heading.items.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Return the prepared sections
    return sections;
  }

  /* -------------------------------------------- */

  /**
   * Format the display of resource attributes on the actor sheet
   * @param {object} attributes       The ActorData.data.attributes object
   * @private
   */
  _formatResources(attributes) {
    for ( let [id, r] of Object.entries(SYSTEM.RESOURCES) ) {
      const attr = attributes[id];
      attr.tooltip = r.tooltip;
      attr.pct = Math.round(attr.value * 100 / attr.max);

      // Determine resource bar color
      const p = attr.pct / 100;
      const c0 = foundry.utils.hexToRGB(r.color.low);
      const c1 = foundry.utils.hexToRGB(r.color.high);
      const bg = c0.map(c => c * 0.25 * 255);
      const fill = c1.map((c, i) => ((c * p) + (c0[i] * (1-p))) * 255);
      attr.color = {
        bg: `rgb(${bg.join(",")})`,
        fill: `rgb(${fill.join(",")})`
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order
   * @param {Object} skills
   * @return {*}
   * @private
   */
  _formatSkills(skills) {
    const categories = foundry.utils.deepClone(SYSTEM.SKILL_CATEGORIES);
    return Object.entries(skills).reduce((categories, e) => {
      let [id, c] = e;
      const skill = mergeObject(c, SYSTEM.SKILLS[id], {inplace: false});
      const cat = categories[skill.category];
      if ( !cat ) return categories;

      // Update skill data for rendering
      skill.attributes = skill.attributes.map(a => SYSTEM.ABILITIES[a]);
      skill.pips = Array.fromRange(5).map((v, i) => i < c.rank ? "trained" : "untrained");
      skill.css = [
        c.rank > 0 ? "trained" : "untrained",
        c.path ? "specialized" : "unspecialized"
      ].join(" ");

      // Specialization status
      const path = skill.paths[skill.path] || null;
      skill.rankName = SYSTEM.SKILL_RANKS[skill.rank].label;
      skill.pathName = path ? path.name : game.i18n.localize("SKILL.Unspecialized");

      // Add to category and return
      cat.skills = cat.skills || {};
      cat.skills[id] = skill;
      return categories;
    }, categories);
  }

  /* -------------------------------------------- */

  /**
   * Organize resistances data for rendering
   * @param {object} resistances    The Actor's resistances data
   * @return {object}               Resistances data organized by category
   * @private
   */
  _formatResistances(resistances) {
    const categories = duplicate(SYSTEM.DAMAGE_CATEGORIES);
    return Object.entries(duplicate(resistances)).reduce((categories, e) => {

      // Merge resistance data for rendering
      let [id, r] = e;
      const resist = mergeObject(r, SYSTEM.DAMAGE_TYPES[id]);

      // Add the resistance to its category
      const cat = categories[resist.type];
      cat.resists = cat.resists || {};
      cat.resists[id] = resist;
      return categories;
    }, categories);
  }

  /* -------------------------------------------- */

  /**
   * Update section locks to automatically unlock sections where the user needs to provide input.
   * @private
   */
  _updateSectionLocks() {
    const locks = this._sectionLocks;
    const points = this.actor.points;
    if ( points.ability.hasUnspent ) locks.abilities = false;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("a.control").click(this._onClickControl.bind(this));
    html.find("a.section-lock").click(this._onToggleSectionLock.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a Skill control
   * @param {Event} event   The originating click event
   * @private
   */
  async _onClickControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    switch ( a.dataset.action ) {
      case "abilityDecrease":
        return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, -1);
      case "abilityIncrease":
        return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, 1);
      case "itemDelete":
        return this._onItemDelete(a);
      case "itemEdit":
        return this._onItemEdit(a);
      case "itemEquip":
        return this._onItemEquip(a);
      case "skillConfig":
        const skillId = a.closest(".skill").dataset.skill;
        return new SkillConfig(this.actor, skillId).render(true);
      case "skillDecrease":
        return this.actor.purchaseSkill(a.closest(".skill").dataset.skill, -1);
      case "skillIncrease":
        return this.actor.purchaseSkill(a.closest(".skill").dataset.skill, 1);
      case "skillRoll":
        return this.actor.rollSkill(a.closest(".skill").dataset.skill, {dialog: true});
      case "useAction":
        return this.actor.useAction(a.closest(".action").dataset.actionId);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the locked state of a specific sheet section
   * @param {Event} event   The originating click event
   * @private
   */
  _onToggleSectionLock(event) {
    event.preventDefault()
    const a = event.currentTarget;
    this._sectionLocks[a.dataset.section] = !this._sectionLocks[a.dataset.section];
    this.render();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(itemData) {
    switch (itemData.type) {
      case "ancestry":
        return this.actor.applyAncestry(itemData);
      case "background":
        return this.actor.applyBackground(itemData);
      case "talent":
        return this.actor.addTalent(itemData);
    }
    return super._onDropItemCreate(itemData);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an Owned Item from the Actor
   * @param {HTMLLinkElement} button
   * @private
   */
  _onItemDelete(button) {
    const li = button.closest(".item");
    const item = this.actor.items.get(li.dataset.itemId);
    return item?.delete();
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an Owned Item on the Actor
   * @param {HTMLLinkElement} button
   * @private
   */
  _onItemEdit(button) {
    const li = button.closest(".item");
    const item = this.actor.items.get(li.dataset.itemId);
    return item?.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Toggle the equipped state of an Owned Item on the Actor
   * @param {HTMLLinkElement} button
   * @private
   */
  _onItemEquip(button) {
    const li = button.closest(".item");
    const item = this.actor.items.get(li.dataset.itemId);
    if ( !item ) return;
    switch ( item.data.type ) {
      case "armor":
        return this.actor.equipArmor({itemId: item.id, equipped: !item.data.data.equipped});
      case "weapon":
        const category = item.data.category;
        const options = {equipped: !item.data.data.equipped};
        if ( category.off ) options.offhandId = item.id;
        else if ( category.main ) options.mainhandId = item.id; // TODO: if the category is mainhand, equip as mainhand
        return this.actor.equipWeapon(options);
    }
  }
}
