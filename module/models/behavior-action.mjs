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
    const frequencyChoices = {
      every: "REGION_BEHAVIORS.ACTION.FREQUENCIES.every",
      round: "REGION_BEHAVIORS.ACTION.FREQUENCIES.round"
    };
    return {
      action: new fields.SchemaField({
        id, name, img, description, effects, tags
      }, {required: true, initial: {id: "action", name: "Action", img: "icons/svg/hazard.svg", effects: [], tags: []}}),
      actor: new fields.DocumentUUIDField({type: "Actor"}),

      // Maintains a record of actors which have been affected by this behavior, and in what context
      affectedActors: new fields.TypedObjectField(new fields.SchemaField({
        combatId: new fields.DocumentIdField({initial: null}),
        combatantId: new fields.DocumentIdField({initial: null}),
        tokenId: new fields.DocumentIdField({initial: null}),
        round: new fields.NumberField({integer: true, nullable: false, initial: -1}),
        turn: new fields.NumberField({integer: true, nullable: false, initial: -1})
      }), {
        expandKeys: false,
        validateKey: uuid => {
          const {id, type} = foundry.utils.parseUuid(uuid);
          return (type === "Actor") && foundry.data.validators.isValidId(id);
        }
      }),
      events: this._createEventsField({events: this.#VALID_EVENTS, initial: ["tokenEnter", "tokenTurnStart"]}),

      // Whether this should apply to a given actor only once per round, on every trigger
      frequency: new fields.StringField({initial: "round", required: true, nullable: false, choices: frequencyChoices}),

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

    // This switch is a bit overkill but if/when additional frequencies are added will make more sense
    switch ( this.frequency ) {

      // If once per round and already done this round, skip. Outside of combat, this means once per actor
      case "round":
        if ( this.affectedActors[actor.uuid]?.round === (game.combat?.round ?? -1) ) return;
        break;
    }

    // Otherwise, perform action
    const action = new crucible.api.models.CrucibleAction(this.action, {
      actor: sourceActor,
      usage: {forcedTargets: [actor]}
    });
    await action.use({dialog: false});

    // If non-"every" frequency, track that actor has been affected
    if ( this.frequency !== "every" ) {
      await this.parent.update({"system.affectedActors": {[actor.uuid]: {
        combatId: game.combat?.id ?? null,
        combatantId: token.combatant,
        tokenId: token.id,
        round: game.combat?.round ?? -1,
        turn: game.combat?.turn ?? -1
      }}});

      // If in combat, record this behavior to the current Combat so that affectedActors is cleared on combat deletion
      if ( game.combat ) {
        const combatBehaviors = game.combat.getFlag("crucible", "trackedActionBehaviors") ?? [];
        if ( combatBehaviors.includes(this.parent.uuid) ) return;
        combatBehaviors.push(this.parent.uuid);
        await game.combat.setFlag("crucible", "trackedActionBehaviors", this.parent.uuid);
      }
    }
  }
}
