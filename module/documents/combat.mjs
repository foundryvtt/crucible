export default class CrucibleCombat extends Combat {

  /* -------------------------------------------- */
  /*  Database Update Workflows                   */
  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(data, options, user) {
    const advanceRound = ("round" in data) && (data.round > this.current.round);
    await super._preUpdate(data, options, user);

    // Re-roll Initiative
    if ( advanceRound ) {
      const rolls = await this.#updateInitiativeRolls();
      data.combatants = rolls.map(r => ({_id: r.combatant.id, initiative: r.roll.total}));
      await this.#postInitiativeMessage(data.round, rolls);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _onStartTurn(combatant) {
    return combatant.actor.onBeginTurn();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onEndTurn(combatant) {
    return combatant.actor.onEndTurn();
  }

  /* -------------------------------------------- */

  /**
   * When the Combat encounter advances to a new round, trigger an update of Initiative for every participant.
   * @returns {Promise<object[]>}       Updated initiative scores for all Combatant documents
   */
  async #updateInitiativeRolls() {
    const rolls = [];
    for ( const c of this.combatants ) {
      const r = c.getInitiativeRoll();
      await r.evaluate();
      rolls.push({combatant: c, roll: r});
    }
    return rolls;
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
