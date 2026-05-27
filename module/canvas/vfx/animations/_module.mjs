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
 * Naming convention - every registry key is `<phase><Kind><Descriptor>`:
 * - phase: `charge` | `projectile` | `impact` - the component schema phase the animation is built
 *   for ("projectile" is the flight phase). One vocabulary across schema and registry.
 * - Kind: `Sprite` (drives a display object, defined in `sprite.mjs`) | `Particle` (configures a
 *   ParticleGenerator, defined in `particle.mjs`) | `Sound` (sound orchestrators, reserved for
 *   `sound.mjs`).
 * - Descriptor: the specific effect, e.g. `Vortex`, `Trail`, `FadeIn`, `Flight`.
 *
 * A behavior generic across phases is named for its primary/intended phase; the prefix communicates
 * intent, not a hard constraint.
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
