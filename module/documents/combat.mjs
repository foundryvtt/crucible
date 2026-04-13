/**
 * A specialized subclass of the Combat document which implements system-specific mechanics.
 */
export default class CrucibleCombat extends foundry.documents.Combat {

  /* -------------------------------------------- */

  /** @inheritDoc */
  async previousRound() {
    if ( !game.user.isGM ) {
      ui.notifications.warn(_loc("COMBAT.WARNINGS.CannotChangeRound"));
      return this;
    }
    return super.previousRound();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async nextRound() {
    if ( !game.user.isGM ) {
      ui.notifications.warn(_loc("COMBAT.WARNINGS.CannotChangeRound"));
      return this;
    }
    return super.nextRound();
  }

  /* -------------------------------------------- */

  /** @override */
  _sortCombatants(a, b) {

    // Initiative first
    const aValue = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    const bValue = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
    if ( aValue !== bValue ) return bValue - aValue;

    // Modifier second
    const aBonus = a.abilityBonus;
    const bBonus = b.abilityBonus;
    if ( aBonus !== bBonus ) return bBonus - aBonus;

    // Maximum Action
    const aMax = a.actor?.resources.action.max || 0;
    const bMax = b.actor?.resources.action.max || 0;
    if ( aMax !== bMax) return bMax - aMax;

    // Type
    const aType = a.actor?.type === "adversary" ? 1 : 0;
    const bType = b.actor?.type === "adversary" ? 1 : 0;
    return (bType - aType) || a.name.compare(b.name) || a._id.compare(b._id);
  }

  /* -------------------------------------------- */
  /*  Database Update Workflows                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    if ( !("type" in data) ) this.updateSource({type: "combat", system: _replace({})});
  }

  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(data, options, user) {
    const advanceRound = ("round" in data) && (data.round > this.current.round);
    await super._preUpdate(data, options, user);
    if ( advanceRound && (this.type === "combat") ) await this.system.preUpdateRoundInitiative(data);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(change, options, userId) {
    super._onUpdate(change, options, userId);
    if ( this.type === "combat" ) this.system.constructor.refreshCombatTracker();
  }


  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    const isGM = game.user.isActiveGM;
    const actorUpdates = [];
    const removeFlanking = [];
    for ( const {actor} of this.combatants ) {
      if ( !actor ) continue;
      if ( isGM ) {
        const {updates, updateFlanking} = actor.prepareLeaveCombatUpdates();
        if ( !foundry.utils.isEmpty(updates) ) actorUpdates.push({_id: actor.id, ...updates});
        if ( updateFlanking ) removeFlanking.push(actor);
      }
      actor.reset();
      actor.render(false);
    }
    if ( actorUpdates.length ) Actor.updateDocuments(actorUpdates);
    Promise.allSettled(removeFlanking.map(a => a.commitFlanking()));
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartTurn(combatant, context) {
    await super._onStartTurn(combatant, context);
    // TODO forward turn events to the system subtype
    return combatant.actor.onStartTurn(context);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartRound(context) {
    await super._onStartRound(context);
    if ( this.turns.length < 2 ) return;

    // Identify the first combatant to act in the round
    const firstCombatant = this.turns[0];
    const firstActor = firstCombatant?.actor;

    // Identify the last non-incapacitated combatant to act in the round
    let lastCombatant;
    for ( let i=this.turns.length-1; i>0; i-- ) {
      if ( this.turns[i].actor?.isIncapacitated !== true ) {
        lastCombatant = this.turns[i];
        break;
      }
    }
    const lastActor = lastCombatant?.actor;

    // Morale Escalation
    if ( this.round > 6 ) {
      await firstActor?.alterResources({morale: this.round}, {}, {statusText: [{text: "Escalation"}]});
      await lastActor?.alterResources({morale: -this.round}, {}, {statusText: [{text: "Escalation"}]});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onEndTurn(combatant, context) {
    await super._onEndTurn(combatant, context);
    await combatant.actor.onEndTurn(context);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onExit(combatant) {
    await super._onExit(combatant);
    if ( combatant.actor ) await combatant.actor.onLeaveCombat(this);
  }
}
