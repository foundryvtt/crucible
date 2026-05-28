import VFXResolvedReferenceField from "../fields/vfx-resolved-reference-field.mjs";

const {ArrayField, BooleanField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;
const {SOUND_ALIGNMENT} = foundry.canvas.vfx.constants;

/**
 * Shared base class for all Crucible VFX components, extending the core {@link VFXComponent} with
 * conventions common to Crucible gesture animations.
 * 1. Deterministic RNG seed
 * 2. Positional sound on the environment channel with phase alignment
 * 3. Embedded {@link ParticleGenerator} management
 * Extended by various Crucible animation component subclasses.
 * @extends {foundry.canvas.vfx.VFXComponent}
 * @abstract
 */
export default class CrucibleVFXComponent extends foundry.canvas.vfx.VFXComponent {

  /** @inheritDoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      // Charge phase: `duration` is the timeline length; `distance` is the offset from the action's
      // origin mesh center at which the charge animation occurs. Subclasses interpret distance against
      // their own geometry (e.g. a ray offsets along the heading; a fan along the cone axis).
      charge: this._phaseField({
        duration: new NumberField({required: true, nullable: false, initial: 700}),
        distance: new NumberField({required: true, nullable: false, initial: 0})
      }),
      delivery: this._phaseField(),
      impacts: new ArrayField(this._impactField()),
      seed: new NumberField({initial: null}),
      // Scene-object references, all resolved at play-time by the framework:
      // - `originMesh` -> the action's origin token mesh (backs the `source` anchor for charge particles)
      // - `targetMeshes` -> per-impact target meshes (parallel to `impacts`); used by impact recoil etc.
      // - `mask` -> a wall-mask polygon honored by particle layers flagged `mask: true`
      originMesh: new VFXResolvedReferenceField(),
      targetMeshes: new ArrayField(new VFXResolvedReferenceField()),
      mask: new VFXResolvedReferenceField()
    };
  }

  /* -------------------------------------------- */
  /*  Schema Helpers                              */
  /* -------------------------------------------- */

  /**
   * A reference-resolvable canvas point (position plus render ordering), for origins, paths, and targets.
   * @returns {VFXReferenceObjectField}
   * @protected
   */
  static _pointField() {
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    return new foundry.canvas.vfx.fields.VFXReferenceObjectField(new SchemaField({
      x: new NumberField({required: true, nullable: false}),
      y: new NumberField({required: true, nullable: false}),
      elevation: new NumberField({required: true, nullable: false, initial: 0}),
      sort: new NumberField({nullable: false, initial: 0}),
      sortLayer: new NumberField({nullable: false, initial: SL.TOKENS})
    }));
  }

  /* -------------------------------------------- */

  /**
   * Timeline animators referenced by a phase: registered CONFIG.Canvas.vfx.animations names plus params.
   * @returns {ArrayField}
   * @protected
   */
  static _animationsField() {
    return new ArrayField(new SchemaField({
      function: new StringField({required: true, blank: false}),
      params: new ObjectField({required: false})
    }));
  }

  /* -------------------------------------------- */

  /**
   * A nullable per-phase positional sound cue; `loop`/`fade`/`offset`/`release` shape looping playback.
   * @returns {SchemaField}
   * @protected
   */
  static _soundField() {
    return new SchemaField({
      src: new StringField({required: true, blank: false}),
      align: new NumberField({required: true, nullable: false, initial: SOUND_ALIGNMENT.START}),
      volume: new foundry.data.fields.AlphaField(),
      radius: new NumberField({required: true, nullable: false, initial: 30}),
      loop: new BooleanField({initial: false}),
      fade: new NumberField({required: true, nullable: false, initial: 0}),
      offset: new NumberField({required: true, nullable: false, initial: 0}),
      release: new NumberField({required: true, nullable: false, initial: 0})
    }, {required: false, nullable: true, initial: null});
  }

  /* -------------------------------------------- */

  /**
   * One impact in a component's `impacts` array: a self-contained per-target visual whose `sound`,
   * `animations`, and `particles` are the look the configurator baked for this target (hit vs miss decided
   * there). The struck point is not stored here - it is resolved at runtime by {@link _impactTarget} from
   * the target's injected mesh, because a reference field sharing an array element with literal data is
   * wiped by `VFXEffect#resolveReferences` (its partial array update replaces the element). Subclasses pass
   * `extraFields` for component-specific data (e.g. `stick`).
   * @param {Record<string, DataField>} [extraFields]
   * @returns {SchemaField}
   * @protected
   */
  static _impactField(extraFields={}) {
    return new SchemaField({
      result: new NumberField({required: false, nullable: true, initial: null}),
      id: new StringField({required: false, blank: true}),
      start: new NumberField({required: false, nullable: true, initial: null}),
      sound: this._soundField(),
      animations: this._animationsField(),
      particles: new ArrayField(this._particleField()),
      ...extraFields
    });
  }

  /* -------------------------------------------- */

  /**
   * A standard animation phase: a positional sound cue, timeline animations, and particle layers, plus any
   * component-specific `extraFields` (e.g. a charge `duration`, or a delivery's projectile sprite fields).
   * @param {Record<string, DataField>} [extraFields]
   * @returns {SchemaField}
   * @protected
   */
  static _phaseField(extraFields={}) {
    return new SchemaField({
      sound: this._soundField(),
      animations: this._animationsField(),
      particles: new ArrayField(this._particleField()),
      ...extraFields
    });
  }

  /* -------------------------------------------- */

  /**
   * A single particle generator layer. `anchor` names a key into `this.state.anchors`; `mask` flags the
   * layer to honor the component's resolved point-source mask.
   * @returns {SchemaField}
   * @protected
   */
  static _particleField() {
    return new SchemaField({
      animation: new StringField({required: true, blank: false}),
      anchor: new StringField({required: true, blank: false, initial: "origin"}),
      textures: new ArrayField(new StringField({required: true, blank: false})),
      offset: new NumberField({required: true, nullable: false, initial: 0}),  // Milliseconds after phase start
      duration: new NumberField({nullable: true, initial: null}),              // Null uses the phase length
      mask: new BooleanField({initial: false}),
      params: new ObjectField({required: false})
    });
  }

  /**
   * Labeled timeline positions for the component animation.
   * @type {Record<string, number>}
   */
  timings = {};

  /**
   * Shared animation state used across multiple phases of component animation.
   * @type {object}
   */
  state = {};

  /**
   * ParticleGenerators spawned by this component.
   * @type {Set<ParticleGenerator>}
   */
  #generators;

  /**
   * Sounds loaded by this component.
   * @type {Set<Sound>}
   */
  #sounds;

  /**
   * Animation tearDown callbacks to invoke when the component stops.
   * @type {Function[]}
   */
  #tearDowns = [];

  /* -------------------------------------------- */
  /*  Determinism                                 */
  /* -------------------------------------------- */

  /**
   * A deterministic random stream seeded by {@link seed}, or {@link Math.random} when unseeded.
   * @type {() => number}
   */
  get rng() {
    if ( this.#rng ) return this.#rng;
    if ( this.seed === null ) return this.#rng = Math.random;
    const twister = new foundry.dice.MersenneTwister(this.seed);
    return this.#rng = twister.random.bind(twister);
  }

  #rng;

  /**
   * Choose a random element of an array using the component's deterministic stream.
   * @template T
   * @param {T[]} arr
   * @returns {T|null}
   */
  _pick(arr) {
    return arr?.length ? arr[Math.floor(this.rng() * arr.length)] : null;
  }

  /* -------------------------------------------- */
  /*  Positional Sound                            */
  /* -------------------------------------------- */

  /**
   * Load a sound on the environment channel for later positional playback. Call from `_load`.
   * @param {string} src                The audio source path.
   * @returns {Promise<Sound|null>}     The loaded Sound, or null if no src was provided.
   */
  async _loadSound(src) {
    if ( !src ) return null;
    const sound = new foundry.audio.Sound(src, {context: game.audio.environment});
    await sound.load();
    this.#sounds ||= new Set();
    this.#sounds.add(sound);
    return sound;
  }

  /* -------------------------------------------- */

  /**
   * Schedule a positional sound on this component's timeline, aligned within a phase of given length.
   * @param {Sound} sound                          A sound previously loaded via {@link _loadSound}.
   * @param {{x: number, y: number, elevation?: number}} origin   Canvas origin for positional playback.
   * @param {object} [options]
   * @param {number} [options.position=0]          Phase start offset (ms) on the component timeline.
   * @param {number} [options.duration=0]          Phase duration (ms) used for alignment.
   * @param {number} [options.align]               A {@link SOUND_ALIGNMENT} value (default START).
   * @param {number} [options.radius=30]           Audible radius in distance units.
   * @param {number} [options.volume=1]            Playback volume in [0, 1].
   * @param {boolean} [options.loop=false]         Loop the source for the phase duration, then fade out.
   * @param {number} [options.fade=0]              Fade-in/out duration (ms) applied when looping.
   * @param {number} [options.offset=0]            Start offset (ms) added to the play time; negative starts earlier.
   * @param {number} [options.release=0]           Extra ms a looping sound lingers past the phase end before stopping.
   */
  _scheduleSound(sound, origin, {position=0, duration=0, align=SOUND_ALIGNMENT.START, radius=30, volume=1,
    loop=false, fade=0, offset=0, release=0}={}) {
    if ( !sound ) return;
    const at = Math.max(0, position + offset + this._alignSound(sound, duration, align));
    const playbackOptions = loop ? {loop: true, fade} : {};
    this.timeline.call(() => {
      sound.playAtPosition(origin, radius, {volume, gmAlways: true, playbackOptions}).catch(err => console.warn(err));
    }, at);

    // A looping sound fades out starting at the phase end (plus any release), so it lingers, not cuts off
    if ( loop && (duration > 0) ) {
      const stopAt = Math.max(at, position + duration + release);
      this.timeline.call(() => sound.stop({fade: fade || 250}).catch(err => console.warn(err)), stopAt);
    }
  }

  /* -------------------------------------------- */

  /**
   * Offset (ms) within a phase at which a sound should begin so it aligns to the requested position.
   * @param {Sound} sound          The sound, used for its natural duration.
   * @param {number} duration      The phase duration in ms.
   * @param {number} align         A {@link SOUND_ALIGNMENT} value.
   * @returns {number}             Offset in ms relative to the phase start.
   */
  _alignSound(sound, duration, align) {
    const soundMS = (sound.duration ?? 0) * 1000;
    if ( soundMS >= duration ) return 0;
    switch ( align ) {
      case SOUND_ALIGNMENT.END_START: return -soundMS;
      case SOUND_ALIGNMENT.MIDDLE: return Math.max((duration - soundMS) / 2, 0);
      case SOUND_ALIGNMENT.END: return Math.max(duration - soundMS, 0);
      case SOUND_ALIGNMENT.START_END: return duration;
      default: return 0; // START
    }
  }

  /* -------------------------------------------- */
  /*  Sprite Helpers                              */
  /* -------------------------------------------- */

  /**
   * Create a transparent {@link VFXCanvasContainer} holding a sized {@link PrimarySpriteMesh} (named
   * "mesh") at a point.
   * @param {string} texture   The texture path.
   * @param {number} size      Sprite size in feet (fit to the larger dimension).
   * @param {{x: number, y: number, elevation: number, sort: number, sortLayer: number}} point
   * @returns {VFXCanvasContainer}
   * @internal
   */
  _createSprite(texture, size, point) {
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

  /* -------------------------------------------- */
  /*  Particle Helpers                            */
  /* -------------------------------------------- */

  /**
   * Construct a {@link ParticleGenerator} instance, and schedule it to play over the course of the effect timeline.
   * @param {ParticleGeneratorConfiguration} config   Configuration passed to the generator constructor.
   * @param {number} [position=0]   Timeline offset (ms) at which the generator begins emitting.
   * @returns {ParticleGenerator}
   */
  _spawnGenerator(config, position=0) {
    const generator = new foundry.canvas.animation.ParticleGenerator(config);
    this.#generators ||= new Set();
    this.#generators.add(generator);
    this.timeline.call(() => generator.start(), position);
    if ( config.duration ) {
      const lt = config.lifetime;
      const maxLifetime = ((typeof lt === "object") && lt) ? (lt.max ?? lt.min ?? 0) : (lt ?? 0);
      this.timeline.call(() => generator.stop({hard: false}), position + config.duration);
      this.timeline.call(() => generator.stop({hard: true}), position + config.duration + maxLifetime);
    }
    return generator;
  }

  /* -------------------------------------------- */
  /*  Phase Dispatch                              */
  /* -------------------------------------------- */

  /**
   * Setup, schedule, animate, and register-teardown the registered animations of a phase.
   * @param {object} phase   A phase config carrying `animations`, `start`, and `duration`.
   * @protected
   */
  _attachAnimations(phase) {
    for ( const entry of phase.animations ) {
      const animation = this._animationEntry(entry.function);
      if ( !animation ) continue;

      // Clone per dispatch: a phase (e.g. a shared impact template) may be dispatched more than once and
      // animations write per-invocation scratch into params, which must not collide between dispatches.
      const params = {...(entry.params ?? {})};
      if ( typeof animation.setup === "function" ) animation.setup.call(this, phase, params);
      if ( typeof animation.schedule === "function" ) animation.schedule.call(this, phase, params);
      if ( typeof animation.animate === "function" ) {
        const progress = {t: 0};
        this.timeline.add(progress, {
          t: {from: 0, to: 1}, duration: phase.duration, ease: "linear",
          onRender: () => animation.animate.call(this, progress.t, phase, params)
        }, phase.start);
      }
      if ( typeof animation.tearDown === "function" ) {
        this._registerTearDown(() => animation.tearDown.call(this, phase, params));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Spawn each particle layer of a phase: the behavior's `setup` contribution is merged over the
   * component-owned material config; optional `schedule` and `tearDown` hooks are honored.
   * @param {object} phase   A phase config carrying `particles`, `start`, and `duration`.
   * @protected
   */
  _attachParticles(phase) {
    for ( const layer of phase.particles ) {
      const behavior = this._animationEntry(layer.animation);
      if ( !behavior ) continue;
      const params = layer.params ?? {};
      const textures = layer.textures.map(path => foundry.canvas.getTexture(path)).filter(Boolean);
      if ( textures.length && (typeof behavior.setup === "function") ) {
        const gridScale = this.state.gridScale;
        const config = {
          textures, manual: false, mode: "effect",
          count: params.count ?? null, initial: params.initial ?? 0,
          blend: params.blend ?? 0, tint: params.tint ?? 0xFFFFFF, fade: params.fade,
          spawnRate: params.spawnRate ?? 240,
          lifetime: this._normalizeLifetime(params.lifetime ?? 1000),
          alpha: params.alpha ? [params.alpha.min, params.alpha.max] : [1, 1],
          scale: params.scale ? [params.scale.min * gridScale, params.scale.max * gridScale] : [gridScale, gridScale],
          elevation: params.elevation ?? 0, sort: params.sort ?? 0,
          duration: layer.duration ?? phase.duration,
          pointSourceMask: layer.mask ? (this.mask ?? null) : null,
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
      if ( typeof behavior.schedule === "function" ) behavior.schedule.call(this, phase, layer);
      if ( typeof behavior.tearDown === "function" ) {
        this._registerTearDown(() => behavior.tearDown.call(this, phase, layer));
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Schedule a phase's loaded sound (if any) at a focal point, aligned within the phase window.
   * @param {object} phase                    A phase config carrying `sound.instance`, `start`, `duration`.
   * @param {{x: number, y: number}} origin   Positional origin for playback.
   * @protected
   */
  _schedulePhaseSound(phase, origin) {
    const config = phase.sound;
    if ( !config?.instance ) return;
    this._scheduleSound(config.instance, origin, {position: phase.start, duration: phase.duration,
      align: config.align, radius: config.radius, volume: config.volume ?? 1, loop: config.loop,
      fade: config.fade, offset: config.offset, release: config.release});
  }

  /* -------------------------------------------- */

  /**
   * Read a registered animation/behavior by name; warn if missing.
   * @param {string} name   A CONFIG.Canvas.vfx.animations key.
   * @returns {object|undefined}
   * @protected
   */
  _animationEntry(name) {
    const entry = CONFIG.Canvas.vfx.animations[name];
    if ( !entry ) console.warn(`Crucible VFX: animation "${name}" is not registered.`);
    return entry;
  }

  /* -------------------------------------------- */

  /**
   * Normalize a lifetime to a {min, max} range in ms.
   * @param {number|{min: number, max: number}} lifetime   A scalar or pre-formed range.
   * @returns {{min: number, max: number}}
   * @protected
   */
  _normalizeLifetime(lifetime) {
    if ( (typeof lifetime === "object") && (lifetime !== null) ) return lifetime;
    return {min: Math.round(lifetime * 0.85), max: lifetime};
  }

  /* -------------------------------------------- */

  /**
   * Dispatch each impact's own visuals at its scheduled time. Each impact carries its own target, sound,
   * animations, and particles (the configurator baked the hit/miss look per target), so this loop is
   * trajectory-agnostic. `this.state.impacts` is the authoritative record; transient `this.state` pointers
   * are set immediately before each synchronous dispatch for the shared, this-bound impact animations.
   * @returns {number}   The latest impact end time (ms), for the caller's "end" label.
   * @protected
   */
  _attachImpacts() {
    this.state.impacts = {};
    let maxEnd = 0;
    this.impacts.forEach((impact, i) => {
      const mesh = this.targetMeshes[i] ?? null;
      const target = this._impactTarget(impact, i);
      const start = this._impactStart(impact, target, i);
      const duration = Math.max(impact.stick ?? 0, ...impact.animations.map(a => a.params?.duration ?? 0), 0);
      const end = start + duration;
      maxEnd = Math.max(maxEnd, end);
      const key = impact.id || String(i);
      this.state.impacts[key] = {id: key, index: i, result: impact.result, destination: target, mesh,
        start, end, duration, anchors: {...this.state.anchors, target, destination: target}};

      // Transient current-impact context read synchronously by the shared impact animations
      this.state.destination = target;
      this.state.targetMesh = mesh;
      this.state.anchors.target = target;
      this.state.anchors.destination = target;

      const phase = {...impact, start, end, duration};
      this._attachAnimations(phase);
      this._schedulePhaseSound(phase, target);
      this._attachParticles(phase);
    });
    this.timings.impactEnd = maxEnd;
    return maxEnd;
  }

  /* -------------------------------------------- */

  /**
   * Resolve the canvas point an impact strikes. The default reads the injected target mesh; override when
   * the strike point differs from the target's mesh position (e.g. a projectile's offset landing point).
   * @param {object} impact   The impact entry.
   * @param {number} i        Its index in `impacts`.
   * @returns {{x: number, y: number, elevation: number, sort: number, sortLayer: number}}
   * @protected
   */
  _impactTarget(impact, i) {
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const mesh = this.targetMeshes[i];
    if ( mesh ) return {x: mesh.x, y: mesh.y, elevation: mesh.elevation ?? 0,
      sort: mesh.sort ?? 0, sortLayer: mesh.sortLayer ?? SL.TOKENS};
    return this.state.destination ?? this.state.end ?? this.state.origin;
  }

  /* -------------------------------------------- */

  /**
   * The timeline start (ms) of an impact. Reads the impact's own `start` field when the configurator
   * baked one in (the common case for trajectory-dependent staggering, e.g. a ray's beam-front
   * arrival); otherwise falls back to a single shared `this.timings.impactStart`. Subclasses can
   * override for runtime-computed timing, but baking at configure-time is preferred.
   * @param {object} impact                   The impact entry.
   * @param {{x: number, y: number}} target   The impact's strike point.
   * @param {number} i                        Its index in `impacts`.
   * @returns {number}
   * @protected
   */
  _impactStart(impact, target, i) {
    return impact.start ?? this.timings.impactStart ?? 0;
  }

  /* -------------------------------------------- */
  /*  Lifecycle                                   */
  /* -------------------------------------------- */

  /**
   * Register an animation tearDown callback, invoked when the component stops.
   * @param {function} callback
   */
  _registerTearDown(callback) {
    this.#tearDowns.push(callback);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _stop() {
    for ( const tearDown of this.#tearDowns ) {
      try { tearDown(); } catch(err) { console.warn(err); }
    }
    for ( const generator of this.#generators ?? [] ) generator.stop({hard: true});
    const stops = [];
    for ( const sound of this.#sounds ?? [] ) {
      if ( sound.playing ) stops.push(sound.stop());
    }
    await Promise.allSettled(stops);
  }
}
