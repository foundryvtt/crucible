import SpellCastDialog from "./spell-cast-dialog.mjs";

/**
 * Prompt the user to configure their Counterspell.
 */
export default class CounterspellDialog extends SpellCastDialog {

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.action.actor;
    const {rune=null} = ChatMessage.implementation.getLastAction() || {};
    let runeLabel = "Unknown"; // TODO localize
    if ( rune && actor.talentIds.has("recognizespellcr") && actor.grimoire.runes.has(rune?.id) ) runeLabel = rune.name;
    context.canInflect = false;
    context.runeHint = `Target Rune: ${runeLabel}`;
    context.gestureHint = `Target Gesture: Unknown`;
    context.chooseDamageType = false;
    return context;
  }

}
