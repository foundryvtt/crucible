import SpellCastDialog from "./spell-cast-dialog.mjs";

/**
 * Prompt the user to configure their Counterspell.
 */
export default class CounterspellDialog extends SpellCastDialog {

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.action.actor;
    const {rune=null} = this.action.usage.targetAction || {};
    const unknown = _loc("Unknown");
    let runeLabel = unknown;
    if ( rune && actor.talentIds.has("recognizespellcr") && actor.grimoire.runes.has(rune?.id) ) runeLabel = rune.name;
    context.canInflect = false;
    context.runeHint = _loc("SPELL.COUNTERSPELL.TargetRune", {rune: runeLabel});
    context.gestureHint = _loc("SPELL.COUNTERSPELL.TargetGesture", {gesture: unknown});
    context.chooseDamageType = false;
    return context;
  }

}
