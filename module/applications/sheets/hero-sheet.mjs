import CrucibleBaseActorSheet from "./base-actor-sheet.mjs";
import SkillConfig from "../config/skill.mjs";

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

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const {actor: a, source: s, incomplete: i} = context;

    // Expand Context
    Object.assign(context, {
      ancestryName: s.system.details.ancestry?.name || game.i18n.localize("ANCESTRY.None"),
      backgroundName: s.system.details.background?.name || game.i18n.localize("BACKGROUND.None"),
      talentTreeButtonText: game.system.tree.actor === a ? "Close Talent Tree" : "Open Talent Tree"
    });

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
    return context;
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
  async _onClickAction(event, target) {
    event.preventDefault();
    event.stopPropagation();
    switch ( target.dataset.action ) {
      // case "abilityDecrease":
      //   return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, -1);
      // case "abilityIncrease":
      //   return this.actor.purchaseAbility(a.closest(".ability").dataset.ability, 1);
      // case "clearAncestry":
      //   return this.actor.system.applyAncestry(null);
      // case "clearBackground":
      //   return this.actor.system.applyBackground(null);
      // case "levelUp":
      //   game.tooltip.deactivate();
      //   return this.actor.levelUp(1);
      case "skillConfig":
        const skillConfig = new SkillConfig({document: this.actor, skillId: target.closest(".skill").dataset.skill})
        await skillConfig.render({force: true});
        break;
      case "skillDecrease":
        return this.actor.purchaseSkill(target.closest(".skill").dataset.skill, -1);
      case "skillIncrease":
        return this.actor.purchaseSkill(target.closest(".skill").dataset.skill, 1);
      case "skillRoll":
        return this.actor.rollSkill(target.closest(".skill").dataset.skill, {dialog: true});
      case "talentTree":
        return this.actor.toggleTalentTree();
      // case "talentReset":
      //   return this.actor.resetTalents();
      // case "viewAncestry":
      //   return this.actor._viewDetailItem("ancestry", {editable: false});
      // case "viewBackground":
      //   return this.actor._viewDetailItem("background", {editable: false});
    }
  }

  /* -------------------------------------------- */

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
