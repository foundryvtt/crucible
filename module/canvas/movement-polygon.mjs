/**
 * A movement-collision polygon for Crucible forced movement which can treat other tokens as obstacles.
 * @module canvas/movement-polygon
 */

/**
 * @import {default as Token} from "@client/canvas/placeables/token.mjs";
 * @import {default as CrucibleAction} from "@crucible/models/action.mjs";
 */

/**
 * A {@link foundry.canvas.geometry.ClockwiseSweepPolygon} that injects the footprints of nearby tokens as ephemeral
 * movement-blocking edges, so movement stops short of other creatures using the same walk-back logic that already
 * handles walls. Requires a Scene using the Crucible microgrid.
 */
export default class CrucibleMovementPolygon extends foundry.canvas.geometry.ClockwiseSweepPolygon {

  /**
   * The CrucibleAction whose movement is being planned for this test, or null if the movement is not the planned
   * movement of an action being configured. Sourced from the metadata of the active movement-planning context, scoped
   * to the moving token so it is never conflated with unrelated movement (keyboard, forced) by the same actor.
   * @type {CrucibleAction|null}
   */
  get crucibleAction() {
    const mover = this.config.excludeToken ?? this.config.source?.object;
    const ctx = canvas.tokens._movementPlanningContext;
    if ( !mover || (ctx?.object !== mover) ) return null;
    return ctx.metadata?.crucibleAction ?? null;
  }

  /* -------------------------------------------- */

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
    super._identifyEdges(); // Wall edges, unchanged
    const mover = this.config.excludeToken ?? this.config.source?.object;
    if ( !mover ) return;
    // An action may exempt its own planned movement from token collision regardless of the movement action used
    if ( this.crucibleAction?.usage.movement.ignoreTokens ) return;
    // Movement actions flagged tokenCollision:false (blink, displace, ...) phase through tokens
    if ( CONFIG.Token.movement.actions[this.#movementAction(mover)]?.tokenCollision === false ) return;
    // Token collision defaults to active only while the mover is in a tracked combat encounter; an explicit
    // config.tokenCollision boolean overrides that default.
    if ( !(this.config.tokenCollision ?? mover.inCombat) ) return;
    for ( const edge of this.#buildTokenEdges(mover) ) this.edges.add(edge);
  }

  /* -------------------------------------------- */

  /**
   * Resolve the movement action for this collision test: the per-segment action passed by core, else the planned
   * action from the active movement-planning context, else the mover's default movement action.
   * @param {Token} mover     The moving token
   * @returns {string|undefined}
   */
  #movementAction(mover) {
    if ( this.config.action ) return this.config.action;
    const ctx = canvas.tokens._movementPlanningContext;
    const planned = (ctx?.object === mover) ? ctx.allowedActions?.[0] : undefined;
    return planned ?? mover.document.movementAction;
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

    // A living, same-level creature other than the mover blocks if its vertical range overlaps the mover's volume.
    // Vertical range is half-open [bottom, top): bottom-inclusive, top-exclusive.
    const isBlocker = token => {
      if ( (token === mover) || !token.actor || token.actor.system.isDead ) return false;
      if ( token.movementAnimationPromise ) return false; // A token mid-movement-animation is not a collider
      if ( token.document._source.level !== levelId ) return false;
      if ( (token.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) && !game.user.isGM ) return false;
      const bottom = token.document.elevation;
      const top = bottom + (token.document.depth * distance);
      return (moverBottom < top) && (bottom < moverTop);
    };

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
