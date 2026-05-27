import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {ArrayField, BooleanField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for a ray attack: a directional beam fired along a line from a source point.
 * Incorporates three sequential animation phases, mirroring {@link CrucibleProjectileComponent}:
 * - Charge-up (at the source)
 * - Delivery (the beam travelling out along its line)
 * - Impact (applied per target, staggered by when the beam front reaches each target)
 * Each phase carries this-bound animations and particle behaviors selected by registry name, so the
 * specific look of any one ray (frost beam, lightning arc, ...) is chosen via those animations, not
 * hardcoded here.
 *
 * Design notes / decisions (revisit):
 * - The phase-dispatch helpers (#attachAnimations / #attachParticles / #scheduleSound / material config)
 *   are duplicated from CrucibleProjectileComponent. They are identical in spirit and SHOULD be hoisted
 *   to the CrucibleVFXComponent base so both components share one implementation. Kept local here to
 *   avoid destabilizing the committed projectile component while prototyping.
 * - Multi-target impacts are recorded authoritatively in `this.state.impacts` (one entry per target with
 *   its own destination/mesh/result/timings). Dispatch reuses the shared impact animations by also setting
 *   transient per-target pointers on `this.state` immediately before each synchronous dispatch. Any
 *   animation that reads `this.state` at frame time (e.g. a recoil) must capture its target in `setup`
 *   from the relevant impact entry for this to be multi-target-safe (see impactRecoilAnimation).
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleRayComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleRay";

  /**
   * Struck-token meshes, indexed parallel to `targets`, injected by finalizeVFX (for impacts that
   * displace the target). Rays that do not displace targets can ignore this.
   * @type {(PIXI.DisplayObject|null)[]}
   */
  _targetMeshes = [];

  /**
   * A resolved move-polygon mask injected by finalizeVFX; applied to particle layers flagged `mask`
   * (the beam) so the ray cannot visibly cross walls. Null when unmasked.
   * @type {PointSourcePolygon|null}
   */
  _beamMask = null;

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const self = CrucibleRayComponent;
    const point = () => new foundry.canvas.vfx.fields.VFXReferenceObjectField(new SchemaField({
      x: new NumberField({required: true, nullable: false}),
      y: new NumberField({required: true, nullable: false}),
      elevation: new NumberField({required: true, nullable: false, initial: 0}),
      sort: new NumberField({nullable: false, initial: 0}),
      sortLayer: new NumberField({nullable: false, initial: SL.TOKENS})
    }));
    return {
      ...super.defineSchema(),

      // The beam source, its heading (radians), and its reach (px) define the line the ray travels.
      origin: point(),
      rotation: new NumberField({required: true, nullable: false, initial: 0}),
      length: new NumberField({required: true, nullable: false, initial: 0}),

      // Charging the ray before it fires
      charge: new SchemaField({
        duration: new NumberField({required: true, nullable: false, initial: 700}),
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      }),

      // The beam delivery itself. `speed` (px/sec) sets how fast the beam front travels, which drives
      // per-target impact timing; `duration` is how long the beam persists/emits.
      delivery: new SchemaField({
        speed: new NumberField({required: true, nullable: false, initial: 2500}),
        duration: new NumberField({required: true, nullable: false, initial: 2000}),
        sound: self.#soundField(),
        animations: self.#animationsField(),
        particles: new ArrayField(self.#particleField())
      }),

      // Per-target impact templates. The beam picks `hit` or `miss` per target based on its attack result,
      // so a struck target and a resisting target can show distinct visuals and sounds.
      impact: new SchemaField({
        hit: self.#impactTemplateField(),
        miss: self.#impactTemplateField()
      }),

      // Targets struck by the ray; each impacted at a staggered time by its distance from the origin
      targets: new ArrayField(point()),

      // Per-target metadata index-aligned with `targets`: the attack result (RESULT_TYPES) and token id.
      targetData: new ArrayField(new SchemaField({
        result: new NumberField({required: false, nullable: true, initial: null}),
        id: new StringField({required: false, blank: true})
      }))
    };
  }

  /* -------------------------------------------- */

  /** Timeline animators referenced by a phase: registered names + params. @returns {ArrayField} */
  static #animationsField() {
    return new ArrayField(new SchemaField({
      function: new StringField({required: true, blank: false}),
      params: new ObjectField({required: false})
    }));
  }

  /* -------------------------------------------- */

  /** One impact variant (hit or miss): its sound, sprite animations, and particle layers. @returns {SchemaField} */
  static #impactTemplateField() {
    return new SchemaField({
      sound: CrucibleRayComponent.#soundField(),
      animations: CrucibleRayComponent.#animationsField(),
      particles: new ArrayField(CrucibleRayComponent.#particleField())
    });
  }

  /* -------------------------------------------- */

  /** A nullable per-phase positional sound cue; `radius` is per-sound. @returns {SchemaField} */
  static #soundField() {
    return new SchemaField({
      src: new StringField({required: true, blank: false}),
      align: new NumberField({required: true, nullable: false,
        initial: foundry.canvas.vfx.constants.SOUND_ALIGNMENT.START}),
      volume: new foundry.data.fields.AlphaField(),
      radius: new NumberField({required: true, nullable: false, initial: 30}),
      loop: new BooleanField({initial: false}),
      fade: new NumberField({required: true, nullable: false, initial: 0}),
      offset: new NumberField({required: true, nullable: false, initial: 0}),
      release: new NumberField({required: true, nullable: false, initial: 0})
    }, {required: false, nullable: true, initial: null});
  }

  /* -------------------------------------------- */

  /** A single particle generator layer. @returns {SchemaField} */
  static #particleField() {
    return new SchemaField({
      animation: new StringField({required: true, blank: false}),
      anchor: new StringField({required: true, blank: false, initial: "origin",
        choices: ["origin", "end", "target"]}),
      textures: new ArrayField(new StringField({required: true, blank: false})),
      offset: new NumberField({required: true, nullable: false, initial: 0}),
      duration: new NumberField({nullable: true, initial: null}),
      mask: new BooleanField({initial: false}),
      params: new ObjectField({required: false})
    });
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  async _load() {
    for ( const phase of [this.charge, this.delivery, this.impact.hit, this.impact.miss] ) {
      for ( const layer of phase.particles ) {
        for ( const texture of layer.textures ) this.assetPaths.add(texture);
      }
      for ( const anim of phase.animations ) {
        if ( anim.params?.texture ) this.assetPaths.add(anim.params.texture);
      }
      if ( phase.sound ) phase.sound.instance = await this._loadSound(phase.sound.src);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    const origin = this.origin;
    const dir = {x: Math.cos(this.rotation), y: Math.sin(this.rotation)};
    const end = {
      x: origin.x + (dir.x * this.length),
      y: origin.y + (dir.y * this.length),
      elevation: origin.elevation, sort: origin.sort, sortLayer: origin.sortLayer
    };

    // Phase timings: charge, then beam delivery. Impacts are scheduled per target within delivery.
    this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      deliveryStart: this.charge.duration,
      deliveryEnd: this.charge.duration + this.delivery.duration
    };

    // Shared state for phase animators
    this.state = {
      origin, end, rotation: this.rotation, length: this.length, direction: dir,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      // Authoritative per-target impact bookkeeping, keyed by target id (or index); populated below
      impacts: {},
      // Per-target impact context written here transiently before each target's synchronous dispatch
      destination: end, targetMesh: null,
      anchors: {origin, end, target: end}
    };

    // Charge phase (at the source)
    Object.assign(this.charge, {start: this.timings.chargeStart, end: this.timings.chargeEnd});
    this.#attachAnimations(this.charge);
    this.#scheduleSound(this.charge, origin);
    this.#attachParticles(this.charge);

    // Delivery phase (the beam travelling out along its line)
    Object.assign(this.delivery,
      {start: this.timings.deliveryStart, end: this.timings.deliveryEnd, duration: this.delivery.duration});
    this.#attachAnimations(this.delivery);
    this.#scheduleSound(this.delivery, origin);
    this.#attachParticles(this.delivery);

    // Impact phase, staggered per target by the beam-front arrival time
    this.#attachImpacts();
    this.timeline.label("end", this.timings.deliveryEnd);
  }

  /* -------------------------------------------- */

  /**
   * Build the per-target impact record and dispatch each target's impact when the beam front reaches it.
   * Each target's hit/miss template is chosen from its attack result; the record (`this.state.impacts`)
   * is authoritative, while the transient `this.state` pointers are what the shared, this-bound impact
   * animations read at synchronous dispatch time.
   */
  #attachImpacts() {
    const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
    const beamSpeed = this.delivery.speed * this.state.gridScale; // Matches the scaled beam particle speed
    this.targets.forEach((target, i) => {
      const data = this.targetData[i] ?? {};
      const isHit = (data.result === T.HIT) || (data.result === T.GLANCE);
      const template = isHit ? this.impact.hit : this.impact.miss;
      const dist = Math.hypot(target.x - this.origin.x, target.y - this.origin.y);
      const start = this.timings.deliveryStart + ((dist / beamSpeed) * 1000);
      const duration = Math.max(...template.animations.map(a => a.params?.duration ?? 0), 0);
      const key = data.id || String(i);

      const impact = {
        id: key, index: i, result: data.result, isHit,
        destination: target, mesh: this._targetMeshes[i] ?? null,
        start, end: start + duration, duration,
        anchors: {origin: this.state.anchors.origin, end: this.state.anchors.end, target, destination: target}
      };
      this.state.impacts[key] = impact;

      // Transient current-target context read synchronously by the shared impact animations
      this.state.destination = target;
      this.state.targetMesh = impact.mesh;
      this.state.anchors.target = target;
      this.state.anchors.destination = target;

      const phase = {...template, start, end: impact.end, duration};
      this.#attachAnimations(phase);
      this.#scheduleSound(phase, target);
      this.#attachParticles(phase);
    });
  }

  /* -------------------------------------------- */
  /*  Phase Dispatch (mirror of CrucibleProjectileComponent; candidate to hoist to the base)  */
  /* -------------------------------------------- */

  /**
   * Setup, schedule, animate, and register-teardown for a phase's registered animations.
   * @param {object} phase   The phase config (charge/delivery/impact), carrying start/duration markers.
   */
  #attachAnimations(phase) {
    for ( const entry of phase.animations ) {
      const animation = this.#animationEntry(entry.function);
      if ( !animation ) continue;
      // Clone per dispatch: impact templates are shared across targets, but animations write per-target
      // scratch (recoil base/target/direction) into params, which must not collide between targets.
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
   * Spawn each particle layer of a phase, merging the behavior's contribution over the component-owned
   * material config; honors optional `schedule` and `tearDown` behavior hooks.
   * @param {object} phase   The phase config, carrying start/duration markers.
   */
  #attachParticles(phase) {
    for ( const layer of phase.particles ) {
      const behavior = this.#animationEntry(layer.animation);
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
          lifetime: this.#normalizeLifetime(params.lifetime ?? 1000),
          alpha: params.alpha ? [params.alpha.min, params.alpha.max] : [1, 1],
          scale: params.scale ? [params.scale.min * gridScale, params.scale.max * gridScale] : [gridScale, gridScale],
          elevation: params.elevation ?? 0, sort: params.sort ?? 0,
          duration: layer.duration ?? phase.duration,
          pointSourceMask: layer.mask ? (this._beamMask ?? null) : null,
          ...behavior.setup.call(this, phase, layer)
        };
        const generator = this._spawnGenerator(config, phase.start + layer.offset);
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
   * Schedule the phase's loaded sound (if any) at a focal point, aligned within the phase window.
   * @param {object} phase                       The phase config (carrying `sound.instance` and timing).
   * @param {{x: number, y: number}} origin      Positional origin for playback.
   */
  #scheduleSound(phase, origin) {
    const config = phase.sound;
    if ( !config?.instance ) return;
    this._scheduleSound(config.instance, origin, {position: phase.start, duration: phase.duration,
      align: config.align, radius: config.radius, volume: config.volume ?? 1, loop: config.loop, fade: config.fade,
      offset: config.offset, release: config.release});
  }

  /* -------------------------------------------- */

  /**
   * Read a registered animation/behavior; warn if missing.
   * @param {string} name   Registry key in CONFIG.Canvas.vfx.animations.
   * @returns {object|undefined}
   */
  #animationEntry(name) {
    const entry = CONFIG.Canvas.vfx.animations[name];
    if ( !entry ) console.warn(`Crucible VFX: animation "${name}" is not registered.`);
    return entry;
  }

  /* -------------------------------------------- */

  /**
   * Normalize a lifetime to a {min, max} range in ms.
   * @param {number|{min: number, max: number}} lifetime   A scalar or pre-formed range.
   * @returns {{min: number, max: number}}
   */
  #normalizeLifetime(lifetime) {
    if ( (typeof lifetime === "object") && (lifetime !== null) ) return lifetime;
    return {min: Math.round(lifetime * 0.85), max: lifetime};
  }
}
