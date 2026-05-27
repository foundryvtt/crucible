import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";

const {ArrayField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for a single projectile attack: a charge phase, a flight phase along a
 * path, and an impact phase, each able to carry timeline animators (motion/look) and an arbitrary
 * number of particle layers (referencing registered particle behaviors). It owns the shared
 * structure and orchestration of all projectiles; how any one projectile looks is chosen via the
 * named phase `animations` and particle `animation` behaviors, none hardcoded.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleProjectileComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleProjectile";

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

      // The impact of the projectile against its target. `duration` is how long a hit projectile lingers
      // (stuck) before fading; the full impact window is the max of it and the impact.animations durations.
      impact: new SchemaField({
        duration: new NumberField({required: true, nullable: false, initial: 0}),
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      })
    };
  }

  /* -------------------------------------------- */

  /** Timeline animators referenced by a phase: registered names + params. */
  static #animationsField() {
    return new ArrayField(new SchemaField({
      function: new StringField({required: true, blank: false}), // A CONFIG.Canvas.vfx.animations key
      params: new ObjectField({required: false})
    }));
  }

  /* -------------------------------------------- */

  /** A nullable per-phase positional sound cue; `radius` is per-sound. */
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
   * One particle layer. `animation` names a registered particle behavior (its `setup` returns the
   * layer's shape/motion/callbacks); `anchor` is where it spawns; `params` carries the material and
   * behavior tuning the component and behavior interpret (lifetime, alpha, scale, spawnRate,
   * elevation, sort, chargeRadius, align, radius, ...).
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
  /*  Loading                                     */
  /* -------------------------------------------- */

  /** Loaded phase sounds, kept for scheduling in `_draw`. @type {Record<string, Sound|null>} */
  #phaseSounds = {charge: null, projectile: null, impact: null};

  /**
   * Struck-token object displaced by impactRecoil/impactShake, injected by finalizeVFX.
   * @type {PIXI.DisplayObject|null}
   */
  _recoilTarget = null;

  /**
   * The mesh of the Action origin Token.
   * @type {PIXI.DisplayObject|null}
   */
  _originMesh = null;

  /** @inheritDoc */
  async _load() {
    // Projectile sprite, particle-layer textures, and any animation sprite textures (e.g. impactBurst)
    this.assetPaths.add(this.projectile.texture);
    for ( const phase of [this.charge, this.projectile, this.impact] ) {
      for ( const layer of phase.particles ) {
        for ( const texture of layer.textures ) this.assetPaths.add(texture);
      }
      for ( const anim of phase.animations ) {
        if ( anim.params?.texture ) this.assetPaths.add(anim.params.texture);
      }
    }
    // Phase sounds, loaded on the environment channel by the base helper (also tracked for teardown)
    this.#phaseSounds.charge = await this._loadSound(this.charge.sound?.src);
    this.#phaseSounds.projectile = await this._loadSound(this.projectile.sound?.src);
    this.#phaseSounds.impact = await this._loadSound(this.impact.sound?.src);
  }

  /* -------------------------------------------- */
  /*  Drawing                                     */
  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    const distancePixels = canvas.dimensions.distancePixels;
    const origin = this.path[0];
    const destination = this.path.at(-1);
    const flightPath = foundry.canvas.vfx.VFXPath.create(this.pathType.type, this.path, this.pathType.params);

    // Impact window = the longest of the stick and the impact animation durations
    const flightMS = (flightPath.pathLength * 1000) / (this.projectile.speed * distancePixels);
    const timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      projectileStart: this.charge.duration,
      projectileEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };
    const impactDuration = Math.max(this.impact.duration,
      ...this.impact.animations.map(a => a.params?.duration ?? 0), 0);
    timings.impactEnd = timings.impactStart + impactDuration;

    // The flying projectile sprite; the impact burst sprite is created by the impactBurst animation.
    this.projectile.container = this.addManagedDisplayObject(
      this._createSprite(this.projectile.texture, this.projectile.size, origin));

    // Shared state for phase animators (mirrors VFXSingleAttackComponent#state).
    const state = {
      origin, destination, flightPath, lastPathIndex: 0,
      charge: this.charge, projectile: this.projectile, impact: this.impact,
      recoilTarget: this._recoilTarget
    };
    const source = this._originMesh ? {x: this._originMesh.x, y: this._originMesh.y} : origin;
    const anchors = {origin, destination, projectile: this.projectile.container, source};

    // Charge phase
    this.#drivePhaseAnimations(this.charge, state, timings.chargeStart, this.charge.duration);
    this.#scheduleSound(this.#phaseSounds.charge, this.charge.sound, origin, timings.chargeStart, this.charge.duration);
    this.#spawnLayers(this.charge, state, anchors, timings.chargeStart, this.charge.duration);

    // Projectile phase
    this.#drivePhaseAnimations(this.projectile, state, timings.projectileStart, flightMS);
    this.#scheduleSound(this.#phaseSounds.projectile, this.projectile.sound, origin, timings.projectileStart, flightMS);
    this.#spawnLayers(this.projectile, state, anchors, timings.projectileStart, flightMS);

    // Impact phase
    this.#animateProjectileExit(timings);
    this.#drivePhaseAnimations(this.impact, state, timings.impactStart, impactDuration);
    this.#scheduleSound(this.#phaseSounds.impact, this.impact.sound, destination, timings.impactStart, impactDuration);
    this.#spawnLayers(this.impact, state, anchors, timings.impactStart, impactDuration);

    this.timeline.label("end", timings.impactEnd);
  }

  /* -------------------------------------------- */

  /**
   * Drive a phase's registered animations: each entry's optional `setup` and `schedule` run once (the
   * latter for sprite-creating animations), and an optional `animate` is driven each frame by a linear
   * progress tween.
   * @param {object} phase       The phase config (charge/projectile/impact).
   * @param {object} state       Shared animation state.
   * @param {number} start       Phase start position (ms) on the timeline.
   * @param {number} duration    Phase duration (ms).
   */
  #drivePhaseAnimations(phase, state, start, duration) {
    for ( const entry of phase.animations ) {
      const animation = this.#animationEntry(entry.function);
      if ( !animation ) continue;
      const params = entry.params ?? {};
      animation.setup?.(state, params);
      if ( typeof animation.schedule === "function" ) animation.schedule(this, state, params, start, duration);
      if ( typeof animation.animate === "function" ) {
        const progress = {t: 0};
        this.timeline.add(progress, {
          t: {from: 0, to: 1}, duration, ease: "linear",
          onRender: () => animation.animate(progress.t, state, params, duration)
        }, start);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Spawn each particle layer of a phase, merging the named behavior's contribution over the
   * component-owned material config.
   * @param {object} phase                       The phase config.
   * @param {object} state                       Shared animation state.
   * @param {Record<string, object>} anchors     Resolved spawn anchors by name.
   * @param {number} start                       Phase start position (ms).
   * @param {number} duration                    Phase duration (ms).
   */
  #spawnLayers(phase, state, anchors, start, duration) {
    const gridScale = getParticleScaleFactor();
    for ( const layer of phase.particles ) {
      const behavior = this.#animationEntry(layer.animation);
      if ( typeof behavior?.setup !== "function" ) continue;
      const textures = layer.textures.map(path => foundry.canvas.getTexture(path)).filter(Boolean);
      if ( !textures.length ) continue;
      const params = layer.params ?? {};
      const anchor = anchors[layer.anchor] ?? anchors.origin;

      // Normalize lifetime: a number becomes a short [0.85*n, n] band; a {min, max} is used directly.
      const lifetime = this.#normalizeLifetime(params.lifetime ?? 1000);
      const context = {anchor, gridScale, lifetime: lifetime.max, params, state};

      // Component-owned material; behavior contributes area/velocity/rotation/blend/drift/callbacks.
      const config = {
        textures,
        manual: false,
        mode: "effect",
        count: params.count ?? null,
        initial: params.initial ?? 0,
        blend: params.blend ?? 0,
        tint: params.tint ?? 0xFFFFFF, // Multiplied into the texture; a dark value darkens (e.g. sooty smoke)
        fade: params.fade,             // Optional {in, out} alpha envelope (fractions of lifetime or ms)
        spawnRate: params.spawnRate ?? 240,
        lifetime,
        alpha: params.alpha ? [params.alpha.min, params.alpha.max] : [1, 1],
        scale: params.scale ? [params.scale.min * gridScale, params.scale.max * gridScale] : [gridScale, gridScale],
        elevation: params.elevation ?? 0,
        sort: params.sort ?? 0,
        duration: layer.duration ?? duration,
        ...behavior.setup(context)
      };
      const generator = this._spawnGenerator(config, start + layer.offset);

      // Optional emission ramp: tween spawnRate from its initial value to params.spawnRateEnd across the
      // layer, e.g. to crossfade a flame-heavy charge toward smoke as the energy burns down.
      if ( (params.spawnRateEnd !== undefined) && (params.spawnRateEnd !== config.spawnRate) ) {
        this.timeline.add(generator,
          {spawnRate: {from: config.spawnRate, to: params.spawnRateEnd, duration: config.duration}},
          start + layer.offset);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Fade the projectile sprite out at impact, lingering for the stick duration first when it sticks.
   * @param {object} timings   The computed phase timings.
   */
  #animateProjectileExit(timings) {
    const stick = this.impact.duration;
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
   * Schedule a phase sound at its phase start, aligned within the phase, via the base helper.
   * @param {Sound|null} sound        The loaded sound, or null.
   * @param {object|null} config      The phase sound config (align / radius / volume).
   * @param {{x: number, y: number}} origin   Positional origin for playback.
   * @param {number} position         Phase start offset (ms).
   * @param {number} duration         Phase duration (ms) for alignment.
   */
  #scheduleSound(sound, config, origin, position, duration) {
    if ( !sound || !config ) return;
    this._scheduleSound(sound, origin, {position, duration, align: config.align,
      radius: config.radius, volume: config.volume ?? 1});
  }

}
