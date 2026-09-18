import CrucibleVFXComponent from "./vfx-component.mjs";
import CrucibleFlipbookMesh from "../flipbook-mesh.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
import {getVFXFlipbook} from "../sprites.mjs";
const {ArrayField, BooleanField, NumberField, ObjectField, SchemaField, StringField} = foundry.data.fields;

/**
 * A Crucible VFX component for an action that uses the "single" target type and transacts a single projectile.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleProjectileComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleProjectile";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();

    // Projectile trajectory as a VFXPath
    Object.assign(schema, {
      path: new ArrayField(CrucibleProjectileComponent._pointField(), {required: true, min: 2}),
      pathType: new SchemaField({
        type: new StringField({required: true, blank: false, initial: "linear"}),
        params: new ObjectField({required: false})
      })
    });

    // Extended fields for projectile delivery
    schema.delivery.extendFields({
      texture: new StringField({required: true, blank: false}),
      size: new NumberField({required: true, nullable: false, initial: 3}),
      speed: new NumberField({required: true, nullable: false, initial: 150}),
      fps: new NumberField({nullable: true, initial: null}),
      textureAnchor: new BooleanField({initial: false}),
      blend: new NumberField({required: true, nullable: false, initial: PIXI.BLEND_MODES.NORMAL})
    });

    // Extended fields for projectile impact
    schema.impacts.element.extendFields({
      stick: new NumberField({required: true, nullable: false, initial: 0})
    });
    return schema;
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _load() {
    this.assetPaths.add(this.delivery.texture);
    await super._load();
  }

  /* -------------------------------------------- */

  /** @override */
  _configureTimings() {
    this._origin = this.path[0];
    this._destination = this.path.at(-1);
    const {size, x, y} = CrucibleProjectileComponent.computeLaunch(this._origin, this._destination, this.delivery);
    this._spriteSize = size;
    this._launch = {...this._origin, x, y};
    this._flightPath = foundry.canvas.vfx.VFXPath.create(this.pathType.type, [this._launch, ...this.path.slice(1)],
      this.pathType.params);
    const distancePixels = canvas.dimensions.distancePixels;
    const flightMS = (this._flightPath.pathLength * 1000) / (this.delivery.speed * distancePixels);
    this.timings = {
      chargeStart: 0,
      chargeEnd: this.charge.duration,
      deliveryStart: this.charge.duration,
      deliveryEnd: this.charge.duration + flightMS,
      impactStart: this.charge.duration + flightMS
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _configureState() {
    const origin = this._origin;
    this.delivery.container = this.addManagedDisplayObject(this._createSprite(this.delivery.texture,
      this._spriteSize, this._launch, {useTextureAnchor: this.delivery.textureAnchor, blend: this.delivery.blend}));
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;
    this.state = {
      origin,
      source,
      destination: this._destination,
      flightPath: this._flightPath,
      lastPathIndex: 0,
      gridScale: getParticleScaleFactor(),
      charge: this.charge,
      delivery: this.delivery,
      targetMesh: this.targetMeshes[0] ?? null,
      anchors: {origin, destination: this._destination, delivery: this.delivery.container, source}
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawDelivery() {
    super._drawDelivery();
    const mesh = this.delivery.container.getChildByName("mesh");
    if ( mesh instanceof CrucibleFlipbookMesh ) {
      const {start, duration, fps} = this.delivery;
      const {ONCE, SUSTAIN} = CrucibleFlipbookMesh.MODES;
      mesh.animate(this.timeline, fps ? {start, duration, fps, mode: SUSTAIN} : {start, duration, mode: ONCE});
    }
    this.#animateProjectileExit(this.timings);
  }

  /* -------------------------------------------- */

  /** @override */
  _impactTarget(_impact, _i) {
    return this.state.destination;
  }

  /* -------------------------------------------- */

  /**
   * Fade the projectile sprite out at impact, lingering for the stick duration first when it sticks.
   * @param {object} timings   The computed phase timings.
   */
  #animateProjectileExit(timings) {
    const stick = this.impacts[0]?.stick ?? 0;
    const fadeStart = (stick > 0) ? (timings.impactStart + stick - 150) : timings.impactStart;
    this.timeline.add(this.delivery.container, {alpha: {to: 0, duration: 150}}, fadeStart);
  }

  /* -------------------------------------------- */

  /**
   * Compute where the flight of a projectile sprite begins relative to the origin of its path.
   * @param {{x: number, y: number}} origin        The first point of the projectile path.
   * @param {{x: number, y: number}} destination   The last point of the projectile path.
   * @param {object} delivery                      Delivery data of the projectile.
   * @param {string} delivery.texture              The sprite texture or flipbook path.
   * @param {number} delivery.size                 The configured sprite size in feet.
   * @param {boolean} delivery.textureAnchor       Whether the sprite rides the path on its own anchor.
   * @returns {{lead: number, size: number, x: number, y: number}}   Pixels of lead, feet of sprite size, launch point.
   */
  static computeLaunch(origin, destination, {texture, size, textureAnchor}) {
    const launch = {lead: 0, size, x: origin.x, y: origin.y};
    if ( !textureAnchor ) return launch;
    const frames = getVFXFlipbook(texture) ?? [foundry.canvas.getTexture(texture)];
    if ( !frames[0] ) return launch;
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const reach = Math.hypot(dx, dy);
    if ( !(reach > 0) ) return launch;

    // Art trails behind the anchor it rides on, so flight begins that far ahead and its rearmost art leaves the origin
    const {width, height} = frames[0].orig;
    const texelSize = (size * Math.min(width / height, 1) * canvas.dimensions.distancePixels) / width;
    let lead = Math.max((frames[0].defaultAnchor.x * width) - (frames[0].trim?.x ?? 0), 0) * texelSize;
    if ( !(lead > 0) ) return launch;

    // A near target leaves no room for the whole sprite, so it shrinks to keep some distance left to fly
    const maxLead = reach * 0.75;
    if ( lead > maxLead ) {
      launch.size = size * (maxLead / lead);
      lead = maxLead;
    }
    launch.lead = lead;
    launch.x += (dx / reach) * lead;
    launch.y += (dy / reach) * lead;
    return launch;
  }
}
