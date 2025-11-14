import SpellCastDialog from "./spell-cast-dialog.mjs";

/**
 * Prompt the user to configure their Counterspell.
 */
export default class CounterspellDialog extends SpellCastDialog {

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.action.actor;
    const {rune=null, gesture=null} = ChatMessage.implementation.getLastAction() || {};
    const rLabel = (actor.talentIds.has("recognizespellcr") && actor.grimoire.runes.has(rune)) ? rune.name : "Unknown";
    context.canInflect = false;
    context.runeHint = `Target Rune: ${rLabel}`;
    context.gestureHint = `Target Gesture: Unknown`;
    context.chooseDamageType = false;
    return context;
  }

}
