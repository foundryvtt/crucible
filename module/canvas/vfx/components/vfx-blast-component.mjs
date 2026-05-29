import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {EmbeddedDataField, NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for a blast attack: a radial area-of-effect centered on a region point.
 * Three sequential animation phases:
 * - Charge-up (at the source token via `chargeAnchor: "source"`, at a gather point in front of the
 *   caster facing the blast via `chargeAnchor: "forward"`, or at the blast center via the default
 *   `chargeAnchor: "origin"`)
 * - Delivery (the blast itself, free to express as falling debris, an outward eruption, blooming
 *   growth, etc.)
 * - Impacts (one self-contained impact per struck target, each with its own configurator-baked
 *   `start` time so e.g. a sweeping shockwave can stagger arrivals by distance from center)
 *
 * Geometry is persisted as a snapshot of the action's region shape at configure-time. Regions used
 * for spell targeting are deleted on action confirmation, so the VFXEffect must carry its own
 * geometry. Source-token + target-token meshes and the wall-mask polygon ARE still
 * reference-resolved by the framework at play-time. {@link CrucibleRayComponent} and
 * {@link CrucibleFanComponent} use the same pattern.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleBlastComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleBlast";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    schema.shape = new EmbeddedDataField(foundry.data.CircleShapeData, {required: true, nullable: false});
    schema.casterRadiusPx = new NumberField({required: true, nullable: false, initial: 50, min: 1});
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
    const {x, y, radius} = this.shape;
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const meshElevation = this.originMesh?.elevation ?? 0;
    const meshSort = this.originMesh?.sort ?? 0;
    const origin = {x, y, elevation: meshElevation + 1, sort: meshSort + 1, sortLayer: SL.TOKENS};
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;
    const forwardDist = (this.casterRadiusPx * 2) / 3;
    const dx = origin.x - source.x;
    const dy = origin.y - source.y;
    const dist = Math.hypot(dx, dy);
    const forward = dist > 0
      ? {x: source.x + ((dx / dist) * forwardDist), y: source.y + ((dy / dist) * forwardDist)}
      : {x: source.x, y: source.y};
    this.state = {
      origin, source, forward, radius,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: origin, targetMesh: null,
      deliveryArea: {type: "circle", x, y, radius, gridBased: false},
      anchors: {origin, source, forward, target: origin}
    };
  }
}
