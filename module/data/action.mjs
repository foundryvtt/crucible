import * as ACTION from "../config/action.mjs";
import {SYSTEM} from "../config/system.js";
import StandardCheck from "../dice/standard-check.js";
import ActionUseDialog from "../dice/action-use-dialog.mjs";
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
export default class ActionData extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      condition: new fields.StringField(),
      description: new fields.StringField(),
      duration: new fields.NumberField({required: false, nullable: false, integer: true, min: 0, initial: undefined}),
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
        type: new fields.StringField({required: true, choices: ACTION.TARGET_TYPES, initial: "single"}),
        number: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        distance: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        scope: new fields.NumberField({required: true, choices: Object.values(ACTION.TARGET_SCOPES),
          initial: ACTION.TARGET_SCOPES.NONE})
      }),
      effects: new fields.ArrayField(new fields.SchemaField({
        scope: new fields.NumberField({required: true, choices: Object.values(ACTION.TARGET_SCOPES)}),
        effect: new fields.ObjectField()
      })),
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

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Additional data preparation steps for the ActionData.
   */
  prepareData() {
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
   */
  prepareForActor(actor) {
    this.prepareData();
    for ( let t of this.tags ) {
      const tag = SYSTEM.ACTION.TAGS[t];
      if ( !tag ) continue;
      if ( tag.prepare instanceof Function ) tag.prepare(actor, this);
    }
    this.#actor = actor;
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
      const tag = ACTION.TAGS[t];
      if ( tag.label ) tags.action[tag.tag] = tag.label;
    }

    // Target
    if ( this.target.type !== "none" ) {
      let target = ACTION.TARGET_TYPES[this.target.type].label;
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
    if ( this.duration ) tags.action.duration = `${this.duration}R`;
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
   * Apply the effects caused by an Action to targeted Actors when the result is confirmed.
   * @param {CrucibleActor[]} targets       The targeted actors
   * @returns {ActiveEffect[]}              An array of created Active Effects
   */
  async confirmEffects(targets) {
    const scopes = ACTION.TARGET_SCOPES;
    const effects = [];
    for ( const {scope, effect} of this.effects ) {
      switch ( scope ) {
        case scopes.NONE:
          continue;
        case scopes.SELF:
          effects.push(await this.#createEffect(effect, this.actor));
          break;
        default:
          for ( const target of targets ) effects.push(await this.#createEffect(effect, target));
          break;
      }
    }
    return effects;
  }

  /* -------------------------------------------- */

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
  async reverseEffects(effects) {
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
    action.prepareForActor(actor);
    action.context = {
      type: undefined,
      label: undefined,
      icon: undefined,
      tags: new Set()
    };
    action.bonuses = {boons, banes, ability: 0, skill: 0, enchantment: 0, damageBonus: 0, multiplier: 1};
    action.actorUpdates = {};
    action.isSpell = action.tags.has("spell");

    // Pre-configure of the action
    for ( let tag of action.tags ) {
      const at = SYSTEM.ACTION.TAGS[tag];
      if ( at.pre instanceof Function ) at.pre(actor, action);
    }

    // Assert that the action can be used based on its tags
    for ( let tag of action.tags ) {
      const at = SYSTEM.ACTION.TAGS[tag];
      if ( (at.can instanceof Function) && !at.can(actor, this) ) {
        return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotUseTag", {
          name: actor.name,
          action: this.name,
          tag: at.label
        }));
      }
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

    // Require a spell configuration dialog
    const pool = new StandardCheck(action.bonuses);
    if ( action.isSpell ) {
      if ( dialog || !action.spell ) {
        const response = await SpellCastDialog.prompt({options: {action, actor, pool, targets}});
        this.#applySpell(actor, action, response.spell);
        targets = action._acquireTargets(actor); // Reacquire for spell
        action.bonuses.boons = response.data.boons;
        action.bonuses.banes = response.data.banes;
      }
    }

    // Normal action configuration
    else if ( dialog ) {
      const response = await ActionUseDialog.prompt({options: {action, actor, pool, targets}});
      if ( response === null ) return [];
      action.bonuses.boons = response.data.boons;
      action.bonuses.banes = response.data.banes;
    }

    // Iterate over every designated target
    let results = [];
    if ( action.target.type === "none" ) targets = [null];
    for ( let target of targets ) {
      const rolls = await this.#evaluateAction(actor, action, target);
      await action.toMessage(actor, target ? [target] : [], rolls, {rollMode});
      results = results.concat(rolls);
    }

    // If the actor is in combat, incur the cost of the action that was performed
    if ( actor.inCombat ) {
      await actor.alterResources({action: -action.actionCost, focus: -action.focusCost}, action.actorUpdates);
    }
    return results;
  }

  /* -------------------------------------------- */

  /**
   * Apply a configured spell as the Action being performed.
   * @param {CrucibleActor} actor     The actor casting the spell
   * @param {ActionData} action       The base action
   * @param {CrucibleSpell} spell     The configured spell
   */
  #applySpell(actor, action, spell) {
    action._source.spell = {}; // FIXME bit of a hack
    action.updateSource({
      name: spell.name,
      img: spell.img,
      description: spell.description,
      cost: spell.cost,
      spell: spell.toObject(),
      target: spell.target,
    });
    action.spell = spell;
    action.prepareForActor(actor);
  }

  /* -------------------------------------------- */

  /**
   * Evaluate an action, constructing an array of Roll instances it produces.
   * @param {CrucibleActor} actor         The actor performing the action
   * @param {ActionData} action           The action being performed
   * @param {Token|null} target           A Token target or null
   * @returns {Promise<StandardCheck[]>}  Performed rolls
   */
  async #evaluateAction(actor, action, target) {

    // Translate action tags which define an "execute" operation into dice rolls
    const rolls = await Promise.all(action.tags.reduce((promises, tag) => {
      const at = SYSTEM.ACTION.TAGS[tag];
      if ( at.execute instanceof Function ) {
        const roll = at.execute(actor, action, target?.actor);
        if ( roll instanceof Promise ) promises.push(roll);
      }
      return promises;
    }, []));

    // Perform post-roll operations for actions which define a "post" operation
    for ( const tag of action.tags ) {
      const at = SYSTEM.ACTION.TAGS[tag];
      if ( at.post instanceof Function ) {
        await at.post(actor, action, target?.actor, rolls);
      }
    }
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
  /*  Migration and Compatibility                 */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {

    // Migrate target data
    if ( "targetType" in data ) data.target.type = data.targetType;
    if ( "targetNumber" in data ) data.target.number = data.targetNumber;
    if ( "targetDistance" in data ) data.target.distance = data.targetDistance;

    // Affect
    if ( data.affectAllies && data.affectEnemies ) data.target.scope = ACTION.TARGET_SCOPES.ALL;
    else if ( data.affectEnemies ) data.target.scope = ACTION.TARGET_SCOPES.ENEMIES;
    else if ( data.affectAllies ) data.target.scope = ACTION.TARGET_SCOPES.ALLIES;
    else if ( data.target.type === "self" ) data.target.scope = ACTION.TARGET_SCOPES.SELF;
    else data.target.scope = ACTION.TARGET_SCOPES.NONE;
  }
}
