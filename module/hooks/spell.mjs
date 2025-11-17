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
  confirmAction(_item, _action, outcome, options) {
    const effect = this.effects.get("protectiveMirage");
    if ( !effect ) return;
    let duplicates = effect.getFlag("crucible", "duplicates") ?? 3;

    // Verify the action targeted physical defense
    const delta = options.reverse ? 1 : -1;
    for ( const roll of outcome.rolls ) {
      if ( !(roll instanceof crucible.api.dice.AttackRoll) ) continue;
      if ( (roll.data.defenseType !== "physical") || roll.isSuccess ) continue;
      duplicates += delta;
    }

    // Delete exhausted effect
    if ( duplicates <= 0 ) {
      outcome.effects.push({_id: effect.id, _delete: true});
      return;
    }

    // Decrement effect
    outcome.effects.push({
      _id: effect.id,
      name: `Mirage (${duplicates})`,
      "flags.crucible.duplicates": duplicates
    });
  }
}

/* -------------------------------------------- */

export default HOOKS;
