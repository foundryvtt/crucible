/**
 * A specialized subclass of the Combat document which implements system-specific mechanics.
 */
export default class CrucibleCombat extends foundry.documents.Combat {

  /* -------------------------------------------- */
  /*  Document Methods                            */
  /* -------------------------------------------- */

  /**
   * @override
   * FIXME bugfix for core https://github.com/foundryvtt/foundryvtt/issues/13095
   * This can be deleted when that bug is closed.
   */
  getCombatantsByActor(actor) {
    const isActor = actor instanceof foundry.documents.Actor;
    if ( isActor && actor.isToken ) return this.getCombatantsByToken(actor.token);
    const actorId = isActor ? actor.id : actor;
    return this.combatants.filter(c => c.actor?.id === actorId);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async previousRound() {
    if ( !game.user.isGM ) {
      ui.notifications.warn("COMBAT.WarningCannotChangeRound", {localize: true});
      return this;
    }
    return super.previousRound();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async nextRound() {
    if ( !game.user.isGM ) {
      ui.notifications.warn("COMBAT.WarningCannotChangeRound", {localize: true});
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
    return (bType - aType) || a.name.compare(b.name) || a._id.localeCompare(b._id);
  }

  /* -------------------------------------------- */
  /*  Database Update Workflows                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    if ( !("type" in data) ) this.updateSource({type: "combat", "==system": {}});
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
        actorUpdates.push({_id: actor.id, "system.resources.heroism.value": 0});
        if ( actor.statuses.has("flanked") ) removeFlanking.push(actor);
      }
      actor.render(false);
    }
    if ( actorUpdates.length ) Actor.updateDocuments(actorUpdates);
    Promise.allSettled(removeFlanking.map(a => a.commitFlanking()));
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartTurn(combatant) {
    await super._onStartTurn(combatant);
    // TODO forward turn events to the system subtype
    return combatant.actor.onStartTurn();
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

    // Impetus
    const impetusId = "impetus000000000";
    if ( firstActor?.talentIds.has(impetusId) ) {
      const impetus = {
        _id: impetusId,
        name: "Impetus",
        icon: "icons/magic/movement/trail-streak-zigzag-yellow.webp",
        statuses: ["hastened"],
        duration: {
          combat: this.id,
          rounds: 1,
        }
      }
      if ( firstActor.effects.has(impetusId) ) await firstActor.updateEmbeddedDocuments("ActiveEffect", [impetus]);
      else await ActiveEffect.create(impetus, {parent: firstActor, keepId: true});
      firstCombatant.updateResource();
    }

    // Focused Anticipation TODO refactor elsewhere
    if ( firstActor?.talentIds.has("focusedanticipat") ) {
      const status = {text: "Focused Anticipation", fillColor: SYSTEM.RESOURCES.focus.color.css};
      await firstActor.alterResources({focus: 1}, {}, {statusText: [status]});
    }

    // Morale Escalation
    if ( this.round > 6 ) {
      await firstActor?.alterResources({morale: this.round}, {}, {statusText: [{text: "Escalation"}]});
      await lastActor?.alterResources({morale: -this.round}, {}, {statusText: [{text: "Escalation"}]});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onEndTurn(combatant) {
    await super._onEndTurn(combatant);
    await combatant.actor.onEndTurn();
    // FIXME determine whether these lines are still required
    combatant.updateResource();
    this.debounceSetup(); // TODO wish this wasn't needed
  }
}
