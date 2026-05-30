import CrucibleVFXComponent from "./vfx-component.mjs";
import {getParticleScaleFactor} from "../blocks.mjs";
const {EmbeddedDataField, NumberField} = foundry.data.fields;

/**
 * A Crucible VFX component for an action that uses the "fan" target type.
 * @extends {CrucibleVFXComponent}
 */
export default class CrucibleFanComponent extends CrucibleVFXComponent {

  /** @override */
  static TYPE = "crucibleFan";

  /* -------------------------------------------- */
  /*  Component Schema                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    schema.shape = new EmbeddedDataField(foundry.data.ConeShapeData, {required: true, nullable: false});
    schema.casterRadiusPx = new NumberField({required: true, nullable: false, initial: 50, min: 1});
    schema.delivery.extendFields({
      duration: new NumberField({required: true, nullable: false, initial: 400})
    });
    return schema;
  }

  /* -------------------------------------------- */
  /*  Component Lifecycle                         */
  /* -------------------------------------------- */

  /** @override */
  _configureState() {
    const {x, y, radius} = this.shape;
    const origin = {x, y};
    const rotation = Math.toRadians(this.shape.rotation);
    const coneAngle = Math.toRadians(this.shape.angle);
    const halfAngle = coneAngle / 2;
    const source = this.originMesh ? {x: this.originMesh.x, y: this.originMesh.y} : origin;
    const forwardDist = (this.casterRadiusPx * 2) / 3;
    const forward = {x: origin.x + (Math.cos(rotation) * forwardDist),
      y: origin.y + (Math.sin(rotation) * forwardDist)};
    this.state = {
      origin, source, forward, rotation, coneAngle, halfAngle, radius,
      gridScale: getParticleScaleFactor(),
      charge: this.charge, delivery: this.delivery,
      destination: origin, targetMesh: null,
      deliveryArea: {type: "cone", x, y, radius, angle: this.shape.angle, rotation: this.shape.rotation,
        curvature: "round", gridBased: false},
      anchors: {origin, source, forward, target: origin}
    };
  }

  /* -------------------------------------------- */

  /**
   * Choose a deterministic sweep direction for a fan: start at the side of the closer outermost target
   * and sweep toward the farther. Falls back to clockwise when there are 0 or 1 targets in-cone, or when
   * both sides are equidistant. Pure utility, invoked at configure-time by the gesture configurator.
   * @param {CrucibleSpellAction} action
   * @param {{x: number, y: number}} origin
   * @param {number} rotRad
   * @param {number} halfAngleRad
   * @returns {{startAngleRad: number, endAngleRad: number}}
   */
  static pickSweepDirection(action, origin, rotRad, halfAngleRad) {
    const gridSize = canvas.dimensions.size;
    let leftmost = null;
    let rightmost = null;
    for ( const [actor, group] of action.eventsByTarget ) {
      if ( !group.hasRoll ) continue;
      const token = action.targets.get(actor)?.token;
      if ( !token ) continue;
      const cx = token.x + ((token.width * gridSize) / 2);
      const cy = token.y + ((token.height * gridSize) / 2);
      const dist = Math.hypot(cx - origin.x, cy - origin.y);
      let delta = Math.atan2(cy - origin.y, cx - origin.x) - rotRad;
      while ( delta > Math.PI ) delta -= Math.PI * 2;
      while ( delta < -Math.PI ) delta += Math.PI * 2;
      if ( Math.abs(delta) > halfAngleRad ) continue;
      if ( (delta < 0) && ((leftmost === null) || (delta < leftmost.delta)) ) leftmost = {delta, dist};
      if ( (delta > 0) && ((rightmost === null) || (delta > rightmost.delta)) ) rightmost = {delta, dist};
    }
    let sweepCW;
    if ( leftmost && rightmost ) sweepCW = (leftmost.dist <= rightmost.dist);
    else if ( leftmost ) sweepCW = true;
    else if ( rightmost ) sweepCW = false;
    else sweepCW = true;
    return {
      startAngleRad: sweepCW ? (rotRad - halfAngleRad) : (rotRad + halfAngleRad),
      endAngleRad: sweepCW ? (rotRad + halfAngleRad) : (rotRad - halfAngleRad)
    };
  }
}
