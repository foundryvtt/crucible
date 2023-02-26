import {SYSTEM} from "../config/system.js";
import StandardCheck from "../dice/standard-check.js";
import ActionUseDialog from "../dice/action-use-dialog.mjs";

/**
 * @typedef {Object} ActionTarget
 * @property {string} name                  The target name
 * @property {CrucibleActor} actor          The base actor being targeted
 * @property {TokenDocument} token          A specific token being targeted
 */

/**
 * @typedef {Object} ActionContext
 * @property {string} type                  The type of context provided, i.e. "weapon", "spell", etc...
 * @property {string} label                 A string label providing context info
 * @property {string[]} tags                An array of tags which describe the context
 * @property {boolean} hasDice              Does this action involve the rolling of a dice check?
 */

/**
 * @typedef {Object} ActionTarget
 * @property {string} type                  The type of target for the action in ACTION.TARGET_TYPES
 * @property {number} [number]              The number of targets affected or size of target template
 * @property {number} [distance]            The allowed distance between the actor and the target(s)
 * @property {number} [scope]               The scope of creatures affected by an action
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
 * The data schema used for an Action within a talent Item
 * @property {string} id                    The action identifier
 * @property {string} name                  The action name
 * @property {string} img                   An image for the action
 * @property {string} condition             An optional condition which must be met in order for the action to be used
 * @property {string} description           Text description of the action
 * @property {ActionTarget} target          Target data for the action
 * @property {ActionCost} cost              Cost data for the action
 * @property {Set<string>} tags             A set of tags in ACTION.TAGS which apply to this action
 *
 * @property {ActionContext} context        Additional context which defines how the action is being used
 * @property {ActionTarget[]} targets       An array of targets which are affected by the action
 * @property {DiceCheckBonuses} bonuses     Dice check bonuses which apply to this action activation
 * @property {object} actorUpdates          Other Actor data updates to make as part of this Action
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
     * @type {{actorUpdates: object, actorFlags: object, bonuses: object, context: object, [defenseType]: string, [skillId]: string}}
     */
    this.usage = this.usage || {
      actorUpdates: {},
      actorFlags: {},
      bonuses: {boons: 0, banes: 0, ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1},
      context: {type: undefined, label: undefined, icon: undefined, tags: new Set()}
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
    if ( this.actor ) {
      if ( cost.action > 0 ) tags.activation.ap = `${cost.action}A`;
      if ( cost.focus > 0 ) tags.activation.fp = `${cost.focus}F`;
    } else {
      if ( cost.action !== 0 ) tags.activation.ap = `${cost.action}A`;
      if ( cost.action !== 0 ) tags.activation.fp = `${cost.focus}F`;
    }
    if ( !(tags.activation.ap || tags.activation.fp) ) tags.activation.ap = "Free";

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
   * @param {ActionTarget[]} targets    The targets of the action
   * @param {Roll[]} rolls              Dice rolls associated with the action
   * @param {DocumentModificationContext} messageOptions  Context options for chat message creation
   * @returns {Promise<ChatMessage>}    The created chat message document
   */
  async toMessage(targets=[], rolls=[], messageOptions) {
    const actor = this.actor;
    targets = targets.map(t => ({name: t.name, uuid: t.uuid}));
    const tags = this.getTags();

    // Render action template
    const content = await renderTemplate("systems/crucible/templates/dice/action-use-chat.html", {
      action: this,
      actor,
      activationTags: tags.activation,
      hasActionTags: !foundry.utils.isEmpty(tags.action),
      actionTags: tags.action,
      context: this.usage.context,
      showTargets: this.target.type !== "self",
      targets
    });

    // Create chat message
    const messageData = {
      type: CONST.CHAT_MESSAGE_TYPES[rolls.length > 0 ? "ROLL": "OTHER"],
      content: content,
      speaker: ChatMessage.getSpeaker({actor}),
      rolls: rolls,
      flags: {
        crucible: {
          action: this.id,
          isAttack: rolls.length,
          targets: targets
        }
      }
    }
    return ChatMessage.create(messageData, messageOptions);
  }

  /* -------------------------------------------- */

  /**
   * Confirm the result of an Action that was recorded as a ChatMessage.
   */
  static async confirm(message, {reverse=false}={}) {
    const flags = message.flags.crucible || {};
    const flagsUpdate = {confirmed: !reverse};

    // Get the Actor and the Action
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    let action = actor.actions[flags.action];
    action = action?.clone({}, {parent: action.parent, actor}) || null;

    // Get targets and group rolls by target
    const targets = new Map();
    for ( const roll of message.rolls ) {
      if ( !roll.data.target ) continue;
      const target = fromUuidSync(roll.data.target);
      if ( !target ) continue;
      if ( !targets.has(target) ) targets.set(target, [roll]);
      else targets.get(target).push(roll);
    }

    // Apply damage or healing to each target
    const outcomes = new Map();
    for ( const [target, rolls] of targets.entries() ) {
      const outcome = await actor.dealDamage(target, rolls, {reverse});
      outcomes.set(target, outcome);
    }

    // Reverse effects
    if ( reverse ) {
      await action.reverseEffects(flags.effects);
      flagsUpdate.effects = [];
      return message.update({flags: {crucible: flagsUpdate}});
    }

    // Action confirmation steps
    await action._confirm(outcomes);

    // Apply damage
    await actor.onDealDamage(action, outcomes);

    // Apply effects
    const effects = await action.confirmEffects(targets.keys());
    for ( const outcome of outcomes.values() ) effects.push(...outcome.effects);
    flagsUpdate.effects = effects.map(e => e.uuid);

    // Record confirmation
    return message.update({flags: {crucible: flagsUpdate}});
  }

  /* -------------------------------------------- */

  /**
   * Apply the effects caused by an Action to targeted Actors when the result is confirmed.
   * @param {CrucibleActor[]} targets       The targeted actors
   * @returns {Promise<ActiveEffect[]>}     An array of created Active Effects
   */
  async confirmEffects(targets) {
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    const effects = [];
    for ( const effectData of this.effects ) {
      const scope = effectData.scope ?? this.target.scope;
      switch ( scope ) {
        case scopes.NONE:
          continue;
        case scopes.SELF:
          effects.push(await this.#createEffect(effectData, this.actor));
          break;
        default:
          for ( const target of targets ) {
            if ( target ) effects.push(await this.#createEffect(effectData, target));
          }
          break;
      }
    }
    return effects;
  }

  /* -------------------------------------------- */

  /**
   * Create a new ActiveEffect defined by this Action and apply it to the target Actor.
   * @param {object} effectData         The effect data which defines the effect
   * @param {CrucibleActor} target      The target to whom the effect is applied
   * @returns {Promise<ActiveEffect>}   The created ActiveEffect document
   */
  async #createEffect(effectData, target) {
    effectData = foundry.utils.mergeObject({
      _id: SYSTEM.EFFECTS.getEffectId(this.id),
      label: this.name,
      description: this.description,
      icon: this.img,
      origin: this.actor.uuid
    }, effectData)

    // Update an existing effect
    const existing = target.effects.get(effectData._id);
    if ( existing ) {
      effectData.duration ||= {};
      effectData.duration.startRound = game.combat?.round || null;
      return existing.update(effectData);
    }

    // Create a new effect
    return ActiveEffect.create(effectData, {parent: target, keepId: true});
  }

  /* -------------------------------------------- */

  /**
   * Reverse applied effects.
   * @param {string[]} effects      An array of active effect UUIDs
   * @returns {Promise<void>}
   */
  async reverseEffects(effects=[]) {
    for ( const uuid of effects ) {
      const effect = fromUuidSync(uuid);
      if ( effect ) await effect.delete();
    }
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /**
   * Display a configuration prompt which customizes the Action usage.
   * @param {CrucibleActor[]} targets     Currently selected targets
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
   * @param {string} rollMode
   * @param {boolean} dialog
   * @returns {Promise<AttackRoll[]>}
   */
  async use({rollMode, dialog=false}={}) {
    if ( !this.actor ) {
      throw new Error("A CrucibleAction may not be used unless it is bound to an Actor");
    }
    //
    const action = this.clone({}, {parent: this.parent, actor: this.actor});
    return action._use({rollMode, dialog});
  }

  /* -------------------------------------------- */

  /**
   * Execute the cloned action.
   * @param {string} rollMode
   * @param {boolean} dialog
   * @returns {Promise<AttackRoll[]>}
   * @private
   */
  async _use({rollMode, dialog=false}={}) {

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
      if ( configuration === null ) return [];  // Dialog closed
      if ( configuration.targets ) targets = configuration.targets;
    }

    // Iterate over every designated target
    let results = [];
    if ( this.usage.context.hasDice ) {
      for ( let target of targets ) {
        const rolls = await this._roll(target?.actor);
        await this._post(target?.actor, rolls);
        await this.toMessage(target ? [target] : [], rolls, {rollMode});
        results = results.concat(rolls);
      }
    }

    // Actions which do not produce rolls
    else {
      await this.toMessage(targets);
    }

    // Apply effects immediately if no dice rolls were involved
    if ( !results.length ) {
      await this._confirm();
      await this.confirmEffects(targets.map(t => t.actor));
    }

    // If the actor is in combat, incur the cost of the action that was performed
    if ( this.actor.combatant ) {
      const updateData = foundry.utils.mergeObject(this.usage.actorUpdates, {
        "flags.crucible": this.usage.actorFlags
      }, {inplace: false});
      await this.actor.alterResources({
        action: Math.min(-this.cost.action, 0),
        focus: Math.min(-this.cost.focus, 0)
      }, updateData);
    }

    // Otherwise, apply Actor flags only
    else await this.actor.update({"crucible.flags": this.usage.actorFlags});
    return results;
  }

  /* -------------------------------------------- */

  /**
   * Acquire the targets for an action activation. For each target track both the Token and the Actor.
   * @returns {ActionTarget[]}
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
          const c = t.center;
          if ( rect.contains(c.x, c.y) && (t.id !== origin.id) ) arr.push(mapTokenTargets(t));
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
        const roll = await test.roll(this.actor, this, target, rolls);
        if ( roll instanceof Array ) rolls.push(...roll);
        else if ( roll ) rolls.push(roll);
      }
    }
    return rolls;
  }

  /* -------------------------------------------- */

  /**
   * Handle post-roll modification of the Rolls array
   * @param {CrucibleActor} target
   * @param {AttackRoll[]} rolls
   * @returns {Promise<void>}
   * @protected
   */
  async _post(target, rolls) {
    for ( const test of this._tests() ) {
      if ( test.post instanceof Function ) await test.post(this.actor, this, target, rolls);
    }
  }

  /* -------------------------------------------- */

  /**
   * Action-specific steps when the outcome is confirmed by a GM user.
   * @param {Map<CrucibleActor, DamageOutcome>} [outcomes]    A mapping of damage outcomes which occurred
   * @protected
   */
  async _confirm(outcomes) {
    for ( const test of this._tests() ) {
      if ( !(test.confirm instanceof Function) ) continue
      await test.confirm(this.actor, this, outcomes);
    }
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
