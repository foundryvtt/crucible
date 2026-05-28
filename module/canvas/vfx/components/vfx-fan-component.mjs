import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {EmbeddedDataField, NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for a fan attack: a sweeping cone fired from a source point. Same three
 * sequential phases as {@link CrucibleRayComponent}:
 * - Charge-up (at the source)
 * - Delivery (the sweep across the cone arc)
 * - Impacts (one self-contained impact per target, each with its own configurator-baked start time)
 *
 * Geometry is persisted as a snapshot of the action's region shape at configure-time. We do NOT hold
 * a live reference to the region document, because regions used for spell targeting are deleted on
 * action confirmation - the VFXEffect must contain everything it needs to play afterward. This is the
 * AoE analogue of `path` on {@link CrucibleProjectileComponent}: both serialize geometry into the
 * persisted component data. The specific visual look of each rune (frost arc, fire wave, ...) is
 * configured at the rune-props layer via registered particle behaviors. Per-target impact timing is
 * baked into each impact's `start` field by the configurator (e.g. fire when the sweeping arm crosses
 * the target's bearing).
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleFanComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleFan";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();

    // Fan shape must be a ConeShapeData instance
    schema.shape = new EmbeddedDataField(foundry.data.ConeShapeData, {required: true, nullable: false});

    // Extend delivery schema with duration
    schema.delivery.extendFields({
      duration: new NumberField({required: true, nullable: false, initial: 400})
    });
    return schema;
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  async _load() {
    for ( const phase of [this.charge, this.delivery, ...this.impacts] ) {
      for ( const layer of phase.particles ) {
        for ( const texture of layer.textures ) this.assetPaths.add(texture);
      }
      for ( const anim of phase.animations ) {
        if ( anim.params?.texture ) this.assetPaths.add(anim.params.texture);
      }
      if ( phase.sound ) phase.sound.instance = await this._loadSound(phase.sound.src);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    const {x, y, radius} = this.shape;
    const origin = {x, y};
    const rotation = Math.toRadians(this.shape.rotation);
    const coneAngle = Math.toRadians(this.shape.angle);
    const halfAngle = coneAngle / 2;

    // Phase timings: charge, then sweep delivery. Per-impact timings are baked by the configurator.
    this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      deliveryStart: this.charge.duration,
      deliveryEnd: this.charge.duration + this.delivery.duration
    };

    // The caster's mesh position when injected, else the cone origin; backs the `source` anchor for
    // caster-anchored charge particles (parity with the arrow / ray source-anchored charge).
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;

    // Shared state for phase animators; per-impact context is written transiently by _attachImpacts.
    this.state = {
      origin, source, rotation, coneAngle, halfAngle, radius,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: origin, targetMesh: null,
      anchors: {origin, source, target: origin}
    };

    // Charge phase (at the source)
    Object.assign(this.charge, {start: this.timings.chargeStart, end: this.timings.chargeEnd});
    this._attachAnimations(this.charge);
    this._schedulePhaseSound(this.charge, origin);
    this._attachParticles(this.charge);

    // Delivery phase (the sweep across the cone arc)
    Object.assign(this.delivery,
      {start: this.timings.deliveryStart, end: this.timings.deliveryEnd, duration: this.delivery.duration});
    this._attachAnimations(this.delivery);
    this._schedulePhaseSound(this.delivery, origin);
    this._attachParticles(this.delivery);

    // Impacts dispatch at each impact's configurator-baked `start` time
    this._attachImpacts();
    this.timeline.label("end", Math.max(this.timings.deliveryEnd, this.timings.impactEnd));
  }
}
