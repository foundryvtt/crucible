import { SYSTEM } from "../config/system.js";
import SkillSheet from "./skill.js";

/**
 * A sheet application for displaying Skills
 * @type {Actor}
 */
export default class HeroSheet extends ActorSheet {

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 760,
      height: 840,
      classes: [SYSTEM.id, "sheet", "actor"],
      template: `systems/${SYSTEM.id}/templates/sheets/hero.html`,
      resizable: false,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes"}],
      scrollY: [".tab.attributes", ".tab.skills"]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.armorCategory = SYSTEM.ARMOR.CATEGORIES[this.actor.equipment.armor.data.data.category].label;
    data.points = this.actor.points;
    data.isL1 = data.entity.data.details.level === 1;
    data.abilityScores = this._formatAttributes(data.entity.data.attributes);
    this._formatResources(data.entity.data.attributes);
    data.resistances = this._formatResistances(data.entity.data.resistances);
    data.skillCategories = this._formatSkills(data.entity.data.skills);
    data.items = this._formatItems(this.entity.items);
    return data;
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
      const attr = mergeObject(attributes[a], ability, {inplace: true});
      attr.id = a;
      attr.canIncrease = (points.pool > 0) || (points.available > 0);
      attr.canDecrease = (this.actor.data.data.details.level === 1) || (attr.increases > 0);
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

  _formatResources(attributes) {
    for ( let [id, r] of Object.entries(SYSTEM.RESOURCES) ) {
      attributes[id].tooltip = r.tooltip;
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
    const categories = duplicate(SYSTEM.SKILL_CATEGORIES);
    return Object.entries(duplicate(skills)).reduce((categories, e) => {
      let [id, c] = e;
      const skill = mergeObject(c, SYSTEM.SKILLS[id]);
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
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("a.control").click(this._onClickControl.bind(this));
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
        return new SkillSheet(this.actor, skillId).render(true);
      case "skillDecrease":
        return this.actor.purchaseSkill(a.closest(".skill").dataset.skill, -1);
      case "skillIncrease":
        return this.actor.purchaseSkill(a.closest(".skill").dataset.skill, 1);
      case "skillRoll":
        return this.actor.rollSkill(a.closest(".skill").dataset.skill, {dialog: true});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(itemData) {
    switch (itemData.type) {
      case "ancestry":
        return this.actor.applyAncestry(itemData);
      case "background":
        return this.actor.applyBackground(itemData);
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
    const itemId = li.dataset.itemId;
    return this.actor.deleteOwnedItem(itemId);
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
    if ( !item ) return;
    return item.sheet.render(true);
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
    const equipped = item.data.data.equipped;

    // Handle different item types
    const updates = [];
    switch ( item.data.type ) {
      case "armor":
        const current = this.actor.equipment.armor;
        if ( !equipped && current?.id ) {
          updates.push({_id: current.id, "data.equipped": false});
        }
        updates.push({_id: item.id, "data.equipped": !equipped});
        break;
      case "weapon":
        updates.push({_id: item.id, "data.equipped": !equipped});
        break;
    }

    // Commit the updates
    return this.actor.updateEmbeddedEntity("OwnedItem", updates);
  }
}
