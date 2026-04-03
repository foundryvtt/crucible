const {api} = foundry.applications;

/**
 * Open the group check quick selection window.
 * @param {KeyboardEventContext} _context    The context data of the event
 * @returns {Promise<Application|void>}
 */
export function openGroupCheckQuickSelection(_context) {
  return new GroupCheckQuickSelection().render(true);
}

/**
 * A quick launcher for opening prefilled group skill check dialogs.
 */
export default class GroupCheckQuickSelection extends api.HandlebarsApplicationMixin(api.ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "themed", "theme-dark", "dice-roll"],
    window: {
      contentClasses: ["standard-check", "standard-form"],
      resizable: true,
      title: "DICE.GROUP_CHECK.QuickSelection"
    },
    position: {
      width: 400
    },
    actions: {
      selectSkill: GroupCheckQuickSelection.#onSelectSkill
    }
  };

  /** @override */
  static PARTS = {
    main: {
      template: "systems/crucible/templates/tools/group-check/quick-selection.hbs"
    }
  };

  /**
   * The party actors prefilled into the request dialog.
   * @type {CrucibleActor[]}
   */
  #partyActors = [];

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.#partyActors = Array.from(crucible.party?.system.actors ?? []).filter(Boolean);
    Object.assign(context, {
      partyActors: this.#partyActors,
      skillCategories: this.#prepareSkills()
    });
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Organize skills by category in alphabetical order.
   * @returns {Record<string, object>}
   */
  #prepareSkills() {
    const categories = foundry.utils.deepClone(SYSTEM.SKILL.CATEGORIES);
    for ( const skill of Object.values(SYSTEM.SKILLS) ) {
      const category = categories[skill.category];
      category.skills ||= {};
      category.skills[skill.id] = skill;
    }
    return categories;
  }

  /* -------------------------------------------- */

  /**
   * Open a prefilled group check dialog for the selected skill.
   * @this {GroupCheckQuickSelection}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onSelectSkill(_event, target) {
    if ( !game.user.isGM ) {
      ui.notifications.warn("DICE.GROUP_CHECK.RequiresGM", {localize: true});
      return;
    }

    const skillId = target.dataset.skillId;
    const roll = new crucible.api.dice.StandardCheck({type: skillId});
    roll.dialog({request: true, requestedActors: this.#partyActors});
    await this.close();
  }
}
