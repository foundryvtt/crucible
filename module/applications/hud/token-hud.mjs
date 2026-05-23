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
}
