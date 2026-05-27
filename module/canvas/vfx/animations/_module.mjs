import {SPRITE_ANIMATIONS} from "./sprite.mjs";
import {PARTICLE_ANIMATIONS} from "./particle.mjs";

/**
 * Registered Crucible VFX animations: the functions written into `CONFIG.Canvas.vfx.animations` and
 * referenced by name from component phase configs. This is distinct from the configure-time block
 * library (`blocks.mjs`), which composes serializable `{components, timeline, references}` results.
 *
 * Naming convention - every registry key is `<phase><Kind><Descriptor>`:
 * - phase: `charge` | `projectile` | `impact` - the component schema phase the animation is built
 *   for ("projectile" is the flight phase). One vocabulary across schema and registry.
 * - Kind: `Sprite` (drives a display object via the `animate(t, state, params)` contract, defined in
 *   `sprite.mjs`) | `Particle` (configures a ParticleGenerator via `setup(context)`, defined in
 *   `particle.mjs`) | `Sound` (sound orchestrators, reserved for `sound.mjs`).
 * - Descriptor: the specific effect, e.g. `Vortex`, `Trail`, `FadeIn`, `Flight`.
 *
 * A behavior generic across phases is named for its primary/intended phase; the prefix communicates
 * intent, not a hard constraint.
 */

export {SPRITE_ANIMATIONS, PARTICLE_ANIMATIONS};

/* -------------------------------------------- */

/**
 * Register all Crucible VFX animations into the global `CONFIG.Canvas.vfx.animations` registry.
 * Sprite animators and particle behaviors share the one registry; the consuming site decides which
 * contract it invokes (`animate` for sprites, `setup` for particle behaviors).
 */
export function registerVFXAnimations() {
  Object.assign(CONFIG.Canvas.vfx.animations, SPRITE_ANIMATIONS, PARTICLE_ANIMATIONS);
}
