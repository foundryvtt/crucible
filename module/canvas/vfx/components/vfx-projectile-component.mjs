import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for a single projectile attack.
 * Incorporates three sequential animation phases:
 * - Charge-up
 * - Flight
 * - Impact
 * Each phase can incorporate custom particle emitter and animation behaviors.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleProjectileComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleProjectile";

  /**
   * Struck-token object displaced by impactRecoil/impactShake, injected by finalizeVFX.
   * @type {PIXI.DisplayObject|null}
   */
  _targetMesh = null;

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
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const self = CrucibleProjectileComponent;
    return {
      ...super.defineSchema(),

      // Projectile trajectory as a VFXPath
      path: new ArrayField(new foundry.canvas.vfx.fields.VFXReferenceObjectField(new SchemaField({
        x: new NumberField({required: true, nullable: false}),
        y: new NumberField({required: true, nullable: false}),
        elevation: new NumberField({required: true, nullable: false, initial: 0}),
        sort: new NumberField({nullable: false, initial: 0}),
        sortLayer: new NumberField({nullable: false, initial: SL.TOKENS})
      })), {required: true, min: 2}),
      pathType: new SchemaField({
        type: new StringField({required: true, blank: false, initial: "linear"}),
        params: new ObjectField({required: false})
      }),

      // Charging or drawing the projectile before launching it
      charge: new SchemaField({
        duration: new NumberField({required: true, nullable: false, initial: 700}),
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      }),

      // The flight of the projectile itself
      projectile: new SchemaField({
        texture: new StringField({required: true, blank: false}),
        size: new NumberField({required: true, nullable: false, initial: 3}),    // Size in feet
        speed: new NumberField({required: true, nullable: false, initial: 150}), // Feet per second
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      }),

      // The impact of the projectile against its target. `stick` is how long a hit projectile lingers
      // (stuck) before fading; the full impact window is the max of it and the impact.animations durations.
      impact: new SchemaField({
        stick: new NumberField({required: true, nullable: false, initial: 0}),
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * Timeline animators referenced by a phase: registered names + params.
   * @returns {ArrayField}
   */
  static #animationsField() {
    return new ArrayField(new SchemaField({
      function: new StringField({required: true, blank: false}), // A CONFIG.Canvas.vfx.animations key
      params: new ObjectField({required: false})
    }));
  }

  /* -------------------------------------------- */

  /**
   * A nullable per-phase positional sound cue; `radius` is per-sound.
   * @returns {SchemaField}
   */
  static #soundField() {
    return new SchemaField({
      src: new StringField({required: true, blank: false}),
      align: new NumberField({required: true, nullable: false,
        initial: foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START}),
      volume: new foundry.data.fields.AlphaField(),
      radius: new NumberField({required: true, nullable: false, initial: 30})
    }, {required: false, nullable: true, initial: null});
  }

  /* -------------------------------------------- */

  /**
   * A schema field used to represent a single particle generator layer.
   * @returns {SchemaField}
   */
  static #particleField() {
    return new SchemaField({
      animation: new StringField({required: true, blank: false}),
      anchor: new StringField({required: true, blank: false, initial: "origin",
        choices: ["origin", "destination", "projectile", "source"]}),
      textures: new ArrayField(new StringField({required: true, blank: false})),
      offset: new NumberField({required: true, nullable: false, initial: 0}),  // Milliseconds after phase start
      duration: new NumberField({nullable: true, initial: null}),              // Null uses the phase length
      params: new ObjectField({required: false})
    });
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  async _load() {
    this.assetPaths.add(this.projectile.texture);
    for ( const phase of [this.charge, this.projectile, this.impact] ) {
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

    // Impact window = the longest of the stick and the impact animation durations
    const flightMS = (flightPath.pathLength * 1000) / (this.projectile.speed * distancePixels);
    const timings = this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      projectileStart: this.charge.duration,
      projectileEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };
    const impactDuration = Math.max(this.impact.stick,
      ...this.impact.animations.map(a => a.params?.duration ?? 0), 0);
    timings.impactEnd = timings.impactStart + impactDuration;

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
      impact: this.impact,
      targetMesh: this._targetMesh,
      anchors: {origin, destination, projectile: this.projectile.container, source}
    };

    // Charge phase
    Object.assign(this.charge, {start: timings.chargeStart, end: timings.chargeEnd});
    this.#attachAnimations(this.charge);
    this.#scheduleSound(this.charge);
    this.#attachParticles(this.charge);

    // Projectile phase
    Object.assign(this.projectile, {start: timings.projectileStart, end: timings.projectileEnd, duration: flightMS});
    this.#attachAnimations(this.projectile);
    this.#scheduleSound(this.projectile);
    this.#attachParticles(this.projectile);

    // Impact phase
    Object.assign(this.impact, {start: timings.impactStart, end: timings.impactEnd, duration: impactDuration});
    this.#animateProjectileExit(timings);
    this.#attachAnimations(this.impact);
    this.#scheduleSound(this.impact);
    this.#attachParticles(this.impact);
    this.timeline.label("end", timings.impactEnd);
  }

  /* -------------------------------------------- */

  /**
   * Setup and schedule custom animations for the phase.
   * @param {object} phase       The phase config (charge/projectile/impact).
   */
  #attachAnimations(phase) {
    for ( const entry of phase.animations ) {
      const animation = this.#animationEntry(entry.function);
      if ( !animation ) continue;
      const params = entry.params ?? {};

      // Animation setup
      if ( typeof animation.setup === "function" ) animation.setup.call(this, phase, params);

      // Animation timeline scheduling
      if ( typeof animation.schedule === "function" ) animation.schedule.call(this, phase, params);

      // Animation ticker
      if ( typeof animation.animate === "function" ) {
        const progress = {t: 0};
        this.timeline.add(progress, {
          t: {from: 0, to: 1},
          duration: phase.duration,
          ease: "linear",
          onRender: () => animation.animate.call(this, progress.t, phase, params)
        }, phase.start);
      }

      // Animation teardown, invoked when the component stops
      if ( typeof animation.tearDown === "function" ) {
        this._registerTearDown(() => animation.tearDown.call(this, phase, params));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Attach particle generators to a phase. Mirrors {@link #attachAnimations}: each behavior's hooks are
   * bound to this component and given `(phase, layer)`. `setup` returns the behavior's motion/shape
   * contribution merged over the component-owned material config to spawn a generator; the optional
   * `schedule` adds bespoke timeline work; the optional `tearDown` is invoked when the component stops.
   * @param {object} phase   The phase config (charge/projectile/impact).
   */
  #attachParticles(phase) {
    for ( const layer of phase.particles ) {
      const behavior = this.#animationEntry(layer.animation);
      if ( !behavior ) continue;
      const params = layer.params ?? {};

      // Default generator: component-owned material merged with the behavior's motion contribution
      const textures = layer.textures.map(path => foundry.canvas.getTexture(path)).filter(Boolean);
      if ( textures.length && (typeof behavior.setup === "function") ) {
        const gridScale = this.state.gridScale;
        const config = {
          textures,
          manual: false,
          mode: "effect",
          count: params.count ?? null,
          initial: params.initial ?? 0,
          blend: params.blend ?? 0,
          tint: params.tint ?? 0xFFFFFF,
          fade: params.fade,
          spawnRate: params.spawnRate ?? 240,
          lifetime: this.#normalizeLifetime(params.lifetime ?? 1000),
          alpha: params.alpha ? [params.alpha.min, params.alpha.max] : [1, 1],
          scale: params.scale ? [params.scale.min * gridScale, params.scale.max * gridScale] : [gridScale, gridScale],
          elevation: params.elevation ?? 0,
          sort: params.sort ?? 0,
          duration: layer.duration ?? phase.duration,
          ...behavior.setup.call(this, phase, layer)
        };
        const generator = this._spawnGenerator(config, phase.start + layer.offset);

        // Optionally govern the rate of particle emission over time
        if ( (params.spawnRateEnd !== undefined) && (params.spawnRateEnd !== config.spawnRate) ) {
          this.timeline.add(generator,
            {spawnRate: {from: config.spawnRate, to: params.spawnRateEnd, duration: config.duration}},
            phase.start + layer.offset);
        }
      }

      // Optional bespoke timeline scheduling and teardown
      if ( typeof behavior.schedule === "function" ) behavior.schedule.call(this, phase, layer);
      if ( typeof behavior.tearDown === "function" ) {
        this._registerTearDown(() => behavior.tearDown.call(this, phase, layer));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Fade the projectile sprite out at impact, lingering for the stick duration first when it sticks.
   * @param {object} timings   The computed phase timings.
   */
  #animateProjectileExit(timings) {
    const stick = this.impact.stick;
    const fadeStart = (stick > 0) ? (timings.impactStart + stick - 150) : timings.impactStart;
    this.timeline.add(this.projectile.container, {alpha: {to: 0, duration: 150}}, fadeStart);
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Read a registry entry directly (no shape assertion); warn if missing.
   * @param {string} name   A CONFIG.Canvas.vfx.animations key.
   * @returns {object|undefined}
   */
  #animationEntry(name) {
    const entry = CONFIG.Canvas.vfx.animations[name];
    if ( !entry ) console.warn(`Crucible VFX: animation "${name}" is not registered.`);
    return entry;
  }

  /* -------------------------------------------- */

  /**
   * Normalize a lifetime input (number or {min, max}) to a {min, max} range in ms.
   * @param {number|{min: number, max: number}} lifetime
   * @returns {{min: number, max: number}}
   */
  #normalizeLifetime(lifetime) {
    if ( (typeof lifetime === "object") && (lifetime !== null) ) return lifetime;
    return {min: Math.round(lifetime * 0.85), max: lifetime};
  }

  /* -------------------------------------------- */

  /**
   * Schedule the phase's loaded sound (if any) at its focal point, aligned within the phase window.
   * @param {object} phase   The phase config (carrying its loaded `sound.instance` and start/duration).
   */
  #scheduleSound(phase) {
    const config = phase.sound;
    if ( !config?.instance ) return;
    // Impact resounds at the target; charge and flight emanate from the source.
    const origin = (phase === this.impact) ? this.state.destination : this.state.origin;
    this._scheduleSound(config.instance, origin, {position: phase.start, duration: phase.duration,
      align: config.align, radius: config.radius, volume: config.volume ?? 1});
  }
}
