/**
 * @import Token from "@client/canvas/placeables/token.mjs";
 * @import ClockwiseSweepPolygon from "@client/canvas/geometry/clockwise-sweep.mjs";
 * @import {ClockwiseSweepPolygonConfig} from "@client/canvas/geometry/_types.mjs";
 */

/**
 * @typedef CrucibleMovementPolygonConfig
 * @property {boolean} [tokenCollision]    Is token collision enforced?
 * @property {Token} [excludeToken]        An acting token who should be excluded from collision tests
 */

/**
 * A {@link ClockwiseSweepPolygon} that injects nearby token footprints as ephemeral
 * movement-blocking edges, stopping movement short of other creatures. Requires the Crucible microgrid.
 * @extends {ClockwiseSweepPolygon<ClockwiseSweepPolygonConfig & CrucibleMovementPolygonConfig>}
 */
export default class CrucibleMovementPolygon extends foundry.canvas.geometry.ClockwiseSweepPolygon {

  /** @inheritDoc */
  initialize(origin, config) {
    super.initialize(origin, config);
    if ( this.config.type !== "move" ) {
      throw new Error(`CrucibleMovementPolygon only supports the "move" type, not "${this.config.type}".`);
    }
    if ( !this.level?.parent?.useMicrogrid ) {
      throw new Error("CrucibleMovementPolygon requires a Scene using the Crucible microgrid.");
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _identifyEdges() {
    super._identifyEdges(); // Wall edges
    if ( !this.config.tokenCollision ) return;
    const mover = this.config.excludeToken ?? this.config.source?.object;
    if ( !mover ) return;
    for ( const edge of this.#buildTokenEdges(mover) ) this.edges.add(edge);
  }

  /* -------------------------------------------- */

  /**
   * Build ephemeral movement-blocking edges from the footprints of tokens overlapping this polygon.
   * @param {Token} mover     The moving token, excluded from collision and used as the blocking vertical volume
   * @returns {foundry.canvas.geometry.edges.Edge[]}
   */
  #buildTokenEdges(mover) {
    const Edge = foundry.canvas.geometry.edges.Edge;
    const distance = canvas.grid.distance;
    const moverDoc = mover.document;
    const moverBottom = moverDoc.elevation;
    const moverTop = moverDoc.elevation + (moverDoc.depth * distance);
    const levelId = moverDoc._source.level;

    // Helper function to determine whether a token is an active blocker
    const isBlocker = token => {
      if ( (token === mover) || !token.actor || token.actor.system.isDead ) return false;
      if ( token.movementAnimationPromise ) return false; // A token mid-movement-animation is not a collider
      if ( token.document._source.level !== levelId ) return false;
      if ( (token.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) && !game.user.isGM ) return false;
      const bottom = token.document.elevation;
      const top = bottom + (token.document.depth * distance);
      return (moverBottom < top) && (bottom < moverTop);
    };

    // Identify blocking tokens and add temporary movement-blocking edges for them
    const edges = [];
    const collisionTest = ({t}) => isBlocker(t);
    const candidates = canvas.tokens.quadtree.getObjects(this.config.boundingBox, {collisionTest});
    for ( const token of candidates ) {
      const corners = token.document.getGridSpacePolygon();
      if ( !corners ) continue;
      const {x: ox, y: oy} = token.document;
      const baseId = `crucible.tokencollision.${token.id}`;
      for ( let i = 0; i < corners.length; i++ ) {
        const next = corners[(i + 1) % corners.length];
        const a = {x: ox + corners[i].x, y: oy + corners[i].y};
        const b = {x: ox + next.x, y: oy + next.y};
        edges.push(new Edge(a, b, {id: `${baseId}.${i}`, type: "wall", move: CONST.EDGE_SENSE_TYPES.NORMAL}));
      }
    }
    return edges;
  }
}
