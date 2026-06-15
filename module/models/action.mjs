import StandardCheck from "../dice/standard-check.mjs";
import ActionUseDialog from "../dice/action-use-dialog.mjs";
import CrucibleActionConfig from "../applications/config/action-config.mjs";

/**
 * @import {DataModelConstructionContext} from "@common/abstract/_types.mjs"
 * @import {CrucibleItemSnapshot} from "../documents/item.mjs"
 * @import {ScrollingTextEvent} from "../documents/actor.mjs"
 */

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
 * @property {string[]} [excludeTokens]     Specific token ids exempt from this action's movement collision
 * @property {(token: Token) => boolean} [excludeTokenTest]  A predicate marking tokens exempt from this action's
 *                                          movement collision, evaluated lazily on near-path candidates (e.g. by Size)
 * @property {number} [strength]            This movement's strength from {@link MOVEMENT_STRENGTHS}; it passes through
 *                                          any blocker whose blockerStrength it strictly exceeds (default NONE)
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
 * A single resource change recorded on a {@link CrucibleActionEvent}.
 * @typedef ActionResourceDelta
 * @property {string} resource          The resource identifier in {@link SYSTEM.RESOURCES}
 * @property {number} delta             The signed change to the resource pool (negative for damage or cost)
 * @property {boolean} [restoration]    Whether this change is restorative (healing) rather than damage
 * @property {string} [damageType]      The damage type responsible for this change, if any (see GH #1204)
 */

/**
 * @typedef {("activation"|"strike"|"spell"|"check"|"summon"|"effect"|"actorUpdate"|"movement"|"other")
 *   } CrucibleActionEventType
 * The type of event in an action's timeline.
 * - "activation": The initial resource cost of performing the action, targeting the acting actor.
 * - "strike": A weapon attack roll against a target.
 * - "spell": A spell effect roll against a target.
 * - "check": A non-attack dice check (e.g. a skill roll).
 * - "summon": A creature summoned as part of the action.
 * - "effect": Active effects applied to a target, not yet attributed to a specific roll.
 * - "actorUpdate": Data updates applied to a target actor (e.g. status flags, item drops from disarm).
 * - "movement": A planned token movement enacted at confirm time. At most one per actor.
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
   * @param {{id: string, origin: TokenPosition}} [data.movement]  Movement id and pre-move origin, for movement events
   * @param {ActionSummonConfiguration} [data.summon]  Summon configuration, present for summon-type events
   * @param {object} [data.actorUpdates]            Data updates to apply to the target actor
   * @param {CrucibleItemSnapshot[]} [data.itemSnapshots]  Pre-action item state for reversal
   * @param {ActionResourceDelta[]} [data.resources=[]]  Resource changes incurred or imposed by this event
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
      if ( !effect.system ) continue;
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
 * @property {CrucibleToken} [token]  A specific Token which is performing the action
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
 * Action-specific properties added to the core data model construction context.
 * @typedef _CrucibleActionContext
 * @property {CrucibleActor} [actor]            A specific Actor to whom this Action is bound
 * @property {CrucibleItem} [item]              A specific Item that provided this Action
 * @property {RegionDocument} [region]          A RegionDocument associated with this Action
 * @property {CrucibleTokenObject} [token]      A specific token performing this Action
 * @property {CrucibleActionMovement} [movement]  Pre-resolved movement data attached to this Action
 * @property {CrucibleChatMessage} [message]    The ChatMessage (if any) representing this Action
 * @property {object} [metadata]                Arbitrary metadata persisted to the ChatMessage flags
 * @property {ActionUsage} [usage]              Pre-configured action usage data
 * @property {boolean|Function} [autoFavorite]  Auto-populate the favorites bar; boolean or `(action) => boolean`
 */

/**
 * The construction context accepted by the {@link CrucibleAction} constructor and consumed by `_configure`.
 * @typedef {DataModelConstructionContext & _CrucibleActionContext} CrucibleActionContext
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
 * - `CrucibleAction##settleRollOutcomes` - Flag critical successes/failures and report whether damage or healing landed.
 *    - Actor hooks called: `applyCriticalEffects` - Critical hit effects are recorded into the event stream when
 *      the action damages or heals another target.
 * - `CrucibleAction##allocateResources` - Compute final resource deltas from roll damage.
 * - Actor hooks called: `finalizeAction`
 * - `CrucibleAction##finalizeEvents` - Final authority over the event stream: invisibility, movement statuses, spell
 *      provenance on new effects, and effect-change snapshots for reversal.
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
 * - Action hooks called: `postConfirm`
 *    - Fires after `#applyEvents` and the message-confirmed flag flip; used for chaining actions.
 *
 * ## Guidance for Hook Authors
 * - Record events, do not mutate actor state directly. All resource changes, effects, and actor updates must be
 *   expressed as events via {@linkcode CrucibleAction#recordEvent}. Direct actor mutations within hooks will be lost
 *   or double-applied.
 * - Use `roll` hooks to create attack/spell/check events, if standard tags are insufficient. See existing `roll` hooks
 *   in `const/action.mjs` for reference.
 * - Use `postActivate` hooks to inspect and modify the event stream after all rolls are complete. This is the
 *   right place to add, remove, or modify events based on action results, and the final phase permitted to mutate
 *   roll data; later steps (critical effects, resource allocation) consume settled rolls.
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
 * @extends {foundry.abstract.DataModel<CrucibleActionData, CrucibleActionContext>}
 */
export default class CrucibleAction extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    // Configure allowed duration properties
    const {duration: aeDuration} = foundry.documents.ActiveEffect.defineSchema();
    const durationUnits = CONST.ACTIVE_EFFECT_DURATION_UNITS;
    aeDuration.extendFields({
      units: new fields.StringField({required: true, blank: true, initial: "", choices: durationUnits})
    });

    // Limit allowed effect scopes
    const effectScopes = SYSTEM.ACTION.TARGET_SCOPES.choices;
    delete effectScopes[SYSTEM.ACTION.TARGET_SCOPES.NONE]; // NONE not allowed

    // Return action schema
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
      summon: new fields.SchemaField({
        actorUuid: new fields.DocumentUUIDField({type: "Actor"}),
        permanent: new fields.BooleanField({initial: true}),
        combatant: new fields.BooleanField({initial: true})
      }, {nullable: true, initial: null}),
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
      tags: new fields.SetField(new fields.StringField({required: true, blank: false}))
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

  /**
   * Event types of which only a single instance per target is permitted in the action's event stream.
   * @type {Set<CrucibleActionEventType>}
   */
  static #SINGLETON_EVENT_TYPES = new Set(["activation", "actorUpdate", "movement"]);

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * The specific Actor to whom this Action is bound. May be undefined if the Action is unbound.
   * @type {CrucibleActor}
   */
  actor = this.actor; // Defined during _configure

  /**
   * The Affix ActiveEffect that provides this Action. Null if the Action is defined directly on an Item.
   * @type {ActiveEffect|null}
   */
  affix = this.affix; // Defined during _configure

  /**
   * The specific Item which contributed this Action. May be undefined if the Action did not originate from an Item.
   * @type {CrucibleItem}
   */
  item = this.item; // Defined during _configure

  /**
   * The message representing this action, if applicable
   * @type {CrucibleChatMessage|null}
   */
  message = this.message; // Defined during _configure

  /**
   * A planned or realized token movement associated with this action, used for movement-tagged actions.
   * @type {CrucibleActionMovement|null}
   */
  movement = this.movement; // Defined during _configure

  /**
   * The declared auto-favorite rule, a boolean or condition function. Read via the {@link autoFavorite} getter.
   * @type {boolean|Function}
   */
  _autoFavorite = this._autoFavorite; // Defined during _configure

  /**
   * Arbitrary metadata that persists to the ChatMessage flags for use during confirmation.
   * Hooks can write keys during the use phase (e.g., preActivate) and read them during confirm.
   * @type {object}
   */
  metadata = this.metadata;

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
   * Whether this action auto-populates the actor sheet favorites bar, resolving any condition function against itself.
   * @type {boolean}
   */
  get autoFavorite() {
    if ( this._autoFavorite instanceof Function ) return this._autoFavorite(this) === true;
    return this._autoFavorite === true;
  }

  /* -------------------------------------------- */

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

  /**
   * Should using this action expire the actor's Invisible status?
   * @type {boolean}
   */
  get breaksInvisibility() {
    if ( this.tags.has("undetectable") ) return false;
    if ( this.tags.has("spell") ) return true;
    return this.target.scope > SYSTEM.ACTION.TARGET_SCOPES.SELF;
  }

  /* -------------------------------------------- */

  /**
   * Test whether this Action involves a particular Rune, either as a cast Spell or an action annotated with a Rune.
   * @param {string} runeId    The Rune identifier to test
   * @returns {boolean}
   */
  usesRune(runeId) {
    return (this.rune?.id === runeId) || (this.usage.rune === runeId);
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
   * @property {CrucibleActionEvent|null} movement    The movement event (singleton, at most one per actor)
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
          movement: null,
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
      else if ( event.type === "movement" ) events.movement = event;
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
   * @param {CrucibleActionContext} [options]     Options passed to the constructor context
   * @inheritDoc
   */
  _configure({actor=null, item=null, region=null, movement=null, token=null, message=null, metadata={}, usage={},
    autoFavorite=false, ...options}) {
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
      _autoFavorite: {value: autoFavorite, writable: false, configurable: true},
      metadata: {value: metadata, writable: false, configurable: true}
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
      bonuses: {ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1, criticalSuccessThreshold: 0},
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

    /**
     * Is this action triggered programmatically (e.g. Fall, Glide) and therefore hidden from the actor sheet?
     * @type {boolean}
     */
    Object.defineProperty(this, "suppressFromSheet", {
      value: crucible.api.hooks.action[this.id]?.suppressFromSheet === true,
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
    this.usage.summons = this.summon?.actorUuid ? [{...this.summon}] : [];

    // Reset bonuses
    Object.assign(this.usage.bonuses, {
      ability: 0,
      skill: 0,
      enchantment: 0,
      damageBonus: 0,
      multiplier: 1,
      criticalSuccessThreshold: 0
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
    context.usage = context.lazy ? foundry.utils.deepClone(this.usage) : this.usage;
    context.actor ??= this.actor;
    context.token ??= this.token;
    context.region ??= this.region;
    context.movement ??= this.movement;
    context.message ??= this.message;
    context.autoFavorite ??= this._autoFavorite;
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
    if ( CrucibleAction.#SINGLETON_EVENT_TYPES.has(event.type) ) {
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
    this._callActionHooks("configure");

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
      this._callActionHooks("configure");
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
    const dealsDamage = this.#settleRollOutcomes();
    if ( dealsDamage ) this.actor.callActorHooks("applyCriticalEffects", this);
    this.#allocateResources();
    this.actor.callActorHooks("finalizeAction", this);
    this.#finalizeEvents();

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

    // Persist action usage flags immediately rather than waiting for action confirmation - skip for transient actors
    if ( game.actors.has(this.actor.id) ) {
      this.#recordActionHistory(message);
      await this.actor.update({"flags.crucible": this.usage.actorFlags});
    }
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
    if ( this.usage.forcedTargets?.length ) {
      return this.targets = new Map(this.usage.forcedTargets.map(actor => {
        const token = actor.getActiveTokens?.(true, true)[0] ?? null;
        return [actor, {actor, uuid: actor.uuid, name: actor.name, token}];
      }));
    }
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
    this._callActionHooks("acquireTargets", targets);

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
   * A token is targeted if the movement path intersects with its hitbox OR if base-to-base with the final position.
   * Targets are returned in path-traversal order and capped to the action's defined maximum targets.
   * @returns {ActionUseTarget[]}
   */
  #acquireTargetsFromMovement() {
    if ( !this.movement ) return [];
    const sparseWaypoints = this.movement.waypoints;
    if ( !sparseWaypoints.length ) return [];

    // Expand sparse waypoints into every intermediate grid cell traversed
    const expandedWaypoints = sparseWaypoints.map(w => (w.action === "blink" ? {...w, action: "walk"} : w));
    const waypoints = this.token.getCompleteMovementPath([this.movement.origin, ...expandedWaypoints]).slice(1);
    if ( !waypoints.length ) return [];

    // Grid spaces occupied by the starting position are never targeted
    const originSpaces = new Set();
    for ( const {i, j, k} of this.token.getOccupiedGridSpaceOffsets(this.movement.origin) ) {
      originSpaces.add(`${i},${j},${k}`);
    }

    // Determine the superset of candidate targets filtered by disposition and visibility
    const adjacencyPad = canvas.dimensions.size / canvas.dimensions.distance; // Pixels per one foot of distance
    const broadBounds = this.#getMovementFootprintRect(waypoints, adjacencyPad);
    const targetDispositions = this.#getTargetDispositions();
    const candidates = canvas.tokens.quadtree.getObjects(broadBounds, {collisionTest: o => {
      const tokenDoc = o.t.document;
      if ( !this.target.self && (tokenDoc.actor === this.actor) ) return false;
      if ( !targetDispositions.includes(tokenDoc.disposition) ) return false;
      return !tokenDoc.hidden;
    }});

    // Padded footprint of the final position used to detect base-to-base adjacency
    const finalRect = this.#getMovementFootprintRect([waypoints.at(-1)], adjacencyPad);

    // Walk the path in order, recording the first step at which each candidate is intersected or in base-to-base
    const encounterStep = new Map();
    for ( let w = 0; w < waypoints.length; w++ ) {
      const isFinal = w === (waypoints.length - 1);
      const occupied = new Set();
      for ( const {i, j, k} of this.token.getOccupiedGridSpaceOffsets(waypoints[w]) ) {
        const key = `${i},${j},${k}`;
        if ( !originSpaces.has(key) ) occupied.add(key);
      }
      for ( const token of candidates ) {
        if ( encounterStep.has(token) ) continue;
        const footprint = token.document.getOccupiedGridSpaceOffsets(token.document._source);
        const intersects = footprint.some(({i, j, k}) => occupied.has(`${i},${j},${k}`));
        const adjacent = isFinal && finalRect.overlaps(token.bounds);
        if ( intersects || adjacent ) encounterStep.set(token, w);
      }
    }

    // Sort targets by encounter step, tie-breaking by center-to-center distance
    const finalCenter = {x: finalRect.x + (finalRect.width / 2), y: finalRect.y + (finalRect.height / 2)};
    const d2 = t => Math.pow(t.center.x - finalCenter.x, 2) + Math.pow(t.center.y - finalCenter.y, 2);
    let ordered = Array.from(encounterStep.keys()).sort((a, b) => {
      return (encounterStep.get(a) - encounterStep.get(b)) || (d2(a) - d2(b));
    });

    // Limit maximum affected targets, skipping those which are already dead
    if ( this.target.limit && (ordered.length > this.target.limit) ) {
      ordered = ordered.filter(token => !token.actor?.system.isDead).slice(0, this.target.limit);
    }
    return ordered.map(token => CrucibleAction.#getTargetFromToken(token.document));
  }

  /* -------------------------------------------- */

  /**
   * Compute the bounding rectangle of the token's grid footprint across one or more waypoints, optionally padded.
   * @param {object[]} waypoints    Waypoint positions to bound
   * @param {number} [pad=0]        Pixel padding applied to every side
   * @returns {PIXI.Rectangle}
   */
  #getMovementFootprintRect(waypoints, pad=0) {
    let minI = Infinity;
    let minJ = Infinity;
    let maxI = -Infinity;
    let maxJ = -Infinity;
    for ( const wp of waypoints ) {
      for ( const {i, j} of this.token.getOccupiedGridSpaceOffsets(wp) ) {
        if ( i < minI ) minI = i;
        if ( j < minJ ) minJ = j;
        if ( i > maxI ) maxI = i;
        if ( j > maxJ ) maxJ = j;
      }
    }
    const {x: x0, y: y0} = canvas.grid.getTopLeftPoint({i: minI, j: minJ});
    const {x: x1, y: y1} = canvas.grid.getTopLeftPoint({i: maxI + 1, j: maxJ + 1});
    return new PIXI.Rectangle(x0 - pad, y0 - pad, (x1 - x0) + (2 * pad), (y1 - y0) + (2 * pad));
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
    const targetDispositions = this.#getTargetDispositions();
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
      // `token` is a placeable from game.user.targets while this.token is a TokenDocument, so compare by id
      if ( (token.id === this.token.id) && !this.damage?.restoration ) {
        t.error = _loc("ACTION.WARNINGS.CannotTargetSelf");
        continue;
      }
      // Enforce the action's target scope by disposition (an empty set means scope NONE/SELF, which is unrestricted here)
      if ( targetDispositions.length && !targetDispositions.includes(token.document.disposition) ) {
        t.error ||= _loc("ACTION.WARNINGS.InvalidTargetScope", {action: this.name});
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
    const allActors = Array.from(this.targets.keys());
    if ( !this.targets.has(this.actor) ) allActors.push(this.actor);
    for ( const target of allActors ) {
      const events = eventsByActor.get(target);
      for ( const [i, effectData] of this.effects.entries() ) {
        const event = this.#getQualifyingEvent(target, events, eventsByActor, effectData);
        if ( !event ) continue;
        if ( regionEffectRequired && (target === this.actor) ) regionEffectRequired = false;
        const {_id, name, duration, statuses: origStatuses, system={}, showIcon} = effectData;
        const statuses = new Set(origStatuses);

        // Keep countdown (units-based) and event-expiry durations; drop empty durations, invalid for the core AE schema
        const effectDuration = duration.units ? duration : (duration.expiry ? {expiry: duration.expiry} : undefined);
        const effect = {
          _id: _id || SYSTEM.EFFECTS.getEffectId(this.id, {suffix: String(i)}),
          name: name || this.name,
          description: this.description,
          img: this.img,
          origin: this.actor.uuid,
          duration: effectDuration,
          system
        };
        if ( showIcon !== undefined ) effect.showIcon = showIcon; // Honor a per-effect icon-visibility override

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
   * @param {CrucibleActor} target                               The target actor
   * @param {ActorEventGroup|undefined} events                   The pre-classified event group for this target
   * @param {Map<CrucibleActor, ActorEventGroup>} eventsByActor  Full events-by-actor map
   * @param {ActionEffect} effectData                            Effect data to consider
   * @returns {CrucibleActionEvent|true|false}
   */
  #getQualifyingEvent(target, events, eventsByActor, effectData) {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    const scope = effectData.scope ?? this.target.scope;
    const {type: resultType, all: resultAll} = effectData.result;

    // Eliminate conditions where the effect cannot apply
    if ( scope === scopes.NONE ) return false;
    if ( (scope === scopes.SELF) && !events?.isSelf ) return false;
    if ( events?.isSelf ) {
      const canAffectSelf = (scope === scopes.SELF) || (events.isTarget && (scope === scopes.ALL));
      if ( !canAffectSelf ) return false;
    }

    // When this actor rolled, the effect gates on those rolls
    if ( events?.roll.length ) return CrucibleAction.#testEventResult(events.roll, resultType, resultAll);

    // A SELF effect whose actor never rolled (its strikes are recorded against the targets) instead gates on the
    // targets' rolls. The no-rolls fallback below applies only when the action produced no rolls at all (a self-buff).
    if ( (scope === scopes.SELF) && events && !events.isTarget ) {
      let actionHasRolls = false;
      for ( const [actor, otherEvents] of eventsByActor ) {
        if ( (actor === target) || !otherEvents.roll.length ) continue;
        actionHasRolls = true;
        const otherResult = CrucibleAction.#testEventResult(otherEvents.roll, resultType, resultAll);
        if ( otherResult ) return otherResult;
      }
      if ( actionHasRolls ) return false; // Other targets rolled but none qualified
    }

    // No rolls for this actor (and none among other targets for a SELF effect): apply the no-rolls result
    return CrucibleAction.#testEventResult([], resultType, resultAll);
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
   * Settle roll outcomes by flagging critical results, and report whether the action dealt damage or healing.
   * Runs after postActivate, the final phase permitted to mutate roll data.
   * @returns {boolean}    Whether this action dealt damage or healing to a target other than the actor.
   */
  #settleRollOutcomes() {
    let dealsDamage = false;
    for ( const event of this.events ) {
      if ( event.roll ) {
        if ( event.roll.isCriticalSuccess ) event.isCriticalSuccess = true;
        else if ( event.roll.isCriticalFailure ) event.isCriticalFailure = true;
      }
      dealsDamage ||= ((event.target !== this.actor) && (event.isDamage || event.isHealing));
    }
    return dealsDamage;
  }

  /* -------------------------------------------- */

  /**
   * Allocate per-roll resource deltas using {@link CrucibleBaseActor#allocateResourceChange}, constraining damage to
   * the state of resource pools so that reversal is accurate.
   */
  #allocateResources() {
    const allocations = new Map();
    for ( const event of this.events ) {
      if ( !event.roll ) continue;

      // Allocate resource changes
      const damage = event.roll.data.damage || {};
      if ( damage.harmless ) continue;
      const resource = damage.resource ?? "health";
      const cfg = SYSTEM.RESOURCES[resource];
      const restoration = !!(damage.restoration ?? this.damage?.restoration);
      const damageType = damage.type; // Annotate the resulting resource changes with their damage type, see GH #1204
      const amount = (damage.total ?? 0) * (restoration ? 1 : -1) * (cfg.type === "reserve" ? -1 : 1);

      // Zero-damage hits still record a resource entry so downstream effects and scrolling text can be detected
      if ( amount === 0 ) {
        event.resources.push({resource, delta: 0, restoration, damageType});
        continue;
      }

      // Allocate without specific system target (in theory should not happen?)
      if ( !event.target?.system ) {
        event.resources.push({resource, delta: amount, restoration, damageType});
        continue;
      }

      // Allocate resource changes to a specific Actor
      if ( !allocations.has(event.target) ) allocations.set(event.target, {});
      const allocation = allocations.get(event.target);
      const deltas = event.target.system.allocateResourceChange(amount, resource, allocation);
      if ( foundry.utils.isEmpty(deltas) ) event.resources.push({resource, delta: 0, restoration, damageType});
      else for ( const [r, delta] of Object.entries(deltas) ) {
        event.resources.push({resource: r, delta, restoration, damageType});
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * The final authority over the event stream before persistence. Stage the last system-level effect changes
   * (break invisibility, derive post-movement statuses incl. grapple breaks), then snapshot the pre-action state of
   * every deleted/updated effect so the change can be reversed.
   */
  #finalizeEvents() {

    // Remove an invisibility effect if this action breaks it
    this.#expireInvisibility();

    // Attach derived movement-based statuses
    for ( const event of this.events ) {
      if ( event.type === "movement" ) this.#deriveMovementStatus(event);
    }

    // Finalize effect data
    for ( const event of this.events ) {
      for ( const effect of event.effects ) {

        // An UNSTOPPABLE movement-blocker cannot be knocked Prone
        if ( effect.statuses?.length && (effect._action !== "delete")
          && (event.target?.system.movement.blockerStrength >= SYSTEM.ACTOR.MOVEMENT_STRENGTHS.UNSTOPPABLE) ) {
          effect.statuses = effect.statuses.filter(s => s !== "prone");
        }

        // Snapshot current state for deletions and updates so reversal is possible
        if ( (effect._action === "delete") || (effect._action === "update") ) {
          const live = event.target?.effects.get(effect._id);
          if ( live ) effect._snapshot = live.toObject();
        }

        // Annotate effects
        else {
          const d = event.roll?.data;
          effect.system ??= {};

          // Spell-applied effects gain the magical property
          if ( this.tags.has("spell") || this.tags.has("iconicSpell") ) {
            const properties = new Set(effect.system.properties);
            properties.add("magical");
            effect.system.properties = Array.from(properties);
          }

          // Populate effect removal difficulty
          if ( effect.system.dc === undefined ) {
            effect.system.dc = d
              ? SYSTEM.PASSIVE_BASE + (d.ability ?? 0) + (d.skill ?? 0) + (d.enchantment ?? 0)
              : SYSTEM.PASSIVE_BASE + (this.actor?.system.advancement?.level ?? 0);
          }
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Stage deletion of the Invisible status on the acting actor if this action breaks invisibility.
   */
  #expireInvisibility() {
    if ( !this.actor?.statuses.has("invisible") ) return;
    if ( !this.breaksInvisibility ) return;
    const activation = this.selfEvents.activation;
    for ( const effect of this.actor.effects ) {
      if ( !effect.statuses.has("invisible") ) continue;
      activation.effects.push({_id: effect.id, _action: "delete"});
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
   * @typedef CrucibleActionWeaponChoice
   * @property {CrucibleItem} item    The candidate weapon Item
   * @property {string} id            The choice identifier: the weapon id, or "mainhandUnarmed"/"offhandUnarmed"
   * @property {string} label         A display label including the equipment slot
   * @property {boolean} viable       Whether the weapon satisfies the action's requirement tags
   * @property {boolean} [valid]      Whether the weapon is currently affordable; annotated by getValidWeaponChoices
   */

  /**
   * Enumerate the equipped weapons structurally eligible for this action, before requirement tags filter viability.
   * Only weapon state (reload) is considered here; requirement tags (melee, ranged, brute, ...) further restrict the
   * returned choices during prepare.
   * @returns {CrucibleActionWeaponChoice[]|null}  The candidate weapons, or null when no choice is presented
   * @protected
   */
  _prepareWeaponChoices() {
    const isWeaponAction = this.tags.has("strike") || this.tags.has("reload");
    const isForced = ["mainhand", "offhand", "twohand"].some(t => this.tags.has(t));
    if ( !isWeaponAction || isForced ) return null;
    const {mainhand: mh, offhand: oh, natural} = this.actor.equipment.weapons;
    const isReload = this.tags.has("reload");

    // Add a weapon as a choice if its reload state qualifies: unloaded for a reload action, loaded for any other;
    // non-reloadable weapons are never a choice for a reload action
    const choices = [];
    const addChoice = (weapon, id, slotLabel) => {
      if ( weapon.config.category.reload ) {
        if ( isReload ? !weapon.system.needsReload : weapon.system.needsReload ) return;
      } else if ( isReload ) return;
      choices.push({item: weapon, id, label: `${weapon.name} (${slotLabel})`, viable: true});
    };
    if ( mh ) addChoice(mh, mh.id || "mainhandUnarmed", SYSTEM.WEAPON.SLOTS.labels.MAINHAND);
    if ( oh ) addChoice(oh, oh.id || "offhandUnarmed", SYSTEM.WEAPON.SLOTS.labels.OFFHAND);
    for ( const n of natural ) addChoice(n, n.id, SYSTEM.WEAPON.PROPERTIES.natural.label);
    return choices;
  }

  /* -------------------------------------------- */

  /**
   * Get the prepared viable weapon choices, annotating each with affordability against an action point budget.
   * @param {object} [options]              Additional options
   * @param {boolean} [options.strict]      Whether to drop unaffordable choices rather than only marking them
   * @param {number} [options.maxCost]      An action point budget; weapons exceeding it get valid=false
   * @returns {CrucibleActionWeaponChoice[]}
   */
  getValidWeaponChoices({strict=false, maxCost=Infinity}={}) {
    const choices = (this.usage.weaponChoices ?? []).filter(c => c.viable);
    const base = this.usage.baseActionCost ?? this.cost.action;
    for ( const choice of choices ) {
      const cost = this.cost.weapon ? (base + (choice.item.system.actionCost || 0)) : this.cost.action;
      choice.valid = cost <= maxCost;
    }
    return strict ? choices.filter(c => c.valid) : choices;
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
   * Synchronously invoke an action hook across all tag handlers and this action's own hooks, bound to the action.
   * @param {string} hookName     The hook name in {@link SYSTEM.ACTION_HOOKS}
   * @param {...*} args           Arguments forwarded to each handler
   * @throws {Error}              If the hook is async, or a handler throws and the hook's metadata sets throws.
   * @protected
   */
  _callActionHooks(hookName, ...args) {
    const cfg = SYSTEM.ACTION_HOOKS[hookName];
    if ( !cfg ) throw new Error(`Invalid Action hook "${hookName}"`);
    if ( cfg.async ) throw new Error(`Action hook "${hookName}" is async; use _callActionHooksAsync`);
    for ( const test of this._tests() ) {
      const fn = test[hookName];
      if ( !(fn instanceof Function) ) continue;
      if ( CONFIG.debug.crucibleHooks ) console.debug(`Calling "${hookName}" action hook for Action "${this.id}"`);
      try {
        fn.call(this, ...args);
      } catch(err) {
        if ( cfg.throws ) throw err;
        console.error(new Error(`The "${hookName}" action hook failed for Action "${this.id}"`, {cause: err}));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Asynchronously invoke an action hook across all tag handlers and this action's own hooks, awaiting each in order.
   * @param {string} hookName     The hook name in {@link SYSTEM.ACTION_HOOKS}
   * @param {...*} args           Arguments forwarded to each handler
   * @returns {Promise<void>}
   * @throws {Error}              If a handler throws and the hook's metadata sets throws.
   * @protected
   */
  async _callActionHooksAsync(hookName, ...args) {
    const cfg = SYSTEM.ACTION_HOOKS[hookName];
    if ( !cfg ) throw new Error(`Invalid Action hook "${hookName}"`);
    for ( const test of this._tests() ) {
      const fn = test[hookName];
      if ( !(fn instanceof Function) ) continue;
      if ( CONFIG.debug.crucibleHooks ) console.debug(`Calling "${hookName}" action hook for Action "${this.id}"`);
      try {
        await fn.call(this, ...args);
      } catch(err) {
        if ( cfg.throws ) throw err;
        console.error(new Error(`The "${hookName}" action hook failed for Action "${this.id}"`, {cause: err}));
      }
    }
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
    if ( this.target.type === "summon" ) this.tags.add("summon");

    // Configure bonuses
    this.usage.bonuses.ability = this.actor.getAbilityBonus(this.scaling);
    this.usage.bonuses.skill = this.actor.getSkillBonus(this.training);

    // Call configuration hooks
    this._callActionHooks("initialize");

    // Build the weapon choice set now so requirement tags can filter it during the later prepare pass
    this.usage.weaponChoices = this._prepareWeaponChoices();
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
    this._callActionHooks("prepare");
    this.actor?.callActorHooks("prepareAction", this);

    // Dedupe ability scaling
    const scaling = new Set(this.scaling);
    this.scaling.length = 0;
    this.scaling.push(...scaling);

    // Final cost overrides
    if ( this.actor.statuses.has("limitless") ) {
      this.cost.action = 0;
      this.cost.focus = 0;
      this.cost.heroism = 0;
    }
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
          if ( test.label ) errorReason = _loc("ACTION.WARNINGS.CannotUseTagGeneric", {tag: test.label});
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
    await this._callActionHooksAsync("preActivate");
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
    await this._callActionHooksAsync("roll", target, token);
    await this.actor.callActorHooksAsync("rollAction", this, target, token);
  }

  /* -------------------------------------------- */

  /**
   * Handle post-roll modification of the event stream.
   * Each hook receives the full action context via `this` and can access the event stream, eventsByTarget, etc.
   * @returns {Promise<void>}
   * @protected
   */
  async _post() {
    await this._callActionHooksAsync("postActivate");
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

    // On confirmation a placed region persists only while an active effect retains a reference to it; otherwise the
    // region was ephemeral to this action and is deleted now.
    if ( this.region ) {
      // Non-ephemeral target types retain their region by default, recording it on a self-effect
      if ( !SYSTEM.ACTION.TARGET_TYPES[this.target.type]?.region?.ephemeral && !isNegated ) {
        const regionEffect = this.selfEvents.all.find(e => e.effects.length)?.effects[0];
        if ( regionEffect ) {
          regionEffect.system.regions ??= [];
          regionEffect.system.regions.push(this.region.uuid);
        }
      }
      // The effect reference is the source of truth for persistence: keep the region iff an effect retains it
      const retained = this.events.some(e => e.effects?.some(f => f.system?.regions?.includes(this.region.uuid)));
      if ( retained ) await this.region.update({visibility: CONST.REGION_VISIBILITY[reverse ? "OBSERVER" : "ALWAYS"]});
      else await this.region.delete();
    }

    // Per-target confirmation hooks; awaited in turn so async hooks (e.g. spell interrupts) resolve before events apply
    for ( const actor of this.eventsByActor.keys() ) {
      await actor.callActorHooksAsync("confirmAction", this, {reverse});
    }

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

    // Defer postConfirm hooks until VFX playback concludes, capped at 4 seconds
    if ( !reverse && this.message?._vfxPlayback ) {
      const maxWait = new Promise(resolve => { setTimeout(resolve, 3000); });
      await Promise.race([this.message._vfxPlayback.catch(() => {}), maxWait]);
    }

    // Post-confirm hooks after #applyEvents has completed and committed changes. Useful for chaining actions.
    await this._callActionHooksAsync("postConfirm", reverse);

    // Settle any movement-driven follow-ups (currently: trigger a fall for any moved token left hovering)
    if ( !reverse && !isNegated ) await this.#settleMovement();
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
        events: [], resources: {}, effects: [], actorUpdates: {}, itemSnapshots: [], movementId: null
      });
      const batch = batches.get(actor);
      const isSelf = actor === this.actor;
      batch.events.push(event);

      // Accumulate resources
      for ( const {resource, delta} of event.resources ) {
        if ( isNegated ) { // Only preserve self-costs
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
      // TODO https://github.com/foundryvtt/crucible/issues/821
      // Negation rework should skip actorUpdates so a negated critical cannot consume once-per-turn sentinels
      if ( event.actorUpdates ) foundry.utils.mergeObject(batch.actorUpdates, event.actorUpdates);

      // Accumulate item snapshots
      if ( event.itemSnapshots ) batch.itemSnapshots.push(...event.itemSnapshots);

      // Stage planned movement; on reverse, also clear free-move bookkeeping if this consumed it
      if ( (event.type === "movement") && event.movement ) {
        batch.movementId = event.movement.id;
        if ( reverse && (event.movement.id === actor.system.status?.freeMovementId) ) {
          foundry.utils.setProperty(batch.actorUpdates, "system.status.hasMoved", false);
          foundry.utils.setProperty(batch.actorUpdates, "system.status.freeMovementId", null);
        }
      }
    }

    // Apply each actor's batch - skip non-persisted actors (e.g. the transient Environment actor used by hazards)
    for ( const [actor, batch] of batches ) {
      if ( !game.actors.has(actor.id) ) continue;
      if ( reverse && batch.itemSnapshots.length ) this.#reverseItemSnapshots(batch);

      // Enact or reverse planned movement before committing resources, update token position and free movement state
      if ( batch.movementId ) await this.#applyMovement(actor, batch.movementId, reverse);

      const textEvents = this.#composeTextEvents(actor, batch.events, {reverse, isNegated});
      const scrollingText = reverse || !this.message?.getFlag("crucible", "vfxConfig");
      await actor.alterResources(batch.resources, batch.actorUpdates, {reverse, textEvents, scrollingText});
      if ( batch.effects.length ) await actor._applyActionEffects(batch.effects, reverse);
    }
  }

  /* -------------------------------------------- */

  /**
   * Compose scrolling text events to display above a target actor on action confirmation.
   * @param {CrucibleActor} actor              The target actor
   * @param {CrucibleActionEvent[]} events     Events targeting this actor, in stream order
   * @param {object} options
   * @param {boolean} options.reverse            Reverse direction of change?
   * @param {boolean} options.isNegated          Action was negated (e.g. by counterspell)?
   * @returns {ScrollingTextEvent[]}
   */
  #composeTextEvents(actor, events, {reverse, isNegated}) {
    return this.constructor.composeTextEvents(actor, events,
      {reverse, isNegated, selfActor: this.actor});
  }

  /* -------------------------------------------- */

  /**
   * Compose scrolling text events for a target actor from a slice of an action's event stream.
   * Public for use by VFX configurators that bake per-target text into a VFXEffect.
   * @param {CrucibleActor} actor
   * @param {object[]} events
   * @param {{reverse: boolean, isNegated: boolean, selfActor: CrucibleActor}} options
   * @returns {ScrollingTextEvent[]}
   */
  static composeTextEvents(actor, events, {reverse, isNegated, selfActor}) {
    const textEvents = [];
    const isSelf = actor === selfActor;
    const sign = reverse ? -1 : 1;
    const resources = actor.system.resources;
    const ActorCls = crucible.api.documents.CrucibleActor;
    const AttackRollCls = crucible.api.dice.AttackRoll;
    const T = AttackRollCls.RESULT_TYPES;

    for ( const event of events ) {
      if ( event.statusText?.length ) textEvents.push(...event.statusText);
      const includeResources = !isNegated || ((event.type === "activation") && isSelf);
      if ( !includeResources ) continue;

      const result = event.roll?.data?.result;
      const isAttackResult = (typeof result === "number") && (result in AttackRollCls.RESULT_TYPE_LABELS);
      const isHit = (result === T.HIT) || (result === T.GLANCE);
      if ( isAttackResult && !isHit ) {
        const label = game.i18n.localize(AttackRollCls.RESULT_TYPE_LABELS[result]);
        textEvents.push({text: label, fontSize: 28, fillColor: "#cccccc"});
        continue;
      }

      // Record individual resource changes for hits
      for ( const {resource: name, delta: rawDelta, restoration} of event.resources ) {
        const delta = rawDelta * sign;
        const attr = resources[name];
        if ( !attr ) continue;
        const effective = Math.clamp(attr.value + delta, 0, attr.max) - attr.value;
        textEvents.push(ActorCls.formatScrollingResource(name, effective, attr.max, {restoration}));
      }
    }
    return textEvents;
  }

  /* -------------------------------------------- */

  /**
   * Derive the resting movement status (flying/burrowing/falling) for one movement event and attach the changes to
   * that event's own `effects`, so the move and its status apply and reverse together.
   * @param {CrucibleActionEvent} event   A movement event whose `effects` are mutated in place.
   */
  #deriveMovementStatus(event) {
    const {burrowing, falling, flying} = CONFIG.statusEffects;
    const {BURROW, FLY} = CONFIG.specialStatusEffects;
    const actor = event.target;

    // A grappled target cannot be moved except by the grappler
    const grapple = crucible.api.hooks.action.grapple;
    const grappled = actor.effects.get(grapple._GRAPPLED_EFFECT_ID);
    if ( grappled && (grappled.origin !== this.actor.uuid) ) {
      event.movement = null;
      return;
    }

    // A grappler who voluntarily or involuntarily moves breaks the grapple
    const grappling = actor.effects.get(grapple._GRAPPLING_EFFECT_ID);
    if ( grappling ) {
      event.effects.push({_id: grapple._GRAPPLING_EFFECT_ID, _action: "delete"});
      const captive = grappling.origin ? fromUuidSync(grappling.origin) : null;
      if ( captive ) this.recordEvent({type: "effect", target: captive,
        effects: [{_id: grapple._GRAPPLED_EFFECT_ID, _action: "delete"}]});
    }

    // Resolve the moved token and its planned movement, matched by movement id
    const isSelf = actor === this.actor;
    const token = isSelf ? this.token
      : (this.targets?.get(actor)?.token ?? actor.getActiveTokens?.(true, true)?.[0]);
    const plan = (token?.movement?.id === event.movement.id) ? token.movement : null;
    if ( !plan ) return;

    // Planned movement "destination" remains the origin until executed; the final waypoint is the true destination
    const finalWaypoint = [...(plan.passed.waypoints ?? []), ...(plan.pending.waypoints ?? [])].at(-1);
    const destination = finalWaypoint ? {...plan.origin, ...finalWaypoint} : plan.destination;
    let toAdd;
    const restingAction = isSelf ? finalWaypoint?.action : null;

    // End as flying if suspended above a supporting surface
    if ( restingAction === "fly" ) {
      const surface = token._findSupportingSurface(destination);
      if ( surface && (surface.elevation < destination.elevation) ) toAdd = flying;
    }

    // End as burrowing if suspended above a deeper surface or below the level base if no surfaces are present
    else if ( restingAction === "burrow" ) {
      const surface = token._findSupportingSurface(destination);
      let underground;
      if ( surface ) underground = surface.elevation < destination.elevation;
      else {
        const base = token.parent?.levels.get(destination.level)?.elevation.base;
        underground = (base !== undefined) && (destination.elevation < base);
      }
      if ( underground ) toAdd = burrowing;
    }

    // Otherwise add the falling condition, unless a climbing move ends adjacent to a climbable surface
    else {
      const staysAirborne = !isSelf && (actor.statuses.has(FLY) || actor.statuses.has(BURROW));
      const surface = staysAirborne ? null : token._findSupportingSurface(destination);
      if ( surface && (surface.elevation < destination.elevation) ) {
        const isClimbing = isSelf && (finalWaypoint?.action === "climb");
        if ( !(isClimbing && token._findClimbableSurface(destination)) ) toAdd = falling;
      }
    }

    // Add a derived status effect change
    const clearable = isSelf ? [burrowing.id, falling.id, flying.id] : [falling.id];
    if ( toAdd && !actor.statuses.has(toAdd.id) ) {
      const {_id, id, img, name} = toAdd;
      event.effects.push({_id, img, name: _loc(name), statuses: [id], showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS});
    }

    // Clear prior movement status effects
    for ( const id of clearable ) {
      if ( (id !== toAdd?.id) && actor.statuses.has(id) ) {
        event.effects.push({_id: CONFIG.statusEffects[id]._id, _action: "delete"});
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Resolve falling for any moved actor carrying the falling status by triggering a follow-up fall action.
   * The status itself is assigned by {@link #deriveMovementStatus}.
   */
  async #settleMovement() {
    const fallers = [];
    for ( const event of this.events ) {
      if ( event.type !== "movement" ) continue;
      const actor = event.target;
      if ( !actor.statuses.has(CONFIG.statusEffects.falling.id) ) continue;
      const isSelf = actor === this.actor;
      const token = isSelf ? this.token
        : (this.targets?.get(actor)?.token ?? actor.getActiveTokens?.(true, true)?.[0]);
      if ( !token ) continue;
      fallers.push({actor, token});
    }
    for ( const {actor, token} of fallers ) {
      await actor.actions.fall.use({token});
    }
  }

  /* -------------------------------------------- */

  /**
   * Enact or reverse a single planned movement recorded as a `type: "movement"` event in this action.
   * @param {CrucibleActor} actor      The actor whose token is being moved
   * @param {string} movementId        The id of the planned movement
   * @param {boolean} reverse          Reverse the movement instead of enacting it?
   */
  async #applyMovement(actor, movementId, reverse) {
    const isSelf = actor === this.actor;
    const token = isSelf ? this.token
      : (this.targets?.get(actor)?.token ?? actor.getActiveTokens?.(true, true)?.[0]);
    if ( !token ) return;
    const isPlanned = (token.movement?.id === movementId) && (token.movement?.state === "planned");
    if ( reverse ) {
      if ( isPlanned ) await token.stopMovement();
      else await token.revertRecordedMovement(movementId);
      return;
    }
    if ( isPlanned ) {
      (token._confirmedMovements ??= new Set()).add(movementId);
      await token.startMovement(movementId);
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
   * Configure a VFXEffect instance for this Action by delegating to tag-defined configureVFX hooks.
   * Each hook receives the current configuration and may modify or replace it. The return value of
   * each hook is passed as input to the next, allowing downstream tags to augment the effect.
   * @returns {object|null}
   */
  configureVFXEffect() {
    let vfxConfig = null;
    for ( const test of this._tests() ) {
      if ( !(test.configureVFX instanceof Function) ) continue;
      vfxConfig = test.configureVFX.call(this, vfxConfig) ?? vfxConfig;
    }
    return vfxConfig;
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

    // Pass 3 - delegate to tag-defined resolveVFX hooks for computing reference values
    this._callActionHooks("resolveVFX", vfxEffect, references);

    // Resolve VFXReferenceField values using the now-complete references map
    // FIXME: restore the line below and delete #resolveVFXReferences once the minimum core build exceeds 14.363
    // vfxEffect.resolveReferences(references);
    CrucibleAction.#resolveVFXReferences(vfxEffect, references);

    // Pass 4 - delegate to tag-defined finalizeVFX hooks for play-time component configuration.
    // References are frozen to enforce the contract that finalizeVFX must not modify them.
    Object.freeze(references);
    this._callActionHooks("finalizeVFX", vfxEffect, references);

    // Play the effect. Sound is orchestrated by positionalSound components within the timeline,
    // so preload and playback are handled internally by VFXEffect#play alongside the visuals.
    if ( CONFIG.debug.vfx ) console.debug(`${this.id} | playVFXEffect`, {components: Object.keys(vfxEffect.components), references});
    try {
      return await vfxEffect.play(references);
    } catch(err) {
      console.error(`${this.id} | VFX play failed:`, err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Resolve VFXReferenceField values into a complete data tree before core resolution runs.
   * FIXME: core commit b5fd29e7 fixes VFXEffect#resolveReferences dropping array element sibling data.
   * Delete this shim and call vfxEffect.resolveReferences(references) once the minimum core build exceeds 14.363.
   * @param {foundry.canvas.vfx.VFXEffect} vfxEffect       The constructed effect awaiting reference resolution
   * @param {Record<string, any>} references               The complete references map
   */
  static #resolveVFXReferences(vfxEffect, references) {
    const {VFXReferenceField} = foundry.canvas.vfx.fields;
    let resolved = false;
    const resolvedUpdates = vfxEffect.schema.apply(function(source, _options) {
      if ( !(this instanceof VFXReferenceField) ) return source;
      if ( !VFXReferenceField.isReference(source) ) return source;
      resolved = true;
      return this.resolve(source, references);
    }, vfxEffect._source, {partial: true});
    if ( resolved ) vfxEffect.updateSource(resolvedUpdates);
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
   * Package this Action into drag data used to create a hotbar Macro which re-uses the Action.
   * @returns {{type: "crucible.action", macroData: object}}
   */
  toMacroDragData() {
    return {
      type: "crucible.action",
      macroData: {
        type: "script",
        scope: "actor",
        name: this.name,
        img: this.img,
        command: `game.system.api.documents.CrucibleActor.macroAction(actor, "${this.id}");`
      }
    };
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
    if ( CONFIG.debug.vfx ) console.debug(`${this.id} | configureVFXEffect`, actionData.vfxConfig);
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

    // Group per-target rolls + non-cost resource/effect changes into sections for the chat card
    const sections = this.#prepareCardSections();
    if ( sections.length ) actionData.sections = sections;

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
      // Target pills only when there are no per-target outcome sections to name them (e.g. an all-confirm-time payload)
      hasTargetTags: !!(targets.length && !sections.length),
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
   * Build per-target chat-card sections: each affected actor's roll indices, non-cost resource changes, and effects.
   * The acting actor's own section, if present, is ordered first.
   * @returns {{uuid: string, name: string, isSelf: boolean, hasSecondary: boolean,
   *   rollIndices: number[], resources: object[], effects: object[]}[]}
   */
  #prepareCardSections() {
    const activation = this.selfEvents.activation;
    const sections = new Map();
    const sectionFor = actor => {
      if ( !sections.has(actor) ) sections.set(actor, {
        uuid: actor.uuid, name: actor.name, isSelf: actor === this.actor,
        rollIndices: [], resources: [], effects: []
      });
      return sections.get(actor);
    };
    for ( const event of this.events ) {
      const target = event.target;
      if ( !target ) continue;
      const section = sectionFor(target);

      // Dice roll for this target
      if ( event.roll && Number.isInteger(event.roll.data.index) ) section.rollIndices.push(event.roll.data.index);

      // Resource changes other than the primary cost and the action's primary damage
      const primaryType = event.roll?.data?.damage?.type; // The roll's own damage, already shown in its breakdown
      if ( event !== activation ) {
        for ( const {resource, delta, damageType} of event.resources ) {
          if ( !delta ) continue;
          if ( event.roll && (damageType === primaryType) ) continue;
          const resCfg = SYSTEM.RESOURCES[resource];
          if ( !resCfg ) continue;
          section.resources.push({
            label: resCfg.label,
            typeLabel: damageType ? (SYSTEM.DAMAGE_TYPES[damageType]?.label ?? null) : null,
            magnitude: Math.abs(delta),
            isHeal: Math.sign(delta) === ((resCfg.type === "active") ? 1 : -1)
          });
        }
      }

      // Effect changes (gained or removed)
      for ( const effect of event.effects ) {
        if ( effect._action === "delete" ) {
          const existing = target.effects.get(effect._id);
          const name = existing?.name ?? effect.name ?? effect._id;
          section.effects.push({name, img: existing?.img ?? effect.img, gained: false});
        }
        else if ( !effect._action ) {
          const d = effect.duration;
          let duration;
          if ( (d?.units === "rounds") && d.value ) duration = _loc("ACTIVE_EFFECT.DURATION.Rounds", {value: d.value});
          else if ( d?.expiry === "combatEnd" ) duration = _loc("ACTIVE_EFFECT.DURATION.Combat");
          else duration = _loc("ACTIVE_EFFECT.DURATION.Infinite");
          section.effects.push({name: effect.name ?? effect._id, img: effect.img, gained: true, duration});
        }
      }
    }

    // Keep sections with content; flag secondary changes; order the acting actor's section first
    const all = Array.from(sections.values())
      .filter(s => s.rollIndices.length || s.resources.length || s.effects.length);
    for ( const s of all ) s.hasSecondary = !!(s.resources.length || s.effects.length);
    all.sort((a, b) => Number(b.isSelf) - Number(a.isSelf)); // Stable sort keeps appearance order; self floats to first
    return all;
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
    // Bail if a reverse-confirm is already in flight for this message.
    if ( reverse && message?._reversing ) return;
    if ( reverse && message ) message._reversing = true;
    try {
      action ||= this.fromChatMessage(message);
      await action.confirm({reverse});
    } finally {
      if ( reverse && message ) message._reversing = false;
    }
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

    // Reference linked documents - hazards use a transient Environment actor that cannot resolve from UUID,
    // so fabricate a fresh placeholder when reconstituting one from chat
    let actor = fromUuidSync(actorUuid) || ChatMessage.getSpeakerActor(message.speaker);
    if ( !actor && actionData.tags?.includes("hazard") ) {
      actor = new Actor.implementation({name: _loc("HAZARD.DefaultActor"), type: "adversary"});
    }
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
    // An unprepared actor has no `actions` map (e.g. getLastAction called during data prep); reconstruct from the
    // serialized action data instead
    if ( actor?.actions && (actionId in actor.actions) ) action = actor.actions[actionId].clone({}, actionContext);
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
   * @param {object} [options={}]           Options which modify hazard creation
   * @param {CrucibleActor} [options.actor]   A particular Actor responsible for the hazard.
   * @param {number} [options.danger=0]       The hazard's danger level (drives the attack roll's ability bonus).
   * @param {string[]} [options.tags]         Tag identifiers applied to the hazard action.
   * @param {string} [options.defenseType]    The defense the hazard targets (defaults to "physical").
   * @param {string} [options.damageType]     The damage type inflicted by the hazard.
   * @param {string} [options.resource]       The resource the hazard damages (defaults to "health").
   * @param {string} [options.name]           A custom display name for the hazard.
   * @param {string} [options.description]    A custom enrichable description.
   * @returns {CrucibleAction}              The resulting CrucibleAction that provides the configured hazard
   */
  static createHazard({actor, danger=0, tags, defenseType, damageType, resource, name, description, ...actionData}={}) {
    actor ||= new Actor.implementation({name: "Environment", type: "adversary"});
    tags = Array.isArray(tags) ? tags.filter(t => t !== "hazard") : [];
    tags.unshift("hazard");
    return new this({
      id: "environmentAttack",
      name: name || _loc("HAZARD.DefaultName"),
      img: "icons/skills/wounds/injury-body-pain-gray.webp",
      description: description ?? "",
      target: {type: "single", scope: 4, self: true},
      ...actionData,
      tags
    }, {actor, usage: {danger, defenseType, damageType, resource}});
  }

  /* -------------------------------------------- */

  /**
   * Construct an ephemeral CrucibleAction for a system default action by id.
   * Used for actor-less references such as the `@Action[default <id>]` enricher.
   * @param {string} actionId       Id of an entry in {@link SYSTEM.ACTION.DEFAULT_ACTIONS}
   * @returns {CrucibleAction|null}
   */
  static getDefaultAction(actionId) {
    const ad = SYSTEM.ACTION.DEFAULT_ACTIONS.find(a => a.id === actionId);
    if ( !ad ) return null;
    return new this(foundry.utils.deepClone(ad), {autoFavorite: ad.autoFavorite});
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @override */
  static migrateData(source) {
    for ( const effect of source.effects ?? [] ) {
      foundry.documents.ActiveEffect.migrateData(effect);
    }
    if ( source.summon && !source.summon.actorUuid ) source.summon = null; // Slim unused summon configs to null
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
