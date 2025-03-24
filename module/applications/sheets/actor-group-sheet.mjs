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
      memberRemove: CrucibleGroupActorSheet.#onMemberRemove,
      memberSheet: CrucibleGroupActorSheet.#onMemberSheet
    },
    form: {
      submitOnChange: true
    },
  };

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/group/header.hbs"
    },
    members:{
      id: "actions",
      template: "systems/crucible/templates/sheets/group/members.hbs"
    },
  };

  /* -------------------------------------------- */
  /*  Sheet Rendering                             */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const system = this.actor.system;
    return {
      actor: this.document,
      system,
      isEditable: this.isEditable,
      fields: this.actor.schema.fields,
      members: this.#prepareMembers(),
      systemFields: system.schema.fields,
      tags: this.actor.getTags(),
      pace: SYSTEM.ACTOR.TRAVEL_PACES[system.movement.pace]
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
      const {health, morale} = member.actor.system.resources;
      const hc = SYSTEM.RESOURCES.health.color;
      const mc = SYSTEM.RESOURCES.morale.color;
      members.push({
        actor: member.actor,
        quantity: member.quantity,
        hasQuantity: member.quantity > 1,
        tags: member.actor.getTags(),
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
    return members;
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @override */
  async _onDropActor(event, actor) {
    if ( actor.pack ) throw new Error("Only world Actors can belong to a group.");
    const actorIds = actor.type === "group" ? actor.system._source.members.map(m => m.actorId) : [actor.id];
    const members = this.actor.system.toObject().members;
    const memberIds = new Set(members.map(m => m.actor));
    for ( const actorId of actorIds ) {
      if ( !memberIds.has(actorId) ) members.push({actorId, quantity: 1});
    }
    await this.actor.update({"system.members": members});
  }

  /* -------------------------------------------- */
  /*  Click Action Handlers                       */
  /* -------------------------------------------- */

  /**
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onMemberRemove(event, target) {
    const li = target.closest("li.member");
    const actorId = li.dataset.actorId;
    const members = this.actor.system.toObject().members;
    members.findSplice(m => m.actorId === actorId);
    await this.actor.update({"system.members": members});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleGroupActorSheet}
   * @type {ApplicationClickAction}
   */
  static async #onMemberSheet(event, target) {
    const li = target.closest("li.member");
    const actorId = li.dataset.actorId;
    const actor = game.actors.get(actorId);
    actor?.sheet?.render({force: true});
  }
}
