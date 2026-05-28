import CrucibleProjectileComponent from "./vfx-projectile-component.mjs";
import CrucibleRayComponent from "./vfx-ray-component.mjs";
import CrucibleFanComponent from "./vfx-fan-component.mjs";

export {default as CrucibleVFXComponent} from "./vfx-component.mjs";
export {CrucibleProjectileComponent, CrucibleRayComponent, CrucibleFanComponent};

/**
 * Concrete Crucible VFX component classes to register into CONFIG.Canvas.vfx.components, keyed by
 * their static TYPE. The abstract CrucibleVFXComponent base is excluded.
 * @type {(typeof CrucibleVFXComponent)[]}
 */
export const CRUCIBLE_VFX_COMPONENTS = [CrucibleProjectileComponent, CrucibleRayComponent,
  CrucibleFanComponent];

/**
 * Register Crucible VFX component subclasses into the shared component registry. Coexists with the
 * core components registered by foundry's vfx.configure(); neither resets the registry.
 */
export function registerComponents() {
  for ( const cls of CRUCIBLE_VFX_COMPONENTS ) CONFIG.Canvas.vfx.components[cls.TYPE] = cls;
}
