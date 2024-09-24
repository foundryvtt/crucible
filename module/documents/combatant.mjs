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
    actor.callActorHooks("prepareStandardCheck", rollData);
    actor.callActorHooks("prepareInitiativeCheck", rollData);

    // Construct Initiative Check
    // TODO this needs to be an InitiativeCheck with custom rendering
    return new StandardCheck(rollData);
  }

  /* -------------------------------------------- */

  /**
   * Get the maximum initiative values is eligible as a delay.
   * @returns {number|null}
   */
  getDelayMaximum() {
    const position = this.parent.turns.indexOf(this);
    const nextCombatant = this.parent.turns.find((c, i) => (i > position) && c.initiative);
    return nextCombatant ? nextCombatant.initiative - 1 : null;
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
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( this.actor ) this.actor.onLeaveCombat();
  }
}
