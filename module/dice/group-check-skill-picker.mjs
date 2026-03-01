const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * A dialog for the GM to select a skill and DC for a group check.
 * Displays skills grouped by category matching the actor sheet layout.
 * Each skill row shows party members with proficiency pips; actors are toggleable.
 * Clicking a skill immediately initiates the group check request with the selected actors.
 * @extends {ApplicationV2}
 * @mixes {HandlebarsApplicationMixin}
 */
export default class GroupCheckSkillPicker extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "group-check-skill-picker",
    classes: ["crucible", "group-check-skill-picker", "dice-roll", "themed", "theme-dark", "sheet"],
    tag: "form",
    window: {
      title: "DICE.GROUP_CHECK.SkillPickerTitle"
    },
    actions: {
      selectSkill: GroupCheckSkillPicker.#onSelectSkill
    },
    form: {
      closeOnSubmit: false
    }
  };

  /** @override */
  static PARTS = {
    skills: {
      template: "systems/crucible/templates/dice/group-check-skill-picker.hbs"
    }
  };

  /**
   * A Promise resolve callback used by the static pick() method.
   * @type {Function|null}
   */
  #resolve = null;

  /**
   * The party member actors available for selection.
   * @type {CrucibleActor[]}
   */
  #partyActors = [];

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    this.#partyActors = crucible.party?.system.members.map(m => m.actor).filter(a => a) ?? [];
    return {
      categories: this.#prepareSkillGroups()
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare skill data grouped by category for template rendering.
   * Each skill includes party member data with proficiency pips.
   * @returns {Object<string, {label: string, color: string, skills: object[]}>}
   */
  #prepareSkillGroups() {
    const categories = {};
    for ( const [catId, cat] of Object.entries(SYSTEM.SKILL.CATEGORIES) ) {
      categories[catId] = {
        label: game.i18n.localize(cat.label),
        color: cat.color.css,
        skills: []
      };
    }
    for ( const skill of Object.values(SYSTEM.SKILLS) ) {
      const cat = categories[skill.category];
      if ( !cat ) continue;

      // Prepare party member data for this skill
      const members = this.#partyActors.map(actor => {
        const actorSkill = actor.system.skills[skill.id];
        const rank = actorSkill?.rank ?? 0;
        const pips = Array.fromRange(4).map((v, i) => i < rank ? "trained" : "untrained");
        return {
          actorId: actor.id,
          name: actor.name,
          img: actor.img,
          pips
        };
      });

      cat.skills.push({
        id: skill.id,
        label: game.i18n.localize(skill.label),
        icon: skill.icon,
        members
      });
    }
    return categories;
  }

  /* -------------------------------------------- */

  /**
   * Handle clicking a skill name to immediately initiate the group check request.
   * Passes the selected actors through to the request dialog.
   * @this {GroupCheckSkillPicker}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onSelectSkill(event, target) {
    const skillId = target.dataset.skillId;
    const result = {skillId, actors: this.#partyActors};
    this.#resolve?.(result);
    this.#resolve = null;
    await this.close();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async close(options={}) {
    if ( this.#resolve ) {
      this.#resolve(null);
      this.#resolve = null;
    }
    return super.close(options);
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /**
   * Show the skill picker, then open StandardCheckDialog in request mode with selected actors.
   * @returns {Promise<void>}
   */
  static async pick() {
    const picker = new this();
    const result = await new Promise(resolve => {
      picker.#resolve = resolve;
      picker.render({force: true});
    });
    if ( !result ) return;
    const {skillId, actors} = result;
    const check = new crucible.api.dice.StandardCheck({type: skillId});
    await check.dialog({
      title: game.i18n.format("ACTION.RequestRollsSuffix", {
        label: game.i18n.format("ACTION.SkillCheck", {skill: SYSTEM.SKILLS[skillId].label})
      }),
      request: true,
      requestActors: actors
    });
  }
}
