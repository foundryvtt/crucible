/**
 * Configure the data for a VFXEffect
 * @param action
 * @returns {{components: {}, name, timeline: *[]}|null}
 */
export function configureStrikeVFXEffect(action) {
  if ( !action.tags.has("strike") ) throw new Error(`The Action ${action.id} does not use the strike tag.`);
  const components = {};
  const timeline = {sequence: []};
  const references = {
    token: action.token.uuid,
    actor: action.actor.uuid
  };

  // Prepare each weapon strike
  let j=1; // Target
  for ( const outcome of action.outcomes.values() ) {
    if ( outcome.target === action.actor ) continue;
    const targetTokenReference = `outcome_${j}_token`;
    references[targetTokenReference] = outcome.token.uuid;
    let i=1; // Strike
    for ( const weapon of action.usage.strikes ) {
      if ( !["projectile1", "projectile2"].includes(weapon.category) ) continue;
      const componentName = `arrowProjectile_${j}_${i}`;
      components[componentName] = {
        type: "arrow",
        texture: "modules/foundryvtt-vfx/assets/arrow/arrow-wood.png",
        path: {
          origin: {reference: "token", property: "object.center"},
          destination: {reference: targetTokenReference, property: "object.center"}
        },
        elevation: {reference: "token", property: "elevation", delta: 1},
        scale: 0.25
      };
      timeline.sequence.push(componentName);
      i++;
    }
    j++;
  }

  if ( !timeline.sequence.length ) return null;

  // Validate that the effect data parses correctly
  const vfxConfig = {name: action.id, components, timeline};
  try {
    new foundry.vfx.VFXEffect(vfxConfig);
  } catch(cause) {
    console.warn(new Error(`Strike VFX configuration failed for Action "${this.id}"`, {cause}));
  }
  vfxConfig.references = references;
  return vfxConfig;
}
