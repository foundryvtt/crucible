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
  _initializeSource(data, options) {
    data = super._initializeSource(data, options);
    data.rune ??= this.actor?.grimoire.runes.first()?.id ?? "lightning";
    data.gesture ??= this.actor?.grimoire.runes.first()?.id ?? "touch";
    return data;
  }

  /** @inheritDoc */
  _prepareData() {
    const {cost: {action, focus}, name, img, target, description, range} = this;
    super._prepareData();

    const cost = {
      ...this.cost,
      action,
      focus
    };

    // Avoid determining hands cost if not actually composing a counterspell
    if ( !this.composition ) cost.hands = 0;
    
    // Undo certain changes we don't want done
    Object.assign(this, {
      name, img, target, description, range, cost
    });
  }


  /* -------------------------------------------- */

  getSpellId({rune, gesture, inflection}={}) {
    return "counterspell";
  }

  /* -------------------------------------------- */
  /*  Action Execution Methods                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  acquireTargets(options={}) {
    const targets = super.acquireTargets(options);
    const target = targets[0];
    const lastAction = ChatMessage.implementation.getLastAction({actor: target?.actor});
    if ( !lastAction || !lastAction.tags.has("spell") ) {
      target.error = "You can only counterspell the caster of the last action, and that must action must be a spell!";
      if (options.strict) throw new Error(target.error);
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
}