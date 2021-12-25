import * as fields from "/common/data/fields.mjs";
import * as TALENT from "../config/talent.mjs";
import {SYSTEM} from "../config/system.js";

/**
 * @typedef {Object} ActionTarget
 * @property {string} name              The target name
 * @property {CrucibleActor} actor      The base actor being targeted
 * @property {TokenDocument} token      A specific token being targeted
 */

/**
 * The data schema used for an Action within a talent Item
 * @property {string} id
 * @property {string} name
 * @property {string} img
 * @property {string} description
 * @property {string} targetType
 * @property {number} targetNumber
 * @property {number} targetDistance
 * @property {number} actionCost
 * @property {boolean} affectAllies
 * @property {boolean} affectEnemies
 * @property {string[]} tags
 */
export default class ActionData extends foundry.abstract.DocumentData {
  static defineSchema() {
    return {
      id: fields.REQUIRED_STRING,
      name: fields.REQUIRED_STRING,
      img: fields.IMAGE_FIELD,
      description: fields.REQUIRED_STRING,
      targetType: fields.field(fields.REQUIRED_STRING, {
        default: "single",
        validate: v => v in TALENT.ACTION_TARGET_TYPES
      }),
      targetNumber: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 1}),
      targetDistance: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 1}),
      actionCost: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 0}),
      focusCost: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 0}),
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
    // Combine action-level tags with talent-level tags
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

  getActivationTags() {
    return [
      TALENT.ACTION_TARGET_TYPES[this.targetType].label,
      this.actionCost ? `${this.actionCost}A` : null,
      this.focusCost ? `${this.focusCost}F` : null,
    ].filter(t => !!t);
  }

  getActionTags() {
    const tags = [];
    for (let t of this.tags) {
      const tag = TALENT.ACTION_TAGS[t];
      if (tag.label) tags.push(tag.label);
    }
    return tags;
  }

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
      activationTags: this.getActivationTags(),
      actionTags: this.getActionTags(),
      targets: targets,
      rolls: await Promise.all(rolls.map(r => r.render()))
    });

    // Create chat message
    const messageData = {
      type: CONST.CHAT_MESSAGE_TYPES[rolls.length > 0 ? "ROLL": "OTHER"],
      content: content,
      speaker: ChatMessage.getSpeaker({actor}),
      roll: rolls.length > 0 ? rolls[0] : null,
      flags: {
        crucible: {
          isAttack: !!rolls[0].data.damage,
          targets: targets,
          additionalRolls: rolls.slice(1)
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
  async use(actor, {banes=0, boons=0, rollMode=null, dialog=false}={}) {

    // Clone the derived action data which may be further transformed throughout the workflow
    const action = new this.constructor(this);

    // Assert that the action can be used based on its tags
    for ( let tag of action.tags ) {
      const actionTags = SYSTEM.TALENT.ACTION_TAGS[tag];
      if ( !actionTags ) continue;
      if ( (actionTags.can instanceof Function) && !actionTags.can(actor, this) ) {
        return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotUseTag", {
          name: actor.name,
          action: this.name,
          tag: actionTags.label
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
          await at.post(actor, action, rolls);
        }
      }

      // Display the Action itself in the chat log
      await action.toMessage(actor, [target], rolls, {rollMode});
      results = results.concat(rolls);
    }

    // Incur the cost of the action that was performed
    await actor.alterResources({action: -action.actionCost, focus: -action.focusCost});
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
    const targets = Array.from(game.user.targets).map(t => {
      return {
        token: t.document,
        actor: t.actor,
        uuid: t.actor.uuid,
        name: t.name
      };
    });
    switch ( this.targetType ) {
      case "self":
        const tokens = actor.getActiveTokens(true);
        return [{actor, token: tokens[0], name: actor.name}];
      case "single":
        if ( targets.length < 1 ) {
          throw new Error(game.i18n.format("ACTION.WarningInvalidTarget", {
            number: this.targetNumber,
            type: this.targetType,
            action: this.name
          }));
        }
        else if ( targets.length > this.targetNumber ) {
          throw new Error(game.i18n.format("ACTION.WarningIncorrectTargets", {
            number: this.targetNumber,
            type: this.targetType,
            action: this.name
          }));
        }
        break;
      default:
        throw new Error(`targetType ${this.targetType} for action ${this.name} is not yet supported`);
    }
    return targets;
  }

  /* -------------------------------------------- */

  /**
   * Compute the amount of damage dealt by a certain action
   * @param {number} overflow       The rolled check result in excess of the target threshold
   * @param {number} multiplier     The overflow multiplier value
   * @param {number} bonus          An additive damage bonus
   * @param {number} resistance     A subtracted resistance threshold
   * @returns {number}
   */
  static computeDamage({overflow, multiplier=1, bonus=0, resistance=0}={}) {
    return Math.max((overflow * multiplier) + bonus - resistance, 1);
  }
}
