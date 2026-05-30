import {SPRITE_ANIMATIONS} from "./sprite.mjs";
import {PARTICLE_ANIMATIONS} from "./particle.mjs";

/**
 * Registered Crucible VFX animations: the functions written into `CONFIG.Canvas.vfx.animations` and
 * referenced by name from component phase configs.
 *
 * Naming convention - every registry key is `<shape><kind><descriptor>`:
 * - shape: the spatial form the behavior is bound to.
 *   - `circle`: an anchor + radius circle (spawn region built from a layer anchor and a `radius`/`chargeRadius` param).
 *   - `shape`: any spawn shape - reads `state.deliveryArea` (or `params.area` override) from the component.
 *   - `projectile`: tracks the projectile container's live position via `state.delivery.container`.
 *   - `ray`: uses the ray geometry (`state.origin`, `state.rotation`, `state.length`).
 *   - (sprite-only) `target`: operates on a struck-target mesh.
 * - kind: the primitive type - `Particle` (configures a ParticleGenerator, in `particle.mjs`) or
 *   `Sprite` (drives a display object, in `sprite.mjs`). `Sound` (orchestrators, reserved for `sound.mjs`).
 * - descriptor: the specific effect, e.g. `Gather`, `Beam`, `Combustion`, `Residue`.
 */

export {SPRITE_ANIMATIONS, PARTICLE_ANIMATIONS};

/* -------------------------------------------- */

/**
 * Register all Crucible VFX animations into the global `CONFIG.Canvas.vfx.animations` registry.
 */
export function registerVFXAnimations() {
  Object.assign(CONFIG.Canvas.vfx.animations, SPRITE_ANIMATIONS, PARTICLE_ANIMATIONS);
}
