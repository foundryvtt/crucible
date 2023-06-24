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

    // Initiative boons and banes
    const boons = {};
    const banes = {};
    const action = this.actor.system.resources.action.value;
    if ( this.parent.round && action ) {
      boons.action = {label: "Reserved Action", number: action};
    }
    if ( weapons.slow ) banes.slow = {label: "Slow Weaponry", number: weapons.slow};
    if ( actor.statuses.has("broken") ) banes.broken = {label: "Broken", number: 2};
    if ( armor.system.properties.has("bulky") ) banes.bulky = {label: "Bulky Armor", number: 2};

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

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if ( this.actor ) {
      this.actor.reset();
      this.actor._sheet?.render(false);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    if ( this.actor ) {
      this.actor.reset();
      this.actor._sheet?.render(false);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( this.actor ) {
      this.actor.reset();
      this.actor._sheet?.render(false);
    }
  }
}
