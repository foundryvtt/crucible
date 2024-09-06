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
    this.config = SYSTEM.SKILLS[skillId];
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "skill", "standard-form"],
    tag: "form",
    position: {width: 600, height: "auto"},
    actions: {},
    sheetConfig: false,
    form: {
      submitOnChange: true
    }
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

  /** @override */
  _processFormData(event, form, formData) {
    debugger;
    // Object.assign(formData, {
    //   [`system.skills.${this.skillId}.path`]: this.form.path.value
    // });
    return formData;
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleAction(action, event, button) {
    switch ( action ) {
      case "increase":
        return this.actor.purchaseSkill(this.skillId, 1);
      case "decrease":
        return this.actor.purchaseSkill(this.skillId, -1);
      case "rules":
        const rulesPage = await fromUuid(this.config.page)
        return rulesPage.parent.sheet.render(true, {pageId: rulesPage.id});
    }
  }
}
