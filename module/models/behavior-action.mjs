export default class CrucibleActionRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["REGION_BEHAVIORS.ACTION"];

  /**
   * Valid subset of triggering events
   * @type {string[]}
   */
  static #VALID_EVENTS = [
    CONST.REGION_EVENTS.TOKEN_ENTER,
    CONST.REGION_EVENTS.TOKEN_EXIT,
    CONST.REGION_EVENTS.TOKEN_MOVE_IN,
    CONST.REGION_EVENTS.TOKEN_MOVE_OUT,
    CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN,
    CONST.REGION_EVENTS.TOKEN_TURN_START,
    CONST.REGION_EVENTS.TOKEN_TURN_END,
    CONST.REGION_EVENTS.TOKEN_ROUND_START,
    CONST.REGION_EVENTS.TOKEN_ROUND_END
  ];

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const {id, name, img, description, effects, tags} = crucible.api.models.CrucibleAction.defineSchema();
    return {
      action: new fields.SchemaField({
        id, name, img, description, effects, tags
      }, {required: true, initial: {id: "action", name: "Action", img: "icons/svg/hazard.svg", effects: [], tags: []}}),
      actor: new fields.DocumentUUIDField({type: "Actor"}),

      // Maintains a record of actors which have been affected by this behavior, and in which round they were affected
      affectedActors: new fields.TypedObjectField(new fields.NumberField({integer: true, nullable: false}), {
        expandKeys: false,
        validateKey: uuid => {
          const {id, type} = foundry.utils.parseUuid(uuid);
          if ( (type !== "Actor") || !foundry.data.validators.isValidId(id) ) return false;
        }
      }),
      events: this._createEventsField({events: this.#VALID_EVENTS, initial: ["tokenEnter", "tokenTurnStart"]}),

      // Whether this should apply to a given actor only once per round, or any number of times
      oncePerRound: new fields.BooleanField({initial: true, required: true, nullable: false}),

      // The effect tracking the existence of the parent region (or null, if not action-created)
      origin: new fields.DocumentUUIDField({type: "ActiveEffect", initial: null, required: true, nullable: true})
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleRegionEvent(event) {
    const sourceActor = await fromUuid(this.actor);
    if ( !game.user.isActiveGM || !sourceActor || !this.action ) return;
    const {token} = event.data;
    const actor = token.actor;

    // Skip invalid targets
    const actionContext = {actor: sourceActor, region: this.parent.parent};
    const originEffect = await fromUuid(this.origin);
    if ( originEffect ) {
      const originAction = originEffect?.system.getOriginAction({actionContext});
      const validTargets = new Set(originAction?.acquireTargets().keys() ?? []);
      if ( !validTargets.has(actor) ) return;
    }

    // If once per round and already done this round, skip
    if ( this.oncePerRound && game.combat && (this.affectedActors[actor.uuid] === game.combat.round) ) return;

    // Perform action
    const action = new crucible.api.models.CrucibleAction(this.action, {
      actor: sourceActor,
      usage: {forcedTargets: [actor]}
    });
    action.use({dialog: false});

    // If once per round, track that targeted actor has been affected this round
    if ( this.oncePerRound && game.combat ) {
      await this.parent.update({"system.affectedActors": {[actor.uuid]: game.combat.round}});
    }
  }
}
