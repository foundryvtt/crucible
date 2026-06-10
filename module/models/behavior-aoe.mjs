export default class CruciblePersistentAOERegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["REGION_BEHAVIORS.PERSISTENT_AOE"];

  // Track affected actors changes accumulated during a multi-event trigger
  // TODO: Once minimum core version is 14.364, remove this
  #dirtyAffectedActors = [];

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const {TOKEN_ENTER, TOKEN_EXIT, TOKEN_MOVE_IN, TOKEN_MOVE_OUT, TOKEN_MOVE_WITHIN,
      TOKEN_TURN_START, TOKEN_TURN_END, TOKEN_ROUND_START, TOKEN_ROUND_END} = CONST.REGION_EVENTS;
    const validEvents = [TOKEN_ENTER, TOKEN_EXIT, TOKEN_MOVE_IN, TOKEN_MOVE_OUT, TOKEN_MOVE_WITHIN,
      TOKEN_TURN_START, TOKEN_TURN_END, TOKEN_ROUND_START, TOKEN_ROUND_END];
    const {id, name, img, description, effects, tags} = crucible.api.models.CrucibleAction.defineSchema();
    return {
      actionIdentifier: new fields.StringField({initial: null, required: true, nullable: true}),
      actionToPerform: new fields.SchemaField({
        id, name, img, description, effects, tags
      }, {required: true, initial: {id: "action", name: "Action", img: "icons/svg/hazard.svg", effects: [], tags: []}}),
      actor: new fields.DocumentUUIDField({type: "Actor"}),
      // TODO: Once minimum core version is 14.364, replace schema with commented version
      affectedActors: new fields.ArrayField(new fields.SchemaField({
        actor: new fields.StringField({required: true, nullable: false, blank: false}),
        round: new fields.NumberField({integer: true, required: true, nullable: false})
      })),
      // affectedActors: new fields.TypedObjectField(new fields.NumberField({integer: true, nullable: false}), {
      //   expandKeys: false,
      //   validateKey: uuid => {
      //     const {id, type} = foundry.utils.parseUuid(uuid);
      //     if ( (type !== "Actor") || !foundry.data.validators.isValidId(id) ) return false;
      //   }
      // }),
      events: this._createEventsField({events: validEvents, initial: ["tokenEnter", "tokenTurnStart"]}),
      oncePerRound: new fields.BooleanField({initial: true, required: true, nullable: false})
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleRegionEvent(event) {
    const sourceActor = await fromUuid(this.actor);
    if ( !game.user.isActiveGM || !sourceActor || !this.actionToPerform ) return;
    const {token} = event.data;
    const actor = token.actor;

    // Skip invalid targets
    const actionContext = {actor: sourceActor, region: this.parent.parent};
    if ( this.actionIdentifier?.length ) {
      const originAction = this.actionIdentifier.startsWith("spell.")
        ? crucible.api.models.CrucibleSpellAction.fromId(this.actionIdentifier, actionContext)
        : sourceActor.actions[this.actionIdentifier]?.clone({}, actionContext);
      const validTargets = new Set(originAction?.acquireTargets().keys() ?? []);
      if ( !validTargets.has(actor) ) return;
    }

    // If once per round and already done this round, skip
    // TODO: Once minimum core version is 14.364, replace next line with commented line
    if ( this.oncePerRound && game.combat && (this.affectedActors.find(a => a.actor === actor.uuid)?.round === game.combat.round) ) return;
    // if ( this.oncePerRound && game.combat && (this.affectedActors[actor.uuid] === game.combat.round) ) return;

    const action = new crucible.api.models.CrucibleAction(this.actionToPerform, {
      actor: sourceActor,
      usage: {forcedTargets: [actor]}
    });
    action.use({dialog: false});

    if ( this.oncePerRound && game.combat ) {
      // TODO: Once minimum core version is 14.364, replace next 2 lines with commented line
      this.#dirtyAffectedActors.push({actor: actor.uuid, round: game.combat.round});
      this.#debounceUpdateAffectedActors();
      // await this.parent.update({"system.affectedActors": {[actor.uuid]: game.combat.round}});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update affected actors with multiple near-simultaneous event triggers
   */
  // TODO: Once minimum core version is 14.364, remove this
  #debounceUpdateAffectedActors = foundry.utils.debounce(() => {
    const newAffected = this.affectedActors.filter(a => ![this.#dirtyAffectedActors.some(({actor}) => actor === a.actor)]);
    newAffected.push(...this.#dirtyAffectedActors);
    this.parent.update({"system.affectedActors": newAffected});
  }, 20);
}
