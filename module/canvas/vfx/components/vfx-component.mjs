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
   * Sounds loaded by this component, tracked so they can be stopped on teardown.
   * @type {Set<Sound>}
   */
  #sounds = new Set();

  /**
   * Load a sound on the environment channel for later positional playback. Call from `_load`.
   * @param {string} src                The audio source path.
   * @returns {Promise<Sound|null>}     The loaded Sound, or null if no src was provided.
   */
  async _loadSound(src) {
    if ( !src ) return null;
    const sound = new foundry.audio.Sound(src, {context: game.audio.environment});
    await sound.load();
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
  /*  Particle Generators                         */
  /* -------------------------------------------- */

  /**
   * ParticleGenerators spawned by this component, tracked for teardown.
   * @type {Set<ParticleGenerator>}
   */
  #generators = new Set();

  /**
   * Construct and track a {@link ParticleGenerator}, then schedule its start, soft-stop, and hard-stop
   * on the component timeline. Construction is eager so configuration errors surface during `_draw`;
   * `start` fires at `position`, emission soft-stops after `config.duration`, and a hard-stop follows
   * once the last particles have lived out their lifetime. Generators without a duration run until the
   * component is torn down.
   * @param {ParticleGeneratorConfiguration} config   Configuration passed to the generator constructor.
   * @param {number} [position=0]   Timeline offset (ms) at which the generator begins emitting.
   * @returns {ParticleGenerator}
   */
  _spawnGenerator(config, position=0) {
    const generator = new foundry.canvas.animation.ParticleGenerator(config);
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

  /** @inheritDoc */
  async _stop() {
    for ( const generator of this.#generators ) generator.stop({hard: true});
    const stops = [];
    for ( const sound of this.#sounds ) {
      if ( sound.playing ) stops.push(sound.stop());
    }
    await Promise.allSettled(stops);
  }
}
