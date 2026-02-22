import CounterspellDialog from "../dice/counterspell-dialog.mjs";
import CrucibleSpellAction from "./spell-action.mjs";

/**
 * Data and functionality that represents a Counterspell in the Crucible spellcraft system.
 */
export default class CrucibleCounterspellAction extends CrucibleSpellAction {

  /** @override */
  static dialogClass = CounterspellDialog;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareData() {
    const {cost, name, img, target, description, range} = this;
    this.rune ??= this.actor?.grimoire.runes.keys().next().value ?? "lightning";
    this.gesture ??= "touch";
    super._prepareData();
    Object.assign(this, {name, img, target, description, range, cost}); // Undo upstream changes
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepare() {
    super._prepare();
    this.usage.hasDice = true; // Counterspell always involves a roll
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  acquireTargets(options={}) {
    if ( this.usage.targetAction?.message === null ) {
      return [{token: null, actor: this.actor, name: this.actor.name, uuid: this.actor.uuid}];
    }
    const targets = super.acquireTargets(options);
    const target = targets[0];
    const lastAction = ChatMessage.implementation.getLastAction({actor: target?.actor});
    const wasSpell = lastAction && (lastAction.tags.has("composed") || lastAction.tags.has("iconicSpell"));
    if ( !wasSpell ) {
      const error = game.i18n.localize("SPELL.COUNTERSPELL.WARNINGS.BadTarget");
      if ( target ) target.error = error;
      if ( options.strict ) throw new Error(error);
    }
    return targets;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags() {
    const tags = super.getTags();
    delete tags.action.defense;
    delete tags.action.healing;
    delete tags.action.resource;
    return tags;
  }

  /* -------------------------------------------- */
  /*  Display and Formatting Methods              */
  /* -------------------------------------------- */

  /** @override */
  // TODO: Store target message ID on action instead of flag, obviating the need for this override
  async _prepareMessage(targets, {confirmed}={}) {
    const messageData = await super._prepareMessage(targets, {confirmed});
    const lastAction = this.usage.targetAction ?? ChatMessage.implementation.getLastAction();
    if ( !lastAction?.message ) return messageData;
    foundry.utils.setProperty(messageData, "flags.crucible.targetMessageId", lastAction.message.id);
    return messageData;
  }

  /* -------------------------------------------- */
  /*              Socket Interactions             */
  /* -------------------------------------------- */

  /**
   * Handle a request to use a non-combat Counterspell action
   * @param {CrucibleActor|string} actor  An Actor or UUID of an Actor to perform the action
   * @param {object} options              Additional options
   * @param {string} options.rune         The rune used on the to-be-counterspelled action
   * @param {string} options.gesture      The gesture used on the to-be-counterspelled action
   * @param {number} options.dc           The DC for the Counterspell action
   * @param {string} [options.inflection] The inflection used on the to-be-counterspelled action
   */
  static async prompt(actor, {rune, gesture, inflection, dc}={}) {
    if ( typeof actor === "string" ) actor = await fromUuid(actor);
    if ( !(actor instanceof Actor) ) throw new Error("CounterspellAction.prompt requires an Actor instance");
    const counterspellAction = actor?.actions.counterspell;
    if ( !counterspellAction ) return;
    const tags = actor.inCombat ? counterspellAction.tags : Array.from(counterspellAction.tags).findSplice(t => t === "reaction", "noncombat");
    const action = counterspellAction.clone({tags});
    action.usage.dc = dc;
    action.usage.targetAction = new crucible.api.models.CrucibleSpellAction({rune, gesture, inflection});
    return action.use();
  }
}
