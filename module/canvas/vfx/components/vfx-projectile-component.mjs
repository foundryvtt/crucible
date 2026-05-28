import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for a single projectile attack, using the inherited charge/delivery/impacts
 * phase structure where the delivery phase is the projectile's flight (a sprite flown along a path).
 * Each phase can incorporate custom particle emitter and animation behaviors. The phase-dispatch
 * machinery is inherited from {@link CrucibleVFXComponent}.
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

  /** @override */
  async _load() {
    this.assetPaths.add(this.delivery.texture);
    for ( const phase of [this.charge, this.delivery, ...this.impacts] ) {
      for ( const layer of phase.particles ) {
        for ( const texture of layer.textures ) this.assetPaths.add(texture);
      }
      for ( const anim of phase.animations ) {
        if ( anim.params?.texture ) this.assetPaths.add(anim.params.texture);
      }
      // Load the phase sound onto its config so it travels with the phase (no separate sound registry)
      if ( phase.sound ) phase.sound.instance = await this._loadSound(phase.sound.src);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    const distancePixels = canvas.dimensions.distancePixels;
    const origin = this.path[0];
    const destination = this.path.at(-1);
    const flightPath = foundry.canvas.vfx.VFXPath.create(this.pathType.type, this.path, this.pathType.params);

    const flightMS = (flightPath.pathLength * 1000) / (this.delivery.speed * distancePixels);
    const timings = this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      deliveryStart: this.charge.duration,
      deliveryEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };

    // The flying projectile sprite; the impact burst sprite is created by the impactSpriteBurst animation.
    this.delivery.container = this.addManagedDisplayObject(
      this._createSprite(this.delivery.texture, this.delivery.size, origin));

    // Shared state for phase animators
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;
    this.state = {
      origin,
      source,
      destination,
      flightPath,
      lastPathIndex: 0,
      gridScale: getParticleScaleFactor(),
      charge: this.charge,
      delivery: this.delivery,
      targetMesh: this.targetMeshes[0] ?? null,
      anchors: {origin, destination, delivery: this.delivery.container, source}
    };

    // Charge phase
    Object.assign(this.charge, {start: timings.chargeStart, end: timings.chargeEnd});
    this._attachAnimations(this.charge);
    this._schedulePhaseSound(this.charge, origin);
    this._attachParticles(this.charge);

    // Delivery phase (the projectile's flight)
    Object.assign(this.delivery, {start: timings.deliveryStart, end: timings.deliveryEnd, duration: flightMS});
    this._attachAnimations(this.delivery);
    this._schedulePhaseSound(this.delivery, origin);
    this._attachParticles(this.delivery);

    // Impact phase (resounds at the target). Impacts dispatch their own visuals at impactStart.
    this.#animateProjectileExit(timings);
    this._attachImpacts();
    this.timeline.label("end", this.timings.impactEnd);
  }

  /* -------------------------------------------- */

  /**
   * The projectile strikes where it lands: the resolved path destination (which carries the per-result
   * offset), not the bare target mesh position.
   * @override
   */
  _impactTarget() {
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
