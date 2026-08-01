const HOOKS = {};

/* -------------------------------------------- */
/*  Shared Light Helpers                         */
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

/* -------------------------------------------- */

/**
 * Find the ActiveEffect (on any actor in the scene) which owns a given AmbientLight, tracked via
 * system.lights. Used so a destroyed light's owning effect - and any duration/cleanup logic tied to it -
 * gets cleaned up consistently rather than deleting the light document out from under it.
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
 * within radiusFeet of a center point. If the light is owned by an ActiveEffect, that effect is deleted
 * so the cascade-delete cleanup handles removing the light; otherwise the light itself is deleted directly.
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
    else await light.delete();
  }
}

/**
 * Explicitly delete the lights owned by a named effect still on the actor. Used on reverse/undo instead of
 * relying on the generic owned-reference cascade, since a reversed action may be a freshly reconstructed
 * instance that never re-derives the light's UUID - the actor's live effect document is the source of truth.
 * @param {CrucibleActor} actor
 * @param {string} effectName
 */
async function deleteOwnedLights(actor, effectName) {
  const effect = actor.effects.find(e => e.name === effectName);
  if ( !effect ) return;
  for ( const uuid of effect.system.lights ?? [] ) {
    const light = await fromUuid(uuid);
    if ( light ) await light.delete();
  }
}

/* -------------------------------------------- */
/*  Dawn Beacon                                  */
/* -------------------------------------------- */

/**
 * The AmbientLightData used by the Dawn Beacon pillar of light.
 * bright/dim are expressed in the scene's grid distance units (feet), matching the spell's 30ft bright / 60ft
 * total radius description.
 */
const DAWN_BEACON_LIGHT = Object.freeze({config: {bright: 30, dim: 60, color: "#fff2c2", alpha: 0.35,
  animation: {type: "pulse", speed: 1, intensity: 2}}});

HOOKS.dawnBeacon000000 = {
  async confirmAction(_item, action, {reverse}) {
    if ( reverse ) return deleteOwnedLights(this, "Dawn Beacon Pillar");
    const lightEffect = action.selfEvents.all
      .flatMap(e => e.effects ?? [])
      .find(e => e.name === "Dawn Beacon Pillar");
    if ( !lightEffect ) return; // Effect was negated (e.g. the caster was silenced) - no light should be placed
    const center = getActorCenter(this);
    if ( !center ) return;
    try {
      // This light counteracts magical darkness: destroy any darkness sources within its area first.
      await destroyMagicalDarknessNear(center, DAWN_BEACON_LIGHT.config.dim);
      const [light] = await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
        x: center.x,
        y: center.y,
        ...DAWN_BEACON_LIGHT
      }]);
      if ( !light ) return;
      lightEffect.system.lights ??= [];
      lightEffect.system.lights.push(light.uuid);
    } catch(err) {
      console.error("Dawn Beacon | failed to create AmbientLight", err);
    }
  }
};

/* -------------------------------------------- */
/*  Engulfing Darkness                           */
/* -------------------------------------------- */

/**
 * The AmbientLightData used by the Engulfing Darkness sphere. negative:true marks this as a magical
 * darkness source - the marker Dawn Beacon (and any other counteracting light) looks for.
 */
const ENGULFING_DARKNESS_LIGHT = Object.freeze({config: {bright: 0, dim: 20, negative: true, color: "#2b0033",
  alpha: 0.75, animation: {type: "blackHole", speed: 1, intensity: 3}}});

HOOKS.engulfingDarknes = {
  async confirmAction(_item, action, {reverse}) {
    if ( reverse ) return deleteOwnedLights(this, "Engulfing Darkness Sphere");
    const darknessEffect = action.selfEvents.all
      .flatMap(e => e.effects ?? [])
      .find(e => e.name === "Engulfing Darkness Sphere");
    if ( !darknessEffect ) return;
    const center = getActorCenter(this);
    if ( !center ) return;
    try {
      const [light] = await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
        x: center.x,
        y: center.y,
        ...ENGULFING_DARKNESS_LIGHT
      }]);
      if ( !light ) return;
      darknessEffect.system.lights ??= [];
      darknessEffect.system.lights.push(light.uuid);
    } catch(err) {
      console.error("Engulfing Darkness | failed to create AmbientLight", err);
    }
  }
};

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
