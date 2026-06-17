import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for an action that uses the "touch" gesture: a small charge gathered at the
 * caster's hand discharged into a single adjacent target on contact. No projectile flight or region shape.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleTouchComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleTouch";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    schema.casterRadiusPx = new NumberField({required: true, nullable: false, initial: 50, min: 1});
    schema.delivery.extendFields({
      duration: new NumberField({required: true, nullable: false, initial: 100})
    });
    return schema;
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  _configureState() {
    const SL = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS;
    const casterElevation = this.originMesh?.elevation ?? 0;
    const casterSort = this.originMesh?.sort ?? 0;
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : {x: 0, y: 0};
    const origin = {x: source.x, y: source.y, elevation: casterElevation, sort: casterSort, sortLayer: SL.TOKENS};
    const targetMesh = this.targetMeshes[0] ?? null;
    const target = targetMesh ? {x: targetMesh.x, y: targetMesh.y} : source;

    // Points along the caster->target vector at caster elevation: the outstretched hand one caster radius
    // ahead, and the palm halfway to it where the charge gathers (close to the caster, not out in the gap)
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / dist;
    const uy = dy / dist;
    const above = {elevation: casterElevation + 1, sort: casterSort + 1, sortLayer: SL.TOKENS};
    const forward = {x: source.x + (ux * this.casterRadiusPx), y: source.y + (uy * this.casterRadiusPx), ...above};
    const palm = {x: source.x + (ux * (this.casterRadiusPx / 2)),
      y: source.y + (uy * (this.casterRadiusPx / 2)), ...above};
    this.state = {
      origin, source, forward, palm,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: target, targetMesh,
      anchors: {origin, source, forward, palm, target, destination: target}
    };
  }

  /* -------------------------------------------- */

  /**
   * Lift the impact strike point one sort step so the impact-burst sprite renders above the target token.
   * @inheritDoc
   */
  _impactTarget(impact, i) {
    const target = super._impactTarget(impact, i);
    return {...target, sort: (target.sort ?? 0) + 1};
  }
}
