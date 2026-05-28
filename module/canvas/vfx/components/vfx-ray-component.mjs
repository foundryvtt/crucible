import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, NumberField, SchemaField} = foundry.data.fields;

/**
 * A Crucible VFX component for a ray attack: a directional beam fired along a line from a source point.
 * Incorporates three sequential animation phases, mirroring {@link CrucibleProjectileComponent}:
 * - Charge-up (at the source)
 * - Delivery (the beam travelling out along its line)
 * - Impacts (one self-contained impact per target, staggered by when the beam front reaches each)
 * Each phase carries this-bound animations and particle behaviors selected by registry name, so the
 * specific look of any one ray (frost beam, lightning arc, ...) is chosen via those animations, not
 * hardcoded here. The phase-dispatch and impact machinery is inherited from {@link CrucibleVFXComponent};
 * this class only contributes the beam geometry, the charge/delivery phases, and the beam-front timing
 * via {@link _impactStart}.
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
    const self = CrucibleRayComponent;
    return {
      ...super.defineSchema(),

      // The beam source, its heading (radians), and its reach (px) define the line the ray travels.
      origin: self._pointField(),
      rotation: new NumberField({required: true, nullable: false, initial: 0}),
      length: new NumberField({required: true, nullable: false, initial: 0}),

      // Charging the ray before it fires
      charge: new SchemaField({
        duration: new NumberField({required: true, nullable: false, initial: 700}),
        sound: self._soundField(),
        animations: self._animationsField(),
        particles: new ArrayField(self._particleField())
      }),

      // The beam delivery itself. `speed` (px/sec) sets how fast the beam front travels, which drives
      // per-target impact timing; `duration` is how long the beam persists/emits.
      delivery: new SchemaField({
        speed: new NumberField({required: true, nullable: false, initial: 2500}),
        duration: new NumberField({required: true, nullable: false, initial: 2000}),
        sound: self._soundField(),
        animations: self._animationsField(),
        particles: new ArrayField(self._particleField())
      }),

      // One self-contained impact per struck target; the configurator bakes each target's hit/miss look.
      impacts: new ArrayField(self._impactField())
    };
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
    const origin = this.origin;
    const dir = {x: Math.cos(this.rotation), y: Math.sin(this.rotation)};
    const end = {
      x: origin.x + (dir.x * this.length),
      y: origin.y + (dir.y * this.length),
      elevation: origin.elevation, sort: origin.sort, sortLayer: origin.sortLayer
    };

    // Phase timings: charge, then beam delivery. Impacts are scheduled per target within delivery.
    this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      deliveryStart: this.charge.duration,
      deliveryEnd: this.charge.duration + this.delivery.duration
    };

    // Shared state for phase animators; per-impact context is written transiently by _attachImpacts.
    this.state = {
      origin, end, rotation: this.rotation, length: this.length, direction: dir,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: end, targetMesh: null,
      anchors: {origin, end, target: end}
    };

    // Charge phase (at the source)
    Object.assign(this.charge, {start: this.timings.chargeStart, end: this.timings.chargeEnd});
    this._attachAnimations(this.charge);
    this._schedulePhaseSound(this.charge, origin);
    this._attachParticles(this.charge);

    // Delivery phase (the beam travelling out along its line)
    Object.assign(this.delivery,
      {start: this.timings.deliveryStart, end: this.timings.deliveryEnd, duration: this.delivery.duration});
    this._attachAnimations(this.delivery);
    this._schedulePhaseSound(this.delivery, origin);
    this._attachParticles(this.delivery);

    // Impacts, staggered per target by the beam-front arrival time (see _impactStart)
    this._attachImpacts();
    this.timeline.label("end", Math.max(this.timings.deliveryEnd, this.timings.impactEnd));
  }

  /* -------------------------------------------- */

  /**
   * The beam front reaches each target at a time proportional to its distance from the source.
   * @override
   */
  _impactStart(target) {
    const beamSpeed = this.delivery.speed * this.state.gridScale;
    const dist = Math.hypot(target.x - this.origin.x, target.y - this.origin.y);
    return this.timings.deliveryStart + ((dist / beamSpeed) * 1000);
  }
}
