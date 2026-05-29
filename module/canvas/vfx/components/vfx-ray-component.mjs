import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {EmbeddedDataField, NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for a ray attack: a directional beam fired along a line from a source point.
 * Three sequential animation phases:
 * - Charge-up (at the charge point - the visible front of the caster, `chargeDistance` ahead of the
 *   region shape's origin along the heading)
 * - Delivery (the beam traveling from the charge point along the heading toward the shape's end)
 * - Impacts (one self-contained impact per target, each with its own configurator-baked start time)
 *
 * Geometry is persisted as a snapshot of the action's region shape at configure-time. We do NOT hold
 * a live reference to the region document, because regions used for spell targeting are deleted on
 * action confirmation - the VFXEffect must contain everything it needs to play afterward. This is
 * the AoE analogue of `path` on {@link CrucibleProjectileComponent}: both serialize geometry into the
 * persisted component data. Source-token + target-token meshes and the wall-mask polygon ARE still
 * reference-resolved by the framework at play-time (they're live scene objects, not persisted data).
 * The inherited `charge.distance` field captures the small forward offset that pulls the visible ray
 * out of the caster's body.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleRayComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleRay";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    schema.shape = new EmbeddedDataField(foundry.data.LineShapeData, {required: true, nullable: false});
    schema.delivery.extendFields({
      duration: new NumberField({required: true, nullable: false, initial: 2000})
    });
    return schema;
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  _configureState() {
    const {x: shapeX, y: shapeY, length: shapeLength, rotation: rotationDeg} = this.shape;
    const rotation = Math.toRadians(rotationDeg);
    const dir = {x: Math.cos(rotation), y: Math.sin(rotation)};
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const meshElevation = this.originMesh?.elevation ?? 0;
    const meshSort = this.originMesh?.sort ?? 0;
    const chargeDistance = this.charge.distance;
    const origin = {
      x: shapeX + (dir.x * chargeDistance), y: shapeY + (dir.y * chargeDistance),
      elevation: meshElevation + 1, sort: meshSort + 1, sortLayer: SL.TOKENS
    };
    const length = shapeLength - chargeDistance;
    const end = {
      x: origin.x + (dir.x * length), y: origin.y + (dir.y * length),
      elevation: origin.elevation, sort: origin.sort, sortLayer: origin.sortLayer
    };
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;
    this.state = {
      origin, end, source, rotation, length, direction: dir,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: end, targetMesh: null,
      deliveryArea: {from: {x: origin.x, y: origin.y}, to: {x: end.x, y: end.y}},
      anchors: {origin, end, source, target: end}
    };
  }
}
