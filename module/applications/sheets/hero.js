import { SYSTEM } from "../../config/system.js";
import CrucibleActorSheet from "./actor.mjs";
import SkillConfig from "../config/skill.mjs";

/**
 * The ActorSheet class which is used to display a Hero Actor.
 */
export default class HeroSheet extends CrucibleActorSheet {

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
    const {actor: a, source: s, incomplete: i} = context;
    const {isL0} = a;

    // Incomplete Tasks
    context.points = a.system.points;
    Object.assign(i, {
      ancestry: !s.system.details.ancestry?.name,
      background: !s.system.details.background?.name,
      abilities: context.points.ability.requireInput,
      skills: context.points.skill.available,
      talents: context.points.talent.available,
      level: isL0 || (a.system.advancement.pct === 100),
      levelOne: isL0,
      levelUp: (a.system.advancement.pct === 100)
    });
    i.any = i.ancestry || i.background || i.abilities || i.skills || i.talents;
    if ( isL0 ) i.levelTooltip = `WALKTHROUGH.Level${i.any ? "Zero" : "One"}`;
    else i.levelTooltip = "WALKTHROUGH.LevelUp";
    i.levelIcon = i.levelOne ? "fa-exclamation-triangle" : "fa-circle-plus";
    context.isL0 = isL0;
    context.showMilestones = a.system.advancement.level.between(1, 23);

    // Compendium Packs
    context.packs = SYSTEM.COMPENDIUM_PACKS;

    // Ancestry and Background names
    context.ancestryName = s.system.details.ancestry?.name || game.i18n.localize("ANCESTRY.None");
    context.backgroundName = s.system.details.background?.name || game.i18n.localize("BACKGROUND.None");

    // Skills
    context.skillCategories = this.#formatSkills(a.system.skills);

    // Talents
    context.talentTreeButton = game.system.tree.actor === a ? "Close Talent Tree" : "Open Talent Tree";

    // Section locks
    context.sectionLocks = this.#getSectionLocks(context);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order
   * @param {Object} skills
   * @return {*}
   */
  #formatSkills(skills) {
    const categories = foundry.utils.deepClone(SYSTEM.SKILL.CATEGORIES);
    for ( const skill of Object.values(SYSTEM.SKILLS) ) {
      const s = foundry.utils.mergeObject(skill, skills[skill.id], {inplace: false});
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
      const path = skill.paths[s.path] || null;
      s.rankName = SYSTEM.SKILL.RANKS[s.rank].label;
      s.pathName = path ? path.name : game.i18n.localize("SKILL.RANKS.Unspecialized");

      // Add to category
      category.skills ||= {};
      category.skills[skill.id] = s;
    }
    return categories;
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
    html.find("a.section-lock").click(this.#onToggleSectionLock.bind(this));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onClickControl(event) {
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
      case "talentTree":
        return this.actor.toggleTalentTree();
      case "talentReset":
        return this.actor.resetTalents();
    }
    return super._onClickControl(event);
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
}
