export default class CrucibleTokenObject extends Token {

  /**
   * Track the set of enemy tokens which are currently engaged.
   * @type {Set<Token>}
   */
  engaged = new Set();

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _draw() {
    await super._draw();
    this.engaged = this.#computeEngagement();
  }

  /* -------------------------------------------- */
  /*  Engagement and Flanking                     */
  /* -------------------------------------------- */

  /**
   * Update the flanking status of the Token.
   */
  #computeEngagement() {
    if ( this.actor?.isIncapacitated ) return new Set();

    // Get grid-appropriate bounds and polygon
    const {engagementBounds, movePolygon} = canvas.grid.isHex
      ? this.#computeEngagementHexGrid()
      : this.#computeEngagementSquareGrid();

    // Identify opposed tokens in the bounds
    const {ally, enemy} = this.#getDispositions();
    const enemies = canvas.tokens.quadtree.getObjects(engagementBounds, {
      collisionTest: ({t: token}) => {
        if ( token.id === this.id ) return false; // Ignore yourself
        if ( token.actor.isIncapacitated ) return false; // Ignore incapacitated
        if ( !enemy.includes(token.document.disposition) ) return false; // Only worry about enemies
        const c = token.center;
        return movePolygon.contains(c.x, c.y);
      }
    });

    // Debug visualize enemies
    if ( CONFIG.debug.flanking ) {
      canvas.controls.debug.beginFill(0xFF0000, 1.0);
      for ( const enemy of enemies ) {
        const c = enemy.center;
        canvas.controls.debug.drawCircle(c.x, c.y, canvas.dimensions.size / 6);
      }
    }
    return enemies;
  }

  /* -------------------------------------------- */

  /**
   * Compute the bounds and eligible polygon for flanking on a square grid.
   * @returns {{engagementBounds: PIXI.Rectangle, movePolygon: PointSourcePolygon}}
   */
  #computeEngagementSquareGrid() {
    const c = this.center;
    const s = canvas.scene.dimensions.size;

    // Compute a rectangle for the engagement bounds
    const [x0, y0] = canvas.grid.getTopLeft(c.x, c.y);
    const engagementBounds = new PIXI.Rectangle(x0 - s, y0 - s, 3 * s, 3 * s);
    engagementBounds.pad(1); // Epsilon in pixels to ensure that collinear walls are matched

    // Compute a movement polygon which excludes impassible walls
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
   * @param {Set<Token>} [options.enemies]  An explicitly provided set of engaged enemies
   */
  #updateFlanking({commit, enemies}={}) {
    enemies ||= this.#computeEngagement();

    // Iterate over prior engaged
    for ( const token of this.engaged ) {
      if ( enemies.has(token) ) continue; // No change
      this.engaged.delete(token);
      token.engaged.delete(this);
      if ( commit && token.actor ) token.actor.updateFlanking(token.engaged);
    }

    // Add new engaged
    for ( const token of enemies ) {
      if ( this.engaged.has(token) ) continue; // No change
      this.engaged.add(token);
      token.engaged.add(this);
      if ( commit && token.actor ) token.actor.updateFlanking(token.engaged);
    }

    // Update our own flanking status
    if ( commit && this.actor ) this.actor.updateFlanking(this.engaged);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    const enemies = this.engaged;
    this.engaged = new Set();
    this.#updateFlanking({enemies, commit});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    this.#updateFlanking({commit});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    for ( const token of this.engaged ) {
      token.engaged.delete(this);
      if ( commit ) token.actor.updateFlanking(token.engaged);
    }
    this.engaged.clear();
  }
}
