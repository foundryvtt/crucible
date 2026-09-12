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
/*  Dawn Beacon                                  */
/* -------------------------------------------- */

/**
 * Find the ActiveEffect (on any actor with a token in the current scene) which owns a given AmbientLight,
 * tracked via system.lights. Deleting the owning effect - rather than the light document directly - lets
 * the generic owned-reference cascade (see CrucibleActiveEffect) handle cleanup consistently, the same way
 * it would if the effect had simply expired.
 * @param {string} lightUuid
 * @returns {CrucibleActiveEffect|null}
 */
function findOwningLightEffect(lightUuid) {
  const actors = new Set([...game.actors, ...canvas.scene.tokens.map(t => t.actor).filter(a => a)]);
  for ( const actor of actors ) {
    for ( const effect of actor.effects ) {
      if ( effect.system.lights?.has(lightUuid) ) return effect;
    }
  }
  return null;
}

/* -------------------------------------------- */

/**
 * Destroy every magical darkness source (an AmbientLight with config.negative = true) whose origin lies
 * within radiusFeet of a center point.
 * @param {{x: number, y: number}} center
 * @param {number} radiusFeet
 */
async function destroyMagicalDarknessNear(center, radiusFeet) {
  const pixelsPerFoot = canvas.scene.grid.size / canvas.scene.grid.distance;
  const radiusPx = radiusFeet * pixelsPerFoot;
  const darknessLights = canvas.scene.lights.filter(l => {
    if ( !l.config.negative ) return false;
    return Math.hypot(l.x - center.x, l.y - center.y) <= radiusPx;
  });
  for ( const light of darknessLights ) {
    const owningEffect = findOwningLightEffect(light.uuid);
    if ( owningEffect ) await owningEffect.delete();
    else await light.delete(); // Unowned darkness source (e.g. authored directly on the scene)
  }
}

/* -------------------------------------------- */

/**
 * Resolve the center point of an actor's primary active token, in canvas pixel coordinates.
 * @param {CrucibleActor} actor
 * @returns {{x: number, y: number}|null}
 */
function getActorCenter(actor) {
  const token = actor.getActiveTokens(true, true)[0];
  if ( !token ) return null;
  return token.getCenterPoint ? token.getCenterPoint() : (token.object?.center ?? null);
}

HOOKS.dawnBeacon000000 = {
  confirmAction(_item, _action, {reverse}) {
    if ( reverse ) return; // Destroying darkness is a one-time forward effect; nothing to reverse
    const center = getActorCenter(this);
    if ( !center ) return;

    // This light counteracts magical darkness: destroy any darkness sources within its area before the
    // "Dawn Beacon Pillar" effect (declared on this action, see Dawn_Beacon_dawnBeacon000000.yml) creates its
    // own owned light. 60ft matches that effect's system.light.dim radius.
    return destroyMagicalDarknessNear(center, 60);
  }
};

/* -------------------------------------------- */

export default HOOKS;
