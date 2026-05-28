import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for a ray attack: a directional beam fired along a line from a source point.
 * Incorporates three sequential animation phases, mirroring {@link CrucibleProjectileComponent}:
 * - Charge-up (at the source)
 * - Delivery (the beam traveling out along its line)
 * - Impacts (one self-contained impact per target)
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleRayComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleRay";

  /**
   * The mesh of the Action origin Token, injected by finalizeVFX; used to anchor charge particles at the
   * caster (the `source` anchor) so rays can reuse caster-anchored arrow charge configs.
   * @type {PIXI.DisplayObject|null}
   */
  _originMesh = null;

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();

    // The beam source, its heading (radians), and its reach (px) define the line the ray travels.
    Object.assign(schema, {
      origin: CrucibleRayComponent._pointField(),
      rotation: new NumberField({required: true, nullable: false, initial: 0}),
      length: new NumberField({required: true, nullable: false, initial: 0})
    });

    // Augment delivery schema with ray-specific fields
    schema.delivery.extendFields({
      duration: new NumberField({required: true, nullable: false, initial: 2000})
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

    // The caster's mesh position when injected, else the ray origin; backs the `source` anchor for
    // caster-anchored charge particles (parity with the arrow's source-anchored charge).
    const source = this._originMesh ? {x: this._originMesh.x, y: this._originMesh.y} : origin;

    // Shared state for phase animators; per-impact context is written transiently by _attachImpacts.
    // `deliveryArea` is the ray's geometry expressed as a ParticleGenerator-native area shape (a line
    // from origin to end), consumed by shape-agnostic delivery behaviors such as shapeParticleCombustion.
    this.state = {
      origin, end, source, rotation: this.rotation, length: this.length, direction: dir,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: end, targetMesh: null,
      deliveryArea: {from: {x: origin.x, y: origin.y}, to: {x: end.x, y: end.y}},
      anchors: {origin, end, source, target: end}
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

    // Impacts dispatch at each impact's configurator-baked `start` time
    this._attachImpacts();
    this.timeline.label("end", Math.max(this.timings.deliveryEnd, this.timings.impactEnd));
  }
}
