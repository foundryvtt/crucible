import {getEffectId} from "../../const/effects.mjs";

/**
 * Override the base TokenHUD class to implement some Crucible-specific presentation.
 * TODO Eventually it will add custom resource management, action HUD, etc...
 */
export default class CrucibleTokenHUD extends foundry.applications.hud.TokenHUD {

  /** @override */
  _getMovementActionChoices() {
    const choices = super._getMovementActionChoices();
    if ( this.document.actor?.type === "group" ) {
      delete choices[""];
      if ( !this.document._source.movementAction ) Object.assign(choices.normal, {isActive: true, cssClass: "active"});
    }
    return choices;
  }

  /* -------------------------------------------- */

  /** @override */
  _getStatusEffectChoices() {
    const choices = super._getStatusEffectChoices();
    // Detect toggle-layer effects by their predictable Toggled-prefixed _id since CONFIG.statusEffects entries
    // do not carry the static _id used by the upstream single-status detection path.
    for ( const [statusId, choice] of Object.entries(choices) ) {
      if ( choice.isActive ) continue;
      const existing = this.actor?.effects.get(getEffectId(`Toggled ${statusId}`));
      if ( !existing ) continue;
      choice.isActive = true;
      if ( existing.getFlag("core", "overlay") ) choice.isOverlay = true;
      choice.cssClass = [choice.isActive ? "active" : null, choice.isOverlay ? "overlay" : null].filterJoin(" ");
    }
    return choices;
  }
}
