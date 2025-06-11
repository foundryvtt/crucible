import StandardCheck from "../dice/standard-check.mjs";


export default class CrucibleCombatant extends Combatant {

  /** @inheritDoc */
  prepareBaseData() {
    super.prepareBaseData();
    if ( this.parent.round === 0 ) this.initiative = null;
  }

  /* -------------------------------------------- */

  /** @override */
  getInitiativeRoll(formula) {
    const boons = {};
    const banes = {};
    const rollData = {ability: 0, skill: 0, enchantment: 0, boons, banes}

    // Actor preparation
    if ( this.actor ) {

      // Ability bonus
      rollData.ability = this.actor.getAbilityBonus(["dexterity", "intellect"]);

      // Boons and Banes
      const action = this.actor.system.resources.action.value;
      if ( this.parent.round && action ) boons.action = {label: "Reserved Action", number: action};
      const {weapons, armor} = this.actor.equipment;
      if ( weapons.slow ) banes.slow = {label: "Slow Weaponry", number: weapons.slow};
      if ( this.actor.statuses.has("broken") ) banes.broken = {label: "Broken", number: 2};
      if ( armor.system.properties.has("bulky") ) banes.bulky = {label: "Bulky Armor", number: 2};

      // Actor Hooks
      this.actor.callActorHooks("prepareStandardCheck", rollData);
      this.actor.callActorHooks("prepareInitiativeCheck", rollData);
    }
    return new StandardCheck(rollData); // TODO this needs to be an InitiativeCheck with custom rendering
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
