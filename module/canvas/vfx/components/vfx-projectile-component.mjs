import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for an action that uses the "single" target type and transacts a single projectile.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleProjectileComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleProjectile";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();

    // Projectile trajectory as a VFXPath
    Object.assign(schema, {
      path: new ArrayField(CrucibleProjectileComponent._pointField(), {required: true, min: 2}),
      pathType: new SchemaField({
        type: new StringField({required: true, blank: false, initial: "linear"}),
        params: new ObjectField({required: false})
      })
    });

    // Extended fields for projectile delivery
    schema.delivery.extendFields({
      texture: new StringField({required: true, blank: false}),
      size: new NumberField({required: true, nullable: false, initial: 3}),
      speed: new NumberField({required: true, nullable: false, initial: 150})
    });

    // Extended fields for projectile impact
    schema.impacts.element.extendFields({
      stick: new NumberField({required: true, nullable: false, initial: 0})
    });
    return schema;
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _load() {
    this.assetPaths.add(this.delivery.texture);
    await super._load();
  }

  /* -------------------------------------------- */

  /** @override */
  _configureTimings() {
    this._origin = this.path[0];
    this._destination = this.path.at(-1);
    this._flightPath = foundry.canvas.vfx.VFXPath.create(this.pathType.type, this.path, this.pathType.params);
    const distancePixels = canvas.dimensions.distancePixels;
    const flightMS = (this._flightPath.pathLength * 1000) / (this.delivery.speed * distancePixels);
    this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      deliveryStart: this.charge.duration,
      deliveryEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _configureState() {
    const origin = this._origin;
    this.delivery.container = this.addManagedDisplayObject(
      this._createSprite(this.delivery.texture, this.delivery.size, origin));
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;
    this.state = {
      origin,
      source,
      destination: this._destination,
      flightPath: this._flightPath,
      lastPathIndex: 0,
      gridScale: getParticleScaleFactor(),
      charge: this.charge,
      delivery: this.delivery,
      targetMesh: this.targetMeshes[0] ?? null,
      anchors: {origin, destination: this._destination, delivery: this.delivery.container, source}
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawDelivery() {
    super._drawDelivery();
    this.#animateProjectileExit(this.timings);
  }

  /* -------------------------------------------- */

  /** @override */
  _impactTarget(_impact, _i) {
    return this.state.destination;
  }

  /* -------------------------------------------- */

  /**
   * Fade the projectile sprite out at impact, lingering for the stick duration first when it sticks.
   * @param {object} timings   The computed phase timings.
   */
  #animateProjectileExit(timings) {
    const stick = this.impacts[0]?.stick ?? 0;
    const fadeStart = (stick > 0) ? (timings.impactStart + stick - 150) : timings.impactStart;
    this.timeline.add(this.delivery.container, {alpha: {to: 0, duration: 150}}, fadeStart);
  }
}
