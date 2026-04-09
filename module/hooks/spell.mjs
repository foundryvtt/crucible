const HOOKS = {};

/* -------------------------------------------- */

HOOKS.protectiveMirage = {
  defendAttack(item, action, _origin, rollData) {
    if ( !action.tags.has("strike") ) return;
    const effect = this.effects.get("protectiveMirage");
    if ( !effect ) return;
    const duplicates = effect.getFlag("crucible", "duplicates") ?? 3;
    rollData.banes.mirage = {label: item.name, number: duplicates * 2};
  },
  confirmAction(_item, action, {reverse}) {
    const effect = this.effects.get("protectiveMirage");
    if ( !effect ) return;
    let duplicates = effect.getFlag("crucible", "duplicates") ?? 3;

    // Count physical attacks that were blocked (failed) against this actor
    const delta = reverse ? 1 : -1;
    for ( const event of action.events ) {
      if ( (event.target !== this) || !event.roll ) continue;
      if ( !(event.roll instanceof crucible.api.dice.AttackRoll) ) continue;
      if ( (event.roll.data.defenseType !== "physical") || event.roll.isSuccess ) continue;
      duplicates += delta;
    }

    // Delete exhausted effect
    if ( duplicates <= 0 ) {
      action.recordEvent({type: "effect", target: this, effects: [{_id: effect.id, _action: "delete"}]});
      return;
    }

    // Decrement effect
    action.recordEvent({type: "effect", target: this, effects: [{
      _id: effect.id,
      name: `Mirage (${duplicates})`,
      "flags.crucible.duplicates": duplicates,
      _action: "update"
    }]});
  }
};

/* -------------------------------------------- */

export default HOOKS;
