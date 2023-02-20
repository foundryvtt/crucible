import { SYSTEM } from "../config/system.js";
import SkillConfig from "./skill.js";

/**
 * The ActorSheet class which is used to display a hero character.
 */
export default class HeroSheet extends ActorSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 760,
      height: 760,
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
    resources: true
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    const systemData = context.systemData = context.data.system;

    // Incomplete Tasks
    const points = this.actor.system.points;
    const i = context.incomplete = {
      ancestry: !systemData.details.ancestry?.name,
      background: !systemData.details.background?.name,
      abilities: points.ability.requireInput,
      skills: points.skill.available,
      talents: points.talent.available,
      level: this.actor.isL0 || (this.actor.system.advancement.pct === 100),
      levelOne: this.actor.isL0,
      levelUp: (this.actor.system.advancement.pct === 100)
    }
    i.any = i.ancestry || i.background || i.abilities || i.skills || i.talents;
    if ( this.actor.isL0 ) i.levelTooltip = `WALKTHROUGH.Level${i.any ? "Zero" : "One"}`;
    else i.levelTooltip = "WALKTHROUGH.LevelUp";
    i.levelIcon = i.levelOne ? "fa-exclamation-triangle" : "fa-circle-plus";
    context.packs = SYSTEM.COMPENDIUM_PACKS;

    // Ancestry and Background names
    systemData.details.ancestry.name ||= game.i18n.localize("ANCESTRY.None");
    systemData.details.background.name ||= game.i18n.localize("BACKGROUND.None");

    // Equipment
    context.items = this.#formatItems(this.actor.items);
    const eqp = this.actor.equipment;
    context.armorCategory = SYSTEM.ARMOR.CATEGORIES[eqp.armor.system.category].label;
    const {mainhand: mh, offhand: oh, twoHanded: th} = eqp.weapons;
    context.featuredEquipment = [
      {name: mh.name, img: mh.img, tag: [mh.getTags().damage]}
    ]
    if ( !th ) context.featuredEquipment.push({name: oh.name, img: oh.img, tag: [oh.getTags().damage]});
    const a = eqp.armor;
    context.featuredEquipment.push({name: a.name, img: a.img, tag: eqp.armor.getTags("short").armor})

    // Leveling
    context.isL0 = this.actor.isL0;
    context.points = this.actor.points;
    context.showMilestones = this.actor.level.between(1, 23);

    // Abilities
    context.abilityScores = this.#formatAbilities(this.actor.system.abilities);

    // Resources
    context.resources = this.#formatResources(this.actor.system.resources);

    // Defenses
    context.saveDefenses = this.#formatSaveDefenses(this.actor.system.defenses);

    // Resistances
    context.resistances = this.#formatResistances(this.actor.system.resistances);

    // Skills
    context.skillCategories = this.#formatSkills(this.actor.system.skills);

    // Talents
    context.talentTreeButton = game.system.tree.actor === this.actor ? "Close Talent Tree" : "Open Talent Tree";
    context.talents = this.actor.itemTypes.talent.sort((a, b) => a.name.localeCompare(b.name));

    // Actions
    context.actions = Object.values(context.actor.actions).map(a => {
      return {id: a.id, name: a.name, img: a.img, tags: a.getTags().activation, totalCost: a.actionCost + a.focusCost}
    }).sort((a, b) => (a.totalCost - b.totalCost) || (a.name.localeCompare(b.name)));

    // Spellcraft
    context.grimoire = this.#formatGrimoire();

    // Active Effects
    context.effects = this.#formatEffects();

    // HTML Biography
    context.biography = {};
    context.biography.public = await TextEditor.enrichHTML(context.systemData.details.biography.public, {
      secrets: this.actor.isOwner,
      rollData: context.rollData,
      async: true,
      relativeTo: this.actor
    });
    context.biography.private = await TextEditor.enrichHTML(context.systemData.details.biography.private, {
      secrets: this.actor.isOwner,
      rollData: context.rollData,
      async: true,
      relativeTo: this.actor
    });

    // Section locks
    context.sectionLocks = this.#getSectionLocks(context);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Format ability scores for display on the Actor sheet.
   * @param {object} abilities
   * @return {object[]}
   */
  #formatAbilities(abilities) {
    return Object.entries(SYSTEM.ABILITIES).map(e => {
      let [a, ability] = e;
      const attr = foundry.utils.mergeObject(abilities[a], ability);
      attr.id = a;
      attr.canIncrease = this.actor.canPurchaseAbility(a, 1);
      attr.canDecrease = this.actor.canPurchaseAbility(a, -1);
      return attr;
    });
  }

  /* -------------------------------------------- */

  #formatItems(items) {

    // Define placeholder structure
    const sections = {
      talents: {
        active: {
          label: "Active Abilities",
          items: []
        },
        passive: {
          label: "Passive Talents",
          items: []
        }
      },
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
      }
    };

    // Iterate over items and organize them
    for ( let i of items ) {
      const d = i.toObject();
      d.showStack = d.system?.quantity && (d.system.quantity !== 1);
      switch(d.type) {
        case "armor":
        case "weapon":
          d.tags = i.getTags();
          d.cssClass = [d.system.equipped ? "equipped" : "unequipped"];
          if ( d.system.equipped ) sections.inventory.equipment.items.push(d);
          else sections.inventory.backpack.items.push(d);
          break;
        case "talent":
          d.tags = {};
          const action = i.actions.at(0);
          const spellComp = i.system.rune || i.system.gesture || i.system.inflection;
          if ( action ) {
            const tags = action.getTags();
            d.tags = Object.assign({}, tags.action, tags.activation);
            sections.talents.active.items.push(d);
          }
          else if ( !spellComp ) sections.talents.passive.items.push(d);
          break;
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
   * Format categories of the grimoire tab.
   * @returns {{
   *  runes: {label: string, known: Set<CrucibleRune>},
   *  inflections: {label: string, known: Set<CrucibleInflection>},
   *  gestures: {label: string, known: Set<CrucibleGesture>}
   * }}
   */
  #formatGrimoire() {
    const grimoire = {
      runes: {label: game.i18n.localize("SPELL.ComponentRune")},
      gestures: {label: game.i18n.localize("SPELL.ComponentGesture")},
      inflections: {label: game.i18n.localize("SPELL.ComponentInflection")}
    }
    for ( const [k, v] of Object.entries(this.actor.grimoire) ) {
      grimoire[k].known = v;
    }
    return grimoire;
  }

  /* -------------------------------------------- */

  /**
   * Format ActiveEffect data required for rendering the sheet
   * @returns {object[]}
   */
  #formatEffects() {
    return this.actor.effects.map(effect => {
      const {startRound, rounds} = effect.duration;
      const tags = {};
      if ( rounds ) tags.duration = game.combat?.round ? (startRound + rounds - game.combat.round) : rounds;
      else tags.duration = "∞";
      return {
        id: effect.id,
        icon: effect.icon,
        label: effect.label,
        tags: tags
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Format the display of resource attributes on the actor sheet
   * @param {object} resources       The ActorData.system.resources object
   */
  #formatResources(resources) {
    const formatted = {};
    for ( const [id, r] of Object.entries(resources) ) {
      const cfg = SYSTEM.RESOURCES[id];
      const resource = foundry.utils.mergeObject(r, cfg);
      resource.pct = Math.round(resource.value * 100 / resource.max);
      const p = resource.pct / 100;
      const c0 = r.color.low.rgb;
      const c1 = r.color.high.rgb;
      const bg = c0.map(c => c * 0.25 * 255);
      const fill = c1.map((c, i) => ((c * p) + (c0[i] * (1-p))) * 255);
      resource.color = {
        bg: `rgb(${bg.join(",")})`,
        fill: `rgb(${fill.join(",")})`
      }
      formatted[id] = resource;
    }
    return formatted;
  }

  /* -------------------------------------------- */

  /**
   * Format magic defenses for display in the sheet.
   * @param {object} defenses     Prepared Actor system defenses
   * @returns {object[]}          A formatted array of save defenses
   */
  #formatSaveDefenses(defenses) {
    const formatted = [];
    for ( const [id, defense] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( defense.type !== "save" ) continue;
      const d = foundry.utils.mergeObject(defense, defenses[id]);
      d.id = id;
      formatted.push(d);
    }
    return formatted;
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order
   * @param {Object} skills
   * @return {*}
   */
  #formatSkills(skills) {
    const categories = foundry.utils.deepClone(SYSTEM.SKILL_CATEGORIES);
    for ( const skill of Object.values(SYSTEM.SKILLS) ) {
      const s = foundry.utils.mergeObject(skill, skills[skill.id]);
      const category = categories[skill.category];

      // Skill data
      s.abilityAbbrs = skill.abilities.map(a => SYSTEM.ABILITIES[a].abbreviation);
      s.pips = Array.fromRange(5).map((v, i) => i < s.rank ? "trained" : "untrained");
      s.css = [
        s.rank > 0 ? "trained" : "untrained",
        s.path ? "specialized" : "unspecialized"
      ].join(" ");
      s.canIncrease = this.actor.canPurchaseSkill(skill.id, 1);
      s.canDecrease = this.actor.canPurchaseSkill(skill.id, -1);

      // Specialization status
      const path = skill.paths[skill.path] || null;
      s.rankName = SYSTEM.SKILL_RANKS[skill.rank].label;
      s.pathName = path ? path.name : game.i18n.localize("SKILL.Unspecialized");

      // Add to category
      category.skills ||= {};
      category.skills[skill.id] = s;
    }
    return categories;
  }

  /* -------------------------------------------- */

  /**
   * Organize resistances data for rendering
   * @param {object} resistances    The Actor's resistances data
   * @return {object}               Resistances data organized by category
   */
  #formatResistances(resistances) {
    const categories = foundry.utils.deepClone(SYSTEM.DAMAGE_CATEGORIES);
    return Object.entries(resistances).reduce((categories, e) => {

      // Merge resistance data for rendering
      let [id, r] = e;
      const resist = foundry.utils.mergeObject(r, SYSTEM.DAMAGE_TYPES[id]);

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
   */
  #getSectionLocks(context) {
    const locks = foundry.utils.deepClone(this._sectionLocks);
    if ( context.incomplete.abilities ) locks.abilities = false;
    return locks;
  }

  /* -------------------------------------------- */

  /** @override */
  async close(options) {
    await super.close(options);
    await this.actor.toggleTalentTree(false);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action]").click(this.#onClickControl.bind(this));
    html.find("a.section-lock").click(this.#onToggleSectionLock.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a Skill control
   * @param {Event} event   The originating click event
   */
  async #onClickControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    switch ( a.dataset.action ) {
      case "abilityDecrease":
        return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, -1);
      case "abilityIncrease":
        return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, 1);
      case "browseCompendium":
        const pack = game.packs.get(a.dataset.pack);
        return pack.render(true);
      case "clearAncestry":
        return this.actor.applyAncestry(null);
      case "clearBackground":
        return this.actor.applyBackground(null);
      case "effectDelete":
        return this.#onEffectDelete(a);
      case "effectEdit":
        return this.#onEffectEdit(a);
      case "itemDelete":
        return this.#onItemDelete(a);
      case "itemEdit":
        return this.#onItemEdit(a);
      case "itemEquip":
        return this.#onItemEquip(a);
      case "levelUp":
        game.tooltip.deactivate();
        return this.actor.levelUp(1);
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
      case "talentTree":
        return this.actor.toggleTalentTree();
      case "talentReset":
        return this.actor.resetTalents();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the locked state of a specific sheet section
   * @param {Event} event   The originating click event
   */
  #onToggleSectionLock(event) {
    event.preventDefault()
    const a = event.currentTarget;
    this._sectionLocks[a.dataset.section] = !this._sectionLocks[a.dataset.section];
    this.render();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(itemData) {
    switch (itemData.type) {
      case "archetype":
        return ui.notifications.error("Archetype items cannot be added to a protagonist Actor.")
      case "ancestry":
        return this.actor.applyAncestry(itemData);
      case "background":
        return this.actor.applyBackground(itemData);
      case "talent":
        return ui.notifications.error("Talents can only be added to a protagonist Actor via the Talent Tree.");
    }
    return super._onDropItemCreate(itemData);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an ActiveEffect within the Actor sheet.
   * @param {HTMLLinkElement} button    The clicked button element
   */
  #onEffectDelete(button) {
    const li = button.closest("[data-effect-id]");
    const effect = this.actor.effects.get(li.dataset.effectId);
    effect?.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an ActiveEffect within the Actor sheet.
   * @param {HTMLLinkElement} button    The clicked button element
   */
  #onEffectEdit(button) {
    const li = button.closest("[data-effect-id]");
    const effect = this.actor.effects.get(li.dataset.effectId);
    effect?.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an Owned Item from the Actor
   * @param {HTMLLinkElement} button
   */
  #onItemDelete(button) {
    const li = button.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    return item?.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an Owned Item on the Actor
   * @param {HTMLLinkElement} button
   */
  #onItemEdit(button) {
    const li = button.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    return item?.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Toggle the equipped state of an Owned Item on the Actor
   * @param {HTMLLinkElement} button
   */
  #onItemEquip(button) {
    const li = button.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    if ( !item ) return;
    switch ( item.type ) {
      case "armor":
        return this.actor.equipArmor({
          itemId: item.id,
          equipped: !item.system.equipped
        });
      case "weapon":
        return this.actor.equipWeapon({
          itemId: item.id,
          equipped: !item.system.equipped
        });
    }
  }
}
