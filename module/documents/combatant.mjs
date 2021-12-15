
export default class CrucibleCombatant extends Combatant {
  /** @override */
  _getInitiativeFormula() {
    const attrs = this.actor.attributes;
    const bonus = Math.ceil(0.5 * (attrs.dexterity.value + attrs.intellect.value));
    const reserves = attrs.action.value;
    return `3d8 + ${bonus} + ${reserves}`;
  }
}
