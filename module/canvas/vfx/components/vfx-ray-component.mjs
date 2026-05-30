import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {EmbeddedDataField, NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for an action that uses the "ray" target type.
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
