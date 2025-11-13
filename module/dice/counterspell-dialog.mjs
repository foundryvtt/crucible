import SpellCastDialog from "./spell-cast-dialog.mjs";

/**
 * Prompt the user to configure their counterspell
 */
export default class CounterspellDialog extends SpellCastDialog {

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/counterspell-dialog.hbs";

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.action.actor;

    // Targeted spell
    // TODO: War Mage?
    const {rune, gesture} = ChatMessage.implementation.getLastAction();
    context.targetedRune = (actor.talentIds.has("recognizespellcr") && actor.grimoire.runes.has(rune)) ? rune.name : "Unknown";
    context.targetedGesture = "Unknown";
    
    return context;
  }

}
