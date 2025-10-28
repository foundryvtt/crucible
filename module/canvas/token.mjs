import CrucibleHitBoxShader from "./grid/hit-box-shader.mjs";

export default class CrucibleTokenObject extends foundry.canvas.placeables.Token {

  /** @inheritDoc */
  static RENDER_FLAGS = Object.assign({}, super.RENDER_FLAGS, {
    refreshFlanking: {}
  });

  /**
   * Container to "store" some unused graphics in Crucible.
   * @type {PIXI.Container}
   */
  static #voidContainer = new PIXI.Container();

  /**
   * @typedef {Object} CrucibleTokenEngagement
   * @property {Set<Token>} allies      Allied tokens which are engaged
   * @property {Set<Token>} enemies     Enemy tokens which are engaged
   * @property {Set<Token>} other       Other tokens which are engaged
   * @property {PIXI.Rectangle} [engagementBounds] Your bounds of engagement
   * @property {PIXI.Polygon} [movePolygon] Your current movement polygon
   * @property {number} [flankers]      The number of enemy flankers
   * @property {number} [allyBonus]     The engagement bonus provided by adjacent allies
   * @property {number} [flanked]       The resulting flanked stage
   */

  /**
   * Current engagement status for the Token.
   * @type {CrucibleTokenEngagement}
   */
  engagement = this.#initializeEngagement();

  /**
   * Should the next flanking update be responsible for committing Active Effect changes?
   * @type {boolean}
   */
  #commitFlanking = false;

  /**
   * A Graphics object in the debug layer which displays engagement for this token.
   * @type {PIXI.Graphics}
   */
  #engagementDebug;

  /**
   * Cached hitbox data in screen-space coordinates.
   * Values are recomputed only when token, scene, or camera state changes.
   * @type {{
   *   abgr: number,                // Token disposition color in little endian
   *   hitboxCenterX: number,       // Screen-space center X
   *   hitboxCenterY: number,       // Screen-space center Y
   *   hitboxHalfWidth: number,     // Screen-space half width
   *   hitboxHalfHeight: number,    // Screen-space half height
   *   trLocalID: number,           // Transform local ID
   *   trParentID: number,          // Transform parent ID
   *   gridSize: number,            // Scene grid size
   *   sizeUnits: number,           // Actor movement size
   *   centerX: number,             // Token world center X
   *   centerY: number,             // Token world center Y
   *   abgr: number,                // Token disposition color in little endian
   *   colorRaw: number             // Raw RGBA color
   *   dashOffsetPx: number         // The hitbox offset for this token
   *   animationTypes: number       // A bitmask holding all the animation types active for this token
   * }}
   */
  #hbCache = {
    hitboxCenterX: 0,
    hitboxCenterY: 0,
    hitboxHalfWidth: 0,
    hitboxHalfHeight: 0,
    trLocalID: -1,
    trParentID: -1,
    gridSize: -1,
    sizeUnits: -1,
    centerX: NaN,
    centerY: NaN,
    abgr: 0,
    colorRaw: NaN,
    dashOffsetPx: 0,
    animationTypes: new foundry.utils.BitMask(CrucibleHitBoxShader.STATES)
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _draw(options){
    await super._draw(options);
    if ( !canvas.scene.useMicrogrid ) return;
    CrucibleTokenObject.#voidContainer.visible = false;
    CrucibleTokenObject.#voidContainer.addChild(this.border);
    CrucibleTokenObject.#voidContainer.addChild(this.targetArrows);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _applyRenderFlags(flags) {
    super._applyRenderFlags(flags);
    if ( flags.refreshFlanking ) this.#updateFlanking();
  }

  /* -------------------------------------------- */

  /** @override */
  _refreshBorder() {
    if ( !canvas.scene.useMicrogrid ) super._refreshBorder();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _refreshVisibility() {
    super._refreshVisibility();
    if ( !canvas.scene.useMicrogrid ) return;
    this.#hbCache.animationTypes.toggleState("controlled", this.controlled);
    this.#hbCache.animationTypes.toggleState("hovered", this.hover || this.layer.highlightObjects);
    if ( this.isVisible ) CrucibleTokenObject.visibleTokens.add(this);
    else CrucibleTokenObject.visibleTokens.delete(this);
  }

  /* -------------------------------------------- */

  /** @override */
  _refreshTarget() {
    if ( !canvas.scene.useMicrogrid ) return super._refreshTarget();
    this._drawTargetPips();
    const isTargetedByUser = (this.targeted.size > 0) && this.targeted.has(game.user);
    this.#hbCache.animationTypes.toggleState("targeted", isTargetedByUser);
  }

  /* -------------------------------------------- */

  /** @override */
  drawBars() {
    super.drawBars();
    if ( !this.actor || (this.document.displayBars === CONST.TOKEN_DISPLAY_MODES.NONE) ) return;
    this.#drawResources();
    if ( !this.bars.alphaFilter ) {
      this.bars.alphaFilter = new PIXI.AlphaFilter();
      this.bars.filters = [this.bars.alphaFilter];
    }
    this.bars.alphaFilter.alpha = 0.6;
  }

  /* -------------------------------------------- */

  /** @override */
  _drawBar(number, bar, data) {
    const val = Number(data.value);
    const pct = Math.clamp(val, 0, data.max) / data.max;
    const p = 8;

    // Determine sizing
    const {width, height} = this.document.getSize();
    const bw = width - (p * 2);
    const bh = number === 0 ? 10 : 8;
    const bs = 1;

    // Determine the color to use
    const colors = number === 0 ? SYSTEM.RESOURCES.health.color : SYSTEM.RESOURCES.morale.color;
    const color = colors.low.mix(colors.high, pct);

    // Draw bar
    bar.clear();
    bar.lineStyle(bs, 0x000000, 1.0);
    bar.beginFill(0x000000, 0.5).drawRect(0, 0, bw, bh, 3);
    bar.beginFill(color, 1.0).drawRect(0, 0, pct * bw, bh, 2);

    // Set position
    const posY = (height - p) - (number === 0 ? 10 : 18);
    bar.position.set(p, posY);
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Draw resource pips as part of the token bars.
   */
  #drawResources() {
    if ( !["hero", "adversary"].includes(this.actor?.type) ) return;
    if ( !this.bars.resources ) {
      this.bars.resources = this.bars.addChild(new PIXI.Graphics());
      this.bars.resources.position.set(0, 0);
    }
    const p = 8;
    const r = this.bars.resources;
    r.clear();
    const {action, focus} = this.actor.system.resources;
    const {width, height} = this.document.getSize();

    // Action Pips
    const ac = SYSTEM.RESOURCES.action.color;
    r.beginFill(ac, 1.0).lineStyle({color: 0x000000, width: 1});
    for ( let i=0; i<action.value; i++ ) {
      r.drawCircle((2 * p) + (i * 10), height - p - 10, 3);
    }
    r.endFill();

    // Focus Pips
    const fc = SYSTEM.RESOURCES.focus.color;
    r.beginFill(fc, 1.0).lineStyle({color: 0x000000, width: 1});
    for ( let i=0; i<focus.value; i++ ) {
      r.drawCircle(width - (2 * p) - (i * 10), height - p - 18, 3);
    }
    r.endFill();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onControl(options) {
    super._onControl(options);
    if ( CONFIG.debug.flanking ) this._visualizeEngagement(this.engagement);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRelease(options) {
    super._onRelease(options);
    this._clearEngagementVisualization();
  }

  /* -------------------------------------------- */
  /*  Movement                                    */
  /* -------------------------------------------- */

  /** @override */
  _getMovementCostFunction(options) {
    const calculateTerrainCost = CONFIG.Token.movement.TerrainData.getMovementCostFunction(this.document, options);
    const actionCostFunctions = {};
    const actor = this.actor;
    return (from, to, distance, segment) => {

      // Step 1: Apply condition-based cost modifiers
      if ( actor ) {
        const statuses = actor.statuses;
        if ( statuses.has("slowed") ) distance *= 2;
        if ( statuses.has("prone") ) distance *= 2;
        if ( statuses.has("hastened") ) distance /= 2;
        if ( statuses.has("restrained") ) distance = Infinity;
      }

      // Step 2: Apply difficult terrain
      const terrainCost = calculateTerrainCost(from, to, distance, segment);

      // Step 3: Apply movement action
      const calculateActionCost = actionCostFunctions[segment.action]
        ??= segment.actionConfig.getCostFunction(this.document, options);
      return calculateActionCost(terrainCost, from, to, distance, segment);
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _getAnimationMovementSpeed(options) {
    return this.actor ? this.actor.system.movement.stride * 2 : CONFIG.Token.movement.defaultSpeed;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _modifyAnimationMovementSpeed(speed, options={}) {
    speed = super._modifyAnimationMovementSpeed(speed, options);
    
    // TODO this can be removed in V14
    if ( foundry.utils.isNewerVersion("14.351", game.release.version) ) {
      const actionConfig = CONFIG.Token.movement.actions[options.action];
      return speed * (actionConfig.speedMultiplier ?? 1);
    }

    return speed;
  }

  /* -------------------------------------------- */

  /** @override */
  _getShiftedPosition(dx, dy, dz) {
    if ( !canvas.scene.useMicrogrid ) return super._getShiftedPosition(dx, dy, dz);
    const initial = {...this.getSnappedPosition(), elevation: this.document.elevation};
    const offset = canvas.grid.getOffset(initial);
    const size = this.actor?.size || this.width;
    offset.i += (size * Math.sign(dy));
    offset.j += (size * Math.sign(dx));
    offset.k += (size * Math.sign(dz));
    return canvas.grid.getTopLeftPoint(offset);
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
    const p0 = canvas.grid.getTopLeftPoint(this.document._source); // Non-animated?
    const {w, h} = this;
    return new PIXI.Rectangle(p0.x - s, p0.y - s, w + (2 * s), h + (2 * s));
  }

  /* -------------------------------------------- */

  /**
   * Compute the current engagement of a Token.
   * This does not update Flanking stage, which is handled later by CrucibleTokenObject.computeFlanking.
   * @returns {CrucibleTokenEngagement}
   */
  #computeEngagement() {
    const enemies = new Set();
    const allies = new Set();
    const other = new Set();
    if ( !canvas.scene.useMicrogrid || !this.actor || this.isPreview ) {
      return {allies, enemies, other};
    }

    // Prepare engagement data
    const {ally, enemy} = this.#getDispositions();
    const value = this.actor.system.movement.engagement;
    const {engagementBounds, movePolygon} = this.#computeEngagementSquareGrid();
    const engagement = {allies, enemies, other, engagementBounds, movePolygon, value};

    // Identify engaged tokens as allies or enemies
    const {elevation, size} = this.document;
    canvas.tokens.quadtree.getObjects(engagementBounds, {
      collisionTest: ({t: token}) => {
        if ( token.id === this.id ) return false; // Ignore yourself
        if ( !token.actor ) return false;         // Ignore non-actors

        // Require elevation overlap
        if ( (elevation + size) < token.document.elevation ) return false;
        if ( elevation > (token.document.elevation + token.document.size) ) return false;

        // Confirm the token can be reached
        const hit = token.getHitRectangle();
        const ix = movePolygon.intersectRectangle(hit); // TODO do something more efficient in the future
        if ( !ix.points.length ) return false;

        // Identify friend and foe
        if ( ally.includes(token.document.disposition) ) allies.add(token);
        else if ( enemy.includes(token.document.disposition) ) enemies.add(token);
        else other.add(token);
      }
    });
    return engagement;
  }

  /* -------------------------------------------- */

  #initializeEngagement() {
    return {allies: new Set(), enemies: new Set(), other: new Set()};
  }

  /* -------------------------------------------- */

  /**
   * Process engagement updates applying them symmetrically to other affected tokens.
   * @param {CrucibleTokenEngagement} oldEngagement   Prior engagement for this Token
   * @param {CrucibleTokenEngagement} newEngagement   New engagement for this Token
   * @returns {Set<CrucibleTokenObject>}              The set of Tokens whose flanking status changed
   */
  #propagateEngagementUpdates(oldEngagement, newEngagement) {
    const updates = new Set();
    for ( const s of ["allies", "enemies", "other"] ) {
      for ( const t of oldEngagement[s] ) {
        updates.add(t);
        t.engagement[s].delete(this);
      }
      for ( const t of newEngagement[s] ) {
        updates.add(t);
        t.engagement[s].add(this);
      }
    }
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Compute the bounds and eligible polygon for flanking on a square grid.
   * @returns {{engagementBounds: PIXI.Rectangle, movePolygon: PointSourcePolygon}}
   */
  #computeEngagementSquareGrid() {
    const c = this.center;
    const engagementBounds = this.getEngagementRectangle();
    const movePolygon = foundry.canvas.geometry.ClockwiseSweepPolygon.create(c, {
      type: "move",
      boundaryShapes: [engagementBounds]
    });
    return {engagementBounds, movePolygon};
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
   * Set the render flag to schedule a flanking refresh.
   */
  refreshFlanking(commit) {
    const activeGM = game.users.activeGM;
    commit ??= (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
    if ( commit ) this.#commitFlanking = true;
    this.renderFlags.set({refreshFlanking: true});
  }

  /* -------------------------------------------- */

  /**
   * Update flanking conditions for all actors affected by a Token change.
   */
  #updateFlanking() {
    if ( !this.actor || (this.actor.type === "group") ) return;

    // Step 1: Update engagement of this token
    const engagement = this.#computeEngagement();

    // Step 2: Update engagement of all engaged tokens
    const toUpdate = this.#propagateEngagementUpdates(this.engagement, engagement);

    // Step 3: Compute flanking of this token
    this.engagement = this.constructor.computeFlanking(engagement);

    // Step 4: Compute flanking stage of all engaged tokens
    for ( const t of toUpdate ) t.engagement = this.constructor.computeFlanking(t.engagement);

    // Debug visualize enemies
    this._visualizeEngagement(engagement);

    // Update other Actors
    if ( !this.#commitFlanking ) return;
    this.#commitFlanking = false;
    for ( const token of toUpdate ) {
      token.actor.commitFlanking(token.engagement);
    }

    // Update our own actor
    this.actor.commitFlanking(this.engagement);
  }

  /* -------------------------------------------- */

  /**
   * Compute the Flanked stage for a certain engagement state.
   * @param {CrucibleTokenEngagement} engagement      The current engagement
   * @returns {CrucibleTokenEngagement}               Updated engagement with computed flanking stage
   */
  static computeFlanking(engagement) {
    engagement.allyBonus = 0;

    // Count the number of enemies who can flank
    let flankers = 0;
    for ( const enemy of engagement.enemies ) {
      const {isBroken, isIncapacitated} = enemy.actor.system;
      if ( !(isBroken || isIncapacitated) ) flankers++;
    }
    engagement.flankers = flankers;

    // Determine the engagement bonus received from allies
    for ( const ally of engagement.allies ) {
      const {isBroken, isIncapacitated} = ally.actor.system;
      if ( isBroken || isIncapacitated ) continue;
      const mutual = ally.engagement.enemies.intersection(engagement.enemies);
      if ( !mutual.size ) continue;
      const allyEngage = ally?.actor.system.movement.engagement ?? 1;
      engagement.allyBonus += Math.min(allyEngage, mutual.size);
    }
    engagement.flanked = Math.max(engagement.flankers - engagement.allyBonus - engagement.value, 0);
    return engagement;
  }

  /* -------------------------------------------- */
  /*  Animated Hitbox                             */
  /* -------------------------------------------- */

  /**
   * The set of visible tokens.
   * @type {Set<CrucibleTokenObject>}
   */
  static visibleTokens = new Set();

  /* -------------------------------------------- */

  /**
   * Get the hitbox border color in little endian format
   * @returns {number}
   */
  getHitBoxBorderColor() {
    const colorRaw = this._getBorderColor();
    const cache = this.#hbCache;
    const same = (cache.colorRaw === colorRaw);
    if ( same ) return cache.abgr;

    // Convert disposition color to little endian
    const cr = (colorRaw >>> 0) || 0;
    const rgba = (cr <= 0xFFFFFF ? ((cr << 8) | 0xFF) : cr) >>> 0;

    // Save and return
    cache.abgr = (
      ((rgba & 0x000000FF) << 24) |
      ((rgba & 0x0000FF00) <<  8) |
      ((rgba & 0x00FF0000) >>> 8) |
      ((rgba & 0xFF000000) >>> 24)
    ) >>> 0;
    cache.colorRaw = colorRaw;
    return cache.abgr;
  }

  /* -------------------------------------------- */

  /**
   * Get the hit box data (which is updated lazily if necessary)
   * @returns {{abgr: number, hitboxCenterX: number, hitboxCenterY: number, hitboxHalfWidth: number, hitboxHalfHeight: number,
   * trLocalID: number, trParentID: number, gridSize: number, sizeUnits: number, centerX: number, centerY: number, colorRaw: number}}
   */
  getHitBoxData() {
    const stage = canvas?.stage;
    const grid = canvas?.grid;
    const cache = this.#hbCache;

    // Verify local ID and parent ID to know if the hitbox data must be recomputed
    const trLocalID = this.transform._localID;
    const trParentID = this.transform._parentID;
    const dirty = (trParentID !== cache.trParentID) || (trLocalID !== cache.trLocalID);
    if ( (dirty === false) || !stage || !grid ) return this.#hbCache;

    cache.gridSize = grid.size || 100;
    const s = cache.sizeUnits = this.actor?.system?.movement?.size ?? this.document?.width ?? 4;
    const uneven = (s % 2 > 0);

    const M = CONST.GRID_SNAPPING_MODES;
    const c = !this.animationContexts.size ? canvas.grid.getSnappedPoint(this.center, {
      mode: uneven ? M.CENTER : M.VERTEX,
      resolution: 1
    }) : this.center;

    cache.centerX = c.x;
    cache.centerY = c.y;

    const st = stage.worldTransform;
    const zoomX = stage.scale.x || 1.0;
    const zoomY = stage.scale.y || 1.0;
    const halfWorld = (cache.sizeUnits * cache.gridSize) * 0.5;

    cache.hitboxHalfWidth  = halfWorld * zoomX;
    cache.hitboxHalfHeight = halfWorld * zoomY;
    cache.hitboxCenterX = st.a * cache.centerX + st.c * cache.centerY + st.tx;
    cache.hitboxCenterY = st.b * cache.centerX + st.d * cache.centerY + st.ty;
    cache.trParentID = trParentID;
    cache.trLocalID = trLocalID;

    return cache;
  }

  /* -------------------------------------------- */

  /**
   * To know whether this token has an active hit box state or can have.
   * @returns {boolean}
   */
  hasNoActiveHitBoxState() {
    return this.#hbCache.animationTypes.valueOf() === 0;
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if ( !canvas.scene.useMicrogrid ) return;
    this.engagement = this.#initializeEngagement(); // "prior" engagement is nobody
    this.refreshFlanking();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    if ( !canvas.scene.useMicrogrid ) return;

    // Flanking Updates
    const flankingChange = ["x", "y", "elevation", "width", "height", "disposition", "actorId", "actorLink"].some(k => k in data);
    if ( flankingChange ) this.refreshFlanking();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( !canvas.scene.useMicrogrid ) return;
    CrucibleTokenObject.visibleTokens.delete(this);

    // Apply flanking updates
    const activeGM = game.users.activeGM;
    const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);

    // Remove engagement from the deleted token
    const newEngagement = this.#initializeEngagement(); // "new" engagement is nobody
    const toUpdate = this.#propagateEngagementUpdates(this.engagement, newEngagement);
    this.engagement = this.constructor.computeFlanking(newEngagement);
    for ( const t of toUpdate ) {
      t.engagement = this.constructor.computeFlanking(t.engagement);
      if ( commit ) t.actor.commitFlanking(t.engagement);
    }
  }

  /* -------------------------------------------- */
  /*  Debugging and Visualization                 */
  /* -------------------------------------------- */

  /**
   * Draw the visualization of Token engagement.
   * @param engagement
   * @internal
   */
  _visualizeEngagement(engagement) {
    if ( !CONFIG.debug.flanking || !canvas.scene?.useMicrogrid ) return;
    const PT = foundry.canvas.containers.PreciseText;
    if ( !this.#engagementDebug ) {
      this.#engagementDebug = canvas.controls.debug.addChild(new PIXI.Graphics());

      // Enemies Text
      this.#engagementDebug.enemies = this.#engagementDebug.addChild(new PT("", PT.getTextStyle({fontSize: 20})));
      this.#engagementDebug.enemies.anchor.set(0.5, 1);

      // Engagement Text
      this.#engagementDebug.engagement = this.#engagementDebug.addChild(new PT("", PT.getTextStyle({fontSize: 20})));
      this.#engagementDebug.engagement.anchor.set(0.5, 0);

      // Flanked Text
      this.#engagementDebug.flanked = this.#engagementDebug.addChild(new PT("", PT.getTextStyle({fontSize: 32})));
      this.#engagementDebug.flanked.anchor.set(0.5, 0.5);
    }
    this._clearEngagementVisualization();
    if ( canvas.tokens.controlled.length !== 1 ) return;
    const e = this.#engagementDebug;

    // Movement polygon
    e.beginFill(0x00FFFF, 0.1).lineStyle({width: 3, color: 0x00FFFF, alpha: 1.0}).drawShape(engagement.movePolygon).endFill();

    // Enemy bounds
    e.beginFill(0xFF0000, 0.1).lineStyle({width: 2, color: 0xFF0000, alpha: 1.0});
    for ( const enemy of engagement.enemies ) e.drawShape(enemy.bounds);
    e.endFill();

    // Ally bounds
    e.beginFill(0x00FF00, 0.1).lineStyle({width: 2, color: 0x00FF00, alpha: 1.0});
    for ( const ally of engagement.allies ) e.drawShape(ally.bounds);
    e.endFill();

    // Flanking State
    const {x, y} = this.document._source;
    const {x: cx, y: cy} = this.getCenterPoint({x, y});
    this.#engagementDebug.enemies.text = `${engagement.enemies.size} Enemies`;
    this.#engagementDebug.enemies.position.set(cx, y);
    this.#engagementDebug.enemies.visible = true;
    this.#engagementDebug.engagement.text = `Engagement ${engagement.value + engagement.allyBonus}`;
    this.#engagementDebug.engagement.position.set(cx, y + this.h);
    this.#engagementDebug.engagement.visible = true;
    this.#engagementDebug.flanked.text = `Flanked ${engagement.flanked}`;
    this.#engagementDebug.flanked.position.set(cx, cy);
    this.#engagementDebug.flanked.visible = true;
  }

  /* -------------------------------------------- */

  /**
   * Clear the visualization of Token engagement.
   * @internal
   */
  _clearEngagementVisualization() {
    if ( !this.#engagementDebug ) return;
    this.#engagementDebug.clear();
    this.#engagementDebug.enemies.visible = false;
    this.#engagementDebug.engagement.visible = false;
    this.#engagementDebug.flanked.visible = false;
  }

  /* -------------------------------------------- */

  /**
   * TODO: figure out how to use this
   * @param g
   * @private
   */
  _visualizeOffensiveRange(g) {
    const c = this.center;
    const mhRange = this.actor.equipment.weapons.mainhand?.system.range ?? 1;
    const r = mhRange + Math.floor(this.actor.size / 2);
    const range = new PIXI.Polygon(canvas.grid.getCircle(c, r));
    const offsets = crucible.api.canvas.grid.getTargetAreaOffsets(c, range);
    g.beginFill(0xFF0000, 0.1);
    const s = canvas.dimensions.size;
    for ( const o of offsets ) {
      const {x, y} = canvas.grid.getTopLeftPoint(o);
      g.drawRect(x, y, s, s);
    }
    g.endFill();
  }
}
