import {SYSTEM} from "../config/system.js";
import StandardCheck from "../dice/standard-check.js";
import ActionUseDialog from "../dice/action-use-dialog.mjs";

/**
 * @typedef {Object} ActionContext
 * @property {string} type                  The type of context provided, i.e. "weapon", "spell", etc...
 * @property {string} label                 A string label providing context info
 * @property {string[]} tags                An array of tags which describe the context
 */

/**
 * @typedef {Object} ActionTarget
 * @property {string} type                  The type of target for the action in ACTION.TARGET_TYPES
 * @property {number} [number]              The number of targets affected or size of target template
 * @property {number} [distance]            The allowed distance between the actor and the target(s)
 * @property {number} [scope]               The scope of creatures affected by an action
 */

/**
 * @typedef {Object} ActionUsage
 * @property {object} actorUpdates          Actor data updates applied when this action is confirmed
 * @property {object} actorFlags            Actor flag updates applied by this action
 * @property {object} bonuses               Roll bonuses applied to this action
 * @property {ActionContext} context        Action usage context
 * @property {boolean} hasDice              Does this action involve the rolling a dice check?
 * @property {string} [defenseType]         A special defense type being targeted
 * @property {string} [skillId]             The skill ID being used.
 * @property {CrucibleWeapon} [weapon]      A special weapon being used
 */

/**
 * @typedef {Object} ActionCost
 * @property {number} action                The cost in action points
 * @property {number} focus                 The cost in focus points
 */

/**
 * @typedef {Object} ActionTags
 * @property {Object<string, string>} activation
 * @property {Object<string, string>} action
 * @property {Object<string, string>} context
 */

/**
 * @typedef {Object} CrucibleActionOutcome
 * @property {CrucibleActor} target       The outcome target
 * @property {AttackRoll[]} rolls         Any AttackRoll instances which apply to this outcome
 * @property {object} resources           Resource changes to apply to the target Actor in the form of deltas
 * @property {object} actorUpdates        Data updates to apply to the target Actor
 * @property {object[]} effects           ActiveEffect data to create on the target Actor
 * @property {boolean} [incapacitated]    Did the target become incapacitated?
 * @property {boolean} [broken]           Did the target become broken?
 * @property {boolean} [criticalSuccess]  Did the damage contain a Critical Hit
 * @property {boolean} [criticalFailure]  Did the damage contain a Critical Miss
 */

/**
 * @typedef {Map<CrucibleActor,CrucibleActionOutcome>} CrucibleActionOutcomes
 */

/**
 * The data schema used for an Action within a talent Item
 * @property {string} id                    The action identifier
 * @property {string} name                  The action name
 * @property {string} img                   An image for the action
 * @property {string} condition             An optional condition which must be met in order for the action to be used
 * @property {string} description           Text description of the action
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
      description: new fields.HTMLField(),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0})
      }),
      target: new fields.SchemaField({
        type: new fields.StringField({required: true, choices: SYSTEM.ACTION.TARGET_TYPES, initial: "single"}),
        number: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        distance: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        scope: new fields.NumberField({required: true, choices: Object.values(SYSTEM.ACTION.TARGET_SCOPES),
          initial: SYSTEM.ACTION.TARGET_SCOPES.NONE})
      }),
      effects: new fields.ArrayField(new fields.ObjectField()),
      tags: new fields.SetField(new fields.StringField({required: true, blank: false}))
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _configure({actor, ...options}) {
    super._configure(options);

    /**
     * Is this Action owned and prepared for a specific Actor?
     * @type {CrucibleActor}
     */
    Object.defineProperty(this, "actor", {value: actor, writable: false, configurable: true});

    /**
     * Special action configuration from SYSTEM.ACTION.ACTIONS
     * @type {object}
     */
    Object.defineProperty(this, "config", {value: SYSTEM.ACTION.ACTIONS[this._source.id] || {}, writable: false});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize(options) {
    super._initialize(options);
    this._prepareData();
    if ( this.actor ) {
      this._prepareForActor();
      this._prepare();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for the Action.
   * @protected
   */
  _prepareData() {

    /**
     * Dice roll bonuses which modify the usage of this action.
     * This object is only initialized once and retained through future initialization workflows.
     * @type {ActionUsage}
     */
    this.usage = this.usage || {
      actorUpdates: {},
      actorFlags: {},
      bonuses: {boons: 0, banes: 0, ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1},
      context: {type: undefined, label: undefined, icon: undefined, tags: new Set()},
      hasDice: false
    };

    // Inherit Talent data
    const talent = this.parent?.parent;
    if ( talent ) {
      this.name ||= talent.name;
      this.img ||= talent.img;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare this Action to be used by a specific Actor.
   * @protected
   */
  _prepareForActor() {
    this.usage.bonuses.boons += (this.actor.rollBonuses.boons || 0);
    this.usage.bonuses.banes += (this.actor.rollBonuses.banes || 0);
    if ( this.actor.statuses.has("broken") ) this.usage.bonuses.banes += 2;
    if ( this.actor.statuses.has("disoriented") && this.cost.focus ) this.cost.focus += 1;
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

  /** @inheritDoc */
  clone(updateData={}, context={}) {
    context.parent = this.parent;
    context.actor = this.actor;
    return super.clone(updateData, context);
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
    const pool = new StandardCheck(this.usage.bonuses);
    return ActionUseDialog.prompt({options: {
      action: this,
      actor: this.actor,
      pool,
      targets
    }});
  }

  /* -------------------------------------------- */

  /**
   * Execute an Action.
   * The action is cloned so that its data may be transformed throughout the workflow.
   * @param {object} [options]                      Options which modify action usage
   * @param {boolean} [options.chatMessage]         Automatically create a ChatMessage for the action?
   * @param {boolean} [options.dialog]              Present the user with an action configuration dialog?
   * @param {string} [options.rollMode]             Which roll mode to apply to the resulting message?
   * @returns {Promise<CrucibleActionOutcomes|undefined>}
   */
  async use(options={}) {
    if ( !this.actor ) throw new Error("A CrucibleAction may not be used unless it is bound to an Actor");
    const action = this.clone({}, {parent: this.parent, actor: this.actor});
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

    // Assert that the action can be used based on its tags
    try {
      this._can();
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Assert that required targets are designated
    let targets = [];
    try {
      targets = this._acquireTargets();
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Pre-execution steps
    this._pre(targets)

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
    const outcomes = new Map();

    // Iterate over designated targets
    for ( const target of targets ) {
      const actor = target.actor;
      const rolls = await this._roll(actor);
      const outcome = this.#createOutcome(actor, rolls);
      await this._post(outcome);
      outcomes.set(actor, outcome);
    }

    // Track the outcome for the original actor
    outcomes.set(this.actor, this.#createSelfOutcome(outcomes));
    const confirmed = this.#canAutoConfirm(outcomes);

    // Record the action as a chat message
    if ( chatMessage ) await this.toMessage(outcomes, {confirmed, ...chatMessageOptions});

    // Apply action usage flags (immediately)
    await this.actor.update({"flags.crucible": this.usage.actorFlags});

    // Auto-confirm the action?
    if ( confirmed ) await this.#confirm(outcomes);
    return outcomes;
  }

  /* -------------------------------------------- */

  /**
   * Acquire the targets for an action activation. For each target track both the Token and the Actor.
   * @returns {object[]}
   * @private
   */
  _acquireTargets() {
    if ( !canvas.ready ) return [];
    const userTargets = game.user.targets;
    const mapTokenTargets = t => {
      return {
        token: t.document,
        actor: t.actor,
        uuid: t.actor.uuid,
        name: t.name
      }
    };
    switch ( this.target.type ) {

      // No target
      case "none":
        return []

      // AOE pulse
      case "pulse":
        const actorTokens = this.actor.getActiveTokens(true);
        if ( !actorTokens.length ) return [];
        const origin = actorTokens[0];
        const r = this.target.distance * canvas.dimensions.size;
        const rect = new NormalizedRectangle(origin.data.x - r, origin.data.y - r, origin.w + (2*r), origin.h + (2*r));
        return canvas.tokens.placeables.reduce((arr, t) => {
          if ( t.id === origin.id ) return arr;
          const {center: c, w, h} = t;
          const hitBox = new PIXI.Rectangle(c.x - (w / 2), c.y - (h / 2), w, h);
          if ( rect.intersects(hitBox) ) arr.push(mapTokenTargets(t));
          return arr;
        }, []);

      // Self-target
      case "self":
        return this.actor.getActiveTokens(true).map(mapTokenTargets);

      // Single targets
      case "single":
        if ( userTargets.size < 1 ) {
          throw new Error(game.i18n.format("ACTION.WarningInvalidTarget", {
            number: this.target.number,
            type: this.target.type,
            action: this.name
          }));
        }
        else if ( userTargets.size > this.target.number ) {
          throw new Error(game.i18n.format("ACTION.WarningIncorrectTargets", {
            number: this.target.number,
            type: this.target.type,
            action: this.name
          }));
        }
        return Array.from(userTargets).map(mapTokenTargets);
      default:
        ui.notifications.warn(`Automation for target type ${this.target.type} for action ${this.name} is not yet supported, you must manually target affected tokens.`);
        return Array.from(userTargets).map(mapTokenTargets);
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify whether an action can be auto-confirmed by the Actor (User) who initiated it.
   * Actions may be auto-confirmed if they affect only yourself.
   * Actions are considered to affect another actor if they contain successful rolls or cause effects.
   * @param {CrucibleActionOutcomes} outcomes     The outcomes of the Action
   * @returns {boolean}                           Can it be auto-confirmed?
   */
  #canAutoConfirm(outcomes) {
    const self = outcomes.get(this.actor);
    for ( const outcome of outcomes.values() ) {
      if ( outcome === self ) continue;
      if ( !outcome.rolls.length && outcome.effects.length ) return false; // automatically caused effects
      if ( outcome.rolls.some(r => r.data.damage?.total) ) return false; // dealt damage
    }
    return true;
  }

  /* -------------------------------------------- */
  /*  Action Outcome Management                   */
  /* -------------------------------------------- */

  /**
   * Translate the action usage result into an outcome to be persisted.
   * @param {CrucibleActor} actor
   * @param {AttackRoll[]} [rolls]
   * @returns {CrucibleActionOutcome}
   */
  #createOutcome(actor, rolls=[]) {
    return {
      target: actor,
      rolls: rolls,
      resources: {},
      actorUpdates: {},
      effects: this.#attachEffects(actor)
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply the effects caused by an Action to targeted Actors when the result is confirmed.
   * @param {CrucibleActor} target    The target actor
   * @returns {object[]}              An array of Active Effect data to attach to the outcome
   */
  #attachEffects(target) {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    return this.effects.reduce((effects, {scope, ...effectData}) => {
      scope ??= this.target.scope;
      if ( (scope === scopes.NONE) || ((target === this.actor) && (scope !== scopes.SELF)) ) return effects;
      effects.push(foundry.utils.mergeObject({
        _id: SYSTEM.EFFECTS.getEffectId(this.id),
        label: this.name,
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
   * @param {CrucibleActionOutcomes} outcomes   Existing outcomes for target creatures
   * @returns {CrucibleActionOutcome}           The outcome for the Actor
   */
  #createSelfOutcome(outcomes) {
    const self = outcomes.get(this.actor) || this.#createOutcome(this.actor);

    // Record actor updates to apply
    foundry.utils.mergeObject(self.actorUpdates, this.usage.actorUpdates);

    // Incur resource cost
    for ( const [k, v] of Object.entries(this.cost) ) {
      self.resources[k] = (self.resources[k] || 0) - v;
    }
    return self;
  }

  /* -------------------------------------------- */

  /**
   * Compute the amount of damage dealt by a certain action
   * @param {DamageData} damage     The component details of the damage dealt
   * @returns {number}              The total damage dealt
   */
  static computeDamage({overflow=1, multiplier=1, base=0, bonus=0, resistance=0}={}) {
    const damage = Math.max((overflow * multiplier) + base + bonus, 1);
    return Math.min(damage - resistance, 2 * damage);
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
      yield SYSTEM.ACTION.TAGS[t];
    }
    yield this.config;
  }

  /* -------------------------------------------- */

  /**
   * Test whether an action can be performed.
   * @throws      An error if the action cannot be taken
   * @protected
   */
  _can() {
    const r = this.actor.system.resources;

    // Cannot spend action
    if ( this.cost.focus && this.actor.statuses.has("paralyzed" ) ) {
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
    if ( this.cost.focus && this.actor.statuses.has("broken" ) ) {
      throw new Error(game.i18n.format("ACTION.WarningCannotSpendFocus", {
        name: this.actor.name
      }))
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
      if ( !(test.can instanceof Function) ) continue;
      const can = test.can(this.actor, this);
      if ( can === false ) throw new Error(game.i18n.format("ACTION.WarningCannotUseTag", {
        name: this.actor.name,
        action: this.name,
        tag: test.label || ""
      }));
    }
  }

  /* -------------------------------------------- */

  /**
   * Preparation, the first step in the Action life-cycle.
   * @protected
   */
  _prepare() {
    for ( const test of this._tests() ) {
      if ( test.prepare instanceof Function ) test.prepare(this.actor, this);
    }
  }

  /* -------------------------------------------- */

  /**
   * Pre-execution steps.
   * @protected
   */
  _pre(targets) {
    for ( const test of this._tests() ) {
      if ( test.pre instanceof Function ) test.pre(this.actor, this, targets);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle execution of dice rolls associated with the Action
   * @param {CrucibleActor} target
   * @returns {Promise<AttackRoll[]>}
   * @protected
   */
  async _roll(target) {
    const rolls = [];
    for ( const test of this._tests() ) {
      if ( test.roll instanceof Function ) {
        let result = await test.roll(this.actor, this, target, rolls);
        if ( !Array.isArray(result) ) result = [result];
        for ( const roll of result ) {
          if ( roll instanceof Roll ) rolls.push(roll);
        }
      }
    }
    return rolls;
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
      // TODO pass outcome directly
      if ( test.post instanceof Function ) await test.post(this.actor, this, outcome.target, outcome.rolls);
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
      activation: {},
      action: {},
      context: {}
    };

    // Action Tags
    for (let t of this.tags) {
      const tag = SYSTEM.ACTION.TAGS[t];
      if ( tag.label ) tags.action[tag.tag] = tag.label;
    }

    // Target
    if ( this.target.type !== "none" ) {
      let target = SYSTEM.ACTION.TARGET_TYPES[this.target.type].label;
      if ( this.target.number > 1 ) target += ` ${this.target.number}`;
      tags.activation.target = target;
    }

    // Cost
    const cost = this._trueCost || this.cost;
    if ( Number.isFinite(cost.action) && (cost.action !== 0) ) tags.activation.ap = `${cost.action}A`;
    if ( Number.isFinite(cost.focus) && (cost.focus !== 0) ) tags.activation.fp = `${cost.focus}F`;
    if ( Number.isFinite(cost.health) && (cost.health !== 0) ) tags.activation.hp = `${cost.health}H`; // e.g. Blood Magic
    if ( !Object.values(cost).some(c => Number.isFinite(c) && (c !== 0)) ) tags.activation.ap = "Free";

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
   * @param {CrucibleActionOutcomes} outcomes   Outcomes that occurred as a result of the Action
   * @param {object} options                    Context options for ChatMessage creation
   * @param {boolean} [options.confirmed]         Were the outcomes auto-confirmed?
   * @returns {Promise<ChatMessage>}            The created ChatMessage document
   */
  async toMessage(outcomes, {confirmed=false, ...options}={}) {

    // Prepare action data
    const actionData = {actor: this.actor.uuid, action: this.id, outcomes: [], confirmed};
    const rolls = [];
    for ( const outcome of outcomes.values() ) {
      const {target, rolls: outcomeRolls, ...outcomeData} = outcome;
      outcomeData.target = target.uuid;
      outcomeData.rolls = outcomeRolls.map((roll, i) => {
        roll.data.newTarget = i === 0; // FIXME it would be good to handle this in a different way
        roll.data.index = rolls.length;
        rolls.push(roll);
        return roll.data.index;
      });
      actionData.outcomes.push(outcomeData);
    }

    // Render HTML template
    const tags = this.getTags();
    const content = await renderTemplate("systems/crucible/templates/dice/action-use-chat.html", {
      actor: this.actor,
      action: this,
      outcomes,
      activationTags: tags.activation,
      hasActionTags: !foundry.utils.isEmpty(tags.action),
      actionTags: tags.action,
      context: this.usage.context,
      showTargets: this.target.type !== "self",
    });

    // Create chat message
    return ChatMessage.create({
      type: CONST.CHAT_MESSAGE_TYPES[rolls.length > 0 ? "ROLL": "OTHER"],
      content: content,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      rolls: rolls,
      flags: {
        crucible: actionData
      }
    }, options);
  }

  /* -------------------------------------------- */

  /**
   * Confirm the result of an Action that was recorded as a ChatMessage.
   */
  static async confirm(message, {reverse=false}={}) {
    const flags = message.flags.crucible || {};
    if ( !flags.action ) throw new Error(`ChatMessage ${message.id} does not contain CrucibleAction data`);
    const flagsUpdate = {confirmed: !reverse};

    // Get the Actor and Action
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    let action;
    if ( flags.action.startsWith("spell.") ) {
      action = game.system.api.models.CrucibleSpell.fromId(flags.action, {actor});
    }
    else action = actor.actions[flags.action]?.clone() || null;

    // Re-prepare Action outcomes
    /** @type {CrucibleActionOutcomes} */
    const outcomes = new Map();
    for ( const {target: targetUuid, rolls: outcomeRolls, ...outcomeData} of flags.outcomes ) {
      let target = fromUuidSync(targetUuid);
      if ( target instanceof TokenDocument ) target = target.actor;
      const outcome = {target, rolls: outcomeRolls.map(i => message.rolls[i]), ...outcomeData};
      for ( const roll of outcome.rolls ) {
        const damage = roll.data.damage || {};
        const resource = damage.resource ?? "health";
        outcome.resources[resource] ??= 0;
        outcome.resources[resource] += (damage.total ?? 0) * (damage.restoration ? 1 : -1);
        if ( roll.isCriticalSuccess ) outcome.criticalSuccess = true;
        else if ( roll.isCriticalFailure) outcome.criticalFailure = true;
      }
      outcomes.set(target, outcome);
    }

    // Confirm outcomes and record confirmation
    await action.#confirm(outcomes, {reverse});
    return message.update({flags: {crucible: flagsUpdate}});
  }

  /* -------------------------------------------- */

  /**
   * Confirm action outcomes, applying actor and active effect changes as a result.
   * This method is factored out so that it may be called directly in cases where the action can be auto-confirmed.
   * @param {CrucibleActionOutcomes} outcomes   Outcomes that occurred as a result of the Action
   * @param {object} [options]                  Options which affect the confirmation workflow
   * @param {boolean} [options.reverse]           Reverse the action instead of applying it?
   * @returns {Promise<void>}
   */
  async #confirm(outcomes, {reverse=false}={}) {

    // Custom Action confirmation steps
    for ( const test of this._tests() ) {
      if ( !(test.confirm instanceof Function) ) continue
      await test.confirm(this.actor, this, outcomes);
    }

    // Additional Actor-specific consequences
    this.actor.onDealDamage(this, outcomes);

    // Play animation
    if ( game.system.animationEnabled && !reverse ) {
      const animation = this.getAnimationSequence(outcomes);
      if ( animation ) await animation.play();
    }

    // Apply outcomes
    for ( const outcome of outcomes.values() ) {
      await outcome.target.applyActionOutcome(outcome, {reverse});
    }
  }

  /* -------------------------------------------- */
  /*  Animation                                   */
  /* -------------------------------------------- */

  /**
   * Prepare a Sequencer animation.
   * @param {CrucibleActionOutcomes} outcomes   Outcomes that occurred as a result of the Action
   * @returns {null}
   */
  getAnimationSequence(outcomes) {
    const config = this._getAnimationConfiguration();
    if ( !config?.src ) return null;

    // Get the origin token
    const originToken = CrucibleAction.#getTargetToken(this.actor);
    if ( !originToken ) return null;

    // Create the Sequence and configure it based on the gesture used
    const sequence = new Sequence();

    // Single target
    if ( this.target.type === "single" ) {
      for ( const outcome of outcomes.values() ) {
        if ( outcome.target === this.actor ) continue;
        const targetToken = CrucibleAction.#getTargetToken(outcome.target);
        const hit = outcome.rolls.some(r => r.isSuccess);
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

    // Placeholder
    if ( this.id === "heavyStrike" ) {
      return {
        src: "jb2a.greatclub.fire.red",
        wait: -1000
      }
    }

    // Weapon Attacks
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

  /* -------------------------------------------- */
  /*  Migration and Compatibility                 */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {

    // Migrate target data
    if ( "targetType" in data ) data.target.type = data.targetType;
    if ( "targetNumber" in data ) data.target.number = data.targetNumber;
    if ( "targetDistance" in data ) data.target.distance = data.targetDistance;

    // Affect
    if ( data.target.scope === undefined ) {
      const scopes = SYSTEM.ACTION.TARGET_SCOPES;
      if ( data.affectAllies && data.affectEnemies ) data.target.scope = scopes.ALL;
      else if ( data.affectEnemies ) data.target.scope = scopes.ENEMIES;
      else if ( data.affectAllies ) data.target.scope = scopes.ALLIES;
      else if ( data.target.type === "self" ) data.target.scope = scopes.SELF;
      else data.target.scope = scopes.NONE;
      delete data.affectAllies;
      delete data.affectEnemies;
    }

    // Effects
    for ( const effectData of data.effects || [] ) {
      if ( "effect" in effectData ) {
        Object.assign(effectData, effectData.effect);
        delete effectData.effect;
      }
    }
  }
}
