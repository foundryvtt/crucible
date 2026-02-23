const {api, sheets} = foundry.applications;

/**
 * A base ActorSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleGroupActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "actor", "actor-group", "themed", "theme-dark"],
    position: {
      width: 720,
      height: 600
    },
    window: {
      contentClasses: ["standard-form"]
    },
    actions: {
      awardMilestone: {handler: CrucibleGroupActorSheet.#onAwardMilestone, buttons: [0, 2]},
      memberRemove: CrucibleGroupActorSheet.#onMemberRemove,
      memberSheet: CrucibleGroupActorSheet.#onMemberSheet,
      cyclePace: CrucibleGroupActorSheet.#onCyclePace,
      recover: CrucibleGroupActorSheet.#onRecover,
      rest: CrucibleGroupActorSheet.#onRest
    },
    form: {
      submitOnChange: true
    }
  };

  /** @override */
  static PARTS = {
    main: {
      root: true,
      template: "systems/crucible/templates/sheets/group/group.hbs",
      scrollable: [".items-list.scrollable"]
    }
  };

  /* -------------------------------------------- */
  /*  Sheet Rendering                             */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    const system = this.actor.system;
    const {expectedLevel} = system.advancement.milestones;
    return {
      actor: this.document,
      system,
      isEditable: this.isEditable,
      fields: this.actor.schema.fields,
      members: this.#prepareMembers(),
      systemFields: system.schema.fields,
      tags: this.actor.getTags(),
      pace: SYSTEM.ACTOR.TRAVEL_PACES[system.movement.pace],
      expectedLevel
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare data about each group member.
   * @returns {object[]}
   */
  #prepareMembers() {
    const members = [];
    for ( const member of this.actor.system.members ) {
      const a = member.actor;
      const m = {
        actorId: member.actorId,
        actor: member.actor,
        name: a?.name ?? "[MISSING]",
        img: a?.img ?? CONST.DEFAULT_TOKEN,
        quantity: member.quantity,
        hasQuantity: member.quantity > 1,
        hasResources: false,
        tags: a?.getTags() || {}
      };
      if ( member.actor ) {
        const {health, morale} = member.actor.system.resources;
        const hc = SYSTEM.RESOURCES.health.color;
        const mc = SYSTEM.RESOURCES.morale.color;
        Object.assign(m, {
          hasResources: true,
          health: {
            value: health.value,
            max: health.max,
            color: hc.low.mix(hc.high, health.value / health.max),
            cssPct: `${Math.round(health.value * 100 / health.max)}%`
          },
          morale: {
            value: morale.value,
            max: morale.max,
            color: mc.low.mix(mc.high, health.value / health.max),
            cssPct: `${Math.round(morale.value * 100 / morale.max)}%`
          }
        });
      }
      members.push(m);
    }
    return members;
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @override */
  async _onDropActor(event, actor) {
    await this.actor.system.addMember(actor);
  }

  /* -------------------------------------------- */
  /*  Click Action Handlers                       */
  /* -------------------------------------------- */

  /**
   * Award or revoke a milestone from the group actor.
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onAwardMilestone(event, _target) {
    if ( !game.user.isGM ) return;
    if ( event.button === 0 ) await this.actor.system.awardMilestoneDialog();
    else if ( event.button === 2 ) await this.actor.system.revokeMilestoneDialog();
  }

  /* -------------------------------------------- */

  /**
   * Remove a member actor from the group.
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onMemberRemove(event, target) {
    const li = target.closest("li.member");
    const actorId = li.dataset.actorId;
    await this.actor.system.removeMember(actorId);
  }

  /* -------------------------------------------- */

  /**
   * Open the sheet for a group member actor.
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onMemberSheet(event, target) {
    const li = target.closest("li.member");
    const actorId = li.dataset.actorId;
    const actor = game.actors.get(actorId);
    actor?.sheet?.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Cycle the travel pace of the group to the next available pace.
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onCyclePace(_event, _target) {
    const paces = SYSTEM.ACTOR.TRAVEL_PACES;
    const current = paces[this.actor.system.movement.pace];
    const next = Object.values(paces).find(p => p.order === current.order + 1) || paces.hidden;
    await this.actor.update({"system.movement.pace": next.id});
  }

  /* -------------------------------------------- */

  /**
   * Trigger a short recovery for all members of the group.
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRecover(_event, _target) {
    await this.document.system.recover();
  }

  /* -------------------------------------------- */

  /**
   * Trigger a full rest for all members of the group.
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRest(_event, _target) {
    await this.document.system.rest();
  }
}
