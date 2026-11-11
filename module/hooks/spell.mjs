const HOOKS = {};

/* -------------------------------------------- */

HOOKS.protectiveMirage = {
  _getPendingChange(actor, action, effect) {
    const events = action.eventsByActor.get(actor)?.all ?? [];
    return events.flatMap(e => e.effects).find(f => f._id === effect.id);
  },
  defendAttack(item, action, _origin, rollData) {
    if ( !action.tags.has("strike") ) return;
    const effect = this.effects.get("protectiveMirage");
    if ( !effect ) return;
    const prior = HOOKS.protectiveMirage._getPendingChange(this, action, effect);
    const duplicates = prior
      ? (prior.flags?.crucible?.duplicates ?? 0)
      : (effect.getFlag("crucible", "duplicates") ?? 3);
    if ( duplicates > 0 ) rollData.banes.mirage = {label: item.name, number: duplicates * 2};
  },
  receiveAttack(_item, action, roll) {
    if ( (roll.data.defenseType !== "physical") || roll.isSuccess ) return;
    const effect = this.effects.get("protectiveMirage");
    if ( !effect ) return;
    const prior = HOOKS.protectiveMirage._getPendingChange(this, action, effect);
    if ( prior?._action === "delete" ) return;
    const current = prior ? prior.flags.crucible.duplicates : (effect.getFlag("crucible", "duplicates") ?? 3);
    const duplicates = current - 1;
    const change = (duplicates <= 0) ? {_id: effect.id, _action: "delete"} : {
      _id: effect.id,
      name: `Mirage (${duplicates})`,
      flags: {crucible: {duplicates}},
      _action: "update"
    };
    if ( prior ) {
      delete prior.name;
      delete prior.flags;
      Object.assign(prior, change);
    }
    else action.recordEvent({type: "effect", target: this, effects: [change]});
  }
};

/* -------------------------------------------- */

export default HOOKS;
