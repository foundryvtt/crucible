import VFXResolvedReferenceField from "../fields/vfx-resolved-reference-field.mjs";
import {scheduleTimelineClock, tokenCenter} from "../helpers.mjs";

const {ArrayField, NumberField, SchemaField} = foundry.data.fields;

/**
 * One turn of an acting token toward the subject of an attack.
 * @typedef FacingTurnData
 * @property {number} time          Component-timeline milliseconds at which the turn begins
 * @property {number} rotation      Mesh rotation in radians faced at the end of the turn
 * @property {number} duration      Milliseconds the turn takes
 */

/**
 * A VFX component which turns an acting token to face each subject of its attack in sequence, then returns it to
 * rest. Display only: it sets the mesh's facing, to which other animations may add a twist.
 * @extends {foundry.canvas.vfx.VFXComponent}
 */
export default class CrucibleFacingComponent extends foundry.canvas.vfx.VFXComponent {

  /** @override */
  static TYPE = "crucibleFacing";

  /**
   * Turn timing: milliseconds per quarter turn, the cap on that multiple, and the smallest angle worth turning.
   * @type {{quarterTurn: number, maxQuarters: number, minAngle: number}}
   */
  static TURN = {quarterTurn: 220, maxQuarters: 1.5, minAngle: Math.toRadians(10)};

  /**
   * Token mesh rotations driven by VFX, split into a facing and a twist so the two never overwrite each other.
   * @type {WeakMap<PrimarySpriteMesh, {rest: number, facing: number, twist: number}>}
   */
  static #rotations = new WeakMap();

  /** @inheritDoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      mesh: new VFXResolvedReferenceField(),
      turns: new ArrayField(new SchemaField({
        time: new NumberField({required: true, nullable: false, initial: 0, min: 0}),
        rotation: new NumberField({required: true, nullable: false, initial: 0}),
        duration: new NumberField({required: true, nullable: false, initial: 0, min: 0})
      })),
      release: new NumberField({required: true, nullable: false, initial: 0, min: 0}),
      hold: new NumberField({required: true, nullable: false, initial: 250, min: 0}), // Follow-through after release
      recover: new NumberField({required: true, nullable: false, initial: 300, min: 0})
    };
  }

  /* -------------------------------------------- */
  /*  Configuration                               */
  /* -------------------------------------------- */

  /**
   * The point an area attack aims at: along the direction of a self-anchored cone or line, or the center of a
   * placed circle. Null for areas centered on the actor itself.
   * @param {TokenDocument} token         The acting token
   * @param {RegionDocument|null} region  The attack's region
   * @returns {{x: number, y: number}|null}
   */
  static getAreaAim(token, region) {
    const shape = region?.shapes[0];
    if ( !shape ) return null;
    switch ( shape.type ) {
      case "cone":
      case "line": {
        const {x, y} = tokenCenter(token);
        const rotation = Math.toRadians(shape.rotation);
        return {x: x + Math.cos(rotation), y: y + Math.sin(rotation)};
      }
      case "circle": return {x: shape.x, y: shape.y};
      default: return null;
    }
  }

  /* -------------------------------------------- */

  /**
   * Milliseconds a token takes to turn through an angle, or 0 when the angle is too small to be worth turning.
   * @param {number} angle    Radians turned
   * @returns {number}
   */
  static getTurnDuration(angle) {
    const {quarterTurn, maxQuarters, minAngle} = this.TURN;
    angle = Math.abs(angle);
    if ( angle < minAngle ) return 0;
    return Math.round(quarterTurn * Math.min(angle / (Math.PI / 2), maxQuarters));
  }

  /* -------------------------------------------- */
  /*  Playback                                    */
  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    const mesh = this.mesh;
    const first = this.turns[0];
    if ( !mesh || !first ) return;
    const returnAt = this.release + this.hold;
    const end = returnAt + this.recover;
    const io = t => ((t < 0.5) ? (2 * t * t) : (1 - (Math.pow((-2 * t) + 2, 2) / 2)));
    const progress = (t, from, duration) => io(Math.clamp((t - from) / Math.max(duration, 1), 0, 1));

    // Each turn eases from the prior facing, which is held through the follow-through and then eases back to rest
    scheduleTimelineClock(this.timeline, first.time, end - first.time, ms => {
      if ( mesh.destroyed || (ms <= 0) ) return; // Timeline init renders at 0 before the component begins
      const t = first.time + ms;
      const {rest} = CrucibleFacingComponent.getMeshRotation(mesh);
      let facing = rest;
      for ( const turn of this.turns ) {
        if ( t < turn.time ) break;
        facing = Math.mix(facing, turn.rotation, progress(t, turn.time, turn.duration));
      }
      if ( t > returnAt ) facing = Math.mix(facing, rest, progress(t, returnAt, this.recover));
      CrucibleFacingComponent.setMeshRotation(mesh, {facing});
    });
    this.timeline.label("end", end);
  }

  /* -------------------------------------------- */

  /** @override */
  async _stop() {
    if ( this.mesh ) CrucibleFacingComponent.restoreMeshRotation(this.mesh);
  }

  /* -------------------------------------------- */
  /*  Mesh Rotation                               */
  /* -------------------------------------------- */

  /**
   * The VFX-driven rotation of a token mesh, capturing its resting rotation when first driven.
   * @param {PrimarySpriteMesh} mesh
   * @returns {{rest: number, facing: number, twist: number}}
   */
  static getMeshRotation(mesh) {
    let rotation = this.#rotations.get(mesh);
    if ( !rotation ) this.#rotations.set(mesh, rotation = {rest: mesh.rotation, facing: mesh.rotation, twist: 0});
    return rotation;
  }

  /* -------------------------------------------- */

  /**
   * Return a token mesh to its resting rotation and stop tracking it.
   * @param {PrimarySpriteMesh} mesh
   */
  static restoreMeshRotation(mesh) {
    const rotation = this.#rotations.get(mesh);
    if ( !rotation ) return;
    this.#rotations.delete(mesh);
    if ( !mesh.destroyed ) mesh.rotation = rotation.rest;
  }

  /* -------------------------------------------- */

  /**
   * Update the facing or twist of a token mesh and rotate the mesh to their sum.
   * @param {PrimarySpriteMesh} mesh
   * @param {{facing?: number, twist?: number}} changes
   */
  static setMeshRotation(mesh, changes) {
    const rotation = Object.assign(this.getMeshRotation(mesh), changes);
    mesh.rotation = rotation.facing + rotation.twist;
  }
}

/* -------------------------------------------- */

/**
 * The turns of an acting token through one attack, which also schedules the attack's beats: each beat turns toward its
 * subject once the prior beat has released, and the token returns to rest after the last delivery.
 */
export class CrucibleFacingPlan {
  /**
   * @param {TokenDocument|null} token    The acting token, or null to schedule beats without turning
   */
  constructor(token) {
    this.token = token;
  }

  /**
   * The planned turns.
   * @type {FacingTurnData[]}
   */
  turns = [];

  /**
   * Effect-timeline milliseconds at which the next beat may begin turning.
   * @type {number}
   */
  next = 0;

  /**
   * Effect-timeline milliseconds at which the token returns to rest.
   * @type {number}
   */
  release = 0;

  /* -------------------------------------------- */

  /**
   * Add a facing component which plays the planned turns, if any.
   * @param {Record<string, object>} components   The effect's components, mutated in place
   * @param {object[]} timeline                    The effect's timeline, mutated in place
   */
  apply(components, timeline) {
    if ( !this.turns.length ) return;
    const type = CrucibleFacingComponent.TYPE;
    components.facing = {type, mesh: {reference: "tokenMesh"}, turns: this.turns, release: this.release};
    timeline.unshift({component: "facing", position: 0});
  }

  /* -------------------------------------------- */

  /**
   * Record a beat's delivery, which allows the next beat once released and holds the facing until it ends.
   * @param {number} start          Effect-timeline milliseconds at which the beat began
   * @param {object} timing
   * @param {number} timing.release Beat-relative milliseconds after which the next beat may begin
   * @param {number} timing.end     Beat-relative milliseconds at which the beat's delivery ends
   */
  deliver(start, {release, end}) {
    this.next = Math.max(this.next, start + release);
    this.release = Math.max(this.release, start + end);
  }

  /* -------------------------------------------- */

  /**
   * Turn toward a point once the prior beat allows, continuing from the prior planned turn.
   * @param {{x: number, y: number}} point    The point to face
   * @returns {number}                        Effect-timeline milliseconds at which the new beat begins
   */
  turnToward(point) {
    const time = this.next;
    const token = this.token;
    if ( !token || token.lockRotation ) return time;
    const from = this.turns.at(-1)?.rotation ?? Math.toRadians(token.rotation);
    const {x, y} = tokenCenter(token);
    const turned = Math.normalizeRadians(Math.atan2(point.y - y, point.x - x) - (Math.PI / 2) - from);
    const duration = CrucibleFacingComponent.getTurnDuration(turned);
    if ( duration ) this.turns.push({time, rotation: from + turned, duration});
    return time + duration;
  }
}
