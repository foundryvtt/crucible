import {SPRITE_ANIMATIONS} from "./sprite.mjs";
import {PARTICLE_ANIMATIONS} from "./particle.mjs";

/**
 * Registered Crucible VFX animations: the functions written into `CONFIG.Canvas.vfx.animations` and
 * referenced by name from component phase configs. This is distinct from the configure-time block
 * library (`blocks.mjs`), which composes serializable `{components, timeline, references}` results.
 *
 * Every animation's hooks are bound to the owning {@link CrucibleVFXComponent} and receive the current
 * `phase`: optional `setup`/`schedule`/`tearDown` and (for sprites) a per-frame `animate`. Particle
 * behaviors additionally return their generator config contribution from `setup`.
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
 *
 * The phase a behavior is invoked in (charge / delivery / impact) is the configurator's choice and is
 * not encoded in the name; the shape prefix already captures the real binding.
 */

export {SPRITE_ANIMATIONS, PARTICLE_ANIMATIONS};

/* -------------------------------------------- */

/**
 * Register all Crucible VFX animations into the global `CONFIG.Canvas.vfx.animations` registry.
 * Sprite animators and particle behaviors share the one registry and the same component-bound hook
 * contract; the component decides which hooks it invokes per phase.
 */
export function registerVFXAnimations() {
  Object.assign(CONFIG.Canvas.vfx.animations, SPRITE_ANIMATIONS, PARTICLE_ANIMATIONS);
}
