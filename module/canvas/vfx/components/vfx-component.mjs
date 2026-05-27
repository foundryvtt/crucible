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
   * Construct and track a {@link ParticleGenerator}, scheduling start at `position`, soft-stop after
   * `config.duration`, and hard-stop once the last particles expire. Generators do not self-stop from
   * `config.duration`; a generator without a duration runs until the component is torn down.
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
  /*  Impact Sprites                              */
  /* -------------------------------------------- */

  /**
   * Create a transparent {@link VFXCanvasContainer} holding a sized {@link PrimarySpriteMesh} (named
   * "mesh") at a point.
   * @param {string} texture   The texture path.
   * @param {number} size      Sprite size in feet (fit to the larger dimension).
   * @param {{x: number, y: number, elevation: number, sort: number, sortLayer: number}} point
   * @returns {VFXCanvasContainer}
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

  /**
   * Pop an impact sprite in with a scale-up, then settle smaller while fading out, with an optional
   * ADD-blend flash on arrival that cools to NORMAL.
   * @param {PIXI.Container} container   The impact sprite container (its child mesh is named "mesh").
   * @param {number} start              Timeline position (ms) at which the impact arrives.
   * @param {number} hold               On-screen duration (ms) from arrival to fully faded.
   * @param {object} [options]
   * @param {number} [options.scaleStart=0.5]     Arrival scale multiplier, grown to 1.0 over the fade-in.
   * @param {number} [options.scaleSettle=0.9]    Scale settled to over the remaining hold while fading out.
   * @param {boolean} [options.flash=true]        Flash ADD blend on arrival before cooling to NORMAL.
   * @param {number} [options.flashDuration=150]  Duration (ms) of the ADD-blend flash.
   */
  _animateImpactSprite(container, start, hold, {scaleStart=0.5, scaleSettle=0.9, flash=true, flashDuration=150}={}) {
    if ( !container || (hold <= 0) ) return;
    const rise = Math.min(hold / 10, 120); // Quick arrival pop; the rest is a gradual settle + fade-out
    const settle = hold - rise;

    // Fade in on arrival, then fade out gradually across the whole settle window (alongside the scale)
    this.timeline.add(container, {alpha: {from: 0, to: 1, duration: rise}}, start)
      .add(container, {alpha: {from: 1, to: 0, duration: settle}}, start + rise);

    // Pop up to full size on arrival, then ease down to the settle scale over the same window
    container.scale.set(scaleStart);
    this.timeline.add(container.scale, {x: {from: scaleStart, to: 1}, y: {from: scaleStart, to: 1}, duration: rise},
      start)
      .add(container.scale, {x: {to: scaleSettle}, y: {to: scaleSettle}, duration: settle}, start + rise);

    // Flash ADD blend on arrival, then cool to NORMAL
    const mesh = flash ? container.getChildByName?.("mesh") : null;
    if ( mesh ) {
      this.timeline.call(() => mesh.blendMode = PIXI.BLEND_MODES.ADD, start);
      this.timeline.call(() => mesh.blendMode = PIXI.BLEND_MODES.NORMAL, start + flashDuration);
    }
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
