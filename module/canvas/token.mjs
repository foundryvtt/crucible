export default class CrucibleTokenObject extends Token {

  /**
   * @typedef {Object} CrucibleTokenEngagement
   * @property {Set<Token>} allies      Allied tokens which are adjacent
   * @property {Set<Token>} enemies     Enemy tokens which are adjacent
   */

  /**
   * Current engagement status for the Token.
   * @type {CrucibleTokenEngagement}
   */
  engagement = {
    allies: new Set(),
    enemies: new Set()
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _draw() {
    await super._draw();
    this.engagement = this.#computeEngagement();
  }

  /* -------------------------------------------- */
  /*  Engagement and Flanking                     */
  /* -------------------------------------------- */

  /**
   * Compute the rectangular area which represents a "hit" against this Token.
   * @returns {Rectangle}
   */
  getHitRectangle() {
    const s = canvas.scene.dimensions.size;
    return this.bounds.pad(-s/4);
  }

  /* -------------------------------------------- */

  /**
   * Compute the rectangular area of engagement for the token on a square grid.
   * @param {number} distance
   * @returns {Rectangle}
   */
  getEngagementRectangle(distance=1) {
    const s = canvas.scene.dimensions.size * distance;
    const [x0, y0] = canvas.grid.getTopLeft(this.document.x, this.document.y);
    const {w, h} = this;
    return new PIXI.Rectangle(x0 - s, y0 - s, w + (2 * s), h + (2 * s));
  }

  /* -------------------------------------------- */

  /**
   * Update the flanking status of the Token.
   * @returns {CrucibleTokenEngagement}
   */
  #computeEngagement() {
    if ( this.actor?.isIncapacitated || this.actor?.isBroken ) return {allies: new Set(), enemies: new Set()};

    // Get grid-appropriate bounds and polygon
    const {engagementBounds, movePolygon} = canvas.grid.isHex
      ? this.#computeEngagementHexGrid()
      : this.#computeEngagementSquareGrid();

    // Identify opposed tokens in the bounds
    const {ally, enemy} = this.#getDispositions();
    const enemies = new Set();
    const allies = new Set();
    canvas.tokens.quadtree.getObjects(engagementBounds, {
      collisionTest: ({t: token}) => {
        if ( token.id === this.id ) return false; // Ignore yourself
        if ( token.actor?.isBroken || token.actor?.isIncapacitated ) return false;

        // Identify friend or foe
        let targetSet;
        if ( enemy.includes(token.document.disposition) ) targetSet = enemies;
        else if ( ally.includes(token.document.disposition) ) targetSet = allies;
        if ( !targetSet ) return false;

        // Confirm collision against the hit rectangle
        const hit = token.getHitRectangle();
        const ix = movePolygon.intersectRectangle(hit); // TODO do something more efficient in the future
        if (ix.points.length > 0) {
          targetSet.add(token);
          return true;
        }
      }
    });

    // Debug visualize enemies
    if ( CONFIG.debug.flanking ) {
      canvas.controls.debug.beginFill(0xFF0000, 1.0);
      for ( const enemy of enemies ) {
        const c = enemy.center;
        canvas.controls.debug.drawCircle(c.x, c.y, canvas.dimensions.size / 6);
      }
      canvas.controls.debug.beginFill(0x00FF00, 1.0);
      for ( const ally of allies ) {
        const c = ally.center;
        canvas.controls.debug.drawCircle(c.x, c.y, canvas.dimensions.size / 6);
      }
      canvas.controls.debug.endFill();
    }
    return {allies, enemies};
  }

  /* -------------------------------------------- */

  /**
   * Compute the bounds and eligible polygon for flanking on a square grid.
   * @returns {{engagementBounds: PIXI.Rectangle, movePolygon: PointSourcePolygon}}
   */
  #computeEngagementSquareGrid() {
    const c = this.center;
    const engagementBounds = this.getEngagementRectangle();
    const movePolygon = ClockwiseSweepPolygon.create(c, {
      type: "move",
      boundaryShapes: [engagementBounds],
      debug: CONFIG.debug.flanking
    });
    return {engagementBounds, movePolygon};
  }

  /* -------------------------------------------- */

  /**
   * Compute the bounds and eligible polygon for flanking on a hexagonal grid.
   * @returns {{engagementBounds: Rectangle, movePolygon: PointSourcePolygon}}
   */
  #computeEngagementHexGrid() {
    throw new Error("Not yet implemented");
  }

  /* -------------------------------------------- */

  /**
   * Classify Token dispositions into allied and enemy groups.
   * @returns {{ally: number[], enemy: number[]}}
   */
  #getDispositions() {
    const D = CONST.TOKEN_DISPOSITIONS;
    switch ( this.document.disposition ) {
      case D.SECRET:
        return {ally: [], enemy: []}
      case D.HOSTILE:
        return {ally: [D.HOSTILE], enemy: [D.NEUTRAL, D.FRIENDLY]}
      case D.NEUTRAL:
        return {ally: [D.NEUTRAL, D.FRIENDLY], enemy: [D.HOSTILE]}
      case D.FRIENDLY:
        return {ally: [D.NEUTRAL, D.FRIENDLY], enemy: [D.HOSTILE]}
    }
  }

  /* -------------------------------------------- */

  /**
   * Update flanking conditions for all actors affected by a Token change.
   * @param {object} [options]
   * @param {boolean} [options.commit]      Commit flanking changes by enacting active effect changes
   * @param {CrucibleTokenEngagement} [options.engagement] Pre-computed engagement data for the token
   */
  updateFlanking({commit, engagement}={}) {
    engagement ||= this.#computeEngagement();
    const toUpdate = this.#applyFlankingUpdates(this.engagement, engagement);
    this.engagement = engagement; // Save the new state
    if ( !commit ) return;

    // Update other Actors
    for ( const token of toUpdate ) {
      token.actor.commitFlanking(token.engagement);
    }

    // Update our own actor
    if ( this.actor ) this.actor.commitFlanking(this.engagement);
  }

  /* -------------------------------------------- */

  /** @override */
  _getShiftedPosition(dx, dy) {
    const {x, y, width, height} = this.document;
    const distance = Math.min(width, height, 5);

    // Get target offset
    const start = this.center;
    const o = canvas.grid.getOffset(start);
    if ( dx < 0 ) o.j -= distance;
    else if ( dx > 0 ) o.j += distance;
    if ( dy < 0 ) o.i -= distance;
    else if ( dy > 0 ) o.i += distance;

    // Test collision center-to-center
    const targetCenter = canvas.grid.getCenterPoint(o);
    const collides = CONFIG.Canvas.polygonBackends.move.testCollision(start, targetCenter, {
      type: "move",
      mode: "any"
    });
    if ( collides ) return {x, y};

    // Get top-left
    o.j -= Math.floor(width / 2);
    o.i -= Math.floor(height / 2);
    return canvas.grid.getTopLeftPoint(o);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    const engagement = this.engagement; // New engagement
    this.engagement = {allies: new Set(), enemies: new Set()}; // "Prior" engagement
    this.updateFlanking({engagement, commit});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(data, options, userId) {

    // Token movement speed
    const positionChange = ("x" in data) || ("y" in data);
    if ( positionChange ) {
      options.animation ||= {};
      options.animation.movementSpeed = this.actor.system.movement.stride * 4;
    }

    // Standard Token update workflow
    super._onUpdate(data, options, userId);

    // Flanking Updates
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    const flankingChange = ["x", "y", "width", "height", "disposition", "actorId", "actorLink"].some(k => k in data);
    if ( flankingChange ) this.updateFlanking({commit});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);

    // Apply flanking updates
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    const newEngagement = {allies: new Set(), enemies: new Set()};
    const toUpdate = this.#applyFlankingUpdates(this.engagement, newEngagement);
    if ( commit ) {
      for ( const token of toUpdate ) token.actor.commitFlanking(token.engagement);
    }
    this.engagement = newEngagement;
  }

  /* -------------------------------------------- */

  /**
   * Process flanking updates applying them symmetrically to other affected tokens
   * @param {CrucibleTokenEngagement} oldEngagement   Prior engagement for this Token
   * @param {CrucibleTokenEngagement} newEngagement   New engagement for this Token
   * @returns {Set<CrucibleTokenObject>}              The set of Tokens whose flanking status changed
   */
  #applyFlankingUpdates(oldEngagement, newEngagement) {
    const updated = new Set();

    // Prior engaged allies
    for ( const ally of oldEngagement.allies ) {
      updated.add(ally);
      if ( newEngagement.allies.has(ally) ) continue;
      ally.engagement.allies.delete(this);
    }

    // Prior engaged enemies
    for ( const enemy of oldEngagement.enemies ) {
      updated.add(enemy);
      if ( newEngagement.enemies.has(enemy) ) continue;
      enemy.engagement.enemies.delete(this);
    }

    // New engaged allies
    for ( const ally of newEngagement.allies ) {
      updated.add(ally);
      if ( oldEngagement.allies.has(ally) ) continue;
      ally.engagement.allies.add(this);
    }

    // New engaged enemies
    for ( const enemy of newEngagement.enemies ) {
      updated.add(enemy);
      if ( oldEngagement.enemies.has(enemy) ) continue;
      enemy.engagement.enemies.add(this);
    }

    // Return actors which were updated
    return updated;
  }
}
