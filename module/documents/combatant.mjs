import StandardCheck from "../dice/standard-check.js";


export default class CrucibleCombatant extends Combatant {

  /** @override */
  getInitiativeRoll() {
    const actor = this.actor;

    // Initiative Boons
    let boons = this.parent.round > 0 ? this.actor.attributes.action.value : 0;
    if ( actor.talentIds.has("preternaturalins") ) boons += 2;

    // Initiative Banes
    let banes = 0;
    if ( actor.equipment.weapons.slow && !actor.talentIds.has("powerfulphysique") ) banes += 3;

    // Construct Initiative Check
    return new StandardCheck({
      ability: this.actor.getAbilityBonus("dexterity.intellect"),
      skill: 0,
      enchantment: 0,
      boons: boons,
      banes: banes
    });
  }
}
