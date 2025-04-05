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
    },
    actions: {
      editAncestry: HeroSheet.#onEditAncestry,
      editBackground: HeroSheet.#onEditBackground,
      levelUp: HeroSheet.#onLevelUp
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
      ancestryName: s.system.details.ancestry?.name || game.i18n.localize("ANCESTRY.SHEET.CHOOSE"),
      backgroundName: s.system.details.background?.name || game.i18n.localize("BACKGROUND.SHEET.CHOOSE"),
      talentTreeButtonText: game.system.tree.actor === a ? "Close Talent Tree" : "Open Talent Tree"
    });

    // Incomplete Tasks
    const {isL0} = a;
    context.points = a.system.points;
    Object.assign(i, {
      ancestry: !s.system.details.ancestry?.name,
      background: !s.system.details.background?.name,
      abilities: context.points.ability.requireInput,
      talents: context.points.talent.available,
      isL0: isL0
    });
    i.creation = i.ancestry || i.background || i.abilities || i.talents;
    i.level = isL0 ? !i.creation : (a.system.advancement.pct === 100);
    if ( i.creation ) {
      i.creationTooltip = "<p>Character Creation Incomplete!</p><ol>";
      if ( i.ancestry ) i.creationTooltip += "<li>Select Ancestry</li>";
      if ( i.background ) i.creationTooltip += "<li>Select Background</li>";
      if ( i.abilities ) i.creationTooltip += "<li>Spend Ability Points</li>";
      if ( i.talents ) i.creationTooltip += "<li>Spend Talent Points</li>";
      i.creationTooltip += "</ol>";
    }
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
      case "abilityDecrease":
        return this.actor.purchaseAbility(target.closest(".ability").dataset.ability, -1);
      case "abilityIncrease":
        return this.actor.purchaseAbility(target.closest(".ability").dataset.ability, 1);
      case "skillConfig":
        const skillConfig = new SkillConfig({document: this.actor, skillId: target.closest(".skill").dataset.skill})
        await skillConfig.render({force: true});
        break;
      case "skillRoll":
        return this.actor.rollSkill(target.closest(".skill").dataset.skill, {dialog: true});
      case "talentTree":
        return this.actor.toggleTalentTree();
      // case "talentReset":
      //   return this.actor.resetTalents();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle click action to level up.
   * @this {HeroSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onLevelUp(event) {
    game.tooltip.deactivate();
    await this.actor.levelUp(1);
  }

  /* -------------------------------------------- */

  /**
   * Handle click action to choose or edit your Ancestry.
   * @this {HeroSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEditAncestry(event) {
    await this.actor._viewDetailItem("ancestry", {editable: false});
  }

  /* -------------------------------------------- */

  /**
   * Handle click action to choose or edit your Background.
   * @this {HeroSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEditBackground(event) {
    await this.actor._viewDetailItem("background", {editable: false});
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return;
    switch (item.type) {
      case "ancestry":
        await this.actor.system.applyAncestry(item);
        return;
      case "background":
        await this.actor.system.applyBackground(item);
        return;
      case "spell":
        try {
          this.actor.canLearnIconicSpell(item);
        } catch(err) {
          ui.notifications.warn(err.message);
          return;
        }
        break;
      case "talent":
        ui.notifications.error("Talents can only be added to a protagonist Actor via the Talent Tree.");
        return;
    }
    return super._onDropItem(event, item);
  }
}
