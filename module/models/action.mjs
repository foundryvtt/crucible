import StandardCheck from "../dice/standard-check.mjs";
import ActionUseDialog from "../dice/action-use-dialog.mjs";
import CrucibleActionConfig from "../applications/config/action-config.mjs";

/**
 * @typedef {Object} ActionContext
 * @property {string} label                 A string label providing context info
 * @property {string} icon                  A font awesome icon used to annotate the context
 * @property {Record<string, string>} tags  A record of tags which describe the context
 */

/**
 * @typedef {Object} ActionRange
 * @property {number} [minimum]             A minimum distance in feet at which the action may be used
 * @property {number} [maximum]             A maximum distance in feet at which the action may be used
 * @property {boolean} weapon               Enforce the maximum range of the used weapon
 */

/**
 * @typedef {Object} ActionTarget
 * @property {string} type                  The type of target for the action in ACTION.TARGET_TYPES
 * @property {number} [number]              The number of targets affected or size of target template
 * @property {number} [distance]            The allowed distance between the actor and the target(s)
 * @property {number} [limit]               Limit the effect to a certain number of targets.
 * @property {number} [scope]               The scope of creatures affected by an action
 * @property {MeasuredTemplate} [template]  A temporary template document that helps to identify AOE targets
 */

/**
 * @typedef {Object} ActionUsage
 * @property {object} actorStatus           Actor status updates applied when the action is confirmed
 * @property {object} actorUpdates          Other non-status actor data updates applied when this action is confirmed
 * @property {object} actorFlags            Actor flag updates applied when this action is used (not confirmed)
 * @property {Object<DiceBoon>} boons       Boons applied to this action
 * @property {Object<DiceBoon>} banes       Banes applied to this action
 * @property {DiceCheckBonuses} bonuses     Roll bonuses applied to this action
 * @property {ActionContext} context        Action usage context
 * @property {boolean} hasDice              Does this action involve the rolling a dice check?
 * @property {string} [rollMode]            A dice roll mode to apply to the message
 * @property {string} [defenseType]         A special defense type being targeted
 * @property {string} [skillId]             A skill ID that is being used
 * @property {CrucibleItem} [weapon]        A specific weapon item being used
 * @property {CrucibleItem} [consumable]    A specific consumable item being used
 * @property {boolean} [selfTarget]         Default to self-target if no other targets are selected
 * @property {ActionSummonConfiguration[]} [summons]  Creatures summoned by this action
 */

/**
 * @typedef ActionSummonConfiguration
 * @property {string} actorUuid
 * @property {string} [templateUuid]
 * @property {object} [tokenData={}]
 * @property {boolean} [combatant=true]
 * @property {number} [initiative=1]
 * @property {boolean} [permanent=true]     Is this summoned creature permanent until killed? Otherwise, a corresponding
 *                                          active effect must exist to track its duration.
 */

/**
 * @typedef {Object} ActionCost
 * @property {number} action                The cost in action points
 * @property {number} focus                 The cost in focus points
 * @property {number} [hands]               A number of free hands required
 */

/**
 * @typedef {Object} ActionTags
 * @property {Object<string, string>} activation
 * @property {Object<string, string>} action
 * @property {Object<string, string>} context
 */

/**
 * @typedef {Object} ActionEffect
 * @property {string} [name]
 * @property {number} scope
 * @property {string[]} statuses
 * @property {{rounds: number, turns: number}} [duration]
 */

/**
 * @typedef {Object} CrucibleActionOutcome
 * @property {CrucibleActor} target       The outcome target
 * @property {AttackRoll[]} rolls         Any AttackRoll instances which apply to this outcome
 * @property {object} resources           Resource changes to apply to the target Actor in the form of deltas
 * @property {object} actorUpdates        Data updates to apply to the target Actor
 * @property {ActionEffect[]} effects     ActiveEffect data to create on the target Actor
 * @property {ActionSummonConfiguration[]} [summons]  Creatures summoned by this action
 * @property {boolean} [weakened]         Did the target become weakened?
 * @property {boolean} [broken]           Did the target become broken?
 * @property {boolean} [incapacitated]    Did the target become incapacitated?
 * @property {boolean} [criticalSuccess]  Did the damage contain a Critical Hit
 * @property {boolean} [criticalFailure]  Did the damage contain a Critical Miss
 * @property {object[]} [statusText]      Optional status text displayed above the outcome target
 */

/**
 * @typedef CrucibleActionUsageOptions
 * @property {CrucibleTokenObject} [token]  A specific Token which is performing the action
 * @property {boolean} [dialog]             Present the user with an action configuration dialog?
 * @property {string} [rollMode]            Which roll mode to apply to the resulting message?
 */


/**
 * @typedef CrucibleActionHistoryEntry      A logged Action within the Actor's action history flag
 * @property {string} id                    The Action ID that was performed
 * @property {string|null} messageId        The ChatMessage ID that contains full action details
 * @property {({id: string}|CombatHistoryData)|null} combat The Combat state at the time the action occurred
 */

/**
 * @typedef CrucibleActionData
 */




/**
 * @typedef {Map<CrucibleActor,CrucibleActionOutcome>} CrucibleActionOutcomes
 */

/**
 * An object used to represent a set of tags.
 */
class ActionTagGroup {
  constructor({icon, tooltip}) {
    Object.defineProperties(this, {
      icon: {value: icon},
      tooltip: {value: tooltip}
    });
  }

  get empty() {
    return foundry.utils.isEmpty(this);
  }
}

/* -------------------------------------------- */

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
    const tag = SYSTEM.ACTION.TAGS[value]
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
 * The data schema used for an Action within a talent Item
 * @property {string} id                    The action identifier
 * @property {string} name                  The action name
 * @property {string} img                   An image for the action
 * @property {string} condition             An optional condition which must be met in order for the action to be used
 * @property {string} description           Text description of the action
 * @property {ActionRange} range            Range data for the action
 * @property {ActionTarget} target          Target data for the action
 * @property {ActionCost} cost              Cost data for the action
 * @property {Set<string>} tags             A set of tags in ACTION.TAGS which apply to this action
 */
export default class CrucibleAction extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      condition: new fields.StringField(),
      description: new fields.HTMLField({required: false, initial: undefined}),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        heroism: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
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
      effects: new fields.ArrayField(new fields.ObjectField()),
      tags: new fields.SetField(new fields.StringField({required: true, blank: false})),
      actionHooks: new fields.ArrayField(new fields.SchemaField({
        hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTION_HOOKS}),
        fn: new fields.JavaScriptField({async: true, gmOnly: true})
      }))
    }
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
   * The specific Item which contributed this Action. May be undefined if the Action did not originate from an Item.
   * @type {CrucibleItem}
   */
  item = this.item; // Defined during constructor

  /**
   * A specific Token that is performing this Action in the context of a Scene.
   * @type {CrucibleToken}
   */
  token = this.token; // Defined during constructor

  /**
   * A temporary MeasuredTemplate object used to establish targets for this action.
   * @type {MeasuredTemplateDocument|null}
   */
  template = this.template; // Defined during constructor

  /**
   * A mapping of outcomes which occurred from this action, arranged by target.
   * @type {undefined|CrucibleActionOutcomes}
   */
  outcomes;

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
   * Does this Action require a Template target
   * @type {boolean}
   */
  get requiresTemplate() {
    return !!SYSTEM.ACTION.TARGET_TYPES[this.target.type]?.template;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * One-time configuration of the CrucibleAction as part of construction.
   * @param {object} [options]            Options passed to the constructor context
   * @param {CrucibleActor} [options.actor]   A specific Actor to whom this Action is bound
   * @param {CrucibleItem} [options.item]     A specific Item that provided this Action
   * @param {MeasuredTemplateDocument} [options.template] A specific MeasuredTemplate that belongs to this Action
   * @param {CrucibleTokenObject} [options.token]  A specific token performing this Action
   * @param {ActionUsage} [options.usage]     Pre-configured action usage data
   * @inheritDoc */
  _configure({actor=null, item=null, template=null, token=null, usage={}, ...options}) {
    super._configure(options);
    Object.defineProperty(this, "actor", {value: actor, writable: false, configurable: true});
    Object.defineProperty(this, "item", {value: item ?? this.parent?.parent, writable: false, configurable: true});
    Object.defineProperty(this, "token", {value: token, writable: false, configurable: true});
    this.template = template instanceof foundry.documents.MeasuredTemplateDocument ? template : null;

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
      hasDice: false
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
      value: CrucibleAction.#prepareHooks(this.id, this.actionHooks),
      configurable: true
    });

    // Prepare action for actor
    if ( !options.lazy ) this.prepare();
  }

  /* -------------------------------------------- */

  /**
   * Prepare Hook functions for this Action.
   * @param {string[]} inlineHooks
   * @returns {Record<string, AsyncFunction|Function>}
   */
  static #prepareHooks(actionId, inlineHooks) {
    const hooks = {};

    // Inline script hooks
    for ( const {hook, fn} of inlineHooks ) {
      const config = SYSTEM.ACTION_HOOKS[hook];
      const fnClass = config.async ? foundry.utils.AsyncFunction : Function;
      if ( config ) hooks[hook] = new fnClass(...config.argNames, fn);
      else console.warn(`Invalid Action hook "${hook}" defined by Action "${this.id}"`)
    }

    // Pre-configured module hooks
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
      if ( !this.description && this.parent ) this.description = this.parent.description.public;
    }

    // Propagate and sort tags
    this.tags = new CrucibleActionTags(this._source.tags, this);

    // Prepare Cost
    this.cost.hands = 0; // Number of free hands required

    // Prepare Effects
    for ( const effect of this.effects ) {
      effect.name ||= this.name;
      effect.img ||= this.img;
      effect.tags = {
        scope: `Affects ${SYSTEM.ACTION.TARGET_SCOPES.label(effect.scope || this.target.scope)}`
      }
      if ( effect.duration ) {
        if ( effect.duration.turns ) effect.tags.duration = `${effect.duration.turns}T`;
        else if ( effect.duration.rounds ) effect.tags.duration = `${effect.duration.rounds}R`;
        else effect.tags.duration = "Until Ended";
      }
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
      performDeletions: true,
      inplace: true
    });
    context.parent = this.parent;
    context.usage = this.usage;
    context.actor ??= this.actor;
    context.token ??= this.token;
    context.template ??= this.template;
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
    this.actor.prepareAction(this);
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
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /**
   * Display a configuration prompt which customizes the Action usage.
   * @param {object[]} targets            Currently selected targets
   * @returns {Promise<object|null>}      The results of the configuration dialog
   */
  async configure(targets) {
    const roll = StandardCheck.fromAction(this);
    const response = await this.constructor.dialogClass.prompt({
      action: this,
      actor: this.actor,
      roll,
      targets
    });
    if ( !response ) return null;

    // Re-verify eligibility and targets after configuration
    try {
      targets = this.acquireTargets({strict: true});
    } catch(err) {
      ui.notifications.warn(err.message);
      return null;
    }
    return {action: this, targets};
  }

  /* -------------------------------------------- */

  /**
   * Execute an Action.
   * The action is cloned so that its data may be transformed throughout the workflow.
   * @param {CrucibleActionUsageOptions} [options]    Options which modify action usage
   * @returns {Promise<CrucibleActionOutcomes|undefined>}
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
   * @returns {Promise<CrucibleActionOutcomes|null>}
   */
  async #use({chatMessageOptions={}, dialog=true}={}) {

    // Assert that the action could possibly be used based on its tags
    try {
      this._canUse();
    } catch(err) {
      console.warn(err);
      return ui.notifications.warn(err.message);
    }

    // Acquire initially designated targets
    let targets = [];
    try {
      targets = this.acquireTargets({strict: false});
    } catch(err) {
      console.warn(err);
      return ui.notifications.warn(err.message);
    }

    // Prompt for action configuration
    if ( dialog ) {
      const configuration = await this.configure(targets);
      if ( configuration === null ) return null;  // Dialog closed
      if ( configuration.targets ) targets = configuration.targets;
    }

    // Pre-execution steps, possibly preventing activation
    // TODO configure outcomes before this so that outcomes can be modified here.
    // The idea is that we would call `_preActivate` every time the configuration of the action changes in the dialog
    // This would recreate outcomes cleanly every time, then call hooks that can modify those outcomes
    // This would allow different outcomes to have different boons/banes for example
    // Once all outcomes are configured, rolls happen for each outcome one at a time
    // Once all outcomes have been rolled, post roll workflows happen for each outcome, or maybe the _post hook
    // becomes something that collectively operates on the map of all outcomes

    try {
      await this._preActivate(targets);
    } catch(err) {
      console.warn(err);
      return ui.notifications.warn(err.message);
    }

    /**
     * Outcomes of the action, arranged by target.
     * @type {CrucibleActionOutcomes}
     */
    const outcomes = this.outcomes = new Map();

    // Iterate over designated targets
    for ( const target of targets ) {
      const actor = target.actor;

      // Perform dice rolls for the action
      const rolls = [];
      try {
        await this._roll(actor, rolls);
      } catch(err) {
        return ui.notifications.warn(err);
      }

      // Create outcome for target
      const outcome = this.#createOutcome(actor, rolls);
      outcomes.set(actor, outcome);
    }

    // Track the outcome for the original actor
    const self = this.#createSelfOutcome();
    outcomes.set(this.actor, self);

    // Finalize all outcomes
    for ( const outcome of outcomes.values() ) {
      await this._post(outcome);
      this.#finalizeOutcome(outcome);
    }

    // Create any Measured Template for the action
    if ( this.template ) {
      const templateData = this.template.toObject();
      delete templateData._id;
      const cls = getDocumentClass("MeasuredTemplate");
      this.template = await cls.create(templateData, {parent: canvas.scene});
      await this.template.object.draw();
    }

    // Record action history and create a ChatMessage to confirm the action
    const message = await this.toMessage(targets, {
      ...chatMessageOptions,
      confirmed: false,
      rollMode: this.usage.rollMode
    });

    // Persist action usage flags immediately rather than waiting for action confirmation
    this.#recordActionHistory(message);
    await this.actor.update({"flags.crucible": this.usage.actorFlags});
    return outcomes;
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
    const history = (this.actor.flags.crucible.actionHistory || []).slice(0, 99); // Maximum 100 history items
    history.unshift(lastAction);
    this.usage.actorFlags.actionHistory = history;
    return lastAction;
  }

  /* -------------------------------------------- */

  /**
   * @typedef {Object} ActionUseTarget
   * @property {Token} token
   * @property {Actor} actor
   * @property {string} name
   * @property {string} uuid
   * @property {string} [error]
   */

  /**
   * Acquire the targets for an action activation. For each target track both the Token and the Actor.
   * @param {object} [options]      Options which affect target acquisition
   * @param {boolean} [options.strict]  Validate that targets conform to the allowed number for the action?
   * @returns {ActionUseTarget[]}
   */
  acquireTargets({strict=true}={}) {
    let targets;
    let targetType = this.target.type;
    const targetCfg = SYSTEM.ACTION.TARGET_TYPES[targetType];
    if ( targetType === "summon" ) return [];

    // Acquire Template Targets
    if ( !!targetCfg.template ) {
      targets = canvas.ready ? this.#acquireTargetsFromTemplate() : [];
    }

    // Other Target Types
    else {
      if ( (targetType === "single") && this.target.self && !game.user.targets.some(t => t !== this.token) ) {
        targetType = "self";
      }
      switch ( targetType ) {
        case "none":
          return []
        case "self":
          const tokenTargets = this.actor.getActiveTokens(true).map(CrucibleAction.#getTargetFromToken);
          targets = tokenTargets.length
            ? tokenTargets
            : [{actor: this.actor, uuid: this.actor.uuid, name: this.actor.name, token: null}];
          break;
        case "single":
          targets = canvas.ready ? this.#acquireSingleTargets(strict) : [];
          break;
        default:
          ui.notifications.warn(`Automation for target type ${this.target.type} for action ${this.name} is not 
            yet supported, you must manually target affected tokens.`);
          targets = Array.from(game.user.targets).map(CrucibleAction.#getTargetFromToken);
          break;
      }
    }

    // Throw an error if any target had an error
    for ( const target of targets ) {
      if ( target.error && strict ) throw new Error(target.error);
    }
    return targets;
  }

  /* -------------------------------------------- */

  /**
   * Convert a Token into a ActionUseTarget data structure.
   * @param {Token} token
   * @returns {ActionUseTarget}
   */
  static #getTargetFromToken(token) {
    return {token, actor: token.actor, uuid: token.actor.uuid, name: token.name};
  }

  /* -------------------------------------------- */

  /**
   * Acquire target tokens using a temporary measured template.
   * @returns {ActionUseTarget[]}
   */
  #acquireTargetsFromTemplate() {
    const template = this.template;
    if ( !template ) return [];
    const {bounds, shape} = template.object;
    const shapePoly = shape instanceof PIXI.Polygon ? shape : shape.toPolygon();

    // Get targets from quadtree
    const {x, y} = template;
    const targetDispositions = this.#getTargetDispositions();
    const tokens = canvas.tokens.quadtree.getObjects(bounds, {collisionTest: ({t: token}) => {
      if ( token.actor === this.actor ) return false;
      if ( !targetDispositions.includes(token.document.disposition) ) return false;
      const hit = token.getHitRectangle();
      hit.x -= x;
      hit.y -= y;
      const ix = shapePoly.intersectRectangle(hit);
      return ix.points.length > 0;
    }});

    // Convert to target data structure
    const targets = Array.from(tokens).map(CrucibleAction.#getTargetFromToken);

    // Unlimited targets
    if ( !this.target.limit ) return targets;

    // If the target type is limited in the number of enemies it can affect, sort on proximity to the template origin
    for ( const t of targets ) t._distance = new Ray({x, y}, t.token.center).distance;
    targets.sort((a, b) => a._distance - b._distance);
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
      if ( strict ) throw new Error(game.i18n.format("ACTION.WarningInvalidTarget", {
        number: this.target.number,
        type: this.target.type,
        action: this.name
      }));
      return [];
    }

    // Too many targets
    if ( tokens.size > this.target.number ) {
      errorAll = game.i18n.format("ACTION.WarningIncorrectTargets", {
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
        t.error = game.i18n.localize("ACTION.WarningCannotTargetSelf");
        continue;
      }
      const range = crucible.api.canvas.grid.getLinearRangeCost(this.token.object, token);
      if ( this.range.minimum && (range < this.range.minimum) ) {
        t.error ||= game.i18n.format("ACTION.WarningMinimumRange", {min: this.range.minimum});
      }
      if ( this.range.maximum && (range > this.range.maximum) ) {
        t.error ||= game.i18n.format("ACTION.WarningMaximumRange", {max: this.range.maximum});
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
    for ( const outcome of this.outcomes.values() ) {
      if ( outcome.target === this.actor ) continue;
      return false;
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
    let disposition = this.actor.getActiveTokens(true, true)[0]?.disposition ?? this.actor.prototypeToken.disposition;

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
  /*  Action Outcome Management                   */
  /* -------------------------------------------- */

  /**
   * Translate the action usage result into an outcome to be persisted.
   * @param {CrucibleActor} actor
   * @param {AttackRoll[]} [rolls]
   * @param {boolean} [effects]
   * @returns {CrucibleActionOutcome}
   */
  #createOutcome(actor, rolls=[], effects=true) {
    const outcome = {
      target: actor,
      rolls: rolls,
      resources: {},
      actorUpdates: {},
      statusText: []
    }
    outcome.effects = effects ? this.#attachEffects(actor, outcome) : [];
    return outcome;
  }

  /* -------------------------------------------- */

  /**
   * Apply the effects caused by an Action to targeted Actors when the result is confirmed.
   * @param {CrucibleActor} target              The target actor
   * @param {CrucibleActionOutcomes} outcome    The outcome being prepared
   * @returns {object[]}                        An array of Active Effect data to attach to the outcome
   */
  #attachEffects(target, outcome) {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    return this.effects.reduce((effects, {scope, ...effectData}) => {
      scope ??= this.target.scope;
      if ( scope === scopes.NONE ) return effects;
      effectData.name ||= this.name;

      // Self target
      if ( target === this.actor ) {
        if ( ![scopes.SELF, scopes.ALL].includes(scope) ) return effects;
      }

      // Target other
      else {
        if ( scope === scopes.SELF ) return effects;
        if ( outcome.rolls.length && !outcome.rolls.some(r => r.isSuccess) ) return effects;
      }

      // For turn-based effects, if the current actor comes after the target in initiative order

      // TODO delete
      // // Offset effect start round for initiative order
      // effectData.duration ||= {};
      // if ( game.combat ) {
      //   effectData.duration.startRound = game.combat.round;
      //   effectData.duration.startTurn = 0;
      //   const c0 = game.combat.getCombatantByActor(this.actor);
      //   const c1 = game.combat.getCombatantByActor(target);
      //   if ( c0 && c1 ) {
      //     const t0 = c0 && game.combat.turns.indexOf(c0);
      //     const t1 = c1 && game.combat.turns.indexOf(c1);
      //     if ( t1 < t0 ) effectData.duration.startRound += 1;
      //   }
      // }

      // Add effect
      effects.push(foundry.utils.mergeObject({
        _id: SYSTEM.EFFECTS.getEffectId(this.id),
        description: this.description,
        icon: this.img,
        origin: this.actor.uuid
      }, effectData));
      return effects;
    }, []);
  }

  /* -------------------------------------------- */

  /**
   * Create the outcome object that applies to the Actor who performed the Action.
   * @returns {CrucibleActionOutcome}           The outcome for the Actor
   */
  #createSelfOutcome() {

    // Determine whether to apply effects
    let applySelfEffects = Array.from(this.outcomes.keys()).length === 0;
    for ( const outcome of this.outcomes.values() ) {
      if ( outcome.target === this.actor ) continue;
      if ( !outcome.rolls.length || outcome.rolls.some(r => r.isSuccess) ) applySelfEffects = true;
    }

    // Create the outcome
    const self = this.outcomes.get(this.actor) || this.#createOutcome(this.actor, [], applySelfEffects);

    // Record actor updates to apply
    const u = self.actorUpdates;
    foundry.utils.mergeObject(u, foundry.utils.expandObject(this.usage.actorUpdates));
    u.system ||= {};
    if ( u.system.status ) {
      console.error(`Crucible | "system.status" key present in action.usage.actorUpdates: ${this.name}`);
    }
    u.system.status = Object.assign(u.system.status || {}, {lastAction: this.id},
      foundry.utils.expandObject(this.usage.actorStatus));

    // Attach summons to the self-outcome
    if ( Array.isArray(this.usage.summons) ) self.summons = this.usage.summons;

    // Incur resource cost
    for ( const [k, v] of Object.entries(this.cost) ) {
      self.resources[k] = (self.resources[k] || 0) - v;
    }
    return self;
  }

  /* -------------------------------------------- */

  /**
   * Apply final flags to the outcome after post-roll workflows have occurred.
   * @param {CrucibleActionOutcome} outcome     The outcome being finalized
   */
  #finalizeOutcome(outcome) {
    for ( const roll of outcome.rolls ) {
      const damage = roll.data.damage || {};
      const resource = damage.resource ?? "health";
      outcome.resources[resource] ??= 0;
      outcome.resources[resource] += (damage.total ?? 0) * (damage.restoration ? 1 : -1);
      if ( roll.isCriticalSuccess ) outcome.criticalSuccess = true;
      else if ( roll.isCriticalFailure) outcome.criticalFailure = true;
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
    if ( preMitigation <= 1 ) return 1; // Never do less than 1 damage

    // Resistance and Vulnerability does not apply to Restoration
    const postMitigation = restoration ? preMitigation : preMitigation - resistance;

    // Constrain total damage between 1 and 2x the pre-mitigation value
    return Math.clamp(postMitigation, 1, 2 * preMitigation);
  }

  /* -------------------------------------------- */
  /*  Action Lifecycle Methods                    */
  /* -------------------------------------------- */

  /**
   * A generator which provides the test conditions for action lifecycle.
   * @returns {Generator<Object|*, void, *>}
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
   * Preparation, the first step in the Action life-cycle.
   * @protected
   */
  _prepare() {
    for ( const test of this._tests() ) {
      if ( test.prepare instanceof Function ) {
        try {
          test.prepare.call(this);
        } catch(err) {
          console.error(new Error(`Failed preparation for Action "${this.id}"`, {cause: err}));
        }
      }
    }
    this.actor?.callActorHooks("prepareAction", this);
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
      throw new Error(game.i18n.format("ACTION.WarningCannotSpendAction", {
        name: this.actor.name
      }))
    }

    // Cannot spend focus
    if ( this.cost.focus ) {
      let focusBlock = "";
      if ( statuses.has("broken") ) focusBlock = "broken";
      else if ( statuses.has("enraged") && !this.actor.talentIds.has("iramancer0000000") ) focusBlock = "enraged";
      if ( focusBlock ) throw new Error(game.i18n.format("ACTION.WarningCannotSpendFocus", {
        name: this.actor.name,
        status: game.i18n.localize(`ACTIVE_EFFECT.STATUSES.${focusBlock.titleCase()}`)
      }));
    }

    // Cannot afford action cost
    if ( this.cost.action > r.action.value ) {
      throw new Error(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.action.label,
        action: this.name
      }));
    }

    // Cannot afford focus cost
    if ( this.cost.focus > r.focus.value ) {
      throw new Error(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.focus.label,
        action: this.name
      }));
    }

    // Cannot afford heroism cost
    if ( this.cost.heroism > r.heroism.value ) {
      throw new Error(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.heroism.label,
        action: this.name
      }));
    }

    // Test each action tag
    for ( const test of this._tests() ) {
      if ( !(test.canUse instanceof Function) ) continue;
      let errorReason;
      let errorOptions = {};
      try {
        const can = test.canUse.call(this);
        if ( can === false ) errorReason = `with tag ${test.label}`;
      } catch(err) {
        errorReason = err.message;
        errorOptions = {cause: err};
      }
      if ( errorReason ) {
        throw new Error(game.i18n.format("ACTION.WarningCannotUse", {
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
   * @param {Combatant} [combatant]     The Combatant associated with this actor, if any
   * @returns {boolean}                 Should the action be displayed?
   * @private
   */
  _displayOnSheet(combatant) {
    combatant ||= game.combat?.getCombatantByActor(this.actor);
    for ( const test of this._tests() ) {
      if ( !(test.displayOnSheet instanceof Function) ) continue;
      if ( test.displayOnSheet.call(this, combatant) === false ) return false;
    }
    return true;
  }

  /* -------------------------------------------- */

  /**
   * An action hook that fires whenever the targets of the action change.
   * This happens immediately when the action is designated for use and again when targets change during configuration.
   * It happens a final time after configuration is confirmed and targets are finalized.
   * Workflows performed in this hook must be idempotent since the hook can be called multiple times.
   *
   * @param {ActionUseTarget[]} targets       The array of targets affected by the action
   * @protected
   */
  async _acquireTargets(targets) {
    for ( const test of this._tests() ) {
      if ( test.preActivate instanceof Function ) await test.acquireTargets.call(this, targets);
    }
    this.actor.callActorHooks("acquireActionTargets", this, targets);
  }

  /* -------------------------------------------- */

  /**
   * Pre-activation steps which happen before the action is evaluated.
   * This could be used to mutate the array of targets which are affected by the action.
   * Pre-activation happens *after* dialog configuration of the action.
   * @param {ActionUseTarget[]} targets       The array of targets affected by the action
   * @protected
   */
  async _preActivate(targets) {
    for ( const test of this._tests() ) {
      if ( test.preActivate instanceof Function ) await test.preActivate.call(this, targets);
    }
    this.actor.callActorHooks("preActivateAction", this, targets);
  }

  /* -------------------------------------------- */

  /**
   * Handle execution of dice rolls associated with the Action.
   * @param {CrucibleActor} target
   * @param {StandardCheck[]} rolls
   * @protected
   */
  async _roll(target, rolls) {
    for ( const test of this._tests() ) {
      if ( test.roll instanceof Function ) {
        await test.roll.call(this, target, rolls);
      }
    }
    this.actor.callActorHooks("rollAction", this, target, rolls);
  }

  /* -------------------------------------------- */

  /**
   * Handle post-roll modification of the Rolls array
   * @param {CrucibleActionOutcome} outcome
   * @returns {Promise<void>}
   * @protected
   */
  async _post(outcome) {
    for ( const test of this._tests() ) {
      if ( test.postActivate instanceof Function ) {
        await test.postActivate.call(this, outcome);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Confirm action outcomes, applying actor and active effect changes as a result.
   * This method is factored out so that it may be called directly in cases where the action can be auto-confirmed.
   * @param {object} [options]                  Options which affect the confirmation workflow
   * @param {boolean} [options.reverse]           Reverse the action instead of applying it?
   * @returns {Promise<void>}
   */
  async confirm({reverse=false}={}) {
    if ( !this._prepared ) throw new Error("A CrucibleAction must be prepared for an Actor before it can be confirmed.");
    if ( !this.outcomes ) throw new Error(`Cannot confirm Action ${this.id} which has no configured outcomes.`)

    // Custom Action confirmation steps
    for ( const test of this._tests() ) {
      if ( !(test.confirm instanceof Function) ) continue
      try {
        await test.confirm.call(this, reverse);
      } catch(err) {
        console.error(new Error(`"${this.id}" action confirmation failed`, {cause: err}));
      }
    }

    // Additional Actor-specific consequences
    this.actor.onDealDamage(this, this.outcomes);

    // Delete any Measured Template that was placed
    if ( this.template ) await this.template.delete();

    // Apply outcomes
    for ( const outcome of this.outcomes.values() ) {
      await outcome.target.applyActionOutcome(this, outcome, {reverse});
    }

    // Record heroism
    try {
      await this.#recordHeroism(reverse);
    } catch(err) {
      console.error(new Error(`Failed to record Heroism from Action "${this.id}"`, {cause: err}));
    }
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
      if ( actor?.type !== "hero" ) continue;
      await actor.alterResources({heroism: award})
    }
  }

  /* -------------------------------------------- */

  /**
   * Can this Action generate heroism?
   * @returns {boolean}
   */
  #canGenerateHeroism() {
    if ( !this.actor.inCombat ) return false;
    for ( const outcome of this.outcomes.values() ) {
      if ( outcome.target === this.actor ) continue;
      if ( outcome.effects.length ) return true;
      for ( const [k, v] of Object.entries(outcome.resources) ) {
        if ( !(k in SYSTEM.RESOURCES) ) continue;
        const isRestoration = !!this.damage?.restoration;
        if ( isRestoration && (v > 0) ) return true;
        else if ( !isRestoration && (v < 0) ) return true;
      }
    }
    return false;
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
    if ( !cost.weapon ) return false;
    if ( ["mainhand", "offhand", "twohand", "natural"].some(t => tags.includes(t)) ) return false;
    return this.actor?.equipment.weapons.hasChoice;
  }

  /* -------------------------------------------- */

  /**
   * Obtain an object of tags which describe the Action.
   * @returns {ActionTags}
   */
  getTags() {
    const tags = {
      activation: new ActionTagGroup({icon: "fa-solid fa-banner", tooltip: "Activation Tags"}),
      action: new ActionTagGroup({icon: "fa-solid fa-lightning-bolt", tooltip: "Action Tags"}),
      context: new ActionTagGroup({icon: "fa-solid fa-bullseye", tooltip: "Context Tags"}),
    };

    // Action Tags
    for (let t of this.tags) {
      const tag = SYSTEM.ACTION.TAGS[t];
      if ( tag.internal ) continue;
      else tags.action[tag.tag] = game.i18n.localize(tag.label);
    }

    // Context Tags
    const ctx = this.usage.context;
    tags.context = new ActionTagGroup({icon: ctx.icon || "fa-solid fa-bullseye", tooltip: ctx.label || "Context Tags"});
    for ( const [k, v] of Object.entries(ctx.tags) ) {
      tags.context[k] = v;
    }

    // Target
    if ( this.target.type !== "none" ) {
      const parts = [SYSTEM.ACTION.TARGET_TYPES[this.target.type].label];
      if ( this.target.number > 1 ) parts.unshift(this.target.number);
      if ( this.range.maximum ) {
        let r = `${this.range.maximum}ft`;
        if ( this.range.weapon && !this.actor ) r = `+${r}`;
        parts.push(r);
      }
      if ( this.target.limit > 0 ) parts.push(`Limit ${this.target.limit}`);
      if ( this.target.multiple > 1 ) parts.push(`x${this.target.multiple}`);
      tags.activation.target = parts.join(" ");
    }

    // Cost
    const cost = this._trueCost || this.cost;
    let ap = cost.action ?? 0;
    if ( this.cost.weapon && !this.usage.strikes?.length ) { // Strike sequence not yet determined
      if ( ap > 0 ) tags.activation.ap = `W+${ap}A`;
      else if ( ap < 0 ) tags.activation.ap = `W${ap}A`;
      else tags.activation.ap = "W";
    }
    else tags.activation.ap = `${ap}A`;
    if ( Number.isFinite(cost.focus) && (cost.focus !== 0) ) tags.activation.fp = `${cost.focus}F`;
    if ( Number.isFinite(cost.heroism) && cost.heroism ) tags.activation.hp = `${cost.heroism}H`;
    if ( Number.isFinite(cost.health) && (cost.health !== 0) ) tags.activation.health = `${cost.health}HP`; // e.g. Blood Magic
    if ( !(tags.activation.ap || tags.activation.fp || tags.activation.hp || tags.activation.health) ) tags.activation.ap = "Free";
    if ( cost.hands ) tags.activation.hands = cost.hands > 1 ? `${cost.hands} Hands` : `1 Hand`;
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Render this Action as HTML for a tooltip card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    await foundry.applications.handlebars.loadTemplates([this.constructor.TOOLTIP_TEMPLATE]);
    return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, {
      action: this,
      tags: this.getTags()
    });
  }

  /* -------------------------------------------- */

  /**
   * Render the action to a chat message including contained rolls and results
   * @param {ActionUseTarget[]} targets           Targets affected by this action usage
   * @param {object} options                      Context options for ChatMessage creation
   * @param {boolean} [options.confirmed]           Were the outcomes auto-confirmed?
   * @returns {Promise<ChatMessage>}              The created ChatMessage document
   */
  async toMessage(targets, {confirmed=false, ...options}={}) {

    // Prepare action data
    const actionData = {
      actor: this.actor.uuid,
      action: this.toObject(false), // Finalized action data rather than source
      confirmed,
      outcomes: [],
    };
    if ( this.item ) actionData.item = this.item.uuid;
    if ( this.template ) actionData.template = this.template.uuid;
    if ( this.token ) actionData.token = this.token.uuid;

    // Record outcomes
    const rolls = [];
    const hasMultipleTargets = Array.from(this.outcomes.values()).filter(o => o.rolls.length).length > 1;
    for ( const outcome of this.outcomes.values() ) {
      const {target, rolls: outcomeRolls, ...outcomeData} = outcome;
      outcomeData.target = target.uuid;
      outcomeData.rolls = outcomeRolls.map((roll, i) => {
        roll.data.newTarget = hasMultipleTargets && (i === 0);
        roll.data.index = rolls.length;
        rolls.push(roll);
        return roll.data.index;
      });
      actionData.outcomes.push(outcomeData);
    }

    // Render HTML template
    const tags = this.getTags();
    const templatePath = "systems/crucible/templates/dice/action-use-chat.hbs";
    const content = await foundry.applications.handlebars.renderTemplate(templatePath, {
      action: this,
      actor: this.actor,
      context: this.usage.context,
      hasActionTags: !tags.action.empty,
      hasContextTags: !tags.context.empty,
      hasTargets: !["self", "none"].includes(this.target.type),
      outcomes: this.outcomes,
      tags,
      targets,
      template: this.template
    });

    // Create chat message
    return ChatMessage.create({
      content: content,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      rolls: rolls,
      flags: {crucible: actionData}
    }, options);
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
    const flagsUpdate = {confirmed: !reverse};
    await action.confirm({reverse});
    return message.update({flags: {crucible: flagsUpdate}});
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
      token: tokenUuid,
      action: actionData,
      template: templateUuid,
      outcomes
    } = message.flags.crucible || {};
    if ( !actionData ) throw new Error(`ChatMessage ${message.id} does not contain CrucibleAction data`);

    const actor = fromUuidSync(actorUuid) || ChatMessage.getSpeakerActor(message.speaker);
    const item = fromUuidSync(itemUuid);
    const template = fromUuidSync(templateUuid);
    const token = fromUuidSync(tokenUuid);

    // Rebuild action from explicit data
    const actionId = actionData.id;
    const actionContext = {parent: item?.system, actor, item, token, template, lazy: true};
    let action;
    if ( actionId in actor.actions ) action = actor.actions[actionId].clone({}, actionContext);
    else if ( actionId.startsWith("spell.") ) {
      action = new game.system.api.models.CrucibleSpellAction(actionData, actionContext);
    }
    else action = new this(actionData, actionContext);
    action.prepare();

    // Reconstruct outcomes
    action.outcomes = new Map();
    for ( const {target: targetUuid, rolls: outcomeRolls, ...outcomeData} of outcomes ) {
      let target = fromUuidSync(targetUuid);
      if ( target instanceof TokenDocument ) target = target.actor;
      const outcome = {target, rolls: outcomeRolls.map(i => message.rolls[i]), ...outcomeData};
      action.outcomes.set(target, outcome);
    }
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Delete a measured template if the chat message which originated it is deleted.
   * @param {ChatMessage} message     The ChatMessage document that will be deleted
   * @param {object} options          Options which modify message deletion
   * @param {string} userId           The ID of the deleting user
   * @returns {Promise<void>}
   */
  static async onDeleteChatMessage(message, options, userId) {
    const template = message.flags.crucible?.template;
    if ( !template ) return;
    const templateDoc = await fromUuid(template);
    if ( templateDoc ) await templateDoc.delete();
  }

  /* -------------------------------------------- */

  /**
   * Create an environmental hazard action.
   * @param {CrucibleActor} actor
   * @param {object} actionData
   * @param {string[]} tags
   * @param {number} [hazard=0]
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
}
