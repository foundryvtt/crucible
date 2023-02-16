import {SYSTEM} from "../config/system.js";
import StandardCheck from "../dice/standard-check.js";
import ActionUseDialog from "../dice/action-use-dialog.mjs";
import CrucibleSpell from "./spell.mjs";
import SpellCastDialog from "../dice/spell-cast-dialog.mjs";

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
 * @property {number} number                The number of targets affected or size of target template
 * @property {number} distance              The allowed distance between the actor and the target(s)
 * @property {number} scope                 The scope of creatures affected by an action
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
      description: new fields.StringField(),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0})
      }),
      spell: new fields.SchemaField({
        rune: new fields.StringField({required: false, choices: SYSTEM.SPELL.RUNES, initial: undefined}),
        gesture: new fields.StringField({required: false, choices: SYSTEM.SPELL.GESTURES, initial: undefined}),
        inflection: new fields.StringField({required: false, choices: SYSTEM.SPELL.INFLECTIONS, initial: undefined}),
      }, {required: false, initial: undefined}),
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

  /**
   * Is this Action owned and prepared for a specific Actor?
   * @type {CrucibleActor}
   */
  get actor() {
    return this.#actor;
  }
  #actor;

  /**
   * Special action configuration from SYSTEM.ACTION.ACTIONS
   * @type {object}
   */
  #config;

  /**
   * Dice roll bonuses which modify the usage of this action
   * @type {{actorUpdates: object, bonuses: object, context: object, [defenseType]: string, [skillId]: string}}
   */
  usage = {};

  /**
   * If this Action involves the casting of a Spell, it is referenced here
   * @type {CrucibleSpell|null}
   */
  spell;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Additional data preparation steps for the CrucibleAction.
   */
  prepareData(actor=null) {

    // Special configuration
    this.#actor = actor;
    this.#config = SYSTEM.ACTION.ACTIONS[this.id] || {};

    // Initialize usage data
    this.usage = {
      actorUpdates: {},
      bonuses: {boons: 0, banes: 0, ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1},
      context: {type: undefined, label: undefined, icon: undefined, tags: new Set()}
    };

    // Configure action data
    const source = this._source;
    const item = this.parent?.parent;
    this.name = source.name || item?.name;
    this.img = source.img || item?.img;
    this.tags = new Set([...item?.system.tags || [], ...source.tags]);

    // Effective costs
    this.actionCost = source.cost.action;
    this.focusCost = source.cost.focus;
  }

  /* -------------------------------------------- */

  /**
   * Prepare this Action to be used by a specific Actor
   * @param {CrucibleActor} actor     The actor for whom this action is being prepared
   * @param {object} bonuses          Special bonuses which apply to this Action usage
   */
  prepareForActor(actor, bonuses={}) {
    this.prepareData(actor);
    Object.assign(this.usage.bonuses, bonuses);
    if ( actor?.statuses.has("broken") ) this.usage.bonuses.banes += 2;
    this.#prepare(actor);
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
    if ( this.#actor ) {
      if ( this.actionCost > 0 ) tags.activation.ap = `${this.actionCost}A`;
      if ( this.focusCost > 0 ) tags.activation.fp = `${this.focusCost}F`;
    } else {
      if ( this.actionCost !== 0 ) tags.activation.ap = `${this.actionCost}A`;
      if ( this.focusCost !== 0 ) tags.activation.fp = `${this.focusCost}F`;
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
   * @param {CrucibleActor} actor       The actor performing the action
   * @param {ActionTarget[]} targets    The targets of the action
   * @param {Roll[]} rolls              Dice rolls associated with the action
   * @param {DocumentModificationContext} messageOptions  Context options for chat message creation
   * @returns {Promise<ChatMessage>}    The created chat message document
   */
  async toMessage(actor, targets, rolls, messageOptions) {
    targets = targets.map(t => {
      return {name: t.name, uuid: t.uuid};
    });
    const tags = this.getTags();

    // Render action template
    const content = await renderTemplate("systems/crucible/templates/dice/action-use-chat.html", {
      action: this,
      actor: actor,
      activationTags: tags.activation,
      actionTags: tags.action,
      showTargets: this.target.type !== "self",
      targets: targets
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
    const action = actor.actions[flags.action] || null;

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

    // Apply effects
    const effects = await action.confirmEffects(targets.keys());
    flagsUpdate.effects = effects.map(e => e.uuid);

    // Action confirmation steps
    action.#confirm(actor, outcomes);

    // Actor follow-up steps
    await actor.onDealDamage(outcomes);

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
          for ( const target of targets ) effects.push(await this.#createEffect(effectData, target));
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
    return ActiveEffect.create(foundry.utils.mergeObject({
      label: this.name,
      description: this.description,
      icon: this.img,
      origin: this.actor.uuid,
      flags: {
        crucible: {
          action: this.id
        }
      }
    }, effectData), {parent: target});
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
   * Execute this particular action
   * @param {CrucibleActor} actor
   * @param {number} banes
   * @param {number} boons
   * @param {string} rollMode
   * @param {boolean} dialog
   * @returns {Promise<AttackRoll[]>}
   */
  async use(actor, {banes=0, boons=0, rollMode, dialog=false}={}) {

    // Clone the derived action data which may be further transformed throughout the workflow
    const action = this.clone({}, {parent: this.parent});

    // Actor-specific action preparation
    action.prepareForActor(actor, {banes, boons});

    // Assert that the action can be used based on its tags
    try {
      this.#can();
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Assert that cost of the action can be afforded
    const attrs = actor.system.attributes;
    if ( action.actionCost > attrs.action.value ) {
      return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: actor.name,
        resource: game.i18n.localize("ATTRIBUTES.Action"),
        action: this.name
      }));
    }
    if ( action.focusCost > attrs.focus.value ) {
      return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: actor.name,
        resource: game.i18n.localize("ATTRIBUTES.Focus"),
        action: this.name
      }));
    }

    // Assert that required targets are designated
    let targets = [];
    try {
      targets = action._acquireTargets(actor);
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Pre-execution steps
    this.#pre(targets)

    // Require a spell configuration dialog
    const pool = new StandardCheck(action.usage.bonuses);
    if ( action.tags.has("spell") ) {
      if ( dialog || !action.spell ) {
        const response = await SpellCastDialog.prompt({options: {action, actor, pool, targets}});
        if ( !response ) return [];
        this.#applySpell(actor, action, response);
        targets = action._acquireTargets(actor); // Reacquire for spell
      }
    }

    // Normal action configuration
    else if ( dialog ) {
      const response = await ActionUseDialog.prompt({options: {action, actor, pool, targets}});
      if ( response === null ) return [];
      Object.assign(action.usage.bonuses, {boons: response.data.boons, banes: response.data.banes});
    }

    // Iterate over every designated target
    let results = [];
    if ( action.target.type === "none" ) targets = [null];
    for ( let target of targets ) {
      const rolls = await this.#evaluateAction(actor, action, target);
      await action.toMessage(actor, target ? [target] : [], rolls, {rollMode});
      results = results.concat(rolls);
    }

    // Apply effects if no dice rolls were involved
    if ( !results.length && action.effects ) {
      await action.#confirm();
      await action.confirmEffects(targets);
    }

    // If the actor is in combat, incur the cost of the action that was performed
    if ( actor.combatant ) {
      await actor.alterResources({action: -action.actionCost, focus: -action.focusCost}, action.usage.actorUpdates);
    }
    return results;
  }

  /* -------------------------------------------- */

  /**
   * Apply a configured spell as the Action being performed.
   * @param {CrucibleActor} actor     The actor casting the spell
   * @param {CrucibleAction} action   The base action
   * @param {object} formData         SpellCastDialog form submission data
   */
  #applySpell(actor, action, formData) {

    // Create Spell
    const {boons, banes, ...spellData} = formData;
    action._source.spell = {}; // FIXME bit of a hack
    const spell = new CrucibleSpell(spellData, {parent: this.#actor});

    // Update Action
    action.updateSource({
      name: spell.name,
      img: spell.img,
      description: spell.description,
      cost: spell.cost,
      spell: spell.toObject(),
      target: spell.target,
    });
    Object.defineProperty(action, "spell", {value: spell, writable: false, enumerable: false});

    // Update derived Action data
    action.prepareForActor(actor);
    Object.assign(action.usage.bonuses, {boons, banes});
  }

  /* -------------------------------------------- */

  /**
   * Evaluate an action, constructing an array of Roll instances it produces.
   * @param {CrucibleActor} actor         The actor performing the action
   * @param {CrucibleAction} action       The action being performed
   * @param {Token|null} target           A Token target or null
   * @returns {Promise<StandardCheck[]>}  Performed rolls
   */
  async #evaluateAction(actor, action, target) {
    const config = SYSTEM.ACTION.ACTIONS[action.id] || {};

    // Translate action tags which define a "roll" operation into dice rolls
    const rolls = await Promise.all(action.tags.reduce((promises, tag) => {
      const at = SYSTEM.ACTION.TAGS[tag];
      if ( at.roll instanceof Function ) {
        const roll = at.roll(actor, action, target?.actor);
        if ( roll instanceof Promise ) promises.push(roll);
      }
      return promises;
    }, []));
    if ( config.roll instanceof Function ) {
      rolls.push(await config.roll(actor, action, target?.actor));
    }

    // Perform post-roll operations for actions which define a "post" operation
    for ( const tag of action.tags ) {
      const at = SYSTEM.ACTION.TAGS[tag];
      if ( at.post instanceof Function ) {
        await at.post(actor, action, target?.actor, rolls);
      }
    }
    if ( config.post instanceof Function ) await config.post(actor, action, target?.actor, rolls);
    return rolls;
  }

  /* -------------------------------------------- */

  /**
   * Acquire the targets for an action activation. For each target track both the Token and the Actor.
   * @param {CrucibleActor} actor     The Actor using the action.
   * @returns {ActionTarget[]}
   * @private
   */
  _acquireTargets(actor) {
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
        const actorTokens = actor.getActiveTokens(true);
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
        return actor.getActiveTokens(true).map(mapTokenTargets);

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
    return Math.max((overflow * multiplier) + base + bonus - resistance, 1);
  }

  /* -------------------------------------------- */
  /*  Action Lifecycle Methods                    */
  /* -------------------------------------------- */

  /**
   * A generator which provides the test conditions for action lifecycle.
   * @returns {Generator<Object|*, void, *>}
   */
  * #tests() {
    for ( const t of this.tags ) {
      yield SYSTEM.ACTION.TAGS[t];
    }
    yield this.#config;
  }

  /* -------------------------------------------- */

  /**
   * Test whether an action can be performed.
   * @throws      An error if the action cannot be taken
   */
  #can() {
    for ( const test of this.#tests() ) {
      if ( !(test.can instanceof Function) ) continue;
      const can = test.can(this.#actor, this);
      if ( can === false ) throw new Error(game.i18n.format("ACTION.WarningCannotUseTag", {
        name: this.#actor.name,
        action: this.name,
        tag: test.label || ""
      }));
    }
  }

  /* -------------------------------------------- */

  /**
   * Preparation, the first step in the Action life-cycle.
   */
  #prepare() {
    for ( const test of this.#tests() ) {
      if ( test.prepare instanceof Function ) test.prepare(this.#actor, this);
    }
  }

  /* -------------------------------------------- */

  /**
   * Pre-execution steps.
   */
  #pre(targets) {
    for ( const test of this.#tests() ) {
      if ( test.pre instanceof Function ) test.pre(this.#actor, this, targets);
    }
  }

  /* -------------------------------------------- */

  /**
   * Action-specific steps when the outcome is confirmed by a GM user.
   * @param {Map<CrucibleActor, DamageOutcome>} [outcomes]    A mapping of damage outcomes which occurred
   */
  async #confirm(outcomes) {
    for ( const test of this.#tests() ) {
      if ( !(test.confirm instanceof Function) ) continue
      await test.confirm(this.#actor, this, outcomes);
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
    const scopes = SYSTEM.ACTION.TARGET_SCOPES;
    if ( data.affectAllies && data.affectEnemies ) data.target.scope = scopes.ALL;
    else if ( data.affectEnemies ) data.target.scope = scopes.ENEMIES;
    else if ( data.affectAllies ) data.target.scope = scopes.ALLIES;
    else if ( data.target.type === "self" ) data.target.scope = scopes.SELF;
    else data.target.scope = scopes.NONE;

    // Effects
    for ( const effectData of data.effects || [] ) {
      if ( "effect" in effectData ) {
        Object.assign(effectData, effectData.effect);
        delete effectData.effect;
      }
    }
  }
}
