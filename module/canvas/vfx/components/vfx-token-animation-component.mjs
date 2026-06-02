import VFXResolvedReferenceField from "../fields/vfx-resolved-reference-field.mjs";

const {ArrayField, NumberField, SchemaField, StringField} = foundry.data.fields;

/**
 * A VFX component for the deferred visual of forced token movement (e.g. a push or pull), played on the impact beat.
 * Data-structure shell: the schema is settled but the playback body is intentionally unimplemented for now.
 * @extends {foundry.canvas.vfx.VFXComponent}
 */
export default class CrucibleTokenAnimationComponent extends foundry.canvas.vfx.VFXComponent {

  /** @override */
  static TYPE = "crucibleTokenAnimation";

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
}
