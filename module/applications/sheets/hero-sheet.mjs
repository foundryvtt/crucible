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
      levelUp: HeroSheet.#onLevelUp,
      proficiencyDecrease: HeroSheet.#onChangeProficiency,
      proficiencyIncrease: HeroSheet.#onChangeProficiency
    }
  };

  static {
    this._initializeActorSheetClass();

    // Proficiency is a Hero-only advancement track, so its tab is not shared with other Actor types
    this.PARTS.proficiency = {
      id: "proficiency",
      template: "systems/crucible/templates/sheets/actor/proficiency.hbs",
      scrollable: [""] // The tab section is itself the scroller, so its position survives re-render
    };
    const tabs = this.TABS.sheet.tabs;
    tabs.splice(tabs.findIndex(t => t.id === "skills") + 1, 0,
      {id: "proficiency", icon: "systems/crucible/ui/tabs/skills.webp"});

    // FIXME Remove once Ember is updated to 0.6.0 requiring Crucible 0.10.1+ to account for TABS change
    Object.assign(this.TABS.sheet, {
      findIndex(...args) {
        return HeroSheet.TABS.sheet.tabs.findIndex(...args);
      },
      splice(...args) {
        return HeroSheet.TABS.sheet.tabs.splice(...args);
      }
    });
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
      ancestryName: s.system.details.ancestry?.name || _loc("ANCESTRY.SHEET.Choose"),
      backgroundName: s.system.details.background?.name || _loc("BACKGROUND.SHEET.Choose"),
      capacity: a.system.capacity,
      proficiency: this.#prepareProficiency(context.skillCategories),
      talentTreeButtonText: _loc(`ACTOR.ACTIONS.TalentTree${game.system.tree.actor === a ? "Close" : "Open"}`)
    });

    // Advancement
    const adv = a.system.advancement;
    i.level = isL0 ? !i.progress : (adv.pct === 100);
    context.advancementTooltip = _loc("ADVANCEMENT.MilestoneTooltip", adv);

    // Progression Issues
    const issues = [];
    if ( !s.system.details.ancestry?.name ) issues.push("ACTOR.WARNINGS.NoAncestry");
    if ( !s.system.details.background?.name ) issues.push("ACTOR.WARNINGS.NoBackground");
    if ( !isL0 ) {
      if ( points.ability.available < 0 ) issues.push("ACTOR.WARNINGS.OverspentAbility");
      else if ( points.ability.requireInput ) issues.push("ACTOR.WARNINGS.UnderspentAbility");
      if ( points.talent.available < 0 ) issues.push("ACTOR.WARNINGS.OverspentTalent");
      else if ( points.talent.available ) issues.push("ACTOR.WARNINGS.UnderspentTalent");
    }
    i.progress = !!issues.length;
    if ( i.progress ) {
      const items = issues.reduce((s, text) => `${s}<li>${_loc(text)}</li>`, "");
      i.progressTooltip = `<h4>${_loc("ACTOR.ProgressionRequirements")}</h4><ol>${items}</ol>`;
    }

    // Allow extension of sheet context
    Hooks.callAll("crucible.prepareHeroSheetContext", this, context, options);
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
      case "talentTree":
        return this.actor.toggleTalentTree();
      case "talentReset":
        return this.actor.resetTalents();
      case "proficiencyReset":
        return this.actor.resetTraining();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare training data for the Proficiency tab, grouped by the kind of training.
   * @param {Record<string, object>} skillCategories   Enriched skill categories from the base sheet context.
   * @returns {{sections: object[], ticks: object[], available: number, spent: number}}
   */
  #prepareProficiency(skillCategories) {
    const {RANKS, RANK_VALUES, POINTS_MAX, GROUPS} = SYSTEM.TRAINING;
    const actor = this.actor;
    const {training, points, details} = actor.system;
    const pct = n => `${(Math.clamp(n / POINTS_MAX, 0, 1) * 100).toFixed(2)}%`;

    // Every bar spans the full point range, marked with the rank thresholds
    const cap = details.progression.trainingCap;
    const ticks = Object.values(RANKS).filter(r => (r.required > 0) && (r.required < POINTS_MAX))
      .map(r => ({left: pct(r.required), label: `${r.label} (${r.required})`}));
    const capLabel = _loc("TRAINING.CapTooltip", {points: cap});
    const signed = n => `${n < 0 ? "-" : "+"} ${Math.abs(n)}`; // Pretty formatting for signed addition

    /**
     * Account for where a training's points came from and what the next rank would cost.
     * Contributing sources appear only when they contribute, so the rows always sum to the total.
     * @param {object} t   The prepared training data for one type.
     * @returns {string}   An HTML table for use as tooltip content.
     */
    const pointsBreakdown = t => {
      const rows = [];
      const row = (key, value, {cssClass="", ...data}={}) => rows.push(
        `<div class="counter ${cssClass}"><label>${_loc(`TRAINING.BREAKDOWN.${key}`, data)}</label>`
        + `<span class="value">${value}</span></div>`);
      if ( t.initial ) row("Granted", t.initial);
      if ( t.talents ) row("Talents", t.talents);
      row("Increases", t.increases); // Always stated, since this is the row the player spends into
      if ( t.bonus ) row("Bonus", signed(t.bonus));
      if ( (cap < POINTS_MAX) && (t.points === cap) ) row("Cap", cap);

      // Increases alone are their own total, so only sum when something else contributes
      if ( t.initial || t.talents || t.bonus ) row("Total", t.points, {cssClass: "total"});
      const next = Object.values(RANKS).find(r => r.required > t.points); // Ascending by points required
      if ( next ) row("Next", next.required, {rank: _loc(next.label)});
      return `<div class="training-breakdown flexcol">${rows.join("")}</div>`;
    };

    // Common to every training type, whether or not it is also a Skill
    const prepareType = (config, color) => {
      const t = training[config.id];
      const abilities = SYSTEM.TRAINING.TYPES[config.id].abilities ?? [];
      const rank = RANK_VALUES[t.value];
      return {
        ...config, color, rank, score: t.score, passive: t.passive, points: t.points,
        widthPct: pct(t.points),
        abilityAbbrs: abilities.map(a => SYSTEM.ABILITIES[a].abbreviation),
        // A pair names both sextants it spans; a single ability names its own
        hexClass: abilities.toSorted().join("-"),
        tooltips: {
          value: _loc("TRAINING.TooltipCheck", {
            abilities: abilities.map(a => `${actor.system.abilities[a].value} ${SYSTEM.ABILITIES[a].abbreviation}`)
              .join(" + "),
            divisor: abilities.length * 2,
            rank: rank.label, skill: signed(t.skillBonus), enchantment: signed(t.enchantmentBonus)
          }),
          passive: _loc("TRAINING.TooltipPassive", {score: t.score}),
          points: pointsBreakdown(t)
        },
        // The cap only earns a marker where it is actually binding on this training
        capTick: (cap < POINTS_MAX) && (t.points === cap) ? {left: pct(cap), label: capLabel} : null,
        canIncrease: actor.canPurchaseTraining(config.id, 1),
        canDecrease: actor.canPurchaseTraining(config.id, -1)
      };
    };

    // Skills additionally offer their roll action from the title
    const sections = Object.values(skillCategories).map(category => ({
      label: _loc("SKILL.CategoryHeader", {category: category.label}),
      color: category.color.css,
      types: Object.values(category.skills).map(s => ({...prepareType(s, category.color.css), rollable: true}))
    }));
    for ( const [group, record] of [["weapon", SYSTEM.WEAPON.TRAINING], ["spell", SYSTEM.SPELL.TRAINING],
      ["craft", SYSTEM.CRAFTING.TRAINING]] ) {
      const {label, color} = GROUPS[group];
      sections.push({label, color, types: Object.values(record).map(c => prepareType(c, color))});
    }
    return {sections, ticks, available: points.proficiency.available, spent: points.proficiency.spent};
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
   * Handle click actions to allocate or reclaim a training point.
   * @this {HeroSheet}
   * @param {PointerEvent} event
   * @param {HTMLButtonElement} target
   * @returns {Promise<void>}
   */
  static async #onChangeProficiency(event, target) {
    const {training} = target.closest(".line-item.training").dataset;
    const delta = target.dataset.action === "proficiencyIncrease" ? 1 : -1;
    await this.actor.purchaseTraining(training, delta);
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
          ui.notifications.error(_loc("ACTOR.WARNINGS.NoDragTalent"));
          return;
        }
    }
    return super._onDropItem(event, item);
  }
}
