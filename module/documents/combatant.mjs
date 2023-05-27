import StandardCheck from "../dice/standard-check.mjs";


export default class CrucibleCombatant extends Combatant {

  /** @inheritDoc */
  prepareBaseData() {
    super.prepareBaseData();
    if ( this.parent.round === 0 ) this.initiative = null;
  }

  /** @override */
  getInitiativeRoll(formula) {
    const actor = this.actor;
    const {weapons, armor} = actor.equipment;

    // Default boons and banes
    const boons = this.parent.round > 0 ? this.actor.system.resources.action.value : 0;
    let banes = weapons.slow;
    if ( actor.statuses.has("broken") ) banes += 2;
    if ( armor.system.properties.has("bulky") ) banes += 2;

    // Prepare roll data
    const rollData = {
      ability: this.actor.getAbilityBonus(["dexterity", "intellect"]),
      skill: 0,
      enchantment: 0,
      boons: boons,
      banes: banes
    }

    // Call talent hooks
    actor.callTalentHooks("prepareStandardCheck", rollData);
    actor.callTalentHooks("prepareInitiativeCheck", rollData);

    // Construct Initiative Check
    return new StandardCheck(rollData);
  }
}
