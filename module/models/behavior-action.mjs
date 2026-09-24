/**
 * @import {CrucibleActionData} from "./action.mjs";
 */

/**
 * The circumstances under which this behavior last applied its Action to one Actor.
 * @typedef ActionBehaviorAffectedActor
 * @property {string|null} combatId     The Combat in progress, or null if the Action applied outside of combat
 * @property {string|null} combatantId  The Combatant which triggered the Action
 * @property {string|null} tokenId      The Token which triggered the Action
 * @property {number} round             The Combat round, or -1 if the Action applied outside of combat
 * @property {number} turn              The Combat turn, or -1 if the Action applied outside of combat
 */

/**
 * @typedef CrucibleActionRegionBehaviorData
 * @property {Pick<CrucibleActionData, "id"|"name"|"img"|"description"|"effects"|"tags">} action  The embedded Action
 * @property {string} actor             UUID of the Actor which performs the embedded Action
 * @property {Record<string, ActionBehaviorAffectedActor>} affectedActors  Keyed by the affected Actor's UUID
 * @property {Set<string>} events       Region events which trigger the embedded Action
 * @property {string} frequency         How often the Action may apply to one triggering Actor
 * @property {string|null} origin       UUID of the ActiveEffect which keeps the parent Region alive
 */

/**
 * A Region Behavior which performs an embedded Action against tokens that trigger its configured Region events.
 * @mixes {CrucibleActionRegionBehaviorData}
 */
export default class CrucibleActionRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["REGION_BEHAVIORS.ACTION"];

  /**
   * Valid values for "frequency"
   * @type {Record<string, string>}
   */
  static FREQUENCY_CHOICES = {
    every: "REGION_BEHAVIORS.ACTION.FREQUENCIES.every",
    once: "REGION_BEHAVIORS.ACTION.FREQUENCIES.once",
    roundActor: "REGION_BEHAVIORS.ACTION.FREQUENCIES.roundActor"
    // TODO additional intended frequencies as proposed below:
    // oncePerActor: "Once per Actor",
    // roundOnce: "Once per Round",
    // turnActor: "Once per Turn per Actor",
    // turnOnce: "Once per Turn"
  };

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
    return {
      ...this.defineEmbeddedSchema(),
      actor: new fields.DocumentUUIDField({type: "Actor"}),
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
      item: new fields.DocumentUUIDField({type: "Item"}),
      origin: new fields.DocumentUUIDField({type: "ActiveEffect"})
    };
  }

  /* -------------------------------------------- */

  /**
   * Define the schema shared with the behavior pre-configuration recorded on a {@link CrucibleAction}.
   * @returns {DataSchema}
   */
  static defineEmbeddedSchema() {
    const fields = foundry.data.fields;
    const embeddedAction = Object.assign(crucible.api.models.CrucibleAction.defineBaseSchema(), {
      target: new fields.SchemaField({
        scope: new fields.NumberField({required: true, initial: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES,
          choices: SYSTEM.ACTION.TARGET_SCOPES.choices})
      }),
      spellcraft: new fields.SchemaField({
        rune: new fields.StringField({required: true, blank: true, choices: SYSTEM.SPELL.RUNES}),
        gesture: new fields.StringField({required: true, blank: true, choices: SYSTEM.SPELL.GESTURES}),
        inflection: new fields.StringField({required: true, blank: true, choices: SYSTEM.SPELL.INFLECTIONS})
      }, {nullable: true, initial: null})
    });
    return {
      action: new fields.SchemaField(embeddedAction, {required: true, initial: {
        id: "action",
        name: "Action",
        img: "icons/svg/hazard.svg",
        effects: [],
        tags: [],
        target: embeddedAction.target.getInitialValue(),
        spellcraft: null
      }}),
      events: this._createEventsField(),
      frequency: new fields.StringField({initial: "roundActor", required: true, nullable: false,
        choices: this.FREQUENCY_CHOICES})
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static _createEventsField() {
    return super._createEventsField({events: this.#VALID_EVENTS, initial: ["tokenEnter", "tokenTurnStart"]});
  }

  /* -------------------------------------------- */

  /**
   * Instantiate the embedded Action to be performed against one triggering Actor. Either a {@link CrucibleSpellAction},
   * if the "spell" tag is applied to the action, otherwise a standard {@link CrucibleAction}.
   * @param {object} options
   * @param {CrucibleActor} options.actor     The Actor performing the Action
   * @param {CrucibleActor} options.target    The Actor which triggered this behavior
   * @param {CrucibleItem|null} options.item  The Item, if any, of the action which spawned this behavior's Region
   * @returns {CrucibleAction}
   */
  createAction({actor, item, target}) {
    const {CrucibleAction, CrucibleSpellAction} = crucible.api.models;
    const isSpell = this.action.tags.has("spell");
    const {spellcraft, ...data} = this.toObject().action; // Construct from a copy because cleaning mutates
    // Flatten spell components in cases that this action needs to become a CrucibleSpellAction
    if ( isSpell ) Object.assign(data, spellcraft, {composition: CrucibleSpellAction.COMPOSITION_STATES.COMPOSED});
    const cls = isSpell ? CrucibleSpellAction : CrucibleAction;
    return new cls(data, {actor, item, usage: {forcedTargets: [target], hasDice: isSpell}});
  }

  /* -------------------------------------------- */
  /*  Region Event Handling                       */
  /* -------------------------------------------- */

  /** @override */
  async _handleRegionEvent(event) {
    if ( !game.user.isActiveGM ) return;
    const sourceActor = await fromUuid(this.actor);
    if ( !sourceActor ) return;
    const {token} = event.data;
    const actor = token.actor;

    // Targets are unaffected on the initially establishing turn
    if ( await this.#isEstablishingTurn() ) return;

    // Determine target eligibility using the region's action target configuration
    const sourceItem = await fromUuid(this.item);
    const action = this.createAction({actor: sourceActor, target: actor, item: sourceItem});
    if ( !action.canTargetActor(actor) ) return;

    // Restrict action usage based on allowed frequency
    switch ( this.frequency ) {
      case "once":        // If once ever and already done, skip
        if ( !foundry.utils.isEmpty(this.affectedActors) ) return;
        break;
      case "roundActor":  // If once per-round-per-actor, skip actors already treated this round
        if ( this.affectedActors[actor.uuid]?.round === (game.combat?.round ?? -1) ) return;
        break;
    }

    // Use the region behavior action
    await action.use({dialog: false});

    // If non-"every" frequency, track that actor has been affected
    if ( this.frequency !== "every" ) {
      await this.parent.update({"system.affectedActors": {[actor.uuid]: {
        combatId: game.combat?.id ?? null,
        combatantId: token.combatant?.id ?? null,
        tokenId: token.id,
        round: game.combat?.round ?? -1,
        turn: game.combat?.turn ?? -1
      }}});

      // If in combat, record this behavior to the current Combat so that affectedActors is cleared on combat deletion
      if ( game.combat ) {
        const combatBehaviors = game.combat.getFlag("crucible", "trackedActionBehaviors") ?? [];
        if ( !combatBehaviors.includes(this.parent.uuid) ) {
          combatBehaviors.push(this.parent.uuid);
          await game.combat.setFlag("crucible", "trackedActionBehaviors", combatBehaviors);
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Is the current Combat turn the one on which the tracking ActiveEffect established this Region?
   * @returns {Promise<boolean>}
   */
  async #isEstablishingTurn() {
    if ( !this.origin || !game.combat?.started ) return false;
    const start = (await fromUuid(this.origin))?.start;
    if ( !start ) return false;
    return (start.combat?.id === game.combat.id) && (start.round === game.combat.round)
      && (start.turn === game.combat.turn);
  }

  /* -------------------------------------------- */

  /**
   * Given a Combat being deleted, update affectedActors to clean stale data (or provide a write operation which can
   * be used to do so). If no update is appropriate, return null.
   * @param {Combat} combat           The combat being deleted
   * @param {object} [options]
   * @param {boolean} [options.batch] If true, return the update operation rather than updating the Region
   * @returns {DatabaseWriteOperation|null|Promise<RegionDocument>}
   */
  updateAffectedActors(combat, {batch=true}={}) {

    // Never clear affectedActors for "once" frequency
    if ( this.frequency === "once" ) return null;
    const affectedActors = foundry.utils.deepClone(this.affectedActors);

    // Do not reset out-of-combat affected marker for actors who are not currently participants in the combat
    const participants = combat.combatants.map(c => c.actor?.uuid);
    for ( const [actorUuid, affectedData] of Object.entries(this.affectedActors) ) {
      if ( !participants.includes(actorUuid) && affectedData.round === -1 ) continue;
      delete affectedActors[actorUuid];
    }
    if ( !batch ) return this.parent.update({"system.affectedActors": _replace(affectedActors)});
    const update = {_id: this.parent.id, "system.affectedActors": _replace(affectedActors)};
    return {
      action: "update",
      documentName: "RegionBehavior",
      parent: this.parent.parent,
      updates: [update]
    };
  }
}
