import CrucibleSheetMixin from "../sheets/crucible-sheet.mjs";

/**
 * A configuration application used to advance skill ranks and choose skill specialization for a CrucibleActor.
 * @mixes CrucibleSheet
 */
export default class SkillConfig extends CrucibleSheetMixin(FormApplication) {
  constructor(actor, skillId, options) {
    super(actor, options);
    this.actor = actor;
    this.skillId = skillId;
    this.config = SYSTEM.SKILLS[skillId];
    this.actor.apps[this.appId] = this;
  }

  /* -------------------------------------------- */

  /** @override */
  static documentType = "skill";

  /* -------------------------------------------- */

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 660,
      template: `systems/${SYSTEM.id}/templates/config/skill.hbs`,
      resizable: true,
      scrollY: [".scrollable"],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return game.i18n.format("SKILL.SheetTitle", {actor: this.object.name, skill: this.config.name});
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
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

    // TODO add specialization paths
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData={}) {
    return Object.assign(updateData || {}, {
      [`system.skills.${this.skillId}.path`]: this.form.path.value
    })
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    return this.actor.update(formData);
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
