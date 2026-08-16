import CrucibleHitBoxShader from "./grid/hit-box-shader.mjs";

export default class CrucibleTokenObject extends foundry.canvas.placeables.Token {

  /** @inheritDoc */
  static RENDER_FLAGS = Object.assign({}, super.RENDER_FLAGS, {
    refreshElevation: { propagate: ["refreshTooltip", "refreshMesh"] },
    refreshFlanking: {}
  });

  /**
   * Container to "store" some unused graphics in Crucible.
   * @type {PIXI.Container}
   */
  static #voidContainer = new PIXI.Container();

  /**
   * @typedef CrucibleTokenEngagement
   * @property {Set<Token>} allies      Allied tokens which are engaged
   * @property {Set<Token>} enemies     Enemy tokens which are engaged
   * @property {Set<Token>} other       Other tokens which are engaged
   * @property {PIXI.Rectangle} [engagementBounds] Your bounds of engagement
   * @property {PIXI.Polygon} [movePolygon] Your current movement polygon
   * @property {number} [value]         Your engagement capacity, absent for an engagement with nobody
   * @property {number} [flankers]      The number of enemy flankers
   * @property {number} [allyBonus]     The engagement bonus provided by adjacent allies
   * @property {number} [flanked]       The resulting flanked stage
   */

  /**
   * @typedef CrucibleTokenFlanking
   * @property {number} flankers        The number of enemy flankers which counted
   * @property {number} allyBonus       The engagement bonus provided by adjacent allies
   * @property {number} flanked         The resulting flanked stage
   */

  /**
   * Current engagement status for the Token.
   * @type {CrucibleTokenEngagement}
   */
  engagement = this.#initializeEngagement();

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
    wasAnimating: false,
    animationTypes: new foundry.utils.BitMask(CrucibleHitBoxShader.STATES)
  };

  /* -------------------------------------------- */
  /*  Detection                                   */
  /* -------------------------------------------- */

  /**
   * Test whether this Token can detect another Token via any of its enabled detection modes.
   * @param {CrucibleTokenObject} targetToken               The token whose visibility is being tested
   * @param {object} [options]
   * @param {Iterable<string>} [options.modes]              Restrict the test to this subset of detection mode ids
   * @returns {boolean}                                     Did any of this token's detection modes detect the target?
   */
  canDetect(targetToken, {modes}={}) {
    if ( this === targetToken ) return true;
    const {visionSource, ephemeral} = this.#acquireDetectionVisionSource();
    const detected = this.#testDetection(targetToken, visionSource, modes ? new Set(modes) : null);
    if ( ephemeral ) visionSource.destroy();
    return detected;
  }

  /* -------------------------------------------- */

  /**
   * Filter a group of Tokens down to those which this Token can detect, reusing one vision source for every test.
   * @param {Iterable<CrucibleTokenObject>} targetTokens    The tokens whose visibility is being tested
   * @param {object} [options]
   * @param {Iterable<string>} [options.modes]              Restrict the test to this subset of detection mode ids
   * @returns {Set<CrucibleTokenObject>}                    The subset of tokens which this Token detects
   */
  filterDetected(targetTokens, {modes}={}) {
    const {visionSource, ephemeral} = this.#acquireDetectionVisionSource();
    const allowed = modes ? new Set(modes) : null;
    const detected = new Set();
    for ( const t of targetTokens ) {
      if ( (this === t) || this.#testDetection(t, visionSource, allowed) ) detected.add(t);
    }
    if ( ephemeral ) visionSource.destroy();
    return detected;
  }

  /* -------------------------------------------- */

  /**
   * Obtain a vision source to perform detection tests against.
   * An ephemeral source is constructed if this Token has none active, which the caller is responsible for destroying.
   * @returns {{visionSource: PointVisionSource, ephemeral: boolean}}
   */
  #acquireDetectionVisionSource() {
    if ( this.vision ) return {visionSource: this.vision, ephemeral: false};
    const visionSource = new CONFIG.Canvas.visionSourceClass({
      sourceId: `${this.sourceId}.detectionTest`,
      object: this
    });
    const blindedStates = this._getVisionBlindedStates();
    for ( const state in blindedStates ) visionSource.blinded[state] = blindedStates[state];
    visionSource.initialize(this._getVisionSourceData());
    return {visionSource, ephemeral: true};
  }

  /* -------------------------------------------- */

  /**
   * Test whether a prepared vision source detects a target Token via any permitted detection mode.
   * @param {CrucibleTokenObject} targetToken     The token whose visibility is being tested
   * @param {PointVisionSource} visionSource      A vision source from {@link #acquireDetectionVisionSource}
   * @param {Set<string>|null} allowed            Permitted detection mode ids, or null to permit all of them
   * @returns {boolean}
   */
  #testDetection(targetToken, visionSource, allowed) {
    const testPoints = targetToken.document.getVisibilityTestPoints();
    const config = canvas.visibility._createVisibilityTestConfig(testPoints, {object: targetToken, tolerance: 0});
    // Use configured detection modes if the token has some, otherwise use automatic lightPerception and basicSight
    const detectionModes = foundry.utils.isEmpty(this.detectionModes) ? {
      lightPerception: {enabled: true, range: Infinity},
      basicSight: {enabled: true, range: this.document.sight.range}
    } : this.detectionModes;
    return Object.entries(detectionModes).some(([id, mode]) => {
      if ( allowed && !allowed.has(id) ) return false;
      return CONFIG.Canvas.detectionModes[id]?.testVisibility(visionSource, mode, config) === true;
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _draw(options) {
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
  _refreshMeshSizeAndScale() {
    super._refreshMeshSizeAndScale();
    const factor = this.getMicrogridScaleFactor();
    const {x: sx, y: sy} = this.mesh.scale;
    this.mesh.scale.set(sx * factor, sy * factor);
  }

  /* -------------------------------------------- */

  /**
   * Get the desired adjusted scale of this token when applied to the Crucible microgrid.
   * Shrink or enlarge tokens with hyperbolic falloff factor, clamped to an allowed range of [0.5, 1.5]
   * @returns {number}
   */
  getMicrogridScaleFactor() {
    if ( !crucible.CONFIG.elevationScaling || !canvas.level || !this.document.parent.useMicrogrid ) return 1;
    const de = this.document.elevation - canvas.level.elevation.base;
    if ( de === 0 ) return 1;
    if ( de < 0 ) return Math.max(0.5, 1 / (1 - (de / 90)));  // Reaches 0.5 at -90ft
    if ( de > 0 ) return Math.min(1.5, 1 / (1 - (de / 270))); // Reaches 1.5 at +90ft
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
  _refreshRuler() {
    super._refreshRuler();
    if ( !canvas.scene.useMicrogrid ) return;
    const dialog = crucible.api.dice.ActionUseDialog.getActiveMovementPlan(this.document);
    if ( dialog ) dialog._onPreviewMovement(this._plannedMovement[game.user.id]);
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
    CrucibleTokenObject.refreshFlankingVisualization();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRelease(options) {
    super._onRelease(options);
    CrucibleTokenObject.refreshFlankingVisualization();
  }

  /* -------------------------------------------- */
  /*  Movement                                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _getDragMovementAction() {
    if ( game.user.isGM && ui.controls.controls.tokens?.tools?.forcedMovement?.active ) return "push";
    return super._getDragMovementAction();
  }

  /* -------------------------------------------- */

  /** @override */
  _getDragLeftDropUpdateOptions() {
    const options = super._getDragLeftDropUpdateOptions();
    if ( crucible.api.dice.ActionUseDialog.getActiveMovementPlan(this.document) ) {
      options.planned = true;
    }
    return options;
  }

  /* -------------------------------------------- */

  /** @override */
  _getMovementCostFunction(options={}) {
    if ( "overrideCost" in options ) return () => options.overrideCost;
    const calculateTerrainCost = CONFIG.Token.movement.TerrainData.getMovementCostFunction(this.document, options);
    const actionCostFunctions = {};
    const actor = this.actor;

    // Construct and return cost function
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

  /** @inheritDoc */
  _getMovementCollisionTestConfiguration(segment, options) {
    const config = super._getMovementCollisionTestConfiguration(segment, options);
    let tokenCollision = this.inCombat;
    if ( segment.actionConfig?.tokenCollision === false ) tokenCollision = false;
    config.tokenCollision = tokenCollision;
    if ( options.crucible?.excludeTokens ) config.excludeTokens = options.crucible.excludeTokens;
    // A collision predicate cannot ride the serialized constrainOptions, so it is stashed locally for the duration of
    // interactive planning (see CrucibleActionUseDialog#onPlanMovement) and read here on the moving client only
    if ( this._movementExcludeTest ) config.excludeTokenTest = this._movementExcludeTest;
    // Unlike the predicate, movement strength is a plain number, so it rides the serialized options to execution
    if ( options.crucible?.movementStrength ) config.movementStrength = options.crucible.movementStrength;
    return config;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  // FIXME remove this override once 14.365 is out with https://github.com/foundryvtt/foundry-vtt/pull/5764
  measureMovementPath(waypoints, options) {
    const context = this.layer._movementPlanningContext;
    if ( context?.object === this ) {
      options = {...context.measureOptions, ...(options ?? {})};
    }
    return super.measureMovementPath(waypoints, options);
  }

  /* -------------------------------------------- */

  /**
   * The token animation movement speed for a given Stride, in grid units per second.
   * Assume 6 strides per turn, 10 seconds per round, x2 multiplier for visual satisfaction.
   * @param {number} stride
   * @returns {number}
   */
  static movementSpeedForStride(stride) {
    return (stride * 6) * 2 / (canvas.dimensions.distance * CONFIG.time.roundTime);
  }

  /* -------------------------------------------- */

  /** @override */
  _getAnimationMovementSpeed(_options) {
    const stride = this.actor?.system.movement?.stride;
    if ( !Number.isFinite(stride) ) return CONFIG.Token.movement.defaultSpeed;
    return CrucibleTokenObject.movementSpeedForStride(stride);
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
    return crucible.api.documents.CrucibleActor.getDispositionGroups(this.document.disposition);
  }

  /* -------------------------------------------- */

  /**
   * Set the render flag to schedule a flanking refresh.
   */
  refreshFlanking() {
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
    this.engagement = Object.assign(engagement, this.constructor.computeFlanking(engagement));

    // Step 4: Compute flanking stage of all engaged tokens
    for ( const t of toUpdate ) Object.assign(t.engagement, this.constructor.computeFlanking(t.engagement));

    // Movement may have changed the flanking of any participant, not only this Token
    CrucibleTokenObject.refreshFlankingVisualization();
  }

  /* -------------------------------------------- */

  /**
   * Compute the Flanked stage for a certain engagement state, which is not mutated.
   * @param {CrucibleTokenEngagement} engagement      The engagement state of the Token being flanked
   * @param {object} [options]
   * @param {CrucibleTokenObject} [options.observer]  An attacking Token which only counts participants it perceives
   * @returns {CrucibleTokenFlanking}                 The computed flanking result
   */
  static computeFlanking(engagement, {observer}={}) {

    // Perception is filtered once for both sides; an observer always perceives itself
    const perceived = observer?.filterDetected(engagement.enemies.union(engagement.allies));

    // Count flankers; an adversary's flankingStrength lets it count as more than one
    let flankers = 0;
    for ( const enemy of engagement.enemies ) {
      if ( perceived && !perceived.has(enemy) ) continue;
      const {isBroken, isIncapacitated} = enemy.actor.system;
      if ( !(isBroken || isIncapacitated) ) flankers += enemy.actor.system.movement?.flankingStrength ?? 1;
    }

    // Determine the engagement bonus received from allies; an unperceived defender does not distract the observer
    let allyBonus = 0;
    for ( const ally of engagement.allies ) {
      if ( perceived && !perceived.has(ally) ) continue;
      const {isBroken, isIncapacitated} = ally.actor.system;
      if ( isBroken || isIncapacitated ) continue;
      const mutual = ally.engagement.enemies.intersection(engagement.enemies);
      if ( !mutual.size ) continue;
      const allyEngage = ally?.actor.system.movement.engagement ?? 1;
      allyBonus += Math.min(allyEngage, mutual.size);
    }

    // Engagement with nobody carries no capacity, in which case there are no flankers to subtract
    const value = engagement.value ?? 0;
    return {flankers, allyBonus, flanked: Math.max(flankers - allyBonus - value, 0)};
  }

  /* -------------------------------------------- */

  /**
   * Compute the degree to which a target Token is flanked, as this Token perceives the situation.
   * @param {CrucibleTokenObject} target        The Token being flanked
   * @param {object} [options]
   * @param {boolean} [options.includeSelf]     Count this Token as a flanker even where it is not yet engaged, as
   *                                            when it will close to melee before it strikes
   * @returns {CrucibleTokenFlanking}
   */
  getFlankingAgainst(target, {includeSelf=false}={}) {
    if ( this === target ) return {flankers: 0, allyBonus: 0, flanked: 0};
    const engagement = target.engagement;
    let {enemies} = engagement;
    if ( includeSelf && !enemies.has(this) ) enemies = enemies.union(new Set([this]));
    const flanking = this.constructor.computeFlanking({...engagement, enemies}, {observer: this});
    flanking.flanked += target.actor?.imposedFlanking ?? 0;
    return flanking;
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
      ((rgba & 0x000000FF) << 24)
      | ((rgba & 0x0000FF00) << 8)
      | ((rgba & 0x00FF0000) >>> 8)
      | ((rgba & 0xFF000000) >>> 24)
    ) >>> 0;
    cache.colorRaw = colorRaw;
    return cache.abgr;
  }

  /* -------------------------------------------- */

  /**
   * Get the hit box data (which is updated lazily if necessary)
   * @returns {{abgr: number, hitboxCenterX: number, hitboxCenterY: number, hitboxHalfWidth: number,
   *   hitboxHalfHeight: number, trLocalID: number, trParentID: number, gridSize: number,
   *   sizeUnits: number, centerX: number, centerY: number, colorRaw: number}}
   */
  getHitBoxData() {
    const stage = canvas?.stage;
    const grid = canvas?.grid;
    const cache = this.#hbCache;

    // Verify transform IDs and Token size to know if the hitbox data must be recomputed. Size is included because the
    // hitbox geometry depends on it, and a resize need not change the transform the IDs track.
    const trLocalID = this.transform._localID;
    const trParentID = this.transform._parentID;
    const s = this.actor?.system?.movement?.size ?? this.document?.width ?? 4;
    const animating = this.animationContexts.size > 0;

    // A resize animates with a raw (un-snapped) center; when it settles force one recompute so the grid-snapped
    // center replaces the stale animated value instead of waiting for the next transform change.
    const settled = cache.wasAnimating && !animating;
    const dirty = settled || (trParentID !== cache.trParentID) || (trLocalID !== cache.trLocalID)
      || (s !== cache.sizeUnits);
    cache.wasAnimating = animating;
    if ( (dirty === false) || !stage || !grid ) return this.#hbCache;

    cache.gridSize = grid.size || 100;
    cache.sizeUnits = s;
    const uneven = (s % 2 > 0);

    const M = CONST.GRID_SNAPPING_MODES;
    const c = !animating ? canvas.grid.getSnappedPoint(this.center, {
      mode: uneven ? M.CENTER : M.VERTEX,
      resolution: 1
    }) : this.center;

    cache.centerX = c.x;
    cache.centerY = c.y;

    const st = stage.worldTransform;
    const zoomX = stage.scale.x || 1.0;
    const zoomY = stage.scale.y || 1.0;
    const halfWorld = (cache.sizeUnits * cache.gridSize) * 0.5;

    cache.hitboxHalfWidth = halfWorld * zoomX;
    cache.hitboxHalfHeight = halfWorld * zoomY;
    cache.hitboxCenterX = (st.a * cache.centerX) + (st.c * cache.centerY) + st.tx;
    cache.hitboxCenterY = (st.b * cache.centerX) + (st.d * cache.centerY) + st.ty;
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

    // Take over a VFX-deferred forced movement's animation on clients with VFX enabled
    this.#interceptVFXMovement(options);

    if ( !canvas.scene.useMicrogrid ) return;

    // Flanking Updates
    const flankingChange = ["x", "y", "elevation", "width", "height", "disposition", "actorId", "actorLink"].some(k => k in data);
    if ( flankingChange ) this.refreshFlanking();
  }

  /* -------------------------------------------- */

  /**
   * On a VFX-enabled client, cancel a VFX-deferred secondary movement's core animation and hold the token at its
   * pre-move origin, so the action's VFX can play the displacement as the impact animation.
   * @param {object} options    Update options, carrying the per-token movement record under `_movement`.
   */
  #interceptVFXMovement(options) {
    if ( !game.settings.get("crucible", "enableVFX") ) return;
    const movement = options._movement?.[this.document.id];
    const origin = movement?.constrainOptions?.crucible?.deferAnimation ? movement.origin : null;
    if ( !origin ) return;
    this.stopAnimation();
    this.animate({x: origin.x, y: origin.y}, {duration: 0});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( !canvas.scene.useMicrogrid ) return;
    CrucibleTokenObject.visibleTokens.delete(this);

    // Remove engagement from the deleted token
    const newEngagement = this.#initializeEngagement(); // "new" engagement is nobody
    const toUpdate = this.#propagateEngagementUpdates(this.engagement, newEngagement);
    this.engagement = Object.assign(newEngagement, this.constructor.computeFlanking(newEngagement));
    for ( const t of toUpdate ) Object.assign(t.engagement, this.constructor.computeFlanking(t.engagement));
  }

  /* -------------------------------------------- */
  /*  Debugging and Visualization                 */
  /* -------------------------------------------- */

  /**
   * A scene-wide overlay which visualizes flanking from the perspective of the controlled Token.
   * @type {PIXI.Container|null}
   */
  static #flankingOverlay = null;

  /* -------------------------------------------- */

  /**
   * Redraw the flanking visualization in its entirety.
   * The overlay describes a single perspective, so it is rebuilt wholesale rather than maintained per-Token.
   * @internal
   */
  static refreshFlankingVisualization() {
    const overlay = CrucibleTokenObject.#clearFlankingVisualization();
    if ( !overlay || !CONFIG.debug.flanking || !canvas.scene?.useMicrogrid ) return;

    // A single controlled Token supplies the perspective; without exactly one there is nothing to describe
    const controlled = canvas.tokens.controlled;
    if ( controlled.length !== 1 ) return;
    const [observer] = controlled;
    if ( !observer.actor || !observer.engagement.movePolygon ) return;

    // The observer's own engagement, and the creatures it perceives around itself
    const g = overlay.addChild(new PIXI.Graphics());
    g.beginFill(0x00FFFF, 0.1).lineStyle({width: 3, color: 0x00FFFF, alpha: 1.0})
      .drawShape(observer.engagement.movePolygon).endFill();
    const {enemies, allies} = observer.engagement;
    const perceived = observer.filterDetected(enemies.union(allies));
    CrucibleTokenObject.#drawFlankingLabels(overlay, observer, [
      {key: "TOKEN.LABELS.Enemies", data: {enemies: enemies.intersection(perceived).size}},
      {key: "TOKEN.LABELS.Engagement", data: {engagement: observer.engagement.value ?? 0}, size: 32},
      {key: "TOKEN.LABELS.Allies", data: {allies: allies.intersection(perceived).size}}
    ]);

    // What each targeted creature affords the observer, as the observer perceives it
    for ( const target of game.user.targets ) {
      if ( (target === observer) || !target.actor ) continue;
      const {flankers, allyBonus, flanked} = observer.getFlankingAgainst(target);
      CrucibleTokenObject.#drawFlankingLabels(overlay, target, [
        {key: "TOKEN.LABELS.Attackers", data: {attackers: flankers}},
        {key: "TOKEN.LABELS.Flanked", data: {flanked}, size: 32},
        {key: "TOKEN.LABELS.Allies", data: {allies: allyBonus}}
      ]);
    }
  }

  /* -------------------------------------------- */

  /**
   * Draw up to three stacked labels within a Token's hitbox, so that adjacent Tokens do not overlap one another.
   * @param {PIXI.Container} overlay                              The overlay to draw into
   * @param {CrucibleTokenObject} token                           The Token to label
   * @param {Array<{key: string, data: object, size?: number}|null>} labels   Top, middle, and bottom labels
   */
  static #drawFlankingLabels(overlay, token, labels) {
    const PT = foundry.canvas.containers.PreciseText;
    const {x, y} = token.document._source;
    const {width, height} = token.document.getSize();
    const rect = new PIXI.Rectangle(x, y, width, height).pad(-canvas.dimensions.size / 4);
    const scale = Math.min(1, rect.width / (5 * canvas.dimensions.size));
    const anchors = [[0, rect.top], [0.5, rect.top + (rect.height / 2)], [1, rect.bottom]];
    for ( const [i, label] of labels.entries() ) {
      if ( !label ) continue;
      const [anchorY, y] = anchors[i];
      const text = overlay.addChild(new PT(_loc(label.key, label.data),
        PT.getTextStyle({fontSize: (label.size ?? 20) * scale})));
      text.anchor.set(0.5, anchorY);
      text.position.set(rect.x + (rect.width / 2), y);
    }
  }

  /* -------------------------------------------- */

  /**
   * Empty the flanking overlay, creating it if the canvas has been redrawn beneath it.
   * @returns {PIXI.Container|null}   The empty overlay, or null if there is no canvas to draw upon
   */
  static #clearFlankingVisualization() {
    let overlay = CrucibleTokenObject.#flankingOverlay;
    if ( overlay && !overlay.destroyed ) overlay.removeChildren().forEach(c => c.destroy({children: true}));
    else {
      if ( !canvas.controls?.debug ) return CrucibleTokenObject.#flankingOverlay = null;
      overlay = CrucibleTokenObject.#flankingOverlay = canvas.controls.debug.addChild(new PIXI.Container());
    }
    return overlay;
  }

  /* -------------------------------------------- */

  /**
   * TODO: figure out how to use this
   * @param {PIXI.Graphics} g
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
