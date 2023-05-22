export default class CrucibleCombat extends Combat {

  /* -------------------------------------------- */
  /*  Database Update Workflows                   */
  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(data, options, user) {
    const advanceRound = ("round" in data) && (data.round > this.current.round);
    await super._preUpdate(data, options, user);

    // Update Initiative scores for all Combatants
    if ( !advanceRound ) return;
    data.combatants = [];
    const rolls = [];
    for ( const c of this.combatants ) {
      const roll = c.getInitiativeRoll();
      await roll.evaluate();
      if ( c.actor.isIncapacitated ) roll._total = 0;
      data.combatants.push({_id: c.id, initiative: roll.total});
      rolls.push({combatant: c, roll});
    }

    // Post new round Initiative summary
    await this.#postInitiativeMessage(data.round, rolls);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartTurn(combatant) {
    return combatant.actor.onBeginTurn();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartRound() {
    if ( this.turns.length < 2 ) return;

    // Identify the first combatant to act in the round
    const firstCombatant = this.turns[0];
    const firstActor = firstCombatant.actor;

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
    if ( (this.round === 1) && firstActor?.talentIds.has(impetusId) ) {
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
      first.updateResource();
    }

    // Morale Escalation
    await firstActor?.alterResources({morale: this.round});
    await lastActor?.alterResources({morale: -this.round});
  }

  /* -------------------------------------------- */

  /** @override */
  async _onEndTurn(combatant) {
    await combatant.actor.onEndTurn();
    combatant.updateResource();
    this.debounceSetup(); // TODO wish this wasn't needed
  }

  /* -------------------------------------------- */

  #postInitiativeMessage(round, rolls) {
    const entries = rolls.map(r => {
      return {id: r.combatant.id, name: r.combatant.name, roll: r.roll, initiative: r.roll.total}
    });
    entries.sort(this._sortCombatants);

    // Format table rows
    const rows = entries.map(i => {
      const rd = i.roll.data;
      const modifiers = [
        rd.ability.signedString(),
        rd.boons > 0 ? `${rd.boons} Boons` : "",
        rd.banes > 0 ? `${rd.banes} Banes` : ""
      ].filterJoin(", ");
      return `<tr><td>${i.name}</td><td>${modifiers}</td><td>${i.initiative}</td></tr>`;
    }).join("");

    // Create the Chat Message
    return ChatMessage.create({
      content: `
      <section class="crucible roll initiative">
      <h3>Round ${round} - Initiative Rolls</h3>
      <table>
        <thead>
          <tr>
              <th>Combatant</th>
              <th>Modifiers</th>
              <th>Result</th>
          </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
      </table>
      </section>`,
      speaker: ChatMessage.getSpeaker({user: game.user}),
      "flags.crucible.isInitiativeReport": true
    });
  }
}
