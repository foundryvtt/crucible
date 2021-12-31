

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
    const isNewRound = (("round" in data) && (data.round !== this.previous.round));
    await super._preUpdate(data, options, user);
    if ( isNewRound ) data.combatants = await this._updateAllInitiative(data);
  }

  /* -------------------------------------------- */

  async _updateAllInitiative(data) {
    const combatantUpdates = [];
    const chatLog = [];

    // Make combat updates
    for ( let c of this.combatants ) {
      const r = c.getInitiativeRoll();
      combatantUpdates.push(r.evaluate({async: true}).then(r => {
        chatLog.push({name: c.name, roll: r, result: r.total});
        return {_id: c.id, initiative: r.total}
      }));
    }
    const updates = await Promise.all(combatantUpdates);

    // Chat log message
    chatLog.sort((a, b) => b.result - a.result);
    const rows = chatLog.map(i => {
      const rd = i.roll.data;
      const modifiers = [
        rd.ability.signedString(),
        rd.boons > 0 ? `${rd.boons} Boons` : "",
        rd.banes > 0 ? `${rd.banes} Banes` : ""
      ].filterJoin(", ");
      return `<tr><td>${i.name}</td><td>${modifiers}</td><td>${i.result}</td></tr>`;
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
      speaker: ChatMessage.getSpeaker({user: game.user})
    });
    return updates;
  }

  /* -------------------------------------------- */

  /** @override */
  _onUpdate(data, options, userId) {

    // Check whether the turn order changed
    const isNewTurn = (("turn" in data) && (data.turn !== this.previous.turn));
    const isNewRound = (("round" in data) && (data.round !== this.previous.round));
    super._onUpdate(data, options, userId);

    // Apply changes at the start of a new combatant's turn
    if ( isNewTurn || isNewRound ) {
      const actor = this.combatant?.actor;
      if ( actor?.isOwner ) actor.recover();
    }
  }
}
