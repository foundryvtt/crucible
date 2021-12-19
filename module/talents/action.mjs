import * as fields from "/common/data/fields.mjs";
import * as TALENT from "../config/talent.mjs";
import {SYSTEM} from "../config/system.js";

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
   * @param {CrucibleActor} target      The target of the action
   * @param {Roll[]} rolls              Dice rolls associated with the action
   * @param {DocumentModificationContext} messageOptions  Context options for chat message creation
   * @returns {Promise<ChatMessage>}    The created chat message document
   */
  async toMessage(actor, target, rolls, messageOptions) {

    // Render action template
    const content = await renderTemplate("systems/crucible/templates/dice/action-use-chat.html", {
      action: this,
      actor: actor,
      activationTags: this.getActivationTags(),
      actionTags: this.getActionTags(),
      target: target,
      rolls: await Promise.all(rolls.map(r => r.render()))
    });

    // Create chat message
    const messageData = {
      type: CONST.CHAT_MESSAGE_TYPES[rolls.length > 0 ? "ROLL": "OTHER"],
      content: content,
      speaker: ChatMessage.getSpeaker({actor}),
    }
    if ( rolls.length > 0 ) messageData.roll = rolls[0];
    if ( rolls.length > 1 ) messageData["flags.crucible.rolls"] = rolls;
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

    // Assert that the action can be used based on its tags
    for ( let tag of this.tags ) {
      const actionTags = SYSTEM.TALENT.ACTION_TAGS[tag];
      if ( !actionTags ) continue;
      if ( (actionTags.canActivate instanceof Function) && !actionTags.canActivate(actor, this) ) {
        return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotUseTag", {
          name: actor.name,
          action: this.name,
          tag: actionTags.label
        }));
      }
    }

    // Assert that cost of the action can be afforded
    const attrs = actor.data.data.attributes;
    if ( this.actionCost > attrs.action.value ) {
      return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: actor.name,
        resource: game.i18n.localize("ATTRIBUTES.Action"),
        action: this.name
      }));
    }
    if ( this.focusCost > attrs.focus.value ) {
      return ui.notifications.warn(game.i18n.format("ACTION.WarningCannotAffordCost", {
        name: actor.name,
        resource: game.i18n.localize("ATTRIBUTES.Focus"),
        action: this.name
      }));
    }

    // Assert that required targets are designated
    let targets;
    try {
      targets = this._acquireTargets(actor);
    } catch(err) {
      return ui.notifications.warn(err.message);
    }

    // Iterate over every designated target
    let results = [];
    for ( let target of targets ) {

      // Perform each action tag callback
      const promises = this.tags.reduce((promises, tag) => {
        const promise = this._executeTag(actor, target, tag);
        if ( promise instanceof Promise ) promises.push(promise);
        return promises;
      }, []);

      // Perform post-roll callbacks
      const rolls = await Promise.all(promises);
      for ( let tag of this.tags ) {
        const at = SYSTEM.TALENT.ACTION_TAGS[tag];
        if ( at.postActivate instanceof Function ) {
          await at.postActivate(actor, this, rolls);
        }
      }

      // Display the Action itself in the chat log
      await this.toMessage(actor, target, rolls, {rollMode});
      results = results.concat(rolls);
    }

    // Incur the cost of the action that was performed
    await actor.update({
      "data.attributes.action.value": attrs.action.value - this.actionCost,
      "data.attributes.focus.value": attrs.focus.value - this.focusCost
    });
    return results;
  }

  /* -------------------------------------------- */

  _acquireTargets(actor) {
    const targets = Array.from(game.user.targets).map(t => t.actor);
    switch ( this.targetType ) {
      case "self":
        return [actor];
      case "single":
        if ( !targets.length.between(1, this.targetNumber) ) {
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
   * Perform the necessary callback method for a particular action tag
   * @param {CrucibleActor} actor
   * @param {CrucibleActor} target
   * @param {string} tag
   * @returns {Promise}
   * @private
   */
  _executeTag(actor, target, tag) {
    switch ( tag ) {
      case "mainhand":
      case "twoHanded":
        return actor.equipment.weapons.mainhand.weaponAttack(target);
      case "offhand":
        return actor.equipment.weapons.offhand.weaponAttack(target);
      case "movement":
        return null;
      default:
        console.warn(`No tags defined which determine how to use Action ${this.id}`);
    }
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
