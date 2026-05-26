/**
 * @import {default as Token} from "@client/canvas/placeables/token.mjs";
 * @import {default as CrucibleAction} from "@crucible/models/action.mjs";
 */

/**
 * A {@link foundry.canvas.geometry.ClockwiseSweepPolygon} that injects nearby token footprints as ephemeral
 * movement-blocking edges, stopping movement short of other creatures. Requires the Crucible microgrid.
 */
export default class CrucibleMovementPolygon extends foundry.canvas.geometry.ClockwiseSweepPolygon {

  /**
   * Maps a planned movement id to the CrucibleAction actualizing it, for the second collision test at confirmation.
   * Set and deleted by {@link CrucibleAction} around `startMovement`.
   * @type {Map<string, CrucibleAction>}
   * @internal
   */
  static _movementActions = new Map();

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

    // Resolve Crucible collision inputs once, preferring any value the caller supplied explicitly
    const mover = this.config.excludeToken ?? this.config.source?.object;
    if ( !("crucibleAction" in this.config) ) {
      this.config.crucibleAction = this.#resolvePlanningAction(mover) ?? this.#resolveActualizingAction(mover);
    }
    this.config.action ??= this.#resolveMovementAction(mover);
    this.config.tokenCollision ??= mover?.inCombat ?? false;
  }

  /* -------------------------------------------- */

  /**
   * Recover the CrucibleAction whose interactive movement this test belongs to, from the open dialog planning it.
   * @param {Token} mover     The moving token
   * @returns {CrucibleAction|null}
   */
  #resolvePlanningAction(mover) {
    if ( !mover || (canvas.tokens._movementPlanningContext?.object !== mover) ) return null;
    for ( const dialog of crucible.api.dice.ActionUseDialog.instances() ) {
      if ( dialog.action?.token?.object === mover ) return dialog.action;
    }
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Recover the CrucibleAction actualizing this token's planned movement, registered during action confirmation.
   * @param {Token} mover     The moving token
   * @returns {CrucibleAction|null}
   */
  #resolveActualizingAction(mover) {
    const movementId = mover?.document.movement?.id;
    if ( !movementId ) return null;
    return CrucibleMovementPolygon._movementActions.get(movementId) ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Resolve the movement action: the planned action from the active planning context, else the mover's default.
   * @param {Token} mover     The moving token
   * @returns {string|undefined}
   */
  #resolveMovementAction(mover) {
    const ctx = canvas.tokens._movementPlanningContext;
    const planned = (ctx?.object === mover) ? ctx.allowedActions?.[0] : undefined;
    return planned ?? mover?.document.movementAction;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _identifyEdges() {
    super._identifyEdges(); // Wall edges
    const mover = this.config.excludeToken ?? this.config.source?.object;
    if ( !mover ) return;

    // The current CrucibleAction explicitly ignores token collision
    if ( this.config.crucibleAction?.usage.movement.ignoreTokens ) return;

    // The movement action bypasses token collision
    if ( CONFIG.Token.movement.actions[this.config.action]?.tokenCollision === false ) return;

    // Token collision must be enabled (defaulted from the mover's combat state at initialization)
    if ( !this.config.tokenCollision ) return;
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
