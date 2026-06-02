import VFXResolvedReferenceField from "../fields/vfx-resolved-reference-field.mjs";

const {ArrayField, NumberField, SchemaField, StringField} = foundry.data.fields;

/**
 * A VFX component that plays the deferred visual of forced token movement (a push or pull) as the impact animation:
 * the token is held at its pre-move origin, then glides to its committed position on the impact beat.
 * @extends {foundry.canvas.vfx.VFXComponent}
 */
export default class CrucibleTokenAnimationComponent extends foundry.canvas.vfx.VFXComponent {

  /** @override */
  static TYPE = "crucibleTokenAnimation";

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

  /** @override */
  async _draw() {
    let end = 0;
    for ( const entry of this.animations ) {
      const object = entry.token?.object;
      if ( !object || !entry.origin ) continue;

      // Hold the rendered position at the pre-move origin, then glide to the committed _source on the impact beat
      object.animate({x: entry.origin.x, y: entry.origin.y}, {duration: 0});
      this.timeline.call(() => this.#pending.push(object.animate(object.document._source)), entry.time);
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
