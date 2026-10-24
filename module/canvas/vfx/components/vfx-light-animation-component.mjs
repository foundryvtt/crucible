import VFXResolvedReferenceField from "../fields/vfx-resolved-reference-field.mjs";

/**
 * @import {VFXBasePathPoint} from "@client/canvas/vfx/_types.mjs";
 * @import VFXPath from "@client/canvas/vfx/vfx-path.mjs";
 */

const {ArrayField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * @typedef CrucibleLightAnimationState
 * @property {{moveTo: (point: Point) => void, update: (data: object) => void}} light  The animated light source
 * @property {VFXPath|null} path      The path along which the light may travel
 * @property {number} duration        The duration of the component's animations in milliseconds
 */

/**
 * A VFX component which animates a light source, either the rendered source of an existing AmbientLight or an
 * ephemeral source which the component creates and destroys. Light documents are never modified.
 * Animations are registered VFXComponentAnimation entries which act upon the light through the component state.
 * @extends {foundry.canvas.vfx.VFXComponent}
 */
export default class CrucibleLightAnimationComponent extends foundry.canvas.vfx.VFXComponent {

  /** @override */
  static TYPE = "crucibleLightAnimation";

  /**
   * The light source being animated.
   * @type {foundry.canvas.sources.PointLightSource|null}
   */
  #source = null;

  /**
   * Was the animated source created by this component rather than borrowed from an AmbientLight?
   * @type {boolean}
   */
  #ephemeral = false;

  /**
   * Tear-down callbacks of the component's animations, invoked when playback stops.
   * @type {Function[]}
   */
  #tearDowns = [];

  /** @inheritDoc */
  static defineSchema() {
    const {VFXReferenceObjectField} = foundry.canvas.vfx.fields;
    return {
      ...super.defineSchema(),
      light: new VFXResolvedReferenceField(),
      config: new ObjectField({required: false, nullable: true, initial: null}),
      path: new ArrayField(new VFXReferenceObjectField(new SchemaField({
        x: new NumberField({required: true, nullable: false}),
        y: new NumberField({required: true, nullable: false}),
        elevation: new NumberField({required: true, nullable: false, initial: 0})
      }))),
      pathType: new SchemaField({
        type: new StringField({required: true, blank: false, initial: "linear"}),
        params: new ObjectField({required: false})
      }),
      speed: new NumberField({required: true, nullable: false, positive: true, initial: 30}),
      duration: new NumberField({required: false, nullable: true, positive: true, initial: null}),
      animations: new ArrayField(new SchemaField({
        function: new StringField({required: true, blank: false}),
        params: new ObjectField({required: false})
      }))
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    const [origin] = this.path;
    if ( !origin || !this.#acquireSource(origin) ) return;
    this.#moveTo(origin);

    // Prepare the shared animation state; a path paces the animations unless an explicit duration is given
    const {VFXPath} = foundry.canvas.vfx;
    const path = (this.path.length > 1) ? VFXPath.create(this.pathType.type, this.path, this.pathType.params) : null;
    const travel = path ? Math.round((path.pathLength / canvas.dimensions.distancePixels / this.speed) * 1000) : 0;
    const duration = this.duration ?? travel;
    const state = {
      light: {moveTo: point => this.#moveTo(point), update: data => this.#update(data)},
      path,
      duration
    };
    if ( duration ) this.#attachAnimations(state);
    this.timeline.label("end", duration);
  }

  /* -------------------------------------------- */

  /** @override */
  async _stop() {
    for ( const tearDown of this.#tearDowns ) tearDown();
    this.#tearDowns.length = 0;
    if ( this.#ephemeral ) {
      this.#source?.destroy();
      canvas.perception.update({refreshLighting: true, refreshVision: true});
    }
    else this.light?.object?.initializeLightSource();
    this.#source = null;
  }

  /* -------------------------------------------- */

  /**
   * Borrow the source of the referenced AmbientLight, or create an ephemeral source from the light config.
   * @param {VFXBasePathPoint} origin   The point at which an ephemeral source begins
   * @returns {boolean}                 Whether a source is available to animate
   */
  #acquireSource(origin) {
    if ( this.light ) {
      this.#source = this.light.object?.lightSource ?? null;
      return !!this.#source;
    }
    if ( !this.config ) return false;
    const {x, y, elevation} = origin;
    const level = canvas.inferLevelFromElevation(elevation)?.id;
    this.#source = new CONFIG.Canvas.lightSourceClass({sourceId: `crucible.vfx.light.${foundry.utils.randomID()}`});
    this.#source.initialize({...this.config, x, y, elevation, level});
    this.#source.add();
    this.#ephemeral = true;
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Schedule each registered animation across the component's duration.
   * @param {CrucibleLightAnimationState} state   The shared animation state
   */
  #attachAnimations(state) {
    for ( const entry of this.animations ) {
      const animation = CONFIG.Canvas.vfx.animations[entry.function];
      if ( !animation ) {
        console.warn(`Crucible | Unknown light animation "${entry.function}"`);
        continue;
      }
      const params = {...(entry.params ?? {})};
      animation.setup?.call(this, state, params);
      if ( animation.animate ) {
        const progress = {t: 0};
        this.timeline.add(progress, {t: {from: 0, to: 1}, duration: state.duration, ease: "linear",
          onRender: () => animation.animate.call(this, progress.t, state, params)}, 0);
      }
      if ( animation.tearDown ) this.#tearDowns.push(() => animation.tearDown.call(this, state, params));
    }
  }

  /* -------------------------------------------- */

  /**
   * Move the animated source to a canvas position.
   * @param {Point} point     The canvas position of the source
   */
  #moveTo({x, y}) {
    this.#update({x, y});
  }

  /* -------------------------------------------- */

  /**
   * Reconfigure the animated source with partial light source data and refresh perception.
   * @param {object} data     Partial light source data
   */
  #update(data) {
    if ( !this.#source || this.light?.object?.destroyed ) return;
    this.#source.initialize(data);
    canvas.perception.update({refreshLighting: true, refreshVision: true});
  }
}
