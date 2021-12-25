

export default class CrucibleCombat extends Combat {

  /** @override */
  async _preUpdate(data, options, user) {
    const isNewRound = (("round" in data) && (data.round !== this.previous.round));
    await super._preUpdate(data, options, user);
    if ( isNewRound ) data.combatants = await this._updateAllInitiative(data);
  }

  /* -------------------------------------------- */

  async _updateAllInitiative() {
    const combatantUpdates = [];
    for ( let c of this.combatants ) {
      const r = c.getInitiativeRoll();
      combatantUpdates.push(r.evaluate({async: true}).then(r => {
        return {_id: c.id, initiative: r.total}
      }));
    }
    return Promise.all(combatantUpdates);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onUpdate(data, options, userId) {
    const isNewTurn = (("turn" in data) && (data.turn !== this.previous.turn));
    const isNewRound = (("round" in data) && (data.round !== this.previous.round));
    if ( isNewTurn || isNewRound ) {
      const actor = this.combatant?.actor;
      if ( !actor?.isOwner ) return;
      actor.update({"data.attributes.action.value": actor.systemData.attributes.action.max});
    }
    return super._onUpdate(data, options, userId);
  }
}
