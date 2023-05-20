/**
 * Extend and replace the core CombatTracker class to add Crucible-specific UI customizations.
 */
export default class CrucibleCombatTracker extends CombatTracker {

  /** @inheritDoc */
  async _renderInner(data) {
    const html = await super._renderInner(data);
    for ( const i of html.find(".combatant-control.roll") ) i.remove();
    return html;
  }
}
