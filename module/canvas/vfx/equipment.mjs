/**
 * The speed at which a thrown torch flies, in feet per second.
 * @type {number}
 */
const THROWN_TORCH_SPEED = 30;

/* -------------------------------------------- */

/**
 * Configure the VFXEffect data for a Burning Torch flying from its thrower to where it lands.
 * @param {CrucibleAction} action  The Throw Torch action being animated
 * @returns {object|null}          The vfxConfig object, or null if the throw has no landing point to animate
 */
export function configureThrowTorchVFXEffect(action) {
  const {item, region, token} = action;
  if ( !item || !region || !token ) return null;

  // Arc to a side chosen now, so every client sees the same flight
  const components = {
    torch: {
      type: "crucibleLightAnimation",
      light: {reference: "torchLight"},
      path: [{reference: "throwOrigin", deltas: {}}, {reference: "throwLanding", deltas: {}}],
      pathType: {type: "arc", params: {peakHeight: 0.15, direction: Math.random() < 0.5 ? -1 : 1}},
      speed: THROWN_TORCH_SPEED,
      animations: [{function: "pathLightFollow", params: {easing: "outQuad"}}]
    }
  };
  let vfxConfig;
  try {
    const effect = new foundry.canvas.vfx.VFXEffect({components, timeline: [{component: "torch", position: 0}],
      name: "crucible.throwTorch"});
    vfxConfig = effect.toObject();
  } catch(cause) {
    console.error(new Error(`Throw Torch VFX configuration failed for Action "${action.id}"`, {cause}));
    return null;
  }

  // The thrown torch's AmbientLight shares the torch's id and lands on the floor at the center of the blast region
  const {x, y} = region.shapes[0];
  vfxConfig.references = {
    torchLight: `@${region.parent.uuid}.AmbientLight.${item.id}`,
    throwOrigin: {...token.getCenterPoint(), elevation: token.elevation},
    throwLanding: {x, y, elevation: region.elevation.bottom}
  };
  return vfxConfig;
}
