import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, NumberField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for a ray attack: a directional beam fired along a line from a source point.
 * Incorporates three sequential animation phases, mirroring {@link CrucibleProjectileComponent}:
 * - Charge-up (at the source)
 * - Delivery (the beam travelling out along its line)
 * - Impact (applied per target, staggered by when the beam front reaches each target)
 * Each phase carries this-bound animations and particle behaviors selected by registry name, so the
 * specific look of any one ray (frost beam, lightning arc, ...) is chosen via those animations, not
 * hardcoded here. The phase-dispatch machinery is inherited from {@link CrucibleVFXComponent}.
 *
 * Multi-target impacts are recorded authoritatively in `this.state.impacts` (one entry per target with
 * its own destination/mesh/result/timings). Dispatch reuses the shared impact animations by also setting
 * transient per-target pointers on `this.state` immediately before each synchronous dispatch. Any
 * animation that reads `this.state` at frame time (e.g. a recoil) must capture its target in `setup`
 * from the relevant impact entry for this to be multi-target-safe (see impactRecoilAnimation).
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleRayComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleRay";

  /**
   * Struck-token meshes, indexed parallel to `targets`, injected by finalizeVFX (for impacts that
   * displace the target). Rays that do not displace targets can ignore this.
   * @type {(PIXI.DisplayObject|null)[]}
   */
  _targetMeshes = [];

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

      // Per-target impact templates. The beam picks `hit` or `miss` per target based on its attack result,
      // so a struck target and a resisting target can show distinct visuals and sounds.
      impact: new SchemaField({
        hit: self.#impactTemplateField(),
        miss: self.#impactTemplateField()
      }),

      // Targets struck by the ray; each impacted at a staggered time by its distance from the origin
      targets: new ArrayField(self._pointField()),

      // Per-target metadata index-aligned with `targets`: the attack result (RESULT_TYPES) and token id.
      targetData: new ArrayField(new SchemaField({
        result: new NumberField({required: false, nullable: true, initial: null}),
        id: new StringField({required: false, blank: true})
      }))
    };
  }

  /* -------------------------------------------- */

  /** One impact variant (hit or miss): its sound, sprite animations, and particle layers. @returns {SchemaField} */
  static #impactTemplateField() {
    const self = CrucibleRayComponent;
    return new SchemaField({
      sound: self._soundField(),
      animations: self._animationsField(),
      particles: new ArrayField(self._particleField())
    });
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  async _load() {
    for ( const phase of [this.charge, this.delivery, this.impact.hit, this.impact.miss] ) {
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

    // Shared state for phase animators
    this.state = {
      origin, end, rotation: this.rotation, length: this.length, direction: dir,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      // Authoritative per-target impact bookkeeping, keyed by target id (or index); populated below
      impacts: {},
      // Per-target impact context written here transiently before each target's synchronous dispatch
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

    // Impact phase, staggered per target by the beam-front arrival time
    this.#attachImpacts();
    this.timeline.label("end", this.timings.deliveryEnd);
  }

  /* -------------------------------------------- */

  /**
   * Build the per-target impact record and dispatch each target's impact when the beam front reaches it.
   * Each target's hit/miss template is chosen from its attack result; the record (`this.state.impacts`)
   * is authoritative, while the transient `this.state` pointers are what the shared, this-bound impact
   * animations read at synchronous dispatch time.
   */
  #attachImpacts() {
    const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
    const beamSpeed = this.delivery.speed * this.state.gridScale; // Matches the scaled beam particle speed
    this.targets.forEach((target, i) => {
      const data = this.targetData[i] ?? {};
      const isHit = (data.result === T.HIT) || (data.result === T.GLANCE);
      const template = isHit ? this.impact.hit : this.impact.miss;
      const dist = Math.hypot(target.x - this.origin.x, target.y - this.origin.y);
      const start = this.timings.deliveryStart + ((dist / beamSpeed) * 1000);
      const duration = Math.max(...template.animations.map(a => a.params?.duration ?? 0), 0);
      const key = data.id || String(i);

      const impact = {
        id: key, index: i, result: data.result, isHit,
        destination: target, mesh: this._targetMeshes[i] ?? null,
        start, end: start + duration, duration,
        anchors: {origin: this.state.anchors.origin, end: this.state.anchors.end, target, destination: target}
      };
      this.state.impacts[key] = impact;

      // Transient current-target context read synchronously by the shared impact animations
      this.state.destination = target;
      this.state.targetMesh = impact.mesh;
      this.state.anchors.target = target;
      this.state.anchors.destination = target;

      const phase = {...template, start, end: impact.end, duration};
      this._attachAnimations(phase);
      this._schedulePhaseSound(phase, target);
      this._attachParticles(phase);
    });
  }
}
