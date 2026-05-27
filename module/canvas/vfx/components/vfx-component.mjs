const {NumberField} = foundry.data.fields;
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
      seed: new NumberField({initial: null})
    };
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
   */
  _scheduleSound(sound, origin, {position=0, duration=0, align=SOUND_ALIGNMENT.START, radius=30, volume=1}={}) {
    if ( !sound ) return;
    const at = Math.max(0, position + this._alignSound(sound, duration, align));
    this.timeline.call(() => {
      sound.playAtPosition(origin, radius, {volume, gmAlways: true}).catch(err => console.warn(err));
    }, at);
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
