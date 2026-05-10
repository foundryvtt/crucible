export default class CruciblePersistentAOERegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["REGION_BEHAVIORS.PERSISTENT_AOE"];

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const {id, name, img, description, effects, tags} = crucible.api.models.CrucibleAction.defineSchema();
    return {
      actionIdentifier: new fields.StringField({initial: null, required: true, nullable: true}),
      actionToPerform: new fields.SchemaField({
        id, name, img, description, effects, tags
      }, {required: true, initial: {id: "action", name: "Action", img: "icons/svg/hazard.svg", effects: [], tags: []}}),
      actor: new fields.DocumentUUIDField({type: "Actor"}),
      affectedActors: new fields.TypedObjectField(new fields.NumberField({integer: true, nullable: false}), {
        expandKeys: false,
        validateKey: uuid => {
          const {id, type} = foundry.utils.parseUuid(uuid);
          if ( (type !== "Actor") || !foundry.data.validators.isValidId(id) ) return false;
        }
      }),
      events: this._createEventsField({initial: ["tokenEnter", "tokenTurnStart"]}),
      oncePerRound: new fields.BooleanField({initial: true, required: true, nullable: false})
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleRegionEvent(event) {
    const sourceActor = await fromUuid(this.actor);
    if ( !event.user.isActiveGM || !sourceActor || !this.actionToPerform ) return;
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
    if ( this.oncePerRound && game.combat && (this.affectedActors[actor.uuid] === game.combat.round) ) return;

    const action = new crucible.api.models.CrucibleAction(this.actionToPerform, {
      actor: sourceActor,
      usage: {forcedTargets: [actor]}
    });
    action.use({dialog: false});

    // TODO: Why isn't this update going through?
    if ( this.oncePerRound && game.combat ) {
      await this.parent.update({"system.affectedActors": {[actor.uuid]: game.combat.round}});
    }
  }
}
