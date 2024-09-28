import StandardCheck from "../dice/standard-check.mjs";
import ActionUseDialog from "../dice/action-use-dialog.mjs";
import ActionConfig from "../applications/config/action.mjs";


/**
 * @typedef {Object} ActionContext
 * @property {string} type                  The type of context provided, i.e. "weapon", "spell", etc...
 * @property {string} label                 A string label providing context info
 * @property {string[]} tags                An array of tags which describe the context
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
 * @property {string} [skillId]             The skill ID being used.
 * @property {CrucibleItem} [weapon]        A specific weapon item being used
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
 * @property {boolean} [weakened]         Did the target become weakened?
 * @property {boolean} [broken]           Did the target become broken?
 * @property {boolean} [incapacitated]    Did the target become incapacitated?
 * @property {boolean} [criticalSuccess]  Did the damage contain a Critical Hit
 * @property {boolean} [criticalFailure]  Did the damage contain a Critical Miss
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
        limit: new fields.NumberField({required: false, nullable: false, initial: undefined, integer: true, min: 1})
      }),
      effects: new fields.ArrayField(new fields.ObjectField()),
      tags: new fields.SetField(new fields.StringField({required: true, blank: false})),
      actionHooks: new fields.ArrayField(new fields.SchemaField({
        hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTION_HOOKS}),
        fn: new fields.StringField({required: true, blank: false, nullable: false, gmOnly: true}),
      }))
    }
  }

  /**
   * A set of localization prefix paths which are used by this data model.
   * @type {string[]}
   */
  static LOCALIZATION_PREFIXES = ["ACTION"];

  /**
   * A temporary MeasuredTemplate object used to establish targets for this action.
   * @type {MeasuredTemplate|null}
   */
  template = null;

  /**
   * A mapping of outcomes which occurred from this action, arranged by target.
   * @type {undefined|CrucibleActionOutcomes}
   */
  outcomes;

  /**
   * Configure the Dialog class that provides the user with an interface to configure this Action.
   * @type {typeof ActionUseDialog}
   */
  static dialogClass = ActionUseDialog;

  /**
   * A sheet used to configure this Action.
   * @returns {*}
   */
  get sheet() {
    this.#sheet ||= new ActionConfig({action: this});
    return this.#sheet;
  }

  #sheet;

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

  /** @inheritDoc */
  _initializeSource(source, options) {
    if ( "_hooks" in source ) {
      this._hooks = source._hooks;
      delete source._hooks;
    }
    return super._initializeSource(source, options);
  }

  /* -------------------------------------------- */

  /**
   * One-time configuration of the CrucibleAction as part of construction.
   * @param {object} [options]            Options passed to the constructor context
   * @param {CrucibleActor} [options.actor]   A specific actor to whom this action is bound
   * @param {CrucibleTokenObject} [options.token]  A specific token performing this Action
   * @param {ActionUsage} [options.usage]     Pre-configured action usage data
   * @inheritDoc */
  _configure({actor=null, token=null, usage, ...options}) {
    super._configure(options);

    /**
     * Is this Action owned and prepared for a specific Actor?
     * @type {CrucibleActor}
     */
    Object.defineProperty(this, "actor", {value: actor, writable: false, configurable: true});

    /**
     * A specific Token which is performing the Action.
     * @type {CrucibleTokenObject}
     */
    Object.defineProperty(this, "token", {value: token, writable: false, configurable: true});

    /**
     * Dice roll bonuses which modify the usage of this action.
     * This object is only initialized once and retained through future initialization workflows.
     * @type {ActionUsage}
     */
    Object.defineProperty(this, "usage", {value: usage || {
      actorFlags: {},
      actorStatus: {},
      actorUpdates: {},
      bonuses: {ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1},
      boons: {},
      banes: {},
      context: {type: undefined, label: undefined, icon: undefined, tags: new Set()},
      hasDice: false
    }});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize(options) {
    super._initialize(options);

    // Prepare base data
    this._prepareData();

    /**
     * Configured hook functions invoked by the action
     * @type {Object<string, {fn: Function}[]>}
     */
    Object.defineProperty(this, "hooks", {
      value: this.actionHooks.reduce((obj, {hook, fn}) => {
        const config = SYSTEM.ACTION_HOOKS[hook];
        const fnClass = config.async ? foundry.utils.AsyncFunction : Function;
        if ( config ) obj[hook] = new fnClass(...config.argNames, fn);
        else console.warn(`Invalid Action hook "${hook}" defined by Action "${this.id}"`)
        return obj;
      }, {}),
      writable: false,
      configurable: true
    });
    if ( this._hooks ) {
      for ( const [hook, fn] of Object.entries(this._hooks) ) this.hooks[hook] = fn;
    }

    // Prepare action for actor
    if ( this.actor ) {
      this.actor.prepareAction(this);
      this._prepare();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for the Action.
   * @protected
   */
  _prepareData() {
    const talent = this.parent?.parent;
    if ( talent ) {
      this.name ||= talent.name;
      this.img ||= talent.img;
      if ( !this.description && this.parent ) this.description = this.parent.description.public;
    }

    // Prepare Cost
    this.cost.hands = 0; // Number of free hands required

    // Prepare Effects
    for ( const effect of this.effects ) {
      effect.name ||= this.name;
      effect.img ||= this.img;
      effect.tags = {
        scope: `Affects ${SYSTEM.ACTION.TARGET_SCOPES.label(effect.scope || this.target.scope)}`,
        duration: effect.duration?.turns ? `${effect.duration.turns}R` : "Until Ended"
      }
    }

    // Reset bonuses
    this.usage.actorStatus.basicStrike = false; // Set later, if true
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
   * Bind an Action to a specific Actor.
   * @param {CrucibleActor} actor     The Actor to which the action should be attached
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
    actionData._hooks = this._hooks;
    Object.assign(context, {parent: this.parent, actor: this.actor, usage: this.usage});
    const clone = new this.constructor(actionData, context);
    clone.template = this.template;

    // When cloning a single action, we need to run through "prepareActions" actor hooks on the clone
    if ( this.actor ) this.actor.callActorHooks("prepareActions", {[clone.id]: clone});
    return clone;
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
      this._canUse(targets);
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
   * @param {object} [options]                      Options which modify action usage
   * @param {CrucibleTokenObject} [options.token]     A specific Token which is performing the action
   * @param {boolean} [options.chatMessage]           Automatically create a ChatMessage for the action?
   * @param {boolean} [options.dialog]                Present the user with an action configuration dialog?
   * @param {string} [options.rollMode]               Which roll mode to apply to the resulting message?
   * @returns {Promise<CrucibleActionOutcomes|undefined>}
   */
  async use({token, ...options}={}) {
    if ( !this.actor ) throw new Error("A CrucibleAction may not be used unless it is bound to an Actor");

    // Redirect to spellcasting
    if ( this.id === "cast" ) {
      const spell = crucible.api.models.CrucibleSpellAction.getDefault(this.actor);
      return spell.use({token, ...options});
    }

    // Infer the Token performing the Action
    if ( !token ) {
      let tokens = this.actor.getActiveTokens();
      if ( tokens.length > 1 ) tokens = tokens.filter(t => t.controlled);
      if ( tokens.length === 1 ) token = tokens[0];
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
   * @param {boolean} [options.chatMessage]         Automatically create a ChatMessage for the action?
   * @param {boolean} [options.dialog]              Present the user with an action configuration dialog?
   * @param {string} [options.rollMode]             Which roll mode to apply to the resulting message?
   * @returns {Promise<CrucibleActionOutcomes|null>}
   */
  async #use({chatMessage=true, chatMessageOptions={}, dialog=true}={}) {

    // Acquire initially designated targets
    let targets = [];
    try {
      targets = this.acquireTargets({strict: false});
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Assert that the action can be used based on its tags
    try {
      this._canUse(targets);
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Pre-execution steps
    await this._preActivate(targets)

    // Prompt for action configuration
    if ( dialog ) {
      const configuration = await this.configure(targets);
      if ( configuration === null ) return null;  // Dialog closed
      if ( configuration.targets ) targets = configuration.targets;
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
        return ui.notifications.warn(err.message);
      }

      // Create outcome for target
      const outcome = this.#createOutcome(actor, rolls);
      await this._post(outcome);
      this.#finalizeOutcome(outcome);
      outcomes.set(actor, outcome);
    }

    // Track the outcome for the original actor
    outcomes.set(this.actor, this.#createSelfOutcome());
    const confirmed = !chatMessage || this.canAutoConfirm();

    // Create any Measured Template for the action
    if ( this.template ) {
      const templateData = this.template.toObject();
      delete templateData._id;
      const cls = getDocumentClass("MeasuredTemplate");
      this.template = await cls.create(templateData, {parent: canvas.scene});
      await this.template.object.draw();
    }

    // Record the action as a chat message
    const message = chatMessage && await this.toMessage(targets, {
      ...chatMessageOptions,
      confirmed,
      rollMode: this.usage.rollMode
    });

    // Apply action usage flags (immediately)
    await this.actor.update({"flags.crucible": this.usage.actorFlags});

    // Auto-confirm the action?
    // TODO move auto-confirm to be a GM action on chat message creation
    if ( confirmed ) {
      if ( message?.rolls.length && ("dice3d" in game) ) await game.dice3d.waitFor3DAnimationByMessageID(message.id);
      await this.confirm();
    }
    return outcomes;
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
    if ( !canvas.ready ) return [];
    let targets;

    // Acquire Template Targets
    if ( this.requiresTemplate ) {
      targets = this.#acquireTargetsFromTemplate();
    }

    // Other Target Types
    else {
      switch ( this.target.type ) {
        case "none": case "summon":
          return []
        case "self":
          targets = this.actor.getActiveTokens(true).map(CrucibleAction.#getTargetFromToken);
          break;
        case "single":
          targets = this.#acquireSingleTargets(strict);
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
      if ( (token === this.token) && !this.damage.restoration ) {
        t.error = game.i18n.localize("ACTION.WarningCannotTargetSelf");
        continue;
      }
      const range = crucible.api.grid.getLinearRangeCost(this.token, token);
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
      actorUpdates: {}
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

      // Offset effect start round for initiative order
      effectData.duration ||= {};
      if ( game.combat ) {
        effectData.duration.startRound = game.combat.round;
        effectData.duration.startTurn = 0;
        const c0 = game.combat.getCombatantByActor(this.actor);
        const c1 = game.combat.getCombatantByActor(target);
        if ( c0 && c1 ) {
          const t0 = c0 && game.combat.turns.indexOf(c0);
          const t1 = c1 && game.combat.turns.indexOf(c1);
          if ( t1 < t0 ) effectData.duration.startRound += 1;
        }
      }

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
    for ( const t of this.tags ) {
      const tag = SYSTEM.ACTION.TAGS[t];
      if ( !tag ) continue;
      yield tag;
    }
    yield this.hooks;
  }

  /* -------------------------------------------- */

  /**
   * Preparation, the first step in the Action life-cycle.
   * @protected
   */
  _prepare() {
    for ( const test of this._tests() ) {
      if ( test.prepare instanceof Function ) test.prepare.call(this);
    }
  }

  /* -------------------------------------------- */

  /**
   * Test whether an action can be performed.
   * @param {ActionUseTarget[]} targets       The array of targets designated for the action
   * @throws {Error}                          An error if the action cannot be taken
   * @protected
   */
  _canUse(targets=[]) {
    const r = this.actor.system.resources;
    const statuses = this.actor.statuses;

    // Cannot spend action
    if ( this.cost.action && this.actor.isIncapacitated ) {
      throw new Error(game.i18n.format("ACTION.WarningCannotSpendAction", {
        name: this.actor.name
      }))
    }

    // Cannot afford action cost
    if ( this.cost.action > r.action.value ) {
      throw new Error(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: this.actor.name,
        resource: SYSTEM.RESOURCES.action.label,
        action: this.name
      }));
    }

    // Cannot spend focus
    if ( this.cost.focus ) {
      let focusBlock = "";
      if ( statuses.has("broken") ) focusBlock = "broken";
      else if ( statuses.has("enraged") && !this.actor.talentIds.has("iramancer0000000") ) focusBlock = "enraged";
      if ( focusBlock ) throw new Error(game.i18n.format("ACTION.WarningCannotSpendFocus", {
        name: this.actor.name,
        status: game.i18n.localize(`EFFECT.STATUSES.${focusBlock.titleCase()}`)
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

    // Test each action tag
    for ( const test of this._tests() ) {
      if ( !(test.canUse instanceof Function) ) continue;
      const can = test.canUse.call(this, targets);
      if ( can === false ) throw new Error(game.i18n.format("ACTION.WarningCannotUseTag", {
        name: this.actor.name,
        action: this.name,
        tag: test.label || ""
      }));
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
   * Pre-activation steps which happen before the action is evaluated.
   * This could be used to mutate the array of targets which are affected by the action.
   * @param {ActionUseTarget[]} targets       The array of targets affected by the action
   * @protected
   */
  async _preActivate(targets) {
    for ( const test of this._tests() ) {
      if ( test.preActivate instanceof Function ) await test.preActivate.call(this, targets);
    }
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
  /*  Display and Formatting Methods              */
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
      if ( !tag?.label ) continue;
      else tags.action[tag.tag] = game.i18n.localize(tag.label);
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
    if ( cost.weapon && !this.actor ) {  // Un-owned actions which include weapon cost
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

    // Duration
    let duration = 0;
    for ( const effect of this.effects ) {
      if ( effect.duration?.rounds ) duration = Math.max(effect.duration?.rounds);
    }
    if ( duration ) tags.action.duration = `${duration}R`;
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Render the action to a chat message including contained rolls and results
   * @param {ActionUseTarget[]} targets           Targets affected by this action usage
   * @param {object} options                      Context options for ChatMessage creation
   * @param {boolean} [options.confirmed]           Were the outcomes auto-confirmed?
   * @param {boolean} [options.temporary]           Create only a temporary in-memory message
   * @returns {Promise<ChatMessage>}              The created ChatMessage document
   */
  async toMessage(targets, {confirmed=false, temporary=false, ...options}={}) {

    // Prepare action data
    const actionData = {
      actor: this.actor.uuid,
      action: this.id,
      confirmed,
      outcomes: [],
    };
    if ( this.template ) actionData.template = this.template.uuid;
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
    const content = await renderTemplate("systems/crucible/templates/dice/action-use-chat.hbs", {
      action: this,
      actionTags: tags.action,
      activationTags: tags.activation,
      actor: this.actor,
      context: this.usage.context,
      hasActionTags: !foundry.utils.isEmpty(tags.action),
      outcomes: this.outcomes,
      showTargets: this.target.type !== "self",
      targets,
      template: this.template
    });

    // Create chat message
    const messageData = {
      type: CONST.CHAT_MESSAGE_TYPES[rolls.length > 0 ? "ROLL": "OTHER"],
      content: content,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      rolls: rolls,
      flags: {
        crucible: actionData
      }
    }
    return temporary ? new ChatMessage(messageData) : ChatMessage.create(messageData, options);
  }

  /* -------------------------------------------- */

  /**
   * Confirm the result of an Action that was recorded as a ChatMessage.
   */
  static async confirm(message, {action, reverse=false}={}) {
    action ||= this.fromChatMessage(message);
    const flagsUpdate = {confirmed: !reverse};
    await action.confirm({reverse});
    return message.update({flags: {crucible: flagsUpdate}});
  }

  /* -------------------------------------------- */

  /**
   * Reconstitute an Action from a ChatMessage which contains it.
   * @param {ChatMessage} message     The ChatMessage instance containing a used Action
   * @returns {CrucibleAction}        The reconstituted Action instance
   */
  static fromChatMessage(message) {
    const {action: actionId, template: templateId, outcomes} = message.flags.crucible || {};
    if ( !actionId ) throw new Error(`ChatMessage ${message.id} does not contain CrucibleAction data`);

    // Get the Actor and Action
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    let action;
    if ( actionId.startsWith("spell.") ) {
      action = game.system.api.models.CrucibleSpellAction.fromId(actionId, {actor});
    }
    else action = actor.actions[actionId]?.clone() || null;

    // Load a MeasuredTemplate associated with this action
    if ( templateId ) action.template = fromUuidSync(templateId);

    // Re-prepare Action outcomes
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
   * Confirm action outcomes, applying actor and active effect changes as a result.
   * This method is factored out so that it may be called directly in cases where the action can be auto-confirmed.
   * @param {object} [options]                  Options which affect the confirmation workflow
   * @param {boolean} [options.reverse]           Reverse the action instead of applying it?
   * @returns {Promise<void>}
   */
  async confirm({reverse=false}={}) {
    if ( !this.outcomes ) throw new Error(`Cannot confirm Action ${this.id} which has no configured outcomes.`)

    // Custom Action confirmation steps
    for ( const test of this._tests() ) {
      if ( !(test.confirm instanceof Function) ) continue
      await test.confirm.call(this);
    }

    // Additional Actor-specific consequences
    this.actor.onDealDamage(this, this.outcomes);

    // Play animation
    if ( game.system.animationEnabled && !reverse ) {
      const animation = this.getAnimationSequence(this.outcomes);
      if ( animation ) await animation.play();
    }

    // Delete any Measured Template that was placed
    if ( this.template ) await this.template.delete();

    // Apply outcomes
    for ( const outcome of this.outcomes.values() ) {
      await outcome.target.applyActionOutcome(this, outcome, {reverse});
    }
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
  /*  Animation                                   */
  /* -------------------------------------------- */

  /**
   * Prepare a Sequencer animation.
   * @returns {null}
   */
  getAnimationSequence() {

    // Confirm that animation paths exist
    const config = this._getAnimationConfiguration();
    if ( !config?.src ) return null;
    const paths = Sequencer.Database.searchFor(config.src);
    if ( !paths.length ) return null;

    // Get the origin token
    const originToken = CrucibleAction.#getTargetToken(this.actor);
    if ( !originToken ) return null;

    // Create the Sequence and configure it based on the gesture used
    const sequence = new Sequence();

    // Single target
    if ( this.target.type === "single" ) {
      for ( const outcome of this.outcomes.values() ) {
        if ( !outcome.rolls.length ) continue;
        const targetToken = CrucibleAction.#getTargetToken(outcome.target);
        const hit = outcome.rolls.some(r => r.isSuccess || (r.data.damage?.total > 0));
        const wait = config.wait ?? 0;
        if ( config.sequence instanceof Function ) {
          config.sequence(sequence, config, {originToken, targetToken, hit});
        }
        else sequence.effect()
          .file(config.src)
          .atLocation(originToken)
          .stretchTo(targetToken)
          .missed(!hit)
          .waitUntilFinished(wait);
        if ( config.scale ) sequence.scale(config.scale);
      }
    }
    return sequence;
  }

  /* -------------------------------------------- */

  /**
   * Get the animation configuration for this Action.
   * @protected
   */
  _getAnimationConfiguration() {
    const isMainhandAttack = ["mainhand", "twohand"].some(t => this.tags.has(t));
    const isOffhandAttack = this.tags.has("offhand");
    if ( isMainhandAttack || isOffhandAttack ) {
      const weapon = this.actor.equipment.weapons[isMainhandAttack ? "mainhand" : "offhand"];
      return weapon.system.getAnimationConfiguration();
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the placeable Token location for a CrucibleActor in the current Scene, if any.
   * @param {CrucibleActor} actor       The Actor being targeted
   * @returns {Token|null}
   */
  static #getTargetToken(actor) {
    return (actor.isToken ? actor.token?.object: actor.getActiveTokens(true)[0]) || null;
  }
}
