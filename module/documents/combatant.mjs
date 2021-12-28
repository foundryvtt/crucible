import StandardCheck from "../dice/standard-check.js";


export default class CrucibleCombatant extends Combatant {

  /** @override */
  getInitiativeRoll() {
    return new StandardCheck({
      ability: this.actor.getAbilityBonus("dexterity.intellect"),
      skill: 0,
      enchantment: 0,
      boons: this.parent.round > 0 ? this.actor.attributes.action.value : 0,
      banes: this.actor.equipment.weapons.slow * 3
    });
  }
}
