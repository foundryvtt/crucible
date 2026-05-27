import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../animations.mjs";

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

      // Trajectory: [manifest origin, impact point]; points resolve references so the impact point
      // can track the live target token mesh with a hit/miss offset.
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

      charge: new SchemaField({
        duration: new NumberField({required: true, nullable: false, initial: 700}),
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      }),

      projectile: new SchemaField({
        texture: new StringField({required: true, blank: false}),
        size: new NumberField({required: true, nullable: false, initial: 3}),    // Size in feet
        speed: new NumberField({required: true, nullable: false, initial: 150}), // Feet per second
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      }),

      impact: new SchemaField({
        stickDuration: new NumberField({required: true, nullable: false, initial: 0}),
        sound: self.#soundField(),
        // Optional single burst sprite, decoupled from the projectile stick; null on a clean miss.
        burst: new SchemaField({
          texture: new StringField({required: true, blank: false}),
          size: new NumberField({required: true, nullable: false, initial: 3}),
          duration: new NumberField({required: true, nullable: false, initial: 1000})
        }, {required: false, nullable: true, initial: null}),
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
   * elevation, sort, gatherRadius, align, radius, ...).
   */
  static #particleField() {
    return new SchemaField({
      animation: new StringField({required: true, blank: false}),
      anchor: new StringField({required: true, blank: false, initial: "origin",
        choices: ["origin", "destination", "projectile"]}),
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

  /** @inheritDoc */
  async _load() {
    // Sprite and particle textures
    this.assetPaths.add(this.projectile.texture);
    if ( this.impact.burst?.texture ) this.assetPaths.add(this.impact.burst.texture);
    for ( const phase of [this.charge, this.projectile, this.impact] ) {
      for ( const layer of phase.particles ) {
        for ( const texture of layer.textures ) this.assetPaths.add(texture);
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

    // Phase timings: charge, then flight (derived from speed), then impact (stick or burst, longest).
    const flightMS = (flightPath.pathLength * 1000) / (this.projectile.speed * distancePixels);
    const timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      projectileStart: this.charge.duration,
      projectileEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };
    const impactDuration = Math.max(this.impact.stickDuration, this.impact.burst?.duration ?? 0);
    timings.impactEnd = timings.impactStart + impactDuration;

    // Sprites: the flying projectile, and an optional impact burst at the destination.
    this.projectile.container = this.addManagedDisplayObject(
      this.#createSprite(this.projectile.texture, this.projectile.size, origin));
    if ( this.impact.burst ) {
      this.impact.container = this.addManagedDisplayObject(
        this.#createSprite(this.impact.burst.texture, this.impact.burst.size, destination));
    }

    // Shared animation state passed to phase animators (mirrors VFXSingleAttackComponent#state).
    const state = {
      origin, destination, flightPath, lastPathIndex: 0,
      charge: this.charge, projectile: this.projectile, impact: this.impact
    };
    const anchors = {origin, destination, projectile: this.projectile.container};

    // Charge phase
    this.#drivePhaseAnimations(this.charge, state, timings.chargeStart, this.charge.duration);
    this.#scheduleSound(this.#phaseSounds.charge, this.charge.sound, origin, timings.chargeStart, this.charge.duration);
    this.#spawnLayers(this.charge, state, anchors, timings.chargeStart, this.charge.duration);

    // Projectile phase
    this.#drivePhaseAnimations(this.projectile, state, timings.projectileStart, flightMS);
    this.#scheduleSound(this.#phaseSounds.projectile, this.projectile.sound, origin, timings.projectileStart, flightMS);
    this.#spawnLayers(this.projectile, state, anchors, timings.projectileStart, flightMS);

    // Impact phase
    this.#animateImpact(timings);
    this.#drivePhaseAnimations(this.impact, state, timings.impactStart, impactDuration);
    this.#scheduleSound(this.#phaseSounds.impact, this.impact.sound, destination, timings.impactStart, impactDuration);
    this.#spawnLayers(this.impact, state, anchors, timings.impactStart, impactDuration);

    this.timeline.label("end", timings.impactEnd);
  }

  /* -------------------------------------------- */

  /**
   * Drive a phase's timeline animators over the phase duration. Each animator's `setup` runs once,
   * then `animate(t, state, params)` is called each frame against a linear progress tween.
   * @param {object} phase       The phase config (charge/projectile/impact).
   * @param {object} state       Shared animation state.
   * @param {number} start       Phase start position (ms) on the timeline.
   * @param {number} duration    Phase duration (ms).
   */
  #drivePhaseAnimations(phase, state, start, duration) {
    for ( const entry of phase.animations ) {
      const animation = this.#animationEntry(entry.function);
      if ( typeof animation?.animate !== "function" ) continue;
      const params = entry.params ?? {};
      animation.setup?.(state, params);
      const progress = {t: 0};
      this.timeline.add(progress, {
        t: {from: 0, to: 1}, duration, ease: "linear",
        onRender: () => animation.animate(progress.t, state, params)
      }, start);
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
        spawnRate: params.spawnRate ?? 240,
        lifetime,
        alpha: params.alpha ? [params.alpha.min, params.alpha.max] : [1, 1],
        scale: params.scale ? [params.scale.min * gridScale, params.scale.max * gridScale] : [gridScale, gridScale],
        elevation: params.elevation ?? 0,
        sort: params.sort ?? 0,
        duration: layer.duration ?? duration,
        ...behavior.setup(context)
      };
      this._spawnGenerator(config, start + layer.offset);
    }
  }

  /* -------------------------------------------- */

  /**
   * Fade the impact burst in and out and fade the projectile out. When the projectile sticks, the
   * burst holds for the same duration so both exit together; otherwise the burst plays for its own
   * duration and the projectile vanishes at impact.
   * @param {object} timings   The computed phase timings.
   */
  #animateImpact(timings) {
    const {impactStart} = timings;
    const stick = this.impact.stickDuration;
    const hold = (stick > 0) ? stick : (this.impact.burst?.duration ?? 0);
    if ( this.impact.container ) {
      const fade = Math.min(hold / 8, 150);
      this.timeline.add(this.impact.container, {alpha: {from: 0, to: 1, duration: fade}}, impactStart)
        .add(this.impact.container, {alpha: {from: 1, to: 0, duration: fade}}, impactStart + hold - fade);
    }
    const fadeStart = (stick > 0) ? (impactStart + stick - 150) : impactStart;
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

  /* -------------------------------------------- */

  /**
   * Create a VFXCanvasContainer holding a sized PrimarySpriteMesh at a path point.
   * @param {string} texture   The texture path.
   * @param {number} size      Sprite size in feet.
   * @param {object} point     The path point ({x, y, elevation, sort, sortLayer}).
   * @returns {VFXCanvasContainer}
   */
  #createSprite(texture, size, point) {
    const container = new foundry.canvas.vfx.VFXCanvasContainer();
    container.position.set(point.x, point.y);
    container.elevation = point.elevation;
    container.sort = point.sort;
    container.sortLayer = point.sortLayer;
    container.alpha = 0;
    const tex = foundry.canvas.getTexture(texture);
    if ( !tex ) return container;
    const mesh = new foundry.canvas.primary.PrimarySpriteMesh(tex);
    mesh.name = "mesh";
    mesh.anchor.set(0.5, 0.5);
    if ( Number.isNumeric(size) ) {
      if ( mesh.width >= mesh.height ) {
        mesh.width = size * canvas.dimensions.distancePixels;
        mesh.scale.y = mesh.scale.x;
      } else {
        mesh.height = size * canvas.dimensions.distancePixels;
        mesh.scale.x = mesh.scale.y;
      }
    }
    container.addChild(mesh);
    return container;
  }
}
