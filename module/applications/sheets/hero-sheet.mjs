import CrucibleBaseActorSheet from "./base-actor-sheet.mjs";

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
    const {isL0} = a;
    const points = context.points = a.system.points;
    Object.assign(i, {isL0});

    // Expand Context
    Object.assign(context, {
      ancestryName: s.system.details.ancestry?.name || game.i18n.localize("ANCESTRY.SHEET.CHOOSE"),
      backgroundName: s.system.details.background?.name || game.i18n.localize("BACKGROUND.SHEET.CHOOSE"),
      knowledgeOptions: this.#prepareKnowledgeOptions(),
      knowledge: this.#prepareKnowledge(),
      talentTreeButtonText: game.system.tree.actor === a ? "Close Talent Tree" : "Open Talent Tree",
    });

    // Advancement
    const adv = a.system.advancement;
    i.level = isL0 ? !i.progress : (adv.pct === 100);
    context.advancementTooltip = game.i18n.format("ADVANCEMENT.MilestoneTooltip", adv);

    // Progression Issues
    const issues = [];
    if ( !s.system.details.ancestry?.name ) issues.push("Choose an Ancestry");
    if ( !s.system.details.background?.name ) issues.push("Choose a Background");
    if ( points.ability.available < 0 ) issues.push("Too many Ability Points have been spent");
    else if ( points.ability.requireInput ) issues.push("Spend Ability Points");
    if ( points.talent.available < 0 ) issues.push("Too many Talents have been taken");
    else if ( points.talent.available ) issues.push("Spend Talent Points");
    i.progress = !!issues.length;
    if ( i.progress ) {
      const items = issues.reduce((s, text) => s + `<li>${text}</li>`, "");
      i.progressTooltip = `<h4>Progression Requirements</h4><ol>${items}</ol>`;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare options provided to a multi-select element for which knowledge areas the character may know.
   * @returns {FormSelectOption[]}
   */
  #prepareKnowledgeOptions() {
    const options = [];
    for ( const [value, {label, skill}] of Object.entries(crucible.CONFIG.knowledge) ) {
      const s = SYSTEM.SKILLS[skill];
      options.push({value, label, group: s?.label});
    }
    return options;
  }

  /**
   * Prepare the user-friendly list of knowledge areas that the actor has.
   * @returns {string[]}
   */
  #prepareKnowledge() {
    const knowledgeNames = [];
    for ( const knowledgeId of this.actor.system.details.knowledge ) {
      if ( crucible.CONFIG.knowledge[knowledgeId] ) {
        knowledgeNames.push(crucible.CONFIG.knowledge[knowledgeId].label);
      };
    };
    return knowledgeNames;
  };

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
      case "talentTree":
        return this.actor.toggleTalentTree();
      case "talentReset":
        return this.actor.resetTalents();
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
        if ( !crucible.developmentMode ) {
          ui.notifications.error("Talents can only be added to a protagonist Actor via the Talent Tree.");
          return;
        }
    }
    return super._onDropItem(event, item);
  }
}
