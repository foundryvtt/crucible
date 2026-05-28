import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for a single projectile attack.
 * Incorporates three sequential animation phases:
 * - Charge-up
 * - Flight
 * - Impact
 * Each phase can incorporate custom particle emitter and animation behaviors. The phase-dispatch
 * machinery is inherited from {@link CrucibleVFXComponent}.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleProjectileComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleProjectile";

  /**
   * The mesh of the Action origin Token.
   * @type {PIXI.DisplayObject|null}
   */
  _originMesh = null;

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const self = CrucibleProjectileComponent;
    return {
      ...super.defineSchema(),

      // Projectile trajectory as a VFXPath
      path: new ArrayField(self._pointField(), {required: true, min: 2}),
      pathType: new SchemaField({
        type: new StringField({required: true, blank: false, initial: "linear"}),
        params: new ObjectField({required: false})
      }),

      // Charging or drawing the projectile before launching it
      charge: new SchemaField({
        duration: new NumberField({required: true, nullable: false, initial: 700}),
        sound: self._soundField(),
        animations: self._animationsField(),
        particles: new ArrayField(self._particleField())
      }),

      // The flight of the projectile itself
      projectile: new SchemaField({
        texture: new StringField({required: true, blank: false}),
        size: new NumberField({required: true, nullable: false, initial: 3}),    // Size in feet
        speed: new NumberField({required: true, nullable: false, initial: 150}), // Feet per second
        sound: self._soundField(),
        animations: self._animationsField(),
        particles: new ArrayField(self._particleField())
      }),

      // The impact(s) of the projectile against its target. A single projectile resolves one impact, so
      // this is a length-1 array (multi-target arrows emit one component per target). `stick` is how long a
      // hit projectile lingers (stuck) before fading; the impact window is the max of it and the animations.
      impacts: new ArrayField(self._impactField({
        stick: new NumberField({required: true, nullable: false, initial: 0})
      }))
    };
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  async _load() {
    this.assetPaths.add(this.projectile.texture);
    for ( const phase of [this.charge, this.projectile, ...this.impacts] ) {
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

    const flightMS = (flightPath.pathLength * 1000) / (this.projectile.speed * distancePixels);
    const timings = this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      projectileStart: this.charge.duration,
      projectileEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };

    // The flying projectile sprite; the impact burst sprite is created by the impactBurst animation.
    this.projectile.container = this.addManagedDisplayObject(
      this._createSprite(this.projectile.texture, this.projectile.size, origin));

    // Shared state for phase animators
    const source = this._originMesh ? {x: this._originMesh.x, y: this._originMesh.y} : origin;
    this.state = {
      origin,
      source,
      destination,
      flightPath,
      lastPathIndex: 0,
      gridScale: getParticleScaleFactor(),
      charge: this.charge,
      projectile: this.projectile,
      targetMesh: this._targetMeshes[0] ?? null,
      anchors: {origin, destination, projectile: this.projectile.container, source}
    };

    // Charge phase
    Object.assign(this.charge, {start: timings.chargeStart, end: timings.chargeEnd});
    this._attachAnimations(this.charge);
    this._schedulePhaseSound(this.charge, origin);
    this._attachParticles(this.charge);

    // Projectile phase
    Object.assign(this.projectile, {start: timings.projectileStart, end: timings.projectileEnd, duration: flightMS});
    this._attachAnimations(this.projectile);
    this._schedulePhaseSound(this.projectile, origin);
    this._attachParticles(this.projectile);

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
    this.timeline.add(this.projectile.container, {alpha: {to: 0, duration: 150}}, fadeStart);
  }
}
