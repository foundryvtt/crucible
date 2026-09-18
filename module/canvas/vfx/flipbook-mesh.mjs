/**
 * A sprite mesh which displays one frame at a time from an ordered sequence of textures.
 * @extends {foundry.canvas.primary.PrimarySpriteMesh}
 */
export default class CrucibleFlipbookMesh extends foundry.canvas.primary.PrimarySpriteMesh {
  /**
   * @param {PIXI.Texture[]} frames   The frame textures in play order, sharing one untrimmed size.
   * @param {object} [options]
   * @param {boolean} [options.frameAnchors=false]   Adopt the default anchor of each frame as it is shown.
   */
  constructor(frames, {frameAnchors=false}={}) {
    super(frames[0]);
    this.frames = frames;
    this.frameAnchors = frameAnchors;

    // A texture swap preserves the displayed size only while every frame shares one untrimmed size
    const {width, height} = frames[0].orig;
    if ( frames.some(f => (f.orig.width !== width) || (f.orig.height !== height)) ) {
      console.warn("Crucible VFX: flipbook frames differ in size and will not stay aligned.");
    }
  }

  /**
   * The ways a flipbook may advance through its frames.
   * - ONCE: every frame in order, spread evenly across the duration.
   * - LOOP: every frame in order at a frame rate, repeating.
   * - SHUFFLE: a random different frame at a frame rate.
   * - SUSTAIN: the first frame once, the middle frames cycling at about a frame rate, then the last frame once.
   * @enum {string}
   */
  static MODES = Object.freeze({ONCE: "once", LOOP: "loop", SHUFFLE: "shuffle", SUSTAIN: "sustain"});

  /**
   * The frame textures in play order.
   * @type {PIXI.Texture[]}
   */
  frames;

  /**
   * Adopt the default anchor of each frame as it is shown.
   * @type {boolean}
   */
  frameAnchors;

  /**
   * The index of the frame currently displayed.
   * @type {number}
   */
  get frame() {
    return this.#frame;
  }

  set frame(index) {
    index = Math.clamp(Math.trunc(index), 0, this.frames.length - 1);
    if ( (index === this.#frame) || this.destroyed ) return;
    this.#frame = index;
    const texture = this.frames[index];
    this.texture = texture;
    if ( this.frameAnchors ) this.anchor.copyFrom(texture.defaultAnchor);
  }

  #frame = 0;

  /* -------------------------------------------- */

  /**
   * Schedule the frame changes of this flipbook onto a timeline.
   * @param {object} timeline            The animejs timeline which keeps time for the flipbook.
   * @param {object} options
   * @param {number} options.duration    Milliseconds the flipbook plays for.
   * @param {number} [options.start=0]   Timeline position in milliseconds at which play begins.
   * @param {string} [options.mode]      A value in {@link CrucibleFlipbookMesh.MODES}, once by default.
   * @param {number} [options.fps=16]    Frames per second of the loop, shuffle, and sustain modes.
   */
  animate(timeline, {duration, start=0, mode=CrucibleFlipbookMesh.MODES.ONCE, fps=16}) {
    const {ONCE, LOOP, SUSTAIN} = CrucibleFlipbookMesh.MODES;
    const count = this.frames.length;
    if ( (count < 2) || !(duration > 0) ) return;

    // A flipbook with no middle frames has nothing to sustain
    if ( (mode === SUSTAIN) && (count < 3) ) mode = ONCE;

    // Sustain divides the duration into whole slots near the frame rate, never fewer than its first, a middle, and
    // its last frame, so the last frame always closes the duration however short that is
    const slots = (mode === SUSTAIN) ? Math.max(3, Math.round((duration * fps) / 1000)) : count;
    const interval = ((mode === ONCE) || (mode === SUSTAIN)) ? (duration / slots) : (1000 / fps);
    const clock = {ms: 0};
    let lastStep = -1;
    timeline.add(clock, {
      ms: {from: 0, to: duration}, duration, ease: "linear",
      onRender: () => {
        const step = Math.floor(clock.ms / interval);
        if ( step === lastStep ) return;
        lastStep = step;
        if ( mode === ONCE ) this.frame = step;
        else if ( mode === LOOP ) this.frame = step % count;
        else if ( mode === SUSTAIN ) {
          if ( step < 1 ) this.frame = 0;
          else if ( step >= (slots - 1) ) this.frame = count - 1;
          else this.frame = 1 + ((step - 1) % (count - 2));
        }
        else this.frame = (this.frame + 1 + Math.floor(Math.random() * (count - 1))) % count;
      }
    }, start);
  }
}
