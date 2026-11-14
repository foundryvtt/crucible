import CrucibleVFXComponent from "./vfx-component.mjs";
import CrucibleFlipbookMesh from "../flipbook-mesh.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
import {getVFXFlipbook} from "../sprites.mjs";
const {BooleanField, ColorField, NumberField, SchemaField, StringField} = foundry.data.fields;

/**
 * The melee strike delivery fields of a {@link CrucibleMeleeStrikeComponent}.
 * @typedef MeleeStrikeDeliveryData
 * @property {string} texture           The strike flipbook path, shown at its authored scale
 * @property {number} fps               Flipbook frame rate, which sets the delivery duration
 * @property {number} impactAt          Fraction of the delivery at which the strike connects
 * @property {Color} tint               Tint applied to the white strike art
 * @property {boolean} mirror           Flip the art across the attack line
 * @property {{forward: number, lateral: number}} offset   Origin offset in caster radii along and across the
 *                                                          attack line; positive lateral is the attacker's right
 */

/**
 * A Crucible VFX component for a melee weapon strike: an anchored flipbook delivered from beside the attacker
 * toward a single target.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleMeleeStrikeComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleMeleeStrike";

  /**
   * Milliseconds over which the strike sprite fades once its flipbook has played.
   * @type {number}
   */
  static FADE_DURATION = 120;

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    schema.casterRadiusPx = new NumberField({required: true, nullable: false, initial: 50, min: 1});
    schema.destination = CrucibleMeleeStrikeComponent._pointField();
    schema.delivery.extendFields({
      texture: new StringField({required: true, blank: false}),
      fps: new NumberField({required: true, nullable: false, initial: 16, positive: true}),
      impactAt: new NumberField({required: true, nullable: false, initial: 0.75, min: 0, max: 1}),
      tint: new ColorField({nullable: false, initial: "#ffffff"}),
      mirror: new BooleanField({initial: false}),
      offset: new SchemaField({
        forward: new NumberField({required: true, nullable: false, initial: 0}),
        lateral: new NumberField({required: true, nullable: false, initial: 0})
      })
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
    const frames = getVFXFlipbook(this.delivery.texture)?.length ?? 1;
    const duration = (frames * 1000) / this.delivery.fps;
    const deliveryStart = this.charge.duration;
    this.timings = {
      chargeStart: 0,
      chargeEnd: deliveryStart,
      deliveryStart,
      deliveryEnd: deliveryStart + duration,
      impactStart: deliveryStart + (duration * this.delivery.impactAt)
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _configureState() {
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : this.destination;
    const destination = this.destination;

    // Attack line from the attacker's center toward the strike point, which places the strike origin
    const ax = destination.x - source.x;
    const ay = destination.y - source.y;
    const attackDist = Math.max(1, Math.hypot(ax, ay));
    const attack = {x: ax / attackDist, y: ay / attackDist};

    // Strike origin offset along the attack line and toward the attacker's right, drawn above both tokens and above
    // the impacts which sit one sort above the target
    const {forward, lateral} = this.delivery.offset;
    const r = this.casterRadiusPx;
    const origin = {
      x: source.x + (attack.x * forward * r) - (attack.y * lateral * r),
      y: source.y + (attack.y * forward * r) + (attack.x * lateral * r),
      elevation: this.originMesh?.elevation ?? 0,
      sort: Math.max(this.originMesh?.sort ?? 0, (this.targetMeshes[0]?.sort ?? 0) + 1) + 1,
      sortLayer: SL.TOKENS
    };

    // The strike travels from its offset origin through the strike point
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const direction = {x: dx / dist, y: dy / dist};

    // Strike sprite on its atlas anchor at authored scale, turned onto the attack line
    const gridScale = getParticleScaleFactor();
    const {texture, tint, mirror} = this.delivery;
    const container = this.addManagedDisplayObject(this._createSprite(texture, null, origin, {useTextureAnchor: true}));
    container.rotation = Math.atan2(direction.y, direction.x);
    const mesh = container.getChildByName("mesh");
    if ( mesh ) {
      mesh.tint = Number(tint);
      mesh.scale.set(gridScale, mirror ? -gridScale : gridScale);
    }
    this.delivery.container = container;

    // Configure animation state
    this.state = {
      origin, source, destination, direction,
      casterRadiusPx: r,
      gridScale,
      charge: this.charge,
      delivery: this.delivery,
      targetMesh: this.targetMeshes[0] ?? null,
      anchors: {origin, source, destination, target: destination, delivery: container}
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawDelivery() {
    super._drawDelivery();
    const {container, start, duration} = this.delivery;
    const mesh = container.getChildByName("mesh");
    if ( mesh instanceof CrucibleFlipbookMesh ) {
      mesh.animate(this.timeline, {start, duration, mode: CrucibleFlipbookMesh.MODES.ONCE});
    }
    const fade = this.constructor.FADE_DURATION;
    this.timeline.add(container, {alpha: {to: 0, duration: fade}}, this.timings.deliveryEnd);
  }

  /* -------------------------------------------- */

  /**
   * Strike the destination one sort above the target token on the token layer, beneath the strike sprite.
   * @override
   */
  _impactTarget(_impact, i) {
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const mesh = this.targetMeshes[i];
    const {x, y, elevation, sort} = this.state.destination;
    if ( !mesh ) return {x, y, elevation, sort, sortLayer: SL.TOKENS};
    return {x, y, elevation: mesh.elevation ?? 0, sort: (mesh.sort ?? 0) + 1, sortLayer: SL.TOKENS};
  }
}
