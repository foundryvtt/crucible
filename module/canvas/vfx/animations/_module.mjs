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
 * Naming convention - every registry key is `<phase><subject><descriptor>`:
 * - phase: `charge` | `delivery` | `impact` - the component schema phase the animation is built for
 *   (delivery is the flight of a projectile or the travel of a beam). One vocabulary across schema and
 *   registry.
 * - subject: the most specific subject the behavior animates. For behaviors generic across gestures this
 *   is the primitive kind - `Sprite` (drives a display object, in `sprite.mjs`), `Particle` (configures a
 *   ParticleGenerator, in `particle.mjs`), or `Sound` (orchestrators, reserved for `sound.mjs`). For
 *   behaviors specific to one gesture it is that gesture's shape - `Projectile`, `Ray`, ... (e.g.
 *   `deliveryProjectileFlight`, `deliveryRayBeam`).
 * - descriptor: the specific effect, e.g. `Gather`, `Beam`, `FadeIn`, `Flight`.
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
