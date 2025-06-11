/**
 * A specialized subclass of the Combat document which implements system-specific mechanics.
 */
export default class CrucibleCombat extends foundry.documents.Combat {

  /* -------------------------------------------- */
  /*  Document Methods                            */
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
    if ( !advanceRound ) return;

    // TODO move to "combat" subtype
    if ( this.type === "combat" ) {
      data.combatants = [];
      const results = [];
      for ( const c of this.combatants ) {
        const roll = c.getInitiativeRoll();
        await roll.evaluate();
        if ( c.actor?.isIncapacitated ) roll._total = 0;
        data.combatants.push({_id: c.id, initiative: roll.total});
        results.push({
          id: c.id,
          name: c.name,
          combatant: c,
          initiative: roll.total,
          roll
        });
      }
      data.turn = 0; // Force starting at the top of the round, ignoring defeated combatant adjustments
      await this.system.postInitiativeMessage(data.round, results);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    for ( const c of this.combatants ) {
      if ( c.actor ) c.actor.render(false);
    }
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
        changes: [{key: "system.status.impetus", value: 1, mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE}],
        duration: {
          combat: this.id,
          rounds: 0,
          turns: 1,
          startRound: 1,
          startTurn: 0
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

    // Award Heroism
    if ( this.type === "combat" ) await this.system.awardHeroism();
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
