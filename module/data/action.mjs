import * as fields from "/common/data/fields.mjs";
import * as TALENT from "../config/talent.mjs";
import {SYSTEM} from "../config/system.js";
import MetaRoll from "../dice/meta-roll.mjs";
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
 * The data schema used for an Action within a talent Item
 *
 * @property {string} id                    The action identifier
 * @property {string} name                  The action name
 * @property {string} img                   An image for the action
 * @property {string} condition             An optional condition which must be met in order for the action to be used
 * @property {string} description           Text description of the action
 * @property {string} targetType            The type of target for the action in ACTION_TARGET_TYPES
 * @property {number} targetNumber          The number of targets affected or size of target template
 * @property {number} targetDistance        The allowed distance between the actor and the target(s)
 * @property {number} actionCost            The action point cost of this action
 * @property {number} focusCost             The focus point cost of this action
 * @property {boolean} affectAllies         Does this action affect allies within its area of effect?
 * @property {boolean} affectEnemies        Does this action affect enemies within its area of effect?
 * @property {string[]} tags                An array of tags in ACTION_TAGS which apply to this action
 *
 * @property {ActionContext} context        Additional context which defines how the action is being used
 * @property {ActionTarget[]} targets       An array of targets which are affected by the action
 * @property {DiceCheckBonuses} bonuses     Dice check bonuses which apply to this action activation
 * @property {object} actorUpdates          Other Actor data updates to make as part of this Action
 */
export default class ActionData extends foundry.abstract.DocumentData {
  static defineSchema() {
    return {
      id: fields.REQUIRED_STRING,
      name: fields.STRING_FIELD,
      img: fields.IMAGE_FIELD,
      condition: fields.BLANK_STRING,
      description: fields.REQUIRED_STRING,
      targetType: fields.field(fields.REQUIRED_STRING, {
        default: "single",
        validate: v => v in TALENT.ACTION_TARGET_TYPES
      }),
      targetNumber: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 1}),
      targetDistance: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 1}),
      actionCost: fields.field(fields.INTEGER_FIELD, {required: true, default: 0}),
      focusCost: fields.field(fields.INTEGER_FIELD, {required: true, default: 0}),
      affectAllies: fields.field(fields.BOOLEAN_FIELD, {default: false}),
      affectEnemies: fields.field(fields.BOOLEAN_FIELD, {default: true}),
      tags: {
        type: [String],
        required: true,
        default: []
      }
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Additional data preparation steps for the ActionData.
   */
  prepareData() {
    this.name = this.name || this.document?.name;
    this.img = this.img || this.document?.img;
    this.tags = (this.document?.data.data.tags || []).concat(this.tags);
  }

  /* -------------------------------------------- */

  /**
   * Prepare this Action to be used by a specific Actor
   * @param {CrucibleActor} actor     The actor for whom this action is being prepared
   */
  prepareForActor(actor) {
    for ( let t of this.tags ) {
      const tag = SYSTEM.TALENT.ACTION_TAGS[t];
      if ( !tag ) continue;
      if ( tag.prepare instanceof Function ) tag.prepare(actor, this);
    }
    return this;
  }

  /* -------------------------------------------- */
  /*  Display and Formatting Methods              */
  /* -------------------------------------------- */

  /**
   * Obtain an object of tags which describe the Action.
   * @param {string} scope      The subset of tags desired: "action", "activation", or "all"
   * @returns {Object<string, string>}
   */
  getTags(scope="all") {
    const tags = {};

    // Action Tags
    if ( ["all", "action"].includes(scope) ) {
      for (let t of this.tags) {
        const tag = TALENT.ACTION_TAGS[t];
        if ( tag.label ) tags[tag.tag] = tag.label;
      }
    }

    // Activation Tags
    if ( ["all", "activation"].includes(scope) ) {

      // Target
      let target = TALENT.ACTION_TARGET_TYPES[this.targetType].label;
      if ( this.targetNumber > 1 ) target += ` ${this.targetNumber}`;
      tags.target = target;

      // Cost
      const ap = Math.max(this.actionCost, 0);
      const fp = Math.max(this.focusCost, 0);
      tags.cost = [
        ap ? `${ap}A` : null,
        fp ? `${fp}F` : null,
        !ap && !fp ? "Free" : null
      ].filterJoin(" ");
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Get tags which describe the activation conditions for the Action.
   * @returns {string[]}
   */
  getActivationTags() {

    // Action target
    let target = TALENT.ACTION_TARGET_TYPES[this.targetType].label;
    if ( this.targetNumber > 1 ) target += ` ${this.targetNumber}`;
    const ap = Math.max(this.actionCost, 0);
    const fp = Math.max(this.focusCost, 0);
    return [
      target,
      ap ? `${ap}A` : null,
      fp ? `${fp}F` : null,
      !ap && !fp ? "Free" : null
    ].filter(t => !!t);
  }

  /* -------------------------------------------- */

  /**
   * Get tags which describe the properties of the Action.
   * @returns {string[]}
   */
  getActionTags() {
    const tags = [];
    for (let t of this.tags) {
      const tag = TALENT.ACTION_TAGS[t];
      if (tag.label) tags.push(tag.label);
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Get all tags for the Action.
   * @returns {string[]}
   */
  getAllTags() {
    return this.getActionTags().concat(this.getActivationTags());
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

    // Render action template
    const content = await renderTemplate("systems/crucible/templates/dice/action-use-chat.html", {
      action: this,
      actor: actor,
      activationTags: this.getTags("activation"),
      actionTags: this.getTags("action"),
      showTargets: this.targetType !== "self",
      targets: targets
    });

    // Composite a single roll for the purpose of the chat record
    const metaRoll = MetaRoll.fromRolls(rolls);

    // Create chat message
    const messageData = {
      type: CONST.CHAT_MESSAGE_TYPES[rolls.length > 0 ? "ROLL": "OTHER"],
      content: content,
      speaker: ChatMessage.getSpeaker({actor}),
      roll: metaRoll,
      flags: {
        crucible: {
          isAttack: rolls.length,
          targets: targets
        }
      }
    }
    return ChatMessage.create(messageData, messageOptions);
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
    const action = new this.constructor(this, this.document);
    action.context = {};
    action.bonuses = {boons, banes, ability: 0, skill: 0, enchantment: 0, damageBonus: 0, damageMultiplier: 0};
    action.actorUpdates = {};

    // Pre-configure of the action
    for ( let tag of action.tags ) {
      const at = SYSTEM.TALENT.ACTION_TAGS[tag];
      if ( at.pre instanceof Function ) at.pre(actor, action);
    }

    // Assert that the action can be used based on its tags
    for ( let tag of action.tags ) {
      const at = SYSTEM.TALENT.ACTION_TAGS[tag];
      if ( (at.can instanceof Function) && !at.can(actor, this) ) {
        return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotUseTag", {
          name: actor.name,
          action: this.name,
          tag: at.label
        }));
      }
    }

    // Assert that cost of the action can be afforded
    const attrs = actor.data.data.attributes;
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

    // Prompt for confirmation with a dialog which customizes boons and banes
    if ( dialog ) {
      const pool = new StandardCheck(action.bonuses);
      const response = await ActionUseDialog.prompt({options: {action, actor, pool, targets}});
      if ( response === null ) return [];
      action.bonuses.boons = response.data.boons;
      action.bonuses.banes = response.data.banes;
    }

    // Iterate over every designated target
    let results = [];
    for ( let target of targets ) {

      // Perform each action tag callback
      const promises = action.tags.reduce((promises, tag) => {
        const at = SYSTEM.TALENT.ACTION_TAGS[tag];
        if ( at.execute instanceof Function ) {
          const promise = at.execute(actor, action, target.actor);
          if ( promise instanceof Promise ) promises.push(promise);
        }
        return promises;
      }, []);

      // Perform post-roll callbacks
      const rolls = await Promise.all(promises);
      for ( let tag of action.tags ) {
        const at = SYSTEM.TALENT.ACTION_TAGS[tag];
        if ( at.post instanceof Function ) {
          await at.post(actor, action, target.actor, rolls);
        }
      }

      // Display the Action itself in the chat log
      await action.toMessage(actor, [target], rolls, {rollMode});
      results = results.concat(rolls);
    }

    // Incur the cost of the action that was performed
    await actor.alterResources({action: -action.actionCost, focus: -action.focusCost}, action.actorUpdates);
    return results;
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
    switch ( this.targetType ) {

      // AOE pulse
      case "pulse":
        const actorTokens = actor.getActiveTokens(true);
        if ( !actorTokens.length ) return [];
        const origin = actorTokens[0];
        const r = this.targetDistance * canvas.dimensions.size;
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
            number: this.targetNumber,
            type: this.targetType,
            action: this.name
          }));
        }
        else if ( userTargets.size > this.targetNumber ) {
          throw new Error(game.i18n.format("ACTION.WarningIncorrectTargets", {
            number: this.targetNumber,
            type: this.targetType,
            action: this.name
          }));
        }
        return Array.from(userTargets).map(mapTokenTargets);
      default:
        ui.notifications.warn(`Automation for target type ${this.targetType} for action ${this.name} is not yet supported, you must manually target affected tokens.`);
        return Array.from(userTargets).map(mapTokenTargets);
    }
  }

  /* -------------------------------------------- */

  /**
   * Compute the amount of damage dealt by a certain action
   * @param {DamageData} damage     The component details of the damage dealt
   * @returns {number}              The total damage dealt
   */
  static computeDamage({overflow, multiplier=1, bonus=0, resistance=0}={}) {
    return Math.max((overflow * multiplier) + bonus - resistance, 1);
  }
}
