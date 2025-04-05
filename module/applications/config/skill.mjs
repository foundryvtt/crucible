const {api} = foundry.applications;

/**
 * A configuration application used to advance skill ranks and choose skill specialization for a CrucibleActor.
 * @extends {DocumentSheetV2}
 * @mixes {HandlebarsApplication}
 */
export default class SkillConfig extends api.HandlebarsApplicationMixin(api.DocumentSheetV2) {
  constructor({skillId, ...options}={}) {
    super(options);
    this.skillId = skillId;
    this.config = foundry.utils.deepClone(SYSTEM.SKILLS[skillId]);
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "skill", "standard-form"],
    tag: "form",
    position: {width: 600, height: "auto"},
    actions: {
      choosePath: this.#onChoosePath,
      rules: this.#onRules,
      decrease: this.#onDecrease,
      increase: this.#onIncrease,
    },
    sheetConfig: false,
    form: {
      submitOnChange: true
    },
  };

  /** @override */
  static PARTS = {
    skill: {
      root: true,
      template: "systems/crucible/templates/sheets/actor/skill.hbs",
      scrollable: [".sheet-body"]
    }
  };

  /* -------------------------------------------- */

  /**
   * A convenience reference to the Actor Document.
   * @returns {CrucibleActor}
   */
  get actor() {
    return this.document;
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return game.i18n.format("SKILL.SheetTitle", {actor: this.document.name, skill: this.config.name});
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const skill = this.actor.skills[this.skillId];
    const context = {
      skill,
      config: this.config,
      path: skill.path ? this.config.paths[skill.path] : null,
      choosePath: skill.rank === 3,
      showPaths: !skill.path && skill.rank < 3,
      displayPath: skill.path && (skill.rank > 3),
      trainedRanks: [],
      untrainedRanks: []
    };

    // Specialization Choice
    for ( const path of Object.values(this.config.paths) ) {
      path.actionIcon = skill.path === path.id ? "fa-regular fa-circle-check" : "fa-regular fa-circle";
      path.actionTooltip = skill.path === path.id ? "Clear Specialization" : "Choose Specialization";
    }

    // Categorize skill ranks as trained or untrained
    for ( const rank of Object.values(SYSTEM.SKILL.RANKS) ) {
      const r = foundry.utils.deepClone(rank);
      r.label = `${r.label} ${this.config.name}`;
      r.description = this.config.ranks[r.id].description;
      if ( skill.rank >= r.rank ) {
        if ( !skill.rank || r.rank ) context.trainedRanks[r.rank] = r; // No longer show untrained once trained
      }
      else context.untrainedRanks[r.rank] = r;
    }
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * @this {SkillConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onChoosePath(event) {
    const pathId = event.target.dataset.path;
    const skill = this.actor.skills[this.skillId];
    const path = skill.path === pathId ? null : pathId;
    await this.actor.update({[`system.skills.${this.skillId}.path`]: path});
  }

  /* -------------------------------------------- */

  /**
   * @this {SkillConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onRules(event) {
    const rulesPage = await fromUuid(this.config.page);
    rulesPage.parent.sheet.render(true, {pageId: rulesPage.id}); // TODO move to app v2
  }

  /* -------------------------------------------- */

  /**
   * @this {SkillConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static #onDecrease(event) {
    // this.actor.purchaseSkill(this.skillId, -1); TODO delete
  }

  /* -------------------------------------------- */

  /**
   * @this {SkillConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static #onIncrease(event) {
    // this.actor.purchaseSkill(this.skillId, 1); TODO delete
  }
}
