

export default class CrucibleCombat extends Combat {

  /** @inheritdoc */
  async nextRound() {
    if ( !game.user.isGM ) return ui.notifications.warn("Only a Gamemaster user may advance the Combat round.");
    return super.nextRound();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async previousRound() {
    if ( !game.user.isGM ) return ui.notifications.warn("Only a Gamemaster user may change the Combat round.");
    return super.previousRound();
  }

  /* -------------------------------------------- */
  /*  Database Update Workflows                   */
  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(data, options, user) {
    const advanceTurn = ("turn" in data) && (data.turn > this.current.turn);
    const advanceRound = ("round" in data) && (data.round > this.current.round);
    await super._preUpdate(data, options, user);

    // Actor End Turn
    const actor = this.combatant?.actor;
    if ( actor && (advanceRound || advanceTurn) ) await actor.onEndTurn();

    // Re-roll Initiative
    if ( advanceRound ) data.combatants = await this.#updateAllInitiative(data);
  }

  /* -------------------------------------------- */

  /** @override */
  _onUpdate(data, options, userId) {
    const advanceTurn = ("turn" in data) && (data.turn > this.previous.turn);
    const advanceRound = ("round" in data) && (data.round > this.previous.round);
    super._onUpdate(data, options, userId);

    // Actor Begin Turn
    const actor = this.combatant?.actor;
    if ( actor && (advanceTurn || advanceRound) ) {
      const hasControl = ((game.userId === userId) && actor.isOwner) || game.users.find(u => u.isGM).isSelf;
      if ( hasControl ) actor.onBeginTurn();
    }
  }

  /* -------------------------------------------- */

  /**
   * When the Combat encounter advances to a new round, trigger an update of Initiative for every participant.
   * @param {object} data               The data being changed as the round changes
   * @returns {Promise<object[]>}       Updated initiative scores for all Combatant documents
   */
  async #updateAllInitiative(data) {
    const combatantUpdates = [];
    const chatLog = [];

    // Make combat updates
    for ( let c of this.combatants ) {
      const r = c.getInitiativeRoll();
      combatantUpdates.push(r.evaluate({async: true}).then(r => {
        chatLog.push({id: c.id, name: c.name, roll: r, initiative: r.total});
        return {_id: c.id, initiative: r.total};
      }));
    }
    const updates = await Promise.all(combatantUpdates);

    // Chat log message
    chatLog.sort(this._sortCombatants);
    const rows = chatLog.map(i => {
      const rd = i.roll.data;
      const modifiers = [
        rd.ability.signedString(),
        rd.boons > 0 ? `${rd.boons} Boons` : "",
        rd.banes > 0 ? `${rd.banes} Banes` : ""
      ].filterJoin(", ");
      return `<tr><td>${i.name}</td><td>${modifiers}</td><td>${i.initiative}</td></tr>`;
    }).join("");
    ChatMessage.create({
      content: `
      <h3>Combat Round ${data.round} - Initiative Rolls</h3>
      <table style="font-size: 12px">
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
      </table>`,
      speaker: ChatMessage.getSpeaker({user: game.user}),
      "flags.crucible.isInitiativeReport": true
    });
    return updates;
  }
}
