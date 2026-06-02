import VFXResolvedReferenceField from "../fields/vfx-resolved-reference-field.mjs";

const {ArrayField, NumberField, SchemaField, StringField} = foundry.data.fields;

/**
 * A VFX component that plays forced token movement (a push or pull) as the impact animation: the token is held at
 * its pre-move origin, then glides to its committed position on the impact beat.
 * @extends {foundry.canvas.vfx.VFXComponent}
 */
export default class CrucibleForcedMovementComponent extends foundry.canvas.vfx.VFXComponent {

  /** @override */
  static TYPE = "crucibleForcedMovement";

  /**
   * The Stride whose animation speed the knockback glide uses. A constant so every creature is knocked back at the
   * same pace (~2x a Stride-10 actor), independent of its own Stride.
   * @type {number}
   */
  static KNOCKBACK_STRIDE = 20;

  /**
   * In-flight knockback glides, awaited in {@link _stop} so playback encompasses the deferred movement.
   * @type {Promise[]}
   */
  #pending = [];

  /** @inheritDoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      animations: new ArrayField(new SchemaField({
        token: new VFXResolvedReferenceField(),
        movementId: new StringField({required: false, blank: true}),
        origin: new SchemaField({
          x: new NumberField({required: true, nullable: false}),
          y: new NumberField({required: true, nullable: false})
        }, {required: false, nullable: true, initial: null}),
        time: new NumberField({required: true, nullable: false, initial: 0})
      }))
    };
  }

  /* -------------------------------------------- */

  /**
   * Record a knockback for a force-moved target so its displacement plays as the impact animation. The target's
   * recoil/shake should be suppressed in turn (use the return value).
   * @param {object[]} forcedMovements   The accumulating knockback array, mutated in place.
   * @param {object} group               The target's event group.
   * @param {string} tokenRef            Reference key of the target's TokenDocument.
   * @param {number} time                Component-timeline ms of the target's impact beat.
   * @returns {boolean}                  True if a knockback was recorded (the target is force-moved).
   */
  static pushKnockback(forcedMovements, group, tokenRef, time) {
    const movement = group.movement?.movement;
    if ( !movement?.origin ) return false;
    forcedMovements.push({token: {reference: tokenRef}, movementId: movement.id,
      origin: {x: movement.origin.x, y: movement.origin.y}, time});
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Attach accumulated knockbacks to a gesture's VFX config as a forced-movement component.
   * @param {object} components          The gesture's components map, mutated in place.
   * @param {object[]} timeline          The gesture's timeline array, mutated in place.
   * @param {object[]} forcedMovements   The accumulated knockbacks.
   */
  static applyForcedMovements(components, timeline, forcedMovements) {
    if ( !forcedMovements.length ) return;
    components.forcedMovement = {type: this.TYPE, animations: forcedMovements};
    timeline.push({component: "forcedMovement", position: 0});
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    let end = 0;
    for ( const entry of this.animations ) {
      const object = entry.token?.object;
      if ( !object || !entry.origin ) continue;

      // Hold at the pre-move origin, then glide to the committed _source on the impact beat at a constant knockback
      // speed (independent of the moved actor's own Stride)
      object.animate({x: entry.origin.x, y: entry.origin.y}, {duration: 0});
      const movementSpeed = object.constructor.movementSpeedForStride(this.constructor.KNOCKBACK_STRIDE);
      this.timeline.call(() => this.#pending.push(
        object.animate(object.document._source, {movementSpeed})), entry.time);
      end = Math.max(end, entry.time);
    }
    this.timeline.label("end", end);
  }

  /* -------------------------------------------- */

  /** @override */
  async _stop() {
    await Promise.allSettled(this.#pending);
  }
}
