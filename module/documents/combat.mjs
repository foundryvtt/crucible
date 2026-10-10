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
    if ( game.user.isGM ) return super.nextRound();

    // Players may ask the Gamemaster to advance the round when they cannot end the final turn themselves
    if ( this._canRequestRoundAdvance(game.user) ) return this._requestRoundAdvance();
    ui.notifications.warn(_loc("COMBAT.WARNINGS.CannotChangeRound"));
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Is the current turn the final one in the round, such that advancing the turn would advance the Combat to the
   * next round? Mirrors the wrap-around behavior of Combat#nextTurn, including the skipDefeated setting.
   * @type {boolean}
   */
  get isFinalTurn() {
    if ( this.round === 0 ) return false;
    const turn = this.turn ?? -1;
    if ( this.settings.skipDefeated ) return this.turns.slice(turn + 1).every(c => c.isDefeated);
    return (turn + 1) >= this.turns.length;
  }

  /* -------------------------------------------- */

  /**
   * May a User request that the Gamemaster advance the round on their behalf? Only permitted when the Combat is
   * underway, the User owns the currently acting Combatant, and that Combatant is the final one to act.
   * @param {User} user     The requesting User
   * @returns {boolean}     Whether the User may make the request
   */
  _canRequestRoundAdvance(user) {
    return ( this.round > 0 ) && this.isFinalTurn && ( this.combatant?.testUserPermission(user, "OWNER") ?? false );
  }

  /* -------------------------------------------- */

  /**
   * Request that the Gamemaster advance the Combat round on behalf of the current User, which occurs when the final
   * acting Combatant of a round belongs to a player who is otherwise unable to end their own turn.
   * @returns {Promise<Combat>}
   */
  async _requestRoundAdvance() {
    if ( !game.users.activeGM ) {
      ui.notifications.warn(_loc("COMBAT.WARNINGS.NoGamemasterPresent"));
      return this;
    }
    game.socket.emit("system.crucible", {
      action: "requestRoundAdvance",
      data: {combatId: this.id, userId: game.user.id, round: this.round}
    });
    return this;
  }

  /* -------------------------------------------- */

  /** @override */
  _sortCombatants(a, b) {

    // Initiative first
    const aValue = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    const bValue = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
    if ( aValue !== bValue ) return bValue - aValue;

    // Delayers act first at their target initiative.
    // Among delayers, the originally-faster combatant goes first.
    const round = a.parent?.round;
    const aDelay = (a.actor?.flags.crucible?.delay?.round === round) ? a.actor.flags.crucible.delay : null;
    const bDelay = (b.actor?.flags.crucible?.delay?.round === round) ? b.actor.flags.crucible.delay : null;
    if ( !!aDelay !== !!bDelay ) return aDelay ? -1 : 1;
    if ( aDelay && bDelay && (aDelay.from !== bDelay.from) ) return bDelay.from - aDelay.from;

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
    for ( const {actor} of this.combatants ) {
      if ( !actor ) continue;
      if ( isGM ) {
        const updates = actor.prepareLeaveCombatUpdates();
        if ( !foundry.utils.isEmpty(updates) ) actorUpdates.push({_id: actor.id, ...updates});
      }
      actor.reset();
      actor.render(false);
    }
    if ( !isGM ) return;
    const batchOperations = [];
    if ( actorUpdates.length ) batchOperations.push({
      action: "update",
      documentName: "Actor",
      updates: actorUpdates
    });

    // Flush the affectedActors tracking of any Crucible Action behaviors which fired during this combat
    for ( const uuid of (this.getFlag("crucible", "trackedActionBehaviors") ?? []) ) {
      const behavior = fromUuidSync(uuid);
      if ( behavior?.type !== "crucible.action" ) continue;
      const operation = behavior.system.updateAffectedActors(this, {batch: true});
      if ( operation ) batchOperations.push(operation);
    }
    if ( batchOperations.length ) foundry.documents.modifyBatch(batchOperations);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartTurn(combatant, context) {
    await super._onStartTurn(combatant, context);
    await this.system._onStartTurn?.(combatant, context);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartRound(context) {
    await super._onStartRound(context);
    await this.system._onStartRound?.(context);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onEndTurn(combatant, context) {
    await super._onEndTurn(combatant, context);
    await this.system._onEndTurn?.(combatant, context);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onExit(combatant) {
    await super._onExit(combatant);
    if ( combatant.actor ) await combatant.actor.onLeaveCombat(this);
  }
}
