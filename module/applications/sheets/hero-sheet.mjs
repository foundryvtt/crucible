import CrucibleBaseActorSheet from "./base-actor-sheet.mjs";

/**
 * A CrucibleBaseActorSheet subclass used to configure Actors of the "hero" type.
 */
export default class HeroSheet extends CrucibleBaseActorSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actor: {
      type: "hero"
    }
  };

  static {
    this._initializeActorSheetClass();
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
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const {actor: a, source: s, incomplete: i} = context;

    // Incomplete Tasks
    const {isL0} = a;
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

    // Ancestry and Background names
    context.ancestryName = s.system.details.ancestry?.name || game.i18n.localize("ANCESTRY.None");
    context.backgroundName = s.system.details.background?.name || game.i18n.localize("BACKGROUND.None");

    // i.any = i.ancestry || i.background || i.abilities || i.skills || i.talents;
    // if ( isL0 ) i.levelTooltip = `WALKTHROUGH.Level${i.any ? "Zero" : "One"}`;
    // else i.levelTooltip = "WALKTHROUGH.LevelUp";
    // i.levelIcon = i.levelOne ? "fa-exclamation-triangle" : "fa-circle-plus";
    // context.isL0 = isL0;
    // context.showMilestones = a.system.advancement.level.between(1, 23);
    //
    // // Compendium Packs
    // context.packs = SYSTEM.COMPENDIUM_PACKS;

    //
    // // Talents
    // context.talentTreeButton = game.system.tree.actor === a ? "Close Talent Tree" : "Open Talent Tree";
    //
    // // Section locks
    // context.sectionLocks = this.#getSectionLocks(context);
    return context;
  }

  // /* -------------------------------------------- */
  //
  // /**
  //  * Update section locks to automatically unlock sections where the user needs to provide input.
  //  */
  // #getSectionLocks(context) {
  //   const locks = foundry.utils.deepClone(this._sectionLocks);
  //   if ( context.incomplete.abilities ) locks.abilities = false;
  //   return locks;
  // }
  //
  // /* -------------------------------------------- */
  //
  // /** @override */
  // async close(options) {
  //   await super.close(options);
  //   await this.actor.toggleTalentTree(false);
  // }
  //
  // /* -------------------------------------------- */
  // /*  Event Listeners and Handlers                */
  // /* -------------------------------------------- */
  //
  // /** @override */
  // activateListeners(html) {
  //   super.activateListeners(html);
  //   html.find("a.section-lock").click(this.#onToggleSectionLock.bind(this));
  // }
  //
  // /* -------------------------------------------- */
  //
  // /** @inheritDoc */
  // async _onClickControl(event) {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   const a = event.currentTarget;
  //   switch ( a.dataset.action ) {
  //     case "abilityDecrease":
  //       return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, -1);
  //     case "abilityIncrease":
  //       return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, 1);
  //     case "clearAncestry":
  //       return this.actor.system.applyAncestry(null);
  //     case "clearBackground":
  //       return this.actor.system.applyBackground(null);
  //     case "levelUp":
  //       game.tooltip.deactivate();
  //       return this.actor.levelUp(1);
  //     case "skillConfig":
  //       const skillId = a.closest(".skill").dataset.skill;
  //       return new SkillConfig(this.actor, skillId).render(true);
  //     case "skillDecrease":
  //       return this.actor.purchaseSkill(a.closest(".skill").dataset.skill, -1);
  //     case "skillIncrease":
  //       return this.actor.purchaseSkill(a.closest(".skill").dataset.skill, 1);
  //     case "skillRoll":
  //       return this.actor.rollSkill(a.closest(".skill").dataset.skill, {dialog: true});
  //     case "talentTree":
  //       return this.actor.toggleTalentTree();
  //     case "talentReset":
  //       return this.actor.resetTalents();
  //     case "viewAncestry":
  //       return this.actor._viewDetailItem("ancestry", {editable: false});
  //     case "viewBackground":
  //       return this.actor._viewDetailItem("background", {editable: false});
  //   }
  //   return super._onClickControl(event);
  // }
  //
  // /* -------------------------------------------- */
  //
  // /**
  //  * Handle toggling the locked state of a specific sheet section
  //  * @param {Event} event   The originating click event
  //  */
  // #onToggleSectionLock(event) {
  //   event.preventDefault()
  //   const a = event.currentTarget;
  //   this._sectionLocks[a.dataset.section] = !this._sectionLocks[a.dataset.section];
  //   this.render();
  // }
  //
  // /* -------------------------------------------- */
  //
  // /** @override */
  // async _onDropItemCreate(itemData) {
  //   switch (itemData.type) {
  //     case "ancestry":
  //       return this.actor.system.applyAncestry(itemData);
  //     case "background":
  //       return this.actor.system.applyBackground(itemData);
  //     case "talent":
  //       return ui.notifications.error("Talents can only be added to a protagonist Actor via the Talent Tree.");
  //   }
  //   return super._onDropItemCreate(itemData);
  // }
}
