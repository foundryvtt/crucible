/**
 * Light animations, driven by a {@link CrucibleLightAnimationComponent} with the core VFXComponentAnimation contract.
 * Each receives the component's state, whose `light` handle moves or reconfigures the animated light source.
 */
export const LIGHT_ANIMATIONS = {

  /**
   * Move the light along the component's path.
   */
  pathLightFollow: {
    setup(state, params) {
      params.ease = foundry.canvas.vfx.utils.resolveEasing(params.easing ?? "linear", params.easingParams);
      params.index = 0;
    },
    animate(t, state, params) {
      if ( !state.path ) return;
      const point = state.path.interpolatedPoint(params.ease(t), params.index);
      params.index = point.index ?? params.index;
      state.light.moveTo(point);
    }
  }
};
