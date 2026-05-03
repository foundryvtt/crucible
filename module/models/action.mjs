/**
 * @import {CrucibleItemSnapshot} from "../documents/item.mjs"
 */
import StandardCheck from "../dice/standard-check.mjs";
import ActionUseDialog from "../dice/action-use-dialog.mjs";
import CrucibleActionConfig from "../applications/config/action-config.mjs";

/**
 * @typedef ActionContext
 * @property {string} label                 A string label providing context info
 * @property {string} icon                  A font awesome icon used to annotate the context
 * @property {Record<string, string>} tags  A record of tags which describe the context
 */

/**
 * @typedef ActionRange
 * @property {number} [minimum]             A minimum distance in feet at which the action may be used
 * @property {number} [maximum]             A maximum distance in feet at which the action may be used
 * @property {boolean} weapon               Enforce the maximum range of the used weapon
 */

/**
 * @typedef ActionTarget
 * @property {string} type                  The type of target for the action in ACTION.TARGET_TYPES
 * @property {number} [number]              The number of targets affected or size of target template
 * @property {number} [distance]            The allowed distance between the actor and the target(s)
 * @property {number} [limit]               Limit the effect to a certain number of targets.
 * @property {number} [scope]               The scope of creatures affected by an action
 */

/**
 * @typedef ActionUsage
 * @property {object} actorStatus           Actor status updates applied when the action is confirmed
 * @property {object} actorUpdates          Other non-status actor data updates applied when this action is confirmed
 * @property {object} actorFlags            Actor flag updates applied when this action is used (not confirmed)
 * @property {Record<string, DiceBoon>} boons  Boons applied to this action
 * @property {Record<string, DiceBoon>} banes  Banes applied to this action
 * @property {DiceCheckBonuses} bonuses     Roll bonuses applied to this action
 * @property {ActionContext} context        Action usage context
 * @property {boolean} hasDice              Does this action involve the rolling a dice check?
 * @property {ActionMovementUsage} movement  Movement planning constraints configured by this action
 * @property {number} [availableHands]      How many hands does the actor this action is on have available?
 * @property {string} [messageMode]         A message visibility mode to apply to the chat message
 * @property {string} [defenseType]         A special defense type being targeted
 * @property {string} [skillId]             A skill ID that is being used
 * @property {CrucibleItem} [weapon]        A specific weapon item being used
 * @property {CrucibleItem} [consumable]    A specific consumable item being used
 * @property {boolean} [selfTarget]         Default to self-target if no other targets are selected
 * @property {ActionSummonConfiguration[]} [summons]  Creatures summoned by this action
 * @property {CrucibleAction} [targetAction]  An action being "responded" to by this action
 */

/**
 * @typedef ActionMovementUsage
 * @property {string} [action]              Force all waypoints in the planned path to use a specific movement action
 * @property {boolean} [direct=true]        Require the planned path to be a single direct segment with no intermediate
 *                                          waypoints. Otherwise, a multi-segment path is allowed. (default true)
 * @property {object} [constrainOptions]    Movement constraint options passed to `Token#planMovement`
 */

/**
 * @typedef CrucibleActionMovement
 * The normalized movement data attached to a movement-tagged CrucibleAction.
 * Both the planned movement (from ActionUseDialog) and the reactive movement (from Actor#useMove) conform to this shape.
 * The waypoints array never includes the origin; it contains only the steps taken after the starting position.
 * @property {string} [id]                  The movement plan ID
 * @property {TokenPosition} origin         The starting position of the movement
 * @property {TokenMovementWaypoint[]} waypoints  The movement path steps, not including the origin
 * @property {number} [cost]                The measured cost of the path in feet
 * @property {object} [plan]                The resolved result of Token#planMovement, present when movement was planned
 *                                          via ActionUseDialog.
 * @property {TokenMovementOperation} [operation]  The TokenMovementOperation provided to Actor#useMove, present when
 *                                                 movement was actualized via a drag event
 */

/**
 * @typedef ActionRegionUsage
 * @property {Color|string} [color]         Override the region visualization color. (default game.user.color))
 * @property {boolean} [ephemeral]          Override whether the region is ephemeral (true) or persisted (false).
 *                                          Default behavior depends on the target type configuration.
 * @property {{bottom: number, top: number}} [elevation]  Override the region elevation range. If defined, must specify
 *                                          both bottom and top. Default behavior depends on the target type
 *                                          configuration.
 * @property {boolean} [wallRestriction]    Whether the region restricts token movement. (default true)
 */

/**
 * @typedef ActionSummonConfiguration
 * @property {string} actorUuid
 * @property {object} [tokenData={}]
 * @property {boolean} [combatant=true]
 * @property {number} [initiative=1]
 * @property {boolean} [permanent=true]     Is this summoned creature permanent until killed? Otherwise, a corresponding
 *                                          active effect must exist to track its duration.
 */

/**
 * @typedef ActionCost
 * @property {number} action                The cost in action points
 * @property {number} focus                 The cost in focus points
 * @property {number} heroism               The cost in heroism points
 * @property {number} [hands=0]             A number of free hands required
 * @property {boolean} [weapon]             Is the equipped weapon's action point cost added to this action's cost?
 */

/**
 * @typedef CrucibleTag
 * @property {string} label
 * @property {string} [cssClasses]
 * @property {boolean} [unmet]
 * @property {Color} [color]
 */

/**
 * @typedef ActionTags
 * @property {Record<string, string|CrucibleTag>} activation
 * @property {Record<string, string>} action
 * @property {Record<string, string>} context
 */

/**
 * @typedef ActionEffect
 * @property {string} name
 * @property {number} scope
 * @property {string[]} statuses
 * @property {object[]} changes
 * @property {EffectDurationData} duration
 * @property {{type: string, all: boolean}} result
 * @property {object} system
 */

/**
 * @typedef {"activation"|"strike"|"spell"|"check"|"summon"|"effect"|"actorUpdate"|"other"} CrucibleActionEventType
 * The type of event in an action's timeline.
 * - "activation": The initial resource cost of performing the action, targeting the acting actor.
 * - "strike": A weapon attack roll against a target.
 * - "spell": A spell effect roll against a target.
 * - "check": A non-attack dice check (e.g. a skill roll).
 * - "summon": A creature summoned as part of the action.
 * - "effect": Active effects applied to a target, not yet attributed to a specific roll.
 * - "actorUpdate": Data updates applied to a target actor (e.g. status flags, item drops from disarm).
 * - "other": A resource change not attributable to a specific roll (e.g. hook-contributed bonuses).
 */

/* -------------------------------------------- */

/**
 * An individual event in an action's timeline.
 * Events comprise a chronological stream of history for what happened during the action across all targets.
 */
class CrucibleActionEvent {
  /**
   * @param {object} data                           Event data
   * @param {CrucibleActionEventType} [data.type="other"]  The event type
   * @param {CrucibleActor} data.target             The target Actor for this event
   * @param {Roll} [data.roll=null]                 The Roll instance
   * @param {CrucibleItemSnapshot} [data.weapon]    Weapon snapshot, present for strike-type events
   * @param {string} [data.movement]                The movement ID, if any
   * @param {ActionSummonConfiguration} [data.summon]  Summon configuration, present for summon-type events
   * @param {object} [data.actorUpdates]            Data updates to apply to the target actor
   * @param {CrucibleItemSnapshot[]} [data.itemSnapshots]  Pre-action item state for reversal
   * @param {object[]} [data.resources=[]]          Resource changes incurred or imposed by this event
   * @param {ActionEffect[]} [data.effects=[]]      Effect changes manifested by this event
   * @param {object[]} [data.statusText]            Status text to display above the target
   * @param {boolean} [data.isCriticalSuccess]      Did this event produce a critical hit?
   * @param {boolean} [data.isCriticalFailure]      Did this event produce a critical miss?
   * @param {CrucibleAction} action                 The parent action that owns this event
   */
  constructor(data, action) {
    this.type = data.type ?? "other";
    this.target = data.target ?? action.actor;
    this.roll = data.roll ?? null;
    this.resources = data.resources ?? [];
    this.effects = data.effects ?? [];
    if ( data.weapon ) this.weapon = data.weapon;
    if ( data.movement ) this.movement = data.movement;
    if ( data.summon ) this.summon = data.summon;
    if ( data.actorUpdates ) this.actorUpdates = data.actorUpdates;
    if ( data.itemSnapshots ) this.itemSnapshots = data.itemSnapshots;
    if ( data.statusText ) this.statusText = data.statusText;
    if ( data.isCriticalSuccess ) this.isCriticalSuccess = data.isCriticalSuccess;
    if ( data.isCriticalFailure ) this.isCriticalFailure = data.isCriticalFailure;
    this.#action = action;
  }

  /* -------------------------------------------- */

  /**
   * The parent action.
   * @type {CrucibleAction}
   */
  #action;

  /**
   * Cached reconstructed weapon Item.
   * @type {CrucibleItem|undefined}
   */
  #weaponItem;

  /* -------------------------------------------- */

  /**
   * Aggregate resource deltas keyed by resource name.
   * @type {Record<string, number>}
   */
  get resourceTotals() {
    return this.resources.reduce((totals, {resource, delta}) => {
      totals[resource] ??= 0;
      totals[resource] += delta;
      return totals;
    }, {});
  }

  /* -------------------------------------------- */

  /**
   * Does this event intend to deal health damage?
   * For roll events, checks whether the roll produced damage data targeting health, even if resisted to zero.
   * For non-roll events, checks whether a negative health delta exists in resources.
   * @type {boolean}
   */
  get damagesHealth() {
    const d = this.roll?.data.damage;
    if ( d ) return !d.restoration && ((d.resource ?? "health") === "health");
    return this.resources.some(r => (r.resource === "health") && (r.delta < 0));
  }

  /**
   * Does this event intend to deal morale damage?
   * @type {boolean}
   */
  get damagesMorale() {
    const d = this.roll?.data.damage;
    if ( d ) return !d.restoration && ((d.resource ?? "health") === "morale");
    return this.resources.some(r => (r.resource === "morale") && (r.delta < 0));
  }

  /**
   * Does this event intend to deal any damage (health or morale)?
   * @type {boolean}
   */
  get isDamage() {
    const d = this.roll?.data.damage;
    if ( d ) return !d.restoration;
    return this.resources.some(r => ((r.resource === "health") || (r.resource === "morale")) && (r.delta < 0));
  }

  /**
   * Does this event intend to restore health?
   * @type {boolean}
   */
  get healsHealth() {
    const d = this.roll?.data.damage;
    if ( d ) return d.restoration && ((d.resource ?? "health") === "health");
    return this.resources.some(r => (r.resource === "health") && (r.delta > 0));
  }

  /**
   * Does this event intend to restore morale?
   * @type {boolean}
   */
  get healsMorale() {
    const d = this.roll?.data.damage;
    if ( d ) return d.restoration && ((d.resource ?? "health") === "morale");
    return this.resources.some(r => (r.resource === "morale") && (r.delta > 0));
  }

  /**
   * Does this event intend to restore any resource (health or morale)?
   * @type {boolean}
   */
  get isHealing() {
    const d = this.roll?.data.damage;
    if ( d ) return !!d.restoration;
    return this.resources.some(r => ((r.resource === "health") || (r.resource === "morale")) && (r.delta > 0));
  }

  /* -------------------------------------------- */

  /**
   * Reconstructed weapon Item with point-in-time state from the weapon snapshot.
   * The live Item is cloned and the saved stateful fields are applied via updateSource.
   * @type {CrucibleItem|undefined}
   */
  get weaponItem() {
    if ( !this.weapon ) return undefined;
    if ( this.#weaponItem ) return this.#weaponItem;
    const source = this.#action.actor.items.get(this.weapon._id);
    if ( !source ) return undefined;
    const clone = source.clone();
    clone.system.updateSource(this.weapon.system);
    return this.#weaponItem = clone;
  }

  /* -------------------------------------------- */

  /**
   * Serialize this event for inclusion in chat message flags.
   * Converts live document references to UUIDs and Roll instances to message-level roll indices.
   * @returns {object}
   */
  toObject() {
    const obj = {type: this.type, target: this.target.uuid, resources: this.resources, effects: this.effects};
    if ( this.roll ) obj.rollIndex = this.roll.data.index;
    if ( this.weapon ) obj.weapon = this.weapon;
    if ( this.movement ) obj.movement = this.movement;
    if ( this.summon ) obj.summon = this.summon;
    if ( this.actorUpdates ) obj.actorUpdates = this.actorUpdates;
    if ( this.itemSnapshots ) obj.itemSnapshots = this.itemSnapshots;
    if ( this.statusText ) obj.statusText = this.statusText;
    if ( this.isCriticalSuccess ) obj.isCriticalSuccess = this.isCriticalSuccess;
    if ( this.isCriticalFailure ) obj.isCriticalFailure = this.isCriticalFailure;
    for ( const effect of obj.effects ) {
      for ( const setKey of ["regions", "summons"] ) {
        if ( setKey in effect.system ) effect.system[setKey] = Array.from(effect.system[setKey]);
      }
    }
    return obj;
  }

  /* -------------------------------------------- */

  /**
   * Reconstruct an event from serialized chat message data.
   * @param {object} data                 Serialized event data from flags.crucible.events
   * @param {CrucibleAction} action       The parent action
   * @param {ChatMessage} message         The ChatMessage containing roll instances
   * @returns {CrucibleActionEvent}
   */
  static fromObject(data, action, message) {
    const {target: targetUuid, rollIndex, ...eventData} = data;
    eventData.target = foundry.utils.fromUuidSync(targetUuid);
    if ( rollIndex != null ) eventData.roll = message.rolls[rollIndex];
    return new this(eventData, action);
  }
}

/* -------------------------------------------- */

/**
 * @typedef CrucibleActionUsageOptions
 * @property {CrucibleTokenObject} [token]  A specific Token which is performing the action
 * @property {boolean} [dialog]             Present the user with an action configuration dialog?
 * @property {string} [messageMode]         Which message visibility mode to apply to the resulting message?
 */


/**
 * @typedef CrucibleActionHistoryEntry      A logged Action within the Actor's action history flag
 * @property {string} id                    The Action ID that was performed
 * @property {string|null} messageId        The ChatMessage ID that contains full action details
 * @property {({id: string}|CombatHistoryData)|null} combat The Combat state at the time the action occurred
 */

/**
 * @typedef CrucibleActionData
 * @property {string} id                    The action identifier
 * @property {string} name                  The action name
 * @property {string} img                   An image for the action
 * @property {string} description           Text description of the action
 * @property {string} condition             An optional condition which must be met in order for the action to be used
 * @property {Set<string>} tags             A set of tags in ACTION.TAGS which apply to this action
 * @property {ActionCost} cost              Cost data for the action
 * @property {ActionTarget} target          Target data for the action
 * @property {ActionRange} range            Range data for the action
 * @property {{actorUuid?: string, permanent?: boolean}} summon  Summon configuration embedded in this action
 * @property {ActionEffect[]} effects       Active effect templates applied when this action is used
 */

/**
 * A special Set that sorts action tags in priority order.
 */
class CrucibleActionTags extends Set {
  constructor(values, action) {
    super();
    this.#action = action;
    if ( values ) {
      for ( const v of values ) this.add(v);
    }
    this.#sorted = [];
    this.#sort();
  }

  /**
   * The action that owns this set of tags.
   * @type {CrucibleAction}
   */
  #action;

  /**
   * The set tags in sorted order.
   * @type {string[]}
   */
  #sorted;

  /** @override */
  *tags() {
    for ( const tag of this.#sorted ) yield SYSTEM.ACTION.TAGS[tag];
  }

  /* -------------------------------------------- */

  #sort() {
    if ( !this.#sorted ) return;
    const TAGS = SYSTEM.ACTION.TAGS;
    this.#sorted = Array.from(this).sort((a, b) => TAGS[a].priority - TAGS[b].priority);
  }

  /* -------------------------------------------- */

  add(value) {
    if ( this.has(value) ) return;
    const tag = SYSTEM.ACTION.TAGS[value];
    if ( !tag ) {
      let msg = `Unrecognized tag "${value}" in Action "${this.#action.id}"`;
      if ( this.#action.actor ) msg += ` for Actor "${this.#action.actor.name}" [${this.#action.actor.uuid}]`;
      console.warn(msg);
      return;
    }
    super.add(value);
    if ( tag.propagate ) {
      for ( const p of tag.propagate ) this.add(p);
    }
    this.#sort();
  }

  /* -------------------------------------------- */

  delete(value) {
    super.delete(value);
    this.#sort();
  }

  /* -------------------------------------------- */

  clear() {
    super.clear();
    this.#sort();
  }
}

/* -------------------------------------------- */

/**
 * The data model for an Action within the Crucible game system.
 *
 * Actions are a fundamental aspect of gameplay in Crucible. Every meaningful thing an actor does during combat (and
 * many things outside of combat) is expressed as an action: attacking, casting a spell, moving, activating a special
 * ability.
 *
 * ## Events
 * An action records its mechanical effects as a flat, chronological array of {@link CrucibleActionEvent} objects in
 * {@link CrucibleAction#events}. Each event represents one discrete thing that an action causes to happen: a strike
 * against a target, a resource cost paid by the attacker, ActiveEffects applied, updates to an actor. The event stream
 * is the primary source of truth for what an action did or will do.
 *
 * Events are created during the action lifecycle via {@linkcode CrucibleAction#recordEvent}. For the most part, events
 * are recorded in Actor or Action hooks. When the action's ChatMessage is created, the event stream is serialized into
 * its flags, and upon confirmation it is deserialized and the changes specified within it are executed.
 *
 * ## Action Lifecycle
 * An action's can be split into three phases. What follows is a brief (and non-exhaustive) explanation of each, and
 * which Action and Actor hooks are called in order.
 *
 * ### Phase 1: Preparation ({@linkcode CrucibleAction#prepare})
 * The majority of actions exist in a persisted state prior to being used. When an action undergoes data preparation,
 * it goes through:
 * - {@linkcode CrucibleAction#_configureUsage} - Set base cost, usage bonuses.
 *    - Action hooks called: `initialize`
 * - {@linkcode CrucibleAction#_prepare} - Call hooks, set scaling.
 *    - Action hooks called: `prepare`
 *    - Actor hooks called: `prepareAction`
 *
 * ### Phase 2: Usage (CrucibleAction##use)
 * The public entry point is {@linkcode CrucibleAction#use}, which clones the action and drives it through:
 * - {@linkcode CrucibleAction#_canUse} - Early rejection (insufficient resources, unmet tag requirements, etc.).
 *    - Action hooks called: `canUse`
 * - Actor hooks called: `useAction`
 * - {@linkcode CrucibleAction#acquireTargets} - Populate `this.targets`
 *    - Action hook called: `acquireTargets`
 * - Action hooks called: `configure`
 * - {@linkcode CrucibleAction#configureDialog} - Present the user with an {@link ActionUseDialog} (skippable).
 *    - Targets are re-acquired strictly after the dialog closes.
 *    - Action hooks called: `configure` (again, after target reacquisition)
 * - {@linkcode CrucibleAction##initializeSelfEvents} - Pre-create the self `actorUpdate` and `activation` events.
 *   Drains any pre-accumulated `usage.actorUpdates` and `usage.itemSnapshots` into the events. After this point,
 *   `preActivate` and `postActivate` hooks can access {@linkcode CrucibleAction#selfUpdateEvent} directly.
 * - {@linkcode CrucibleAction#_preActivate} - Final validation with full target knowledge. May throw to abort.
 *    - Action hooks: `preActivate`
 *    - Actor hooks: `preActivateAction`
 *    - {@linkcode CrucibleAction#_canUse} (and its corresponding action hooks) called again
 * - {@linkcode CrucibleAction#_roll} - Called once per target. This is where dice rolls happen and attack/spell/skill
 *    events are recorded.
 *    - Action hooks called: `roll`
 *    - Actor hooks called: `rollAction`
 * - {@linkcode CrucibleAction##finalizeSelfEvents} - Finalize the pre-existing self events: merge `usage.actorStatus`
 *   into the actorUpdate event, compute activation costs from `this.cost`, and record summon events.
 * - `CrucibleAction##recordEffectEvents` - Record ActiveEffect data to roll events which should result in effect
 *   application, or as standalone "effect" events.
 * - {@linkcode CrucibleAction#_post} - Post-roll modification of the event stream.
 *    - Action hooks called: `postActivate`
 * - `CrucibleAction##finalizeEvents` - Compute final resource deltas and critical flags.
 * - Actor hooks called: `finalizeAction`
 * - {@linkcode CrucibleAction#toMessage} - Serialize the action (including its event stream) into ChatMessage flags
 *   and create the message. The action is now persisted but not yet applied.
 *
 * ### Phase 3: Confirmation ({@linkcode CrucibleAction#confirm})
 * After the ChatMessage is created, a GM (or the acting player, if auto-confirm is enabled & the action targets only
 * self) may confirm the action.
 * The action is reconstituted from the ChatMessage via {@linkcode CrucibleAction.fromChatMessage}, which deserializes
 * the event stream, targets, and linked documents. Then {@linkcode CrucibleAction#confirm} drives:
 *
 * - Action hooks called: `confirm`
 *    - Receives `reverse` boolean to support undo.
 * - Actor hooks called: `confirmAction` - Called for every actor (including self) in the event stream.
 * - `CrucibleAction##applyEvents` - Walk the event stream and apply resource changes to each actor. When
 *   `reverse=true`, all deltas are inverted, effects are removed, and item snapshots are restored.
 * - `CrucibleAction##recordHeroism` - Award heroism for confirmed damage-dealing actions.
 *
 * ## Guidance for Hook Authors
 * - Record events, do not mutate actor state directly. All resource changes, effects, and actor updates must be
 *   expressed as events via {@linkcode CrucibleAction#recordEvent}. Direct actor mutations within hooks will be lost
 *   or double-applied.
 * - Use `roll` hooks to create attack/spell/check events, if standard tags are insufficient. See existing `roll` hooks
 *   in `const/action.mjs` for reference.
 * - Use `postActivate` hooks to inspect and modify the event stream after all rolls are complete. This is the
 *   right place to add, remove, or modify events based on action results.
 * - Use `confirm` hooks only for side effects that require the `reverse` parameter, such as committing or
 *   undoing movement. Most hooks belong in earlier lifecycle stages.
 * - If examining the effects for a specific actor, use {@linkcode CrucibleAction#eventsByActor},
 *   {@linkcode CrucibleAction#eventsByTarget}, or {@linkcode CrucibleAction#selfEvents}. These provide cached,
 *   pre-classified views.
 * - Use {@link ActorEventGroup} properties like `isSuccess`, `isCriticalSuccess`, `hasRoll` to avoid manual iteration.
 * - Use getters like {@linkcode CrucibleActionEvent#isDamage} or {@linkcode CrucibleActionEvent#healsMorale} rather
 *   than inspecting raw resource deltas or roll data. These getters correctly handle edge cases like zero-damage hits
 *   and restoration spells.
 * - Use {@linkcode CrucibleActionEvent#weaponItem} to get the weapon used, with pre-use values for stateful properties.
 *
 * ## Related References
 * - {@link SYSTEM.ACTION_HOOKS} - Defines the available action hook names, their argument signatures, and whether they
 *   are async. Tags and module hooks contribute handlers keyed to these hook names.
 * - {@link SYSTEM.ACTOR.HOOKS} - Defines the available actor hook names and their argument signatures. Actor hooks
 *   are registered by module hook or affix, and are called passing the item for which they are registered.
 * - `crucible.api.hooks` - The runtime registry where action hook handlers are defined, keyed by action/item
 *   identifier or talent ID. This is the object that module authors extend to add custom hook behavior.
 * - {@link ActionUseDialog} - The dialog presented during the "Usage" phase. Brokers target selection and action
 *   configuration before execution proceeds.
 *
 * @mixes CrucibleActionData
 */
export default class CrucibleAction extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const {duration: aeDuration} = foundry.documents.ActiveEffect.defineSchema();
    const effectScopes = SYSTEM.ACTION.TARGET_SCOPES.choices;
    delete effectScopes[SYSTEM.ACTION.TARGET_SCOPES.NONE]; // NONE not allowed
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      description: new fields.HTMLField({required: false, initial: undefined}),
      condition: new fields.StringField(),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        heroism: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        hands: new fields.NumberField({required: false, nullable: false, integer: true, initial: 0, min: 0, max: 2}),
        weapon: new fields.BooleanField({initial: false})
      }),
      range: new fields.SchemaField({
        minimum: new fields.NumberField({required: true, nullable: true, integer: true, min: 1, initial: null}),
        maximum: new fields.NumberField({required: true, nullable: true, integer: true, min: 1, initial: null}),
        weapon: new fields.BooleanField({initial: false})
      }),
      target: new fields.SchemaField({
        type: new fields.StringField({required: true, choices: SYSTEM.ACTION.TARGET_TYPES, initial: "single"}),
        number: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        size: new fields.NumberField({required: false, nullable: false, integer: true, min: 1, initial: undefined}),
        multiple: new fields.NumberField({required: false, nullable: false, integer: true, min: 1, initial: undefined}),
        scope: new fields.NumberField({required: true, initial: SYSTEM.ACTION.TARGET_SCOPES.ALL,
          choices: SYSTEM.ACTION.TARGET_SCOPES.choices}),
        limit: new fields.NumberField({required: false, nullable: false, initial: undefined, integer: true, min: 1}),
        self: new fields.BooleanField()
      }),
      // TODO: Consider which fields make sense to have configurable via UI
      summon: new fields.SchemaField({
        actorUuid: new fields.DocumentUUIDField({type: "Actor"}),
        permanent: new fields.BooleanField({initial: true})
      }),
      effects: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({blank: true, initial: ""}),
        scope: new fields.NumberField({choices: effectScopes}),
        result: new fields.SchemaField({
          type: new fields.StringField({choices: SYSTEM.ACTION.EFFECT_RESULT_TYPES, initial: "success", blank: false}),
          all: new fields.BooleanField({initial: false})
        }),
        statuses: new fields.SetField(new fields.StringField({choices: CONFIG.statusEffects})),
        duration: aeDuration,
        system: new fields.SchemaField(crucible.api.models.CrucibleBaseActiveEffect.defineSchema())
      })),
      tags: new fields.SetField(new fields.StringField({required: true, blank: false})),
      autoFavorite: new fields.BooleanField({initial: false})
    };
  }

  /**
   * A set of localization prefix paths which are used by this data model.
   * @type {string[]}
   */
  static LOCALIZATION_PREFIXES = ["ACTION"];

  /**
   * The Handlebars template used to render this Action as a line item for tooltips or as a partial.
   * @type {string}
   */
  static TOOLTIP_TEMPLATE = "systems/crucible/templates/tooltips/tooltip-action.hbs";

  /**
   * Configure the Dialog class that provides the user with an interface to configure this Action.
   * @type {typeof ActionUseDialog}
   */
  static dialogClass = ActionUseDialog;

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * The specific Actor to whom this Action is bound. May be undefined if the Action is unbound.
   * @type {CrucibleActor}
   */
  actor = this.actor; // Defined during constructor

  /**
   * The Affix ActiveEffect that provides this Action. Null if the Action is defined directly on an Item.
   * @type {ActiveEffect|null}
   */
  affix = this.affix; // Defined during constructor

  /**
   * The specific Item which contributed this Action. May be undefined if the Action did not originate from an Item.
   * @type {CrucibleItem}
   */
  item = this.item; // Defined during constructor

  /**
   * The message representing this action, if applicable
   * @type {CrucibleChatMessage|null}
   */
  message = this.message; // Defined during constructor

  /**
   * A planned or realized token movement associated with this action, used for movement-tagged actions.
   * @type {CrucibleActionMovement|null}
   */
  movement = this.movement; // Defined during constructor

  /**
   * The Actors explicitly targeted by this Action, mapped to their target data. Null before targets are acquired.
   * @type {CrucibleActionTargets|null}
   */
  targets = null;

  /**
   * The chronological event stream of outcomes resulting from this Action.
   * @type {CrucibleActionEvent[]}
   */
  events = [];

  /**
   * A specific RegionDocument, either persisted or ephemeral, used to establish area of effect for this action.
   * @type {RegionDocument|null}
   */
  region = this.region; // Defined during constructor

  /**
   * The ability scores which cause this action to scale.
   * @type {string[]}
   */
  scaling = this.scaling; // Defined during _prepareData

  /**
   * A specific Token document that is performing this Action in the context of a Scene.
   * This is the TokenDocument instance (CrucibleToken), not the canvas placeable (CrucibleTokenObject).
   * @type {CrucibleToken}
   */
  token = this.token; // Defined during constructor

  /**
   * The training types which can provide a skill bonus to use of this action.
   * @type {string[]}
   */
  training = this.training; // Defined during _prepareData

  /**
   * A sheet used to configure this Action.
   * @returns {*}
   */
  get sheet() {
    this.#sheet ||= new CrucibleActionConfig({action: this});
    return this.#sheet;
  }

  #sheet;

  /**
   * Has this action been prepared for a given Actor to use?
   * @internal
   */
  _prepared = this._prepared ?? false;

  /**
   * Is this Action a favorite of the Actor which owns it?
   * @type {boolean}
   */
  get isFavorite() {
    return this.actor?.system.favorites.has(this.id);
  }

  /**
   * Does this action require movement planning before it can be used?
   * @type {boolean}
   */
  get requiresMovement() {
    return this.tags.has("movement") && !!this.token && !this.movement;
  }

  /**
   * Does this Action require a region placement to establish its targets?
   * @type {boolean}
   */
  get requiresRegion() {
    return SYSTEM.ACTION.TARGET_TYPES[this.target.type]?.region && !this.region;
  }

  /**
   * Does this Action require a viewed Scene to acquire its targets?
   * @type {boolean}
   */
  get requiresScene() {
    return !["none", "self"].includes(this.target.type);
  }

  /* -------------------------------------------- */
  /*  Events Management                           */
  /* -------------------------------------------- */

  /**
   * @typedef {object} ActorEventGroup
   * @property {CrucibleActionEvent[]} all            All events targeting this actor in chronological order
   * @property {CrucibleActionEvent[]} roll           Events that contain dice rolls
   * @property {CrucibleActionEvent|null} activation  The activation event (singleton, at most one per actor)
   * @property {CrucibleActionEvent|null} actorUpdate The actor update event (singleton, at most one per actor)
   * @property {boolean} isSelf                       Is this actor the one performing the action?
   * @property {boolean} isTarget                     Was this actor explicitly targeted by the action?
   * @property {boolean} hasRoll                      Does this actor have at least one roll event?
   * @property {boolean} isSuccess                    Did at least one roll succeed?
   * @property {boolean} allSuccess                   Did all rolls succeed?
   * @property {boolean} isFailure                    Did at least one roll fail?
   * @property {boolean} allFailure                   Did all rolls fail?
   * @property {boolean} isCriticalSuccess            Did at least one roll critically succeed?
   * @property {boolean} isCriticalFailure            Did at least one roll critically fail?
   */

  /**
   * The event stream partitioned by actor with pre-classified accessors.
   * Built in a single pass over the events array and cached until invalidated.
   * @type {Map<CrucibleActor, ActorEventGroup>}
   */
  get eventsByActor() {
    if ( !this._eventsDirty && this.#eventsByActor ) return this.#eventsByActor;
    const eventsByActor = new Map();
    for ( const event of this.events ) {
      let events = eventsByActor.get(event.target);
      if ( !events ) {
        events = {
          all: [],
          roll: [],
          activation: null,
          actorUpdate: null,
          isSelf: event.target === this.actor,
          isTarget: this.targets?.has(event.target) ?? false,
          hasRoll: false,
          isSuccess: false,
          allSuccess: true,
          isFailure: false,
          allFailure: true,
          isCriticalSuccess: false,
          isCriticalFailure: false
        };
        eventsByActor.set(event.target, events);
      }
      events.all.push(event);
      if ( event.roll ) {
        events.roll.push(event);
        events.hasRoll = true;
        if ( event.roll.isSuccess ) events.isSuccess = true;
        else events.allSuccess = false;
        if ( event.roll.isFailure ) events.isFailure = true;
        else events.allFailure = false;
        if ( event.roll.isCriticalSuccess ) events.isCriticalSuccess = true;
        if ( event.roll.isCriticalFailure ) events.isCriticalFailure = true;
      }
      if ( event.type === "activation" ) events.activation = event;
      else if ( event.type === "actorUpdate" ) events.actorUpdate = event;
    }

    // allSuccess/allFailure are only meaningful when there are rolls
    for ( const events of eventsByActor.values() ) {
      if ( !events.hasRoll ) events.allSuccess = events.allFailure = false;
    }

    this._eventsDirty = false;
    return this.#eventsByActor = eventsByActor;
  }

  /**
   * The event stream filtered to only explicitly targeted actors.
   * @type {Map<CrucibleActor, ActorEventGroup>}
   */
  get eventsByTarget() {
    const map = new Map();
    for ( const [actor, group] of this.eventsByActor ) {
      if ( group.isTarget ) map.set(actor, group);
    }
    return map;
  }

  /**
   * The pre-classified event group for the actor performing this action.
   * @type {ActorEventGroup|undefined}
   */
  get selfEvents() {
    return this.eventsByActor.get(this.actor);
  }

  /**
   * The actorUpdate event for the actor performing this action.
   * Available after #initializeSelfEvents has run, before any preActivate or postActivate hooks.
   * @type {CrucibleActionEvent}
   * @throws {Error} If accessed before self events have been initialized
   */
  get selfUpdateEvent() {
    const event = this.selfEvents?.actorUpdate;
    if ( !event ) throw new Error(`selfUpdateEvent accessed before initialization for action "${this.id}"`);
    return event;
  }

  /**
   * Cached result of eventsByActor. Invalidated when events are added via recordEvent.
   * @type {Map<CrucibleActor, ActorEventGroup>|null}
   */
  #eventsByActor = null;

  /**
   * Flag to force rebuild of the eventsByActor cache on next access.
   * Set to true by recordEvent. Can also be set manually if the events array is mutated directly.
   * @type {boolean}
   */
  _eventsDirty = true;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * One-time configuration of the CrucibleAction as part of construction.
   * @param {object} [options]                    Options passed to the constructor context
   * @param {CrucibleActor} [options.actor]         A specific Actor to whom this Action is bound
   * @param {CrucibleItem} [options.item]           A specific Item that provided this Action
   * @param {RegionDocument} [options.region]       A RegionDocument associated with this Action
   * @param {CrucibleTokenObject} [options.token]   A specific token performing this Action
   * @param {CrucibleChatMessage} [options.message] The specific ChatMessage (if any) representing this Action
   * @param {ActionUsage} [options.usage]           Pre-configured action usage data
   * @inheritDoc */
  _configure({actor=null, item=null, region=null, movement=null, token=null, message=null, metadata={}, usage={}, ...options}) {
    super._configure(options);
    const AffixModel = crucible.api.models.CrucibleAffixActiveEffect;
    const affix = (this.parent instanceof AffixModel) ? this.parent.parent : null;
    Object.defineProperties(this, {
      actor: {value: actor, writable: false, configurable: true},
      affix: {value: affix, writable: false, configurable: true},
      item: {value: item ?? this.parent?.parent, writable: false, configurable: true},
      token: {value: token, writable: false, configurable: true},
      region: {value: region, writable: false, configurable: true},
      movement: {value: movement, writable: false, configurable: true},
      message: {value: message, writable: false, configurable: true},

      /**
       * Arbitrary metadata that persists to the ChatMessage flags for use during confirmation.
       * Hooks can write keys during the use phase (e.g., preActivate) and read them during confirm.
       * @type {object}
       */
      metadata: {value: metadata}
    });

    /**
     * Dice roll bonuses which modify the usage of this action.
     * Usage data is *shared* across all clones of the same Action owned by a certain Actor.
     * This object is only initialized once and retained through future initialization workflows.
     * @type {ActionUsage}
     */
    Object.defineProperty(this, "usage", {value: foundry.utils.mergeObject(usage, {
      actorFlags: {},
      actorStatus: {},
      actorUpdates: {},
      bonuses: {ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1},
      boons: {},
      banes: {},
      context: {label: undefined, icon: undefined, tags: {}},
      hasDice: false,
      isAttack: false,
      isMelee: false,
      isRanged: false,
      movement: {},
      region: {}
    }, {inplace: true, overwrite: false})});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize(options={}) {
    super._initialize(options);

    // Prepare base data
    this._prepareData();

    /**
     * Configured hook functions invoked by the action.
     * @type {Readonly<Record<string, AsyncFunction|Function>>}
     */
    Object.defineProperty(this, "hooks", {
      value: CrucibleAction.#prepareHooks(this.id),
      configurable: true
    });

    // Prepare action for actor
    if ( !options.lazy ) this.prepare();
  }

  /* -------------------------------------------- */

  /**
   * Prepare Hook functions for this Action from the module-defined hook registry.
   * @param {string} actionId
   * @returns {Record<string, AsyncFunction|Function>}
   */
  static #prepareHooks(actionId) {
    const hooks = {};
    const cfg = crucible.api.hooks.action[actionId];
    if ( cfg ) {
      for ( const hookName in SYSTEM.ACTION_HOOKS ) {
        if ( cfg[hookName] instanceof Function ) hooks[hookName] = cfg[hookName];
      }
    }
    return Object.freeze(hooks);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for the Action.
   * @protected
   */
  _prepareData() {
    const talent = this.item;
    if ( talent ) {
      this.name ||= talent.name;
      this.img ||= talent.img;
    }

    // Propagate and sort tags
    this.tags = new CrucibleActionTags(this._source.tags, this);

    // Ability Scaling and Skill Training
    this.scaling = [];
    this.training = [];

    // Prepare Cost
    this.cost.hands ??= 0; // Number of free hands required
    if ( this.actor ) {
      const {freeHands, spellHands} = this.actor.equipment.weapons;
      this.usage.availableHands = this.tags.has("spell") ? spellHands : freeHands;
    }

    // Prepare Effects
    for ( const effect of this.effects ) {
      effect.name ||= this.name;
      effect.img ||= this.img;
      effect.tags = {};
      if ( effect.result?.type ) {
        let result = SYSTEM.ACTION.EFFECT_RESULT_TYPES[effect.result.type]?.label;
        if ( effect.result.all ) result = _loc("ACTION.AllResult", {existing: result});
        effect.tags.result = result;
      }
      effect.tags.scope = _loc("ACTION.AffectsScope", {scope: _loc(SYSTEM.ACTION.TARGET_SCOPES.label(effect.scope || this.target.scope))});
      if ( effect.duration ) {
        const {units, value} = effect.duration;
        if ( !Number.isFinite(value) ) effect.tags.duration = _loc("ACTION.DurationUntilEnded");
        if ( units === "seconds" ) effect.tags.duration = _loc("ACTION.DurationSeconds", {value});
        else if ( units === "rounds" ) effect.tags.duration = _loc("ACTION.DurationRounds", {value});
      }
    }

    // Prepare Summons
    if ( this.summon.actorUuid ) {
      this.usage.summons = [{...this.summon}];
    }

    // Reset bonuses
    Object.assign(this.usage.bonuses, {
      ability: 0,
      skill: 0,
      enchantment: 0,
      damageBonus: 0,
      multiplier: 1
    });
  }

  /* -------------------------------------------- */

  /**
   * Bind an existing Action to a specific Actor.
   * This is an alternative to constructing a new Action instance in cases where the existing instance can be reused.
   * @param {CrucibleActor} actor     A specific Actor to whom this Action is bound
   * @returns {CrucibleAction}        This action, for chaining
   */
  bind(actor) {
    Object.defineProperty(this, "actor", {value: actor, writable: false});
    this.reset();
    return this;
  }

  /* -------------------------------------------- */

  /** @override */
  clone(updateData={}, context={}) {
    const actionData = foundry.utils.mergeObject(this.toObject(), updateData, {
      insertKeys: false,
      applyOperators: true,
      inplace: true
    });
    context.parent = this.parent;
    context.usage = this.usage;
    context.actor ??= this.actor;
    context.token ??= this.token;
    context.region ??= this.region;
    context.movement ??= this.movement;
    context.message ??= this.message;
    const clone = new this.constructor(actionData, context);

    // When cloning a single action, we need to run through "prepareActions" actor hooks on the clone
    if ( this.actor && !context.lazy ) this.actor.callActorHooks("prepareActions", {[clone.id]: clone});
    return clone;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the Action to be used by an Actor.
   * Happens automatically in _initialize unless the document is being constructed lazily.
   */
  prepare() {
    if ( !this.actor ) return;
    this._configureUsage();
    this._prepare();
    this._prepared = true;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  toObject(source) {
    const obj = super.toObject();
    // Preserve final tags
    if ( source === false ) obj.tags = Array.from(this.tags);
    return obj;
  }

  /* -------------------------------------------- */

  /**
   * Record a new event in the action's event stream.
   * Fills in default values for omitted properties, allowing callers to provide only the relevant fields.
   * @param {Partial<CrucibleActionEvent>} eventData  New event data, must include at least "type"
   * @param {object} [options]                        Options controlling event insertion
   * @param {number} [options.index]                    Splice the event to a specific index of the events array
   * @param {number} [options.temporary]                Create a `CrucibleActionEvent` instance without adding it to
   *                                                    the events array
   * @param {boolean} [options.start]                   Unshift the event to the start of the events array
   * @returns {CrucibleActionEvent}                   The recorded event object
   */
  recordEvent(eventData, {index, start, temporary}={}) {
    const event = new CrucibleActionEvent(eventData, this);
    if ( temporary ) return event;
    if ( (event.type === "activation") || (event.type === "actorUpdate") ) {
      const existing = this.events.find(e => (e.type === event.type) && (e.target === event.target));
      if ( existing ) throw new Error(`Duplicate singleton "${event.type}" event for actor "${event.target.name}"`);
    }
    if ( start ) this.events.unshift(event);
    else if ( Number.isInteger(index) ) this.events.splice(index, 0, event);
    else this.events.push(event);
    this._eventsDirty = true;
    return event;
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /**
   * Display a configuration prompt which customizes the Action usage.
   * @returns {Promise<object|null>}      The results of the configuration dialog
   */
  async configureDialog() {
    const roll = StandardCheck.fromAction(this);
    const response = await this.constructor.dialogClass.prompt({
      action: this,
      actor: this.actor,
      roll,
      targets: this.targets
    });
    return response || null;
  }

  /* -------------------------------------------- */

  /**
   * Invoke the configure Action hook for each tag, allowing tags to customize the action based on targets.
   * This method is tolerant, it captures errors in hooks and allows the rest of the action workflow to proceed.
   */
  #configure() {
    for ( const test of this._tests() ) {
      if ( test.configure instanceof Function ) {
        try {
          test.configure.call(this);
        } catch(err) {
          console.error(new Error(`Failed usage configuration for Action "${this.id}"`, {cause: err}));
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Execute an Action.
   * The action is cloned so that its data may be transformed throughout the workflow.
   * @param {CrucibleActionUsageOptions} [options]    Options which modify action usage
   * @param {TokenDocument} [options.token]           A specific token performing the action
   * @returns {Promise<CrucibleAction|undefined>}
   */
  async use({token, ...options}={}) {
    if ( !this._prepared ) throw new Error("A CrucibleAction must be prepared for an Actor before it can be used.");

    // Redirect to spellcasting
    if ( this.id === "cast" ) {
      const spell = crucible.api.models.CrucibleSpellAction.getDefault(this.actor);
      return spell.use({token, ...options});
    }

    // Infer the Token performing the Action
    if ( !token ) {
      let tokens = this.actor.getActiveTokens();
      if ( tokens.length > 1 ) tokens = tokens.filter(t => t.controlled);
      if ( tokens.length === 1 ) token = tokens[0]?.document;
      if ( tokens.length > 1 ) {
        throw new Error(`Multiple tokens controlled for Actor "${this.actor.name}"`);
      }
    }

    // Use a clone of the Action
    const action = this.clone({}, {parent: this.parent, actor: this.actor, token});
    return action.#use(options);
  }

  /* -------------------------------------------- */

  /**
   * Execute the cloned action.
   * @param {object} [options]                      Options which modify action usage
   * @param {boolean} [options.dialog]              Present the user with an action configuration dialog?
   * @param {object} [options.chatMessageOptions]   Options which are passed to Action#toMessage
   * @returns {Promise<CrucibleAction|null>}
   */
  async #use({chatMessageOptions={}, dialog=true}={}) {

    // Assert that the action could possibly be used based on its tags
    try {
      this._canUse();
      this.actor.callActorHooks("useAction", this);
    } catch(err) {
      ui.notifications.warn(err);
      return null;
    }

    // Acquire initial targets and configure the action
    this.acquireTargets({strict: false});
    this.#configure();

    // Prompt for action configuration
    if ( dialog ) {
      const configuration = await this.configureDialog();
      if ( configuration === null ) return null;  // Dialog closed
      try {
        this.acquireTargets({strict: true});  // Re-acquire configured targets, strictly
      } catch(err) {
        ui.notifications.warn(err);
        return null;
      }
      this.#configure();
    }

    // Initialize self events before pre-activation hooks
    this.#initializeSelfEvents();

    // Pre-execution steps, possibly preventing activation
    try {
      await this._preActivate();
    } catch(err) {
      ui.notifications.warn(err);
      return null;
    }

    // Iterate over designated targets
    for ( const [actor, {token}] of this.targets ) {
      try {
        await this._roll(actor, token);
      } catch(err) {
        ui.notifications.warn(err);
        return null;
      }
    }

    // Finalize action events
    this.#finalizeSelfEvents();
    this.#recordEffectEvents();
    await this._post();
    this.#finalizeEvents();
    this.actor.callActorHooks("finalizeAction", this);

    // Create the RegionDocument, visible to GMs and the placing user
    if ( this.region ) {
      const regionData = this.region.toObject();
      regionData.ownership = {default: 0, [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER};
      regionData.visibility = CONST.REGION_VISIBILITY.OBSERVER; // Author and GM only until confirmed
      const region = await this.region.constructor.create(regionData, {parent: canvas.scene, keepId: true});
      Object.defineProperty(this, "region", {value: region, configurable: true});
    }

    // Record action history and create a ChatMessage to confirm the action
    const message = await this.toMessage({
      ...chatMessageOptions,
      confirmed: false,
      messageMode: this.usage.messageMode || game.settings.get("core", "messageMode")
    });

    // Persist action usage flags immediately rather than waiting for action confirmation
    this.#recordActionHistory(message);
    await this.actor.update({"flags.crucible": this.usage.actorFlags});
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Record this action usage to action history for the Actor.
   * @param {ChatMessage} message           The created ChatMessage that records the Action
   * @returns {CrucibleActionHistoryEntry}
   */
  #recordActionHistory(message) {
    const lastAction = {
      id: this.id,
      messageId: message?.id || null,
      combat: this.actor.inCombat ? {id: game.combat.id, ...game.combat.current} : null
    };
    const history = (this.actor.flags.crucible?.actionHistory || []).slice(0, 99); // Maximum 100 history items
    history.unshift(lastAction);
    this.usage.actorFlags.actionHistory = history;
    return lastAction;
  }

  /* -------------------------------------------- */

  /**
   * @typedef ActionUseTarget
   * @property {CrucibleToken} token
   * @property {CrucibleActor} actor
   * @property {string} name
   * @property {string} uuid
   * @property {string} [error]
   */

  /**
   * @typedef {Map<CrucibleActor, ActionUseTarget>} CrucibleActionTargets
   */

  /**
   * Acquire the targets for an action activation. For each target track both the Token and the Actor.
   * @param {object} [options]      Options which affect target acquisition
   * @param {boolean} [options.strict]  Validate that targets conform to the allowed number for the action?
   * @returns {CrucibleActionTargets}
   */
  acquireTargets({strict=true}={}) {
    let targets;
    let targetType = this.target.type;
    const targetCfg = SYSTEM.ACTION.TARGET_TYPES[targetType];
    if ( targetType === "summon" ) return this.targets = new Map();

    // Acquire Region Targets
    if ( targetCfg.region ) targets = this.#acquireTargetsFromRegion();

    // Other Target Types
    else {
      if ( (targetType === "single") && this.target.self && !game.user.targets.some(t => t !== this.token) ) {
        targetType = "self";
      }
      switch ( targetType ) {
        case "none":
          return this.targets = new Map();
        case "self":
          const tokenTargets = this.actor.getActiveTokens(true, true).map(CrucibleAction.#getTargetFromToken);
          targets = tokenTargets.length
            ? [tokenTargets[0]]
            : [{actor: this.actor, uuid: this.actor.uuid, name: this.actor.name, token: null}];
          break;
        case "movement":
          targets = canvas.ready ? this.#acquireTargetsFromMovement() : [];
          break;
        case "single":
          targets = canvas.ready ? this.#acquireSingleTargets(strict) : [];
          break;
        default:
          ui.notifications.warn(_loc("ACTION.WARNINGS.UnimplementedTarget", {type: this.target.type, name: this.name}));
          targets = Array.from(game.user.targets).map(CrucibleAction.#getTargetFromToken);
          break;
      }
    }

    // Call acquireTargets action hook
    for ( const test of this._tests() ) {
      if ( test.acquireTargets instanceof Function ) test.acquireTargets.call(this, targets);
    }

    // Throw an error if any target had an error
    for ( const target of targets ) {
      if ( target.error && strict ) throw new Error(target.error);
    }

    // Build and return the targets map
    return this.targets = new Map(targets.map(t => [t.actor, t]));
  }

  /* -------------------------------------------- */

  /**
   * Convert a Token into a ActionUseTarget data structure.
   * @param {CrucibleToken|CrucibleTokenObject} token
   * @returns {ActionUseTarget}
   */
  static #getTargetFromToken(token) {
    if ( token instanceof foundry.canvas.placeables.Token ) token = token.document;
    const {actor, name} = token;
    return {token, actor, uuid: actor?.uuid, name};
  }

  /* -------------------------------------------- */

  /**
   * Acquire target tokens from the actor's planned movement path.
   * Tokens whose grid footprint overlaps any portion of the swept path become targets.
   * @returns {ActionUseTarget[]}
   */
  #acquireTargetsFromMovement() {
    if ( !this.movement ) return [];
    const sparseWaypoints = this.movement.waypoints;
    if ( !sparseWaypoints.length ) return [];

    // Expand sparse waypoints into every intermediate grid cell traversed.
    // Blink is a teleport action which getCompleteMovementPath would not expand, treat it as walk instead.
    const expandedWaypoints = sparseWaypoints.map(w => (w.action === "blink" ? {...w, action: "walk"} : w));
    const waypoints = this.token.getCompleteMovementPath([this.movement.origin, ...expandedWaypoints]).slice(1);

    // Identify 3d grid space offsets covered by the token's traversed path. Record the bounding offsets.
    const visitedSpaces = new Set();
    let minI = Infinity;
    let minJ = Infinity;
    let maxI = -Infinity;
    let maxJ = -Infinity;
    for ( let w = 0; w < waypoints.length; w++ ) {
      for ( const {i, j, k} of this.token.getOccupiedGridSpaceOffsets(waypoints[w]) ) {
        visitedSpaces.add(`${i},${j},${k}`);
        if ( i < minI ) minI = i;
        if ( j < minJ ) minJ = j;
        if ( i > maxI ) maxI = i;
        if ( j > maxJ ) maxJ = j;
      }
    }

    // Remove spaces occupied by the token's starting position
    for ( const {i, j, k} of this.token.getOccupiedGridSpaceOffsets(this.movement.origin) ) {
      visitedSpaces.delete(`${i},${j},${k}`);
    }

    // Identify Token targets by filtering the quadtree result for movement bounds
    const {x: x0, y: y0} = canvas.grid.getTopLeftPoint({i: minI, j: minJ});
    const {x: x1, y: y1} = canvas.grid.getTopLeftPoint({i: maxI + 1, j: maxJ + 1});
    const movementBounds = new PIXI.Rectangle(x0, y0, x1 - x0, y1 - y0);
    const targetDispositions = this.#getTargetDispositions();
    const hitTokens = canvas.tokens.quadtree.getObjects(movementBounds, {collisionTest: o => {
      const tokenDoc = o.t.document;
      if ( !this.target.self && (tokenDoc.actor === this.actor) ) return false;
      if ( !targetDispositions.includes(tokenDoc.disposition) ) return false;
      if ( tokenDoc.hidden ) return false;
      const spaces = tokenDoc.getOccupiedGridSpaceOffsets(tokenDoc._source);
      return spaces.some(({i, j, k}) => visitedSpaces.has(`${i},${j},${k}`));
    }});

    // Return the array of targets
    const targets = [];
    for ( const token of hitTokens ) targets.push(CrucibleAction.#getTargetFromToken(token.document));
    return targets;
  }

  /* -------------------------------------------- */

  /**
   * Acquire target tokens from a placed region using RegionDocument#tokens.
   * This needs to work with an ephemeral RegionDocument, so it cannot utilize RegionDocument#tokens directly.
   * @returns {ActionUseTarget[]}
   */
  #acquireTargetsFromRegion() {
    if ( !this.region ) return [];
    const potentialTokens = canvas.tokens.quadtree.getObjects(this.region.bounds);
    const targetDispositions = this.#getTargetDispositions();

    // Identify tokens contained within the region which match the correct disposition and visibility
    const targets = [];
    for ( const token of potentialTokens ) {
      const tokenDoc = token.document;
      if ( !this.target.self && (tokenDoc.actor === this.actor) ) continue;       // Exclude self
      if ( !targetDispositions.includes(tokenDoc.disposition) ) continue;         // Require correct disposition
      if ( tokenDoc.hidden ) continue;                                            // Ignore hidden
      if ( !tokenDoc.testInsideRegion(this.region, tokenDoc._source) ) continue;  // Require region containment
      targets.push(CrucibleAction.#getTargetFromToken(tokenDoc));
    }

    // Unlimited targets
    if ( !this.target.limit ) return targets;

    // If the target type is limited in the number it can affect, sort on proximity to the region origin
    const origin = this.region.shapes[0];
    for ( const t of targets ) {
      const c = t.token.getCenterPoint(t.token._source);
      t._d2 = Math.pow(c.x - origin.x, 2) + Math.pow(c.y - origin.y, 2);
    }
    targets.sort((a, b) => a._d2 - b._d2);
    return targets.slice(0, this.target.limit);
  }

  /* -------------------------------------------- */

  /**
   * Acquire and validate the targets for a Single target action.
   * @param {boolean} strict
   * @returns {ActionUseTarget[]}
   */
  #acquireSingleTargets(strict) {
    const tokens = game.user.targets;
    let errorAll;

    // Too few targets
    if ( tokens.size < 1 ) {
      if ( strict ) throw new Error(_loc("ACTION.WARNINGS.InvalidTarget", {
        number: this.target.number,
        type: this.target.type,
        action: this.name
      }));
      return [];
    }

    // Too many targets
    if ( tokens.size > this.target.number ) {
      errorAll = _loc("ACTION.WARNINGS.IncorrectTargets", {
        number: this.target.number,
        type: this.target.type,
        action: this.name
      });
    }

    // Test each target
    const targets = [];
    for ( const token of tokens ) {
      const t = CrucibleAction.#getTargetFromToken(token);
      if ( errorAll ) t.error = errorAll;
      targets.push(t);
      if ( !this.token ) continue;
      if ( (token === this.token) && !this.damage?.restoration ) {
        t.error = _loc("ACTION.WARNINGS.CannotTargetSelf");
        continue;
      }
      const range = crucible.api.canvas.grid.getLinearRangeCost(this.token.object, token);
      if ( this.range.minimum && (range < this.range.minimum) ) {
        t.error ||= _loc("ACTION.WARNINGS.MinimumRange", {min: this.range.minimum});
      }
      if ( this.range.maximum && (range > this.range.maximum) ) {
        t.error ||= _loc("ACTION.WARNINGS.MaximumRange", {max: this.range.maximum});
      }
    }
    return targets;
  }

  /* -------------------------------------------- */

  /**
   * Identify whether an action can be auto-confirmed by the Actor (User) who initiated it.
   * Actions are considered to affect another actor if they contain successful rolls or cause effects.
   * @returns {boolean}                           Can it be auto-confirmed?
   */
  canAutoConfirm() {
    const autoConfirm = game.settings.get("crucible", "autoConfirm");

    // No Auto-Confirm or not GM
    if ( !game.user.isGM || !autoConfirm ) return false;

    // All Actions
    if ( autoConfirm === 2 ) return true;

    // Non-Offensive Actions Only
    for ( const actor of this.targets.keys() ) {
      if ( actor !== this.actor ) return false;
    }
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Classify Token dispositions into allied and enemy groups.
   * @returns {{ally: number[], enemy: number[]}}
   */
  #getTargetDispositions() {
    const D = CONST.TOKEN_DISPOSITIONS;
    const S = SYSTEM.ACTION.TARGET_SCOPES;
    const scope = this.target.scope;

    // Some dispositions are universal
    if ( [S.NONE, S.SELF].includes(scope) ) return [];
    if ( S.ALL === scope ) return [D.FRIENDLY, D.NEUTRAL, D.HOSTILE];

    // Determine the Actor's disposition
    const disposition = this.actor.getActiveTokens(true, true)[0]?.disposition ?? this.actor.prototypeToken.disposition;

    // Hostile actors
    if ( disposition === D.HOSTILE ) {
      if ( S.ALLIES === scope ) return [D.HOSTILE];
      else return [D.FRIENDLY, D.NEUTRAL];
    }

    // Non-hostile actors
    if ( S.ALLIES === scope ) return [D.NEUTRAL, D.FRIENDLY];
    else return [D.HOSTILE];
  }

  /* -------------------------------------------- */

  /**
   * Pre-create the self actorUpdate and activation events before preActivate hooks run.
   * Drains any pre-accumulated usage.actorUpdates and usage.itemSnapshots into the events.
   */
  #initializeSelfEvents() {
    const actorUpdates = foundry.utils.expandObject(this.usage.actorUpdates);
    actorUpdates.items ??= [];
    const itemSnapshots = this.usage.itemSnapshots?.length ? this.usage.itemSnapshots : [];
    this.recordEvent({type: "actorUpdate", actorUpdates, itemSnapshots}, {start: true});
    this.recordEvent({type: "activation", resources: []}, {start: true});
  }

  /* -------------------------------------------- */

  /**
   * Finalize the pre-existing self events with actor status, activation costs, and summons.
   */
  #finalizeSelfEvents() {

    // Finalize actor status on the pre-existing actorUpdate event
    const updateEvent = this.selfUpdateEvent;
    updateEvent.actorUpdates.system ||= {};
    if ( updateEvent.actorUpdates.system.status ) {
      console.error(`Crucible | "system.status" key present in actorUpdate event: ${this.name}`);
    }
    updateEvent.actorUpdates.system.status = Object.assign(
      updateEvent.actorUpdates.system.status || {}, {lastAction: this.id},
      foundry.utils.expandObject(this.usage.actorStatus));

    // Finalize activation costs on the pre-existing activation event
    const activationEvent = this.selfEvents.activation;
    for ( const [k, v] of Object.entries(this.cost) ) {
      if ( v && (k in SYSTEM.RESOURCES) ) activationEvent.resources.push({resource: k, delta: -v});
    }

    // Record summons
    if ( Array.isArray(this.usage.summons) ) {
      for ( const summon of this.usage.summons ) {
        this.recordEvent({type: "summon", summon});
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Record effect events for each target in the event stream based on the action's defined effects.
   * Effects are attached to qualifying roll events where possible, or recorded as standalone effect events.
   * If action creates a non-ephemeral region, ensure at least one self-effect to record it.
   */
  #recordEffectEvents() {
    let regionEffectRequired = this.region
      && (SYSTEM.ACTION.TARGET_TYPES[this.target.type]?.region?.ephemeral === false);
    if ( !this.effects.length && !regionEffectRequired ) return;
    const eventsByActor = this.eventsByActor;
    for ( const [target, events] of eventsByActor ) {
      for ( const [i, effectData] of this.effects.entries() ) {
        const event = this.#getQualifyingEvent(target, events, eventsByActor, effectData);
        if ( !event ) continue;
        if ( regionEffectRequired && (target === this.actor) ) regionEffectRequired = false;
        const {_id, name, duration, statuses: origStatuses, system={}} = effectData;
        const statuses = new Set(origStatuses);

        // Prepare effect data
        const effect = {
          _id: _id || SYSTEM.EFFECTS.getEffectId(this.id, {suffix: String(i)}),
          name: name || this.name,
          description: this.description,
          img: this.img,
          origin: this.actor.uuid,
          duration,
          system
        };

        // Automatically configure damage-over-time statuses
        for ( const status of origStatuses ) {
          const fn = SYSTEM.EFFECTS[status];
          if ( typeof fn !== "function" ) continue;
          const statusEffect = fn(this.actor, {ability: this.scaling});
          if ( statusEffect.system?.dot && !effect.system.dot?.length ) effect.system.dot = statusEffect.system.dot;
          if ( statusEffect.statuses ) {
            for ( const s of statusEffect.statuses ) statuses.add(s);
          }
        }
        effect.statuses = Array.from(statuses);

        // Attach the effect to the qualifying event, or record a standalone effect event
        if ( event instanceof CrucibleActionEvent ) event.effects.push(effect);
        else this.recordEvent({type: "effect", target, effects: [effect]});
      }

      // If no self effect to track non-ephemeral region on, create one
      if ( regionEffectRequired && (target === this.actor) ) {
        this.recordEvent({type: "effect", target, effects: [{
          _id: SYSTEM.EFFECTS.getEffectId(this.gesture?.id ?? this.id),
          name: this.name,
          description: this.description,
          img: this.img,
          origin: this.actor.uuid,
          showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
          system: {}
        }]});
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify the qualifying CrucibleActionEvent which enables an ActionEffect to be applied.
   * Return true if the effect may be applied unconditionally, or false if qualifications are unmet.
   * @param {CrucibleActor} target              The target actor
   * @param {ActorEventGroup} events            The pre-classified event group for this target
   * @param {Map<CrucibleActor, ActorEventGroup>} eventsByActor  Full events-by-actor map
   * @param {ActionEffect} effectData           Effect data to consider
   * @returns {CrucibleActionEvent|true|false}
   */
  #getQualifyingEvent(target, events, eventsByActor, effectData) {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    const scope = effectData.scope ?? this.target.scope;
    const {type: resultType, all: resultAll} = effectData.result;

    // Eliminate conditions where the effect cannot apply
    if ( scope === scopes.NONE ) return false;
    if ( (scope === scopes.SELF) && !events.isSelf ) return false;
    if ( events.isSelf ) {
      const canAffectSelf = (scope === scopes.SELF) || (events.isTarget && (scope === scopes.ALL));
      if ( !canAffectSelf ) return false;
    }

    // Test the rolls for this target
    const result = CrucibleAction.#testEventResult(events.roll, resultType, resultAll);
    if ( result ) return result;

    // A SELF effect may still apply based on other targets' rolls if self has no immediate rolls
    if ( (scope === scopes.SELF) && !events.isTarget ) {
      for ( const [actor, otherEvents] of eventsByActor ) {
        if ( actor === target ) continue;
        const otherResult = CrucibleAction.#testEventResult(otherEvents.roll, resultType, resultAll);
        if ( otherResult ) return otherResult;
      }
    }
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Test whether an action effect should apply based on roll results in a set of events.
   * @param {CrucibleActionEvent[]} events      Events with rolls to test
   * @param {string} resultType                 The required result type
   * @param {boolean} resultAll                 Whether all rolls must match
   * @returns {CrucibleActionEvent|true|false}  The qualifying event, true for unconditional, or false for unmet
   */
  static #testEventResult(events, resultType, resultAll) {
    const hasRolls = events.length > 0;
    // Any result can be always applied
    if ( resultType === "any" ) return true;
    // Custom result types are never applied, for hooks only
    if ( resultType === "custom" ) return false;
    // If an "all" result is required, there must be rolls
    if ( resultAll && !hasRolls ) return false;
    // Special case: allow success (not "all") without rolls
    if ( (resultType === "success") && !resultAll && !hasRolls ) return true;

    // Define the test function for this result type
    const test = {
      success: r => r.isSuccess,
      successCritical: r => r.isCriticalSuccess,
      failure: r => r.isFailure,
      failureCritical: r => r.isCriticalFailure
    }[resultType];
    if ( !test ) return false;

    // All rolls must match: return the last event if all qualify
    if ( resultAll ) return events.every(e => test(e.roll)) ? events.at(-1) : false;

    // Any roll must match: return the first qualifying event
    return events.find(e => test(e.roll)) ?? false;
  }

  /* -------------------------------------------- */

  /**
   * Finalize the event stream by recording per-roll resource deltas and critical flags.
   * Called after all postActivate hooks have had a chance to modify roll data.
   * Allocate resource changes using {@link CrucibleBaseActor#allocateResourceChange}, constraining damage to the
   * state of resource pools, allowing for accurate reversal.
   */
  #finalizeEvents() {
    const allocations = new Map();
    for ( const event of this.events ) {
      if ( !event.roll ) continue;
      if ( event.roll.isCriticalSuccess ) event.isCriticalSuccess = true;
      else if ( event.roll.isCriticalFailure ) event.isCriticalFailure = true;

      // Allocate resource changes
      const damage = event.roll.data.damage || {};
      const resource = damage.resource ?? "health";
      const cfg = SYSTEM.RESOURCES[resource];
      const amount = (damage.total ?? 0) * (damage.restoration ? 1 : -1) * (cfg.type === "reserve" ? -1 : 1);
      if ( !amount ) continue;

      // Allocate without specific system target (in theory should not happen?)
      if ( !event.target?.system ) {
        event.resources.push({resource, delta: amount});
        continue;
      }

      // Allocate to specific Actor per system type
      if ( !allocations.has(event.target) ) allocations.set(event.target, {});
      const allocation = allocations.get(event.target);
      const deltas = event.target.system.allocateResourceChange(amount, resource, allocation);
      for ( const [r, delta] of Object.entries(deltas) ) event.resources.push({resource: r, delta});
    }
  }

  /* -------------------------------------------- */

  /**
   * Compute the amount of damage dealt by a certain action
   * @param {DamageData} damage     The component details of the damage dealt
   * @returns {number}              The total damage dealt
   */
  static computeDamage({overflow=1, multiplier=1, base=0, bonus=0, resistance=0, restoration=false}={}) {

    // Compute damage before any mitigation
    if ( overflow < 0 ) multiplier = Math.max(multiplier, 1); // You cannot have an increased multiplier on misses
    const preMitigation = (overflow * multiplier) + base + bonus;
    if ( preMitigation <= 0 ) return 0; // If the pre-mitigation amount did no damage, not increased by vulnerability

    // Resistance and Vulnerability does not apply to Restoration
    const postMitigation = restoration ? preMitigation : preMitigation - resistance;

    // Constrain total damage between 0 and 2x the pre-mitigation value
    return Math.clamp(postMitigation, 0, 2 * preMitigation);
  }

  /* -------------------------------------------- */

  /**
   * Get all equipped weapons which fulfil the requirements for this action, optionally excluding those which are
   * valid generally, but are not currently due to a lack of resource or being unloaded
   * @param {object} [options]              Additional options
   * @param {boolean} [options.strict]      Whether to filter out invalid items or only mark them invalid
   * @param {number|null} [options.maxCost] If provided, consider weapons with greater action cost invalid
   * @returns {{item: CrucibleWeaponItem, label: string, id: string, isValid: boolean}[]}
   */
  getValidWeaponChoices({strict=false, maxCost=null}={}) {
    const choices = [];
    if ( !["strike", "reload"].some(t => this.tags.has(t)) ) return choices;
    const {mainhand: mh, offhand: oh, natural} = this.actor.equipment.weapons;

    // Identify weapons using the union of _source tags and current tags to account for tag removal during configuration
    const hasMelee = this._source.tags.includes("melee") || this.tags.has("melee");
    const hasRanged = this._source.tags.includes("ranged") || this.tags.has("ranged");
    const isValidChoice = weapon => {
      let available = true;
      let eligible = true;
      if ( weapon.config.category.reload ) {
        available = this.tags.has("reload") ? weapon.system.needsReload : !weapon.system.needsReload;
      } else if ( this.tags.has("reload") ) eligible = false;
      if ( maxCost !== null ) available &&= (weapon.system.actionCost <= maxCost);
      if ( this.tags.has("talisman") && !["talisman1", "talisman2"].includes(weapon.system.category)) eligible = false;

      // Any strike that's neither melee nor ranged shouldn't hard-disqualify weapons based on melee/ranged
      if ( hasRanged || hasMelee ) {
        eligible &&= (hasRanged || !weapon.config.category.ranged);
        eligible &&= (hasMelee || weapon.config.category.ranged);
      }
      return {available, eligible};
    };
    const isNatural = this.tags.has("natural");
    if ( mh && !isNatural ) {
      const {available, eligible} = isValidChoice(mh);
      if ( eligible && (!strict || available) ) choices.push({
        item: mh,
        id: mh.id || "mainhandUnarmed",
        label: `${mh.name} (${SYSTEM.WEAPON.SLOTS.labels.MAINHAND})`,
        isValid: available
      });
    }
    if ( oh && !isNatural ) {
      const {available, eligible} = isValidChoice(oh);
      if ( eligible && (!strict || available) ) choices.push({
        item: oh,
        id: oh.id || "offhandUnarmed",
        label: `${oh.name} (${SYSTEM.WEAPON.SLOTS.labels.OFFHAND})`,
        isValid: available
      });
    }
    if ( !hasRanged ) {
      for ( const n of natural ) {
        const isValid = (maxCost !== null) ? (n.system.actionCost <= maxCost) : true;
        if ( strict && !isValid ) continue;
        choices.push({
          item: n,
          id: n.id,
          label: `${n.name} (${SYSTEM.WEAPON.PROPERTIES.natural.label})`,
          isValid
        });
      }
    }
    return choices;
  }

  /* -------------------------------------------- */
  /*  Action Lifecycle Methods                    */
  /* -------------------------------------------- */

  /**
   * A generator which provides the test conditions for action lifecycle.
   * @yields {Record<string, function>}
   * @protected
   */
  * _tests() {
    yield* this.tags.tags();
    yield this.hooks;
  }

  /* -------------------------------------------- */

  /**
   * Configure aspects of action usage before the action is prepared.
   * @protected
   */
  _configureUsage() {
    this.usage.hasDice = false; // Actions don't involve a roll unless otherwise configured

    // Reset cost fields to their source values so that repeated prepare() calls do not accumulate costs
    const sc = this._source.cost;
    this.cost.action = sc.action;
    this.cost.focus = sc.focus;
    this.cost.heroism = sc.heroism;
    this.cost.hands = sc.hands;

    // Configure tags
    if ( this.target.type === "movement" ) this.tags.add("movement");

    // Configure bonuses
    this.usage.bonuses.ability = this.actor.getAbilityBonus(this.scaling);
    this.usage.bonuses.skill = this.actor.getSkillBonus(this.training);

    // Call configuration hooks
    for ( const test of this._tests() ) {
      if ( test.initialize instanceof Function ) {
        try {
          test.initialize.call(this);
        } catch(err) {
          console.error(new Error(`Failed initialize hook for Action "${this.id}"`, {cause: err}));
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Preparation, the first step in the Action life-cycle.
   * @protected
   */
  _prepare() {

    // Global preparation rules
    if ( this.actor.statuses.has("disoriented") && this.cost.focus ) this.cost.focus += 1;

    // Action-specific preparation
    for ( const test of this._tests() ) {
      if ( test.prepare instanceof Function ) {
        try {
          test.prepare.call(this);
        } catch(err) {
          console.error(new Error(`Failed prepare hook for Action "${this.id}"`, {cause: err}));
        }
      }
    }
    this.actor?.callActorHooks("prepareAction", this);

    // Dedupe ability scaling
    const scaling = new Set(this.scaling);
    this.scaling.length = 0;
    this.scaling.push(...scaling);
  }

  /* -------------------------------------------- */

  /**
   * Test whether an action can be performed before it has been fully configured.
   * This test should provide an early rejection that prevents the configuration dialog from being presented.
   * This test can only rely on initially known tags, for example preventing a reaction from occurring on your own turn.
   * @throws {Error}                          An error if the action cannot be taken
   * @protected
   */
  _canUse() {
    const r = this.actor.system.resources;
    const statuses = this.actor.statuses;

    // Cannot spend action
    if ( this.cost.action && this.actor.isIncapacitated ) {
      throw new Error(_loc("ACTION.WARNINGS.CannotSpendAction", {
        name: this.actor.name
      }));
    }

    // Cannot spend focus
    if ( this.cost.focus ) {
      let focusBlock = "";
      const allowEnragedFocus = this.actor.talentIds.has("iramancer0000000") || this.tags.has("strike");
      if ( statuses.has("broken") ) focusBlock = "broken";
      else if ( statuses.has("enraged") && !allowEnragedFocus ) focusBlock = "enraged";
      if ( focusBlock ) throw new Error(_loc("ACTION.WARNINGS.CannotSpendFocus", {
        name: this.actor.name,
        status: _loc(`ACTIVE_EFFECT.STATUSES.${focusBlock.titleCase()}`)
      }));
    }

    // Cannot afford action cost
    if ( this.cost.action > r.action.value ) {
      throw new Error(_loc("ACTION.WARNINGS.CannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.action.label,
        action: this.name
      }));
    }

    // Cannot afford focus cost
    if ( this.cost.focus > r.focus.value ) {
      throw new Error(_loc("ACTION.WARNINGS.CannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.focus.label,
        action: this.name
      }));
    }

    // Cannot afford heroism cost
    if ( this.cost.heroism > r.heroism.value ) {
      throw new Error(_loc("ACTION.WARNINGS.CannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.heroism.label,
        action: this.name
      }));
    }

    // Cannot afford hands cost
    if ( this.cost.hands > this.usage.availableHands ) {
      const plurals = new Intl.PluralRules(game.i18n.lang);
      const error = this.tags.has("spell") ? "SPELL.WARNINGS.CannotAffordHands" : "ACTION.WARNINGS.CannotAffordHands";
      throw new Error(_loc(`${error}.${plurals.select(this.cost.hands)}`, {
        name: this.actor.name,
        hands: this.cost.hands,
        action: this.name
      }));
    }

    // Cannot use physical scaling
    if ( !this.actor.abilities.strength.value && this.scaling.length && this.scaling.every(s => ["strength", "toughness", "dexterity"].includes(s)) ) {
      throw new Error(_loc("ACTION.WARNINGS.NoAbility", {
        actor: this.actor.name,
        ability: SYSTEM.ABILITIES.strength.label,
        action: this.name
      }));
    }

    // Cannot use mental scaling
    if ( !this.actor.abilities.wisdom.value && this.scaling.length && this.scaling.every(s => ["wisdom", "presence", "intellect"].includes(s)) ) {
      throw new Error(_loc("ACTION.WARNINGS.NoAbility", {
        actor: this.actor.name,
        ability: SYSTEM.ABILITIES.wisdom.label,
        action: this.name
      }));
    }

    // Test each action tag
    for ( const test of this._tests() ) {
      if ( !(test.canUse instanceof Function) ) continue;
      let errorReason;
      let blocked = false;
      let errorOptions = {};
      try {
        const can = test.canUse.call(this);
        if ( can === false ) {
          blocked = true;
          if ( test.label ) errorReason = `with tag ${test.label}`;
        }
      } catch(err) {
        blocked = true;
        errorReason = err.message;
        errorOptions = {cause: err};
      }
      if ( blocked ) {
        const key = errorReason ? "ACTION.WARNINGS.CannotUseReason" : "ACTION.WARNINGS.CannotUse";
        throw new Error(_loc(key, {
          name: this.actor.name,
          action: this.name,
          reason: errorReason
        }, errorOptions));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Should this Action be displayed on a character sheet as available for use?
   * @returns {boolean}                 Should the action be displayed?
   * @internal
   */
  _displayOnSheet() {
    try {
      for ( const test of this._tests() ) {
        if ( !(test.canUse instanceof Function) ) continue;
        if ( test.canUse.call(this) === false ) return false;
      }
    } catch(err) {
      return false;
    }
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Pre-activation steps which happen after dialog configuration of the action but before the action is evaluated.
   * This could be used to mutate the array of targets which are affected by the action.
   *
   * This is also the ideal lifecycle event within which to throw an error which prevents action usage conditional
   * on the selected array of targets.
   *
   * @throws {Error}                          An error which prevents action activation
   * @protected
   */
  async _preActivate() {
    for ( const test of this._tests() ) {
      if ( test.preActivate instanceof Function ) await test.preActivate.call(this);
    }
    this.actor.callActorHooks("preActivateAction", this);
    this._canUse();
  }

  /* -------------------------------------------- */

  /**
   * Handle execution of dice rolls associated with the Action.
   * Tag and hook roll methods create events directly via recordEvent.
   * @param {CrucibleActor} target        The target actor for this roll sequence
   * @param {CrucibleToken} [token]       The target's token document
   * @protected
   */
  async _roll(target, token) {
    for ( const test of this._tests() ) {
      if ( test.roll instanceof Function ) {
        await test.roll.call(this, target, token);
      }
    }
    this.actor.callActorHooks("rollAction", this, target, token);
  }

  /* -------------------------------------------- */

  /**
   * Handle post-roll modification of the event stream.
   * Each hook receives the full action context via `this` and can access the event stream, eventsByTarget, etc.
   * @returns {Promise<void>}
   * @protected
   */
  async _post() {
    for ( const test of this._tests() ) {
      if ( test.postActivate instanceof Function ) {
        await test.postActivate.call(this);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Confirm an action, enacting its event stream to apply Actor changes, create ActiveEffects, or manage
   * RegionDocuments. Action confirmation happens after ChatMessage persistence and after the action has been
   * recreated via `CrucibleAction.fromChatMessage`.
   * @param {object} [options]                  Options which affect the confirmation workflow
   * @param {boolean} [options.reverse]           Reverse the action instead of applying it?
   * @returns {Promise<boolean>}                false if not actually confirmed/reversed, otherwise true
   */
  async confirm({reverse=false}={}) {
    if ( !this._prepared ) throw new Error("A CrucibleAction must be prepared for an Actor before it can be confirmed.");
    if ( !this.events.length ) throw new Error(`Cannot confirm Action ${this.id} which has no recorded events.`);

    // Custom Action confirmation steps
    for ( const test of this._tests() ) {
      if ( !(test.confirm instanceof Function) ) continue;
      try {
        await test.confirm.call(this, reverse);
      } catch(err) {
        console.error(new Error(`"${this.id}" action confirmation failed`, {cause: err}));
        return false;
      }
    }
    const isNegated = this.message?.getFlag("crucible", "isNegated");

    // Update or remove the placed region on confirmation
    if ( this.region ) {
      const isEphemeral = SYSTEM.ACTION.TARGET_TYPES[this.target.type]?.region?.ephemeral;
      if ( isEphemeral ) await this.region.delete();
      else if ( !isNegated ) {
        const regionEffect = this.selfEvents.all.find(e => e.effects.length).effects[0];
        regionEffect.system.regions ??= [];
        regionEffect.system.regions.push(this.region.uuid);
        await this.region.update({visibility: CONST.REGION_VISIBILITY[reverse ? "OBSERVER" : "ALWAYS"]});
      }
    }

    // Additional Actor-specific consequences when the action deals damage to a target
    if ( !isNegated && this.events.some(e => (e.target !== this.actor) && e.isDamage) ) {
      this.actor._onDealDamage(this);
    }

    // Per-target confirmation hooks
    for ( const actor of this.eventsByActor.keys() ) actor.callActorHooks("confirmAction", this, {reverse});

    // Apply action events
    await this.#applyEvents({reverse, isNegated});

    // Record heroism
    try {
      await this.#recordHeroism(reverse);
    } catch(err) {
      console.error(new Error(`Failed to record Heroism from Action "${this.id}"`, {cause: err}));
    }

    // Mark the message as confirmed (or unconfirmed)
    await this.message?.update({flags: {crucible: {confirmed: !reverse}}});
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Apply the action's event stream to target actors.
   * Iterates events once, staging per-actor batches, then commits each batch in a single operation.
   * @param {object} options
   * @param {boolean} options.reverse         Reverse the action instead of applying it?
   * @param {boolean} options.isNegated       Was the action negated (e.g. by counterspell)?
   */
  async #applyEvents({reverse, isNegated}) {

    // Stage per-actor batches from the event stream
    const batches = new Map();
    for ( const event of this.events ) {
      const actor = event.target;
      if ( !batches.has(actor) ) batches.set(actor, {
        resources: {}, effects: [], actorUpdates: {}, itemSnapshots: [], statusText: []
      });
      const batch = batches.get(actor);
      const isSelf = actor === this.actor;

      // Accumulate resources
      for ( const {resource, delta} of event.resources ) {
        // When negated, only preserve self-costs from activation events
        if ( isNegated ) {
          if ( (event.type === "activation") && isSelf ) {
            batch.resources[resource] ??= 0;
            batch.resources[resource] += delta;
          }
          continue;
        }
        batch.resources[resource] ??= 0;
        batch.resources[resource] += delta;
      }

      // Accumulate effects (skip if negated)
      if ( !isNegated && event.effects.length ) batch.effects.push(...event.effects);

      // Accumulate actor updates
      if ( event.actorUpdates ) foundry.utils.mergeObject(batch.actorUpdates, event.actorUpdates);

      // Accumulate item snapshots
      if ( event.itemSnapshots ) batch.itemSnapshots.push(...event.itemSnapshots);

      // Accumulate status text
      if ( event.statusText ) batch.statusText.push(...event.statusText);
    }

    // Apply each actor's batch
    for ( const [actor, batch] of batches ) {
      if ( reverse && batch.itemSnapshots.length ) this.#reverseItemSnapshots(batch);
      const statusText = batch.statusText.length ? batch.statusText : undefined;
      await actor.alterResources(batch.resources, batch.actorUpdates, {reverse, statusText});
      if ( batch.effects.length ) await actor._applyActionEffects(batch.effects, reverse);
    }
  }

  /* -------------------------------------------- */

  /**
   * Replace forward item changes in a batch with pre-action snapshots for reversal.
   * Snapshots are iterated in reverse order so the oldest snapshot per item wins.
   * Snapshot entries replace any forward change with the same _id. Other item changes are preserved.
   * @param {object} batch    The per-actor batch being applied
   */
  #reverseItemSnapshots(batch) {
    const restorations = new Map();
    for ( let i=batch.itemSnapshots.length-1; i>=0; i-- ) {
      const snap = batch.itemSnapshots[i];
      restorations.set(snap._id, snap);
    }
    const items = batch.actorUpdates.items ??= [];
    for ( const [i, {_id}] of items.entries() ) {
      if ( restorations.has(_id) ) {
        items[i] = restorations.get(_id);
        restorations.delete(_id);
      }
    }
    items.push(...Array.from(restorations.values()));
  }

  /* -------------------------------------------- */

  /**
   * Record actions which generate heroism.
   * @param {boolean} reverse
   */
  async #recordHeroism(reverse) {
    if ( !this.#canGenerateHeroism() ) return;
    const h = game.combat.system.heroism;
    const delta = this.cost.action * (reverse ? -1 : 1);
    const actions = h.actions + delta;

    // Update Combat
    const combatUpdate = {system: {heroism: {actions}}};
    let award = 0;
    if ( (actions >= h.next) && (actions > h.awarded) ) {
      combatUpdate.system.heroism.awarded = actions;
      award = 1;
    }
    else if ( (actions < h.previous) && (actions < h.awarded) ) {
      combatUpdate.system.heroism.awarded = actions;
      award = -1;
    }
    await game.combat.update(combatUpdate);

    // Award Heroism
    if ( award === 0 ) return;
    for ( const {actor} of game.combat.combatants ) {
      const maxH = actor.system.resources?.heroism?.max || 0;
      if ( maxH > 0 ) await actor.alterResources({heroism: award});
    }
  }

  /* -------------------------------------------- */

  /**
   * Can this Action generate heroism?
   * @returns {boolean}
   */
  #canGenerateHeroism() {
    if ( !this.actor.inCombat ) return false;
    if ( !this.actor.abilities.wisdom.value ) return false;
    const isRestoration = !!this.damage?.restoration;
    for ( const event of this.events ) {
      if ( event.target === this.actor ) continue;
      if ( event.effects.length ) return true;
      if ( isRestoration && event.isHealing ) return true;
      else if ( !isRestoration && event.isDamage ) return true;
    }
    return false;
  }

  /* -------------------------------------------- */
  /*  VFX Integration                             */
  /* -------------------------------------------- */

  /**
   * Configure a VFXEffect instance for this Action.
   * @returns {foundry.canvas.vfx.VFXEffect|null}
   */
  // TODO re-enable VFX after migrating strikes.mjs to use action.events instead of action.outcomes
  configureVFXEffect() {
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Construct and play a configured VFXEffect on every client after the Action is confirmed.
   * @param {foundry.canvas.vfx.VFXEffectData} vfxConfig
   * @param {Record<string, any>} references
   * @returns {Promise<void>}
   */
  async playVFXEffect(vfxConfig, references) {
    if ( !this.token?.parent.isView ) return;

    // Construct the VFXEffect instance
    let vfxEffect;
    try {
      vfxEffect = new foundry.canvas.vfx.VFXEffect(vfxConfig);
    } catch(cause) {
      console.warn(new Error(`Failed to construct provided Action VFX config for Action "${this.id}"`));
      return;
    }

    // Always include the action actor and token
    references.actor ??= this.actor;
    references.token ??= this.token;

    // Pass 1 - resolve UUID references that start with @
    for ( const [k, v] of Object.entries(references) ) {
      if ( (typeof v === "string") && (v[0] === "@") ) {
        references[k] = fromUuidSync(v.slice(1));
      }
    }

    // Pass 2 - resolve indirect references that start with ^
    for ( const [k, v] of Object.entries(references) ) {
      if ( (typeof v === "string") && (v[0] === "^") ) {
        references[k] = foundry.utils.getProperty(references, v.slice(1)) ?? null;
      }
    }

    // Play the effect
    return vfxEffect.play(references);
  }

  /* -------------------------------------------- */
  /*  Display and Formatting Methods              */
  /* -------------------------------------------- */

  /**
   * Does this Action require a weapon to be chosen before it can be used?
   * @returns {boolean}
   */
  get allowWeaponChoice() {
    if ( !this.actor ) return false;
    const original = this.actor.actions[this.id];
    if ( !original ) return false;
    const {cost, tags} = original._source;
    if ( !(cost.weapon || tags.includes("reload")) ) return false;
    if ( ["mainhand", "offhand", "twohand"].some(t => tags.includes(t)) ) return false;
    return this.actor?.equipment.weapons.hasChoice;
  }

  /* -------------------------------------------- */

  /**
   * Obtain an object of tags which describe the Action.
   * @returns {ActionTags}
   */
  getTags() {
    const tags = {
      activation: new ActionTagGroup({icon: "fa-solid fa-banner", tooltip: _loc("ACTION.TAGS.Activation")}),
      action: new ActionTagGroup({icon: "fa-solid fa-lightning-bolt", tooltip: _loc("ACTION.TAGS.Action")}),
      context: new ActionTagGroup({icon: "fa-solid fa-bullseye", tooltip: _loc("ACTION.TAGS.Context")})
    };

    // Action Tags
    for ( const t of this.tags ) {
      const tag = SYSTEM.ACTION.TAGS[t];
      if ( tag.internal ) continue;
      else tags.action[tag.tag] = _loc(tag.label);
    }

    // Context Tags
    const ctx = this.usage.context;
    tags.context = new ActionTagGroup({icon: ctx.icon || "fa-solid fa-bullseye", tooltip: ctx.label || _loc("ACTION.TAGS.Context")});
    for ( const [k, v] of Object.entries(ctx.tags) ) {
      tags.context[k] = v;
    }

    // Target
    if ( this.target.type !== "none" ) {
      const parts = [SYSTEM.ACTION.TARGET_TYPES[this.target.type].label];
      if ( this.target.number > 1 ) parts.unshift(`${this.target.number}x`);
      if ( this.range.maximum ) {
        let r = this.range.maximum;
        if ( this.range.weapon && !this.actor ) r = `+${r}`;
        parts.push(r);
      }
      if ( this.target.limit > 0 ) parts.push(_loc("ACTION.TAGS.TargetLimit", {limit: this.target.limit}));
      if ( this.target.multiple > 1 ) parts.push(`x${this.target.multiple}`);
      tags.activation.target = parts.join(" ");
    }

    // Cost
    const cost = this._trueCost || this.cost;
    const ap = cost.action ?? 0;
    if ( this.cost.weapon && !this.usage.strikes?.length ) { // Strike sequence not yet determined
      if ( ap === 0 ) tags.activation.ap = _loc("ACTION.TAG.CostWeapon");
      else tags.activation.ap = _loc("ACTION.TAG.CostWeaponAction", {action: ap.signedString()});
    }
    else tags.activation.ap = _loc("ACTION.TAG.CostAction", {action: ap});
    if ( ap ) {
      const unmet = ap > this.actor?.resources.action.value;
      const label = tags.activation.ap;
      tags.activation.ap = {label, unmet};
    }
    if ( Number.isFinite(cost.focus) && (cost.focus !== 0) ) {
      const unmet = cost.focus > this.actor?.resources.focus.value;
      const label = _loc("ACTION.TAG.CostFocus", {focus: cost.focus});
      tags.activation.fp = {label, unmet};
    }
    if ( Number.isFinite(cost.heroism) && cost.heroism ) {
      const unmet = cost.heroism > this.actor?.resources.heroism.value;
      const label = _loc("ACTION.TAG.CostHeroism", {heroism: cost.heroism});
      tags.activation.hp = {label, unmet};
    }
    if ( Number.isFinite(cost.health) && (cost.health !== 0) ) {
      const unmet = cost.health > this.actor?.resources.health.value; // Blood Magic, for example
      const label = _loc("ACTION.TAG.CostHealth", {health: cost.health});
      tags.activation.health = {label, unmet};
    }
    if ( !(tags.activation.ap || tags.activation.fp || tags.activation.hp || tags.activation.health) ) tags.activation.ap = "Free";
    if ( cost.hands ) {
      const unmet = cost.hands > this.usage.availableHands;
      const plurals = new Intl.PluralRules(game.i18n.lang);
      const label = _loc(`ACTION.TAG.CostHand.${plurals.select(cost.hands)}`, {hands: cost.hands});
      tags.activation.hands = {label, unmet};
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Render this Action as HTML for a tooltip card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    await foundry.applications.handlebars.loadTemplates([this.constructor.TOOLTIP_TEMPLATE]);
    const descriptionHTML = await CONFIG.ux.TextEditor.enrichHTML(this.description, {relativeTo: this});
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      action: this,
      descriptionHTML,
      tags: this.getTags()
    });
  }

  /* -------------------------------------------- */

  /**
   * Create the ChatMessageData object to be used for an action's chat message creation
   * @param {ActionUseTarget[]} targets   Targets affected by this action usage
   * @param {object} options              Context options for ChatMessage creation
   * @param {boolean} options.confirmed   Was the action auto-confirmed?
   * @returns {Promise<ChatMessageData>}
   * @protected
   */
  async _prepareMessage({confirmed}={}) {

    // Prepare action data
    const actionData = {
      actor: this.actor.uuid,
      action: this.toObject(false), // Finalized action data rather than source
      confirmed
    };
    if ( this.item ) actionData.item = this.item.uuid;
    if ( this.movement ) actionData.movement = this.movement.id;
    if ( this.region?.persisted ) actionData.region = this.region.uuid;
    if ( this.token ) actionData.token = this.token.uuid;
    if ( this.targets ) actionData.targets = Array.from(this.targets).map(([actor, t]) => {
      return {actor: actor.uuid, token: t.token?.uuid ?? null};
    });
    actionData.vfxConfig = this.configureVFXEffect();
    if ( !foundry.utils.isEmpty(this.metadata) ) actionData.metadata = this.metadata;

    // Collect rolls from the event stream and assign indices for serialization
    const rolls = [];
    const targetActors = new Set();
    for ( const event of this.events ) {
      if ( !event.roll ) continue;
      const isNewTarget = !targetActors.has(event.target);
      if ( isNewTarget ) targetActors.add(event.target);
      event.roll.data.newTarget = isNewTarget && (this.eventsByTarget.size > 1);
      event.roll.data.index = rolls.length;
      rolls.push(event.roll);
    }

    // Serialize the canonical event stream (roll.data.index was assigned above)
    actionData.events = this.#serializeEvents();

    // Derive target list for chat message rendering
    let targets;
    if ( this.target.type === "summon" ) {
      targets = (this.usage.summons || []).map(({actorUuid}) => ({
        uuid: actorUuid,
        name: fromUuidSync(actorUuid).name ?? "Unknown"
      }));
    }
    else targets = Array.from(this.targets?.values() ?? []);

    // Render HTML template
    const tags = this.getTags();
    const templatePath = "systems/crucible/templates/dice/action-use-chat.hbs";
    const descriptionHTML = await CONFIG.ux.TextEditor.enrichHTML(this.description, {relativeTo: this});
    let content = await foundry.applications.handlebars.renderTemplate(templatePath, {
      action: this,
      actor: this.actor,
      context: this.usage.context,
      descriptionHTML,
      hasActionTags: !tags.action.empty,
      hasContextTags: !tags.context.empty,
      hasTargetTags: (targets.length === 1) || (targets.length && !this.eventsByTarget.values().some(e => e.roll)),
      hasTargets: !["self", "none"].includes(this.target.type),
      tags,
      targets,
      region: this.region
    });

    // Allow action hooks to manipulate message content via the DOM. The element is parsed lazily on first
    // registered hook, and serialized back out only if it was parsed.
    let element = null;
    for ( const test of this._tests() ) {
      if ( !(test.prepareMessage instanceof Function) ) continue;
      element ??= foundry.utils.parseHTML(content);
      await test.prepareMessage.call(this, element);
    }
    if ( element ) content = element.outerHTML;

    // Return message data
    return {
      content,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      rolls: rolls,
      flags: {crucible: actionData}
    };
  }

  /* -------------------------------------------- */

  /**
   * Serialize the event stream for inclusion in chat message flags.
   * Converts live document references to UUIDs and Roll instances to message-level roll indices.
   * Must be called after roll.data.index values have been assigned by _prepareMessage.
   * @returns {object[]}    The serialized events array
   */
  #serializeEvents() {
    return this.events.map(event => event.toObject());
  }

  /* -------------------------------------------- */

  /**
   * Deserialize the event stream from chat message flags.
   * Converts UUID strings back to live document references and reconnects Roll instances from the message.
   * @param {object[]} serializedEvents   The serialized events from flags.crucible.events
   * @param {ChatMessage} message         The ChatMessage containing the roll instances
   */
  #deserializeEvents(serializedEvents, message) {
    if ( !serializedEvents?.length ) return;
    for ( const data of serializedEvents ) {
      this.events.push(CrucibleActionEvent.fromObject(data, this, message));
    }
  }

  /* -------------------------------------------- */

  /**
   * Render the action to a chat message including contained rolls and results
   * @param {ActionUseTarget[]} targets           Targets affected by this action usage
   * @param {object} options                      Context options for ChatMessage creation
   * @param {boolean} [options.confirmed]           Was the action auto-confirmed?
   * @returns {Promise<ChatMessage>}              The created ChatMessage document
   */
  async toMessage(options={}) {
    const messageData = await this._prepareMessage(options);
    return ChatMessage.create(messageData, options);
  }

  /* -------------------------------------------- */

  /**
   * Confirm the result of an Action that was recorded as a ChatMessage.
   * @param {CrucibleChatMessage} message
   * @param {object} options
   * @param {CrucibleAction} [options.action]
   * @param {boolean} [options.reverse=false]
   */
  static async confirmMessage(message, {action, reverse=false}={}) {
    action ||= this.fromChatMessage(message);
    await action.confirm({reverse});
  }

  /* -------------------------------------------- */

  /**
   * Reconstitute an Action from a ChatMessage which contains it.
   * The reconstituted Action is constructed lazily and has not been prepared for a particular Actor.
   * @param {ChatMessage} message     The ChatMessage instance containing a used Action
   * @returns {CrucibleAction|null}   The reconstituted Action instance
   */
  static fromChatMessage(message) {
    const {
      actor: actorUuid,
      item: itemUuid,
      movement: movementId,
      token: tokenUuid,
      action: actionData,
      metadata,
      region: regionUuid,
      events: serializedEvents,
      targets: serializedTargets
    } = message.flags.crucible || {};
    if ( !actionData ) throw new Error(`ChatMessage ${message.id} does not contain CrucibleAction data`);

    // Reference linked documents
    const actor = fromUuidSync(actorUuid) || ChatMessage.getSpeakerActor(message.speaker);
    const item = fromUuidSync(itemUuid);
    const token = fromUuidSync(tokenUuid);
    const region = fromUuidSync(regionUuid);

    // Rebuild movement data for the action
    let movement = null;
    if ( movementId && token ) {
      let waypoints;
      let origin;
      if ( token.movement?.id === movementId ) {  // Use most recent movement data
        const m = token.movement;
        waypoints = [...(m.passed.waypoints ?? []), ...(m.pending.waypoints ?? [])];
        origin = m.origin;
      }

      // Reconstruct movement data from history
      // Unfortunately requires double iteration, first to find the subpathId then to reconstruct it
      // The movement origin is the last waypoint prior to this movement, unless this is the first movement
      else {
        const subpathId = token.movementHistory.find(w => w.movementId === movementId)?.subpathId;
        let firstIdx;
        waypoints = token.movementHistory.filter((w, i) => {
          if ( w.subpathId === subpathId ) {
            firstIdx ??= i;
            return true;
          }
          return false;
        });
        origin = token.movementHistory[firstIdx - 1] || waypoints[0];
      }
      if ( waypoints.length ) {
        const movementCost = waypoints.reduce((t, w) => t + (w.cost ?? 0), 0);
        // FIXME we have a design problem here, there could be multiple movementIds in the waypoints for a subpath
        movement = /** @type {CrucibleActionMovement} */ {id: movementId, origin, waypoints, cost: movementCost};
      }
    }

    // Rebuild action from explicit data
    const actionId = actionData.id;
    const actionContext = {parent: item?.system, actor, item, token, region, movement, message, metadata, lazy: true};
    let action;
    if ( actionId in actor.actions ) action = actor.actions[actionId].clone({}, actionContext);
    else if ( actionId.startsWith("spell.") ) {
      action = new game.system.api.models.CrucibleSpellAction(actionData, actionContext);
    }
    else action = new this(actionData, actionContext);
    action.prepare();

    // Reconstruct targets and the canonical event stream
    if ( serializedTargets ) {
      action.targets = new Map(serializedTargets.map(t => {
        const actor = fromUuidSync(t.actor);
        const token = t.token ? fromUuidSync(t.token) : null;
        return [actor, {actor, token, name: actor.name, uuid: actor.uuid}];
      }));
    }
    action.#deserializeEvents(serializedEvents, message);
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Handle cleanup when a chat message representing an action is deleted.
   * @param {ChatMessage} message     The ChatMessage document that will be deleted
   * @param {object} _options         Options which modify message deletion
   * @param {string} _userId          The ID of the deleting user
   * @returns {Promise<void>}
   */
  static async onDeleteChatMessage(message, _options, _userId) {
    const regionUuid = message.flags.crucible?.region;
    const region = await fromUuid(regionUuid);
    if ( region ) await region.delete();
  }

  /* -------------------------------------------- */

  /**
   * Create an environmental hazard action.
   * @param {CrucibleActor} actor
   * @param {object} [options={}]
   * @param {object} [options.actionData]
   * @param {string[]} [options.tags]
   * @param {number} [options.hazard=0]
   * @returns {CrucibleAction}
   */
  static createHazard(actor, {hazard=0, tags, ...actionData}={}) {
    actor ||= new Actor.implementation({name: "Environment", type: "adversary"});
    tags = Array.isArray(tags) ? tags : [];
    tags.unshift("hazard");
    return new this({
      id: "environmentAttack",
      name: "Environmental Hazard",
      img: "icons/skills/wounds/injury-body-pain-gray.webp",
      description: "",
      target: {type: "single", scope: 4, self: true},
      ...actionData,
      tags
    }, {actor, usage: {hazard}});
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @override */
  static migrateData(source) {
    for ( const effect of source.effects ?? [] ) {
      foundry.documents.ActiveEffect.migrateData(effect);
    }
    return source;
  }
}

/* -------------------------------------------- */

/**
 * An object used to represent a set of tags.
 */
class ActionTagGroup {
  constructor({icon, tooltip}) {
    Object.defineProperties(this, {
      icon: {value: icon, enumerable: false},
      tooltip: {value: tooltip, enumerable: false}
    });
  }

  get empty() {
    return !Object.keys(this).length;
  }
}
