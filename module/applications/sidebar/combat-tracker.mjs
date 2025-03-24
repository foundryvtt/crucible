/**
 * Extend and replace the core CombatTracker class to add Crucible-specific UI customizations.
 */
export default class CrucibleCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  /** @inheritDoc */
  _onRender(options) {
    super._onRender(options);
    for ( const i of this.element.querySelectorAll(".combatant-control.roll") ) i.remove();
  }
}
