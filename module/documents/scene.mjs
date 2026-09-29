/**
 * A Scene subclass which extends the base Scene document with some Crucible-specific functionalities.
 */
export default class CrucibleScene extends Scene {

  useMicrogrid = false;

  /**
   * Cached microgrid assessment populated on first prepareBaseData, plus memoized Crucible scene parameters.
   * @type {{shouldUse: boolean, canUse: boolean, warning: string|undefined, usesSurfaces: boolean|undefined}}
   * @internal
   */
  _microgrid;

  /* -------------------------------------------- */

  /**
   * Whether this scene defines any movement surface. When true, surfaces are the only floors (surface mode); when
   * false, the base of every level is an implied floor (level mode).
   * @type {boolean}
   */
  get usesSurfaces() {
    if ( this._microgrid.usesSurfaces === undefined ) {
      this._microgrid.usesSurfaces = this.getSurfaces({type: "move"}).length > 0;
    }
    return this._microgrid.usesSurfaces;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareBaseData() {
    if ( !(this.grid instanceof foundry.grid.BaseGrid) ) {
      this._microgrid = this.constructor.useMicrogrid(this._source);
      if ( this._microgrid.canUse ) {
        this.useMicrogrid = true;
        this.grid.size = this._source.grid.size / 5;
        this.grid.distance = 1;
      }
    }
    super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _invalidateSurfaces() {
    super._invalidateSurfaces();
    // The usesSurfaces flag derives from getSurfaces, whose canonical invalidation is this hook
    if ( this._microgrid ) this._microgrid.usesSurfaces = undefined;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preCreate(data, options, userId) {
    const allowed = await super._preCreate(data, options, userId);
    if ( allowed === false ) return false;
    const sceneSystem = data._stats?.systemId ?? data._stats?.exportSource?.systemId;
    if ( !sceneSystem || (sceneSystem === "crucible") ) return;
    if ( !this.useMicrogrid || !data.tokens?.length ) return;
    for ( const token of data.tokens ) CrucibleScene.#rescaleForMicrogrid(token);
    this.updateSource({tokens: data.tokens});
  }

  /* -------------------------------------------- */

  /** @override */
  getDimensions() {
    const dimensions = super.getDimensions();
    if ( !this.useMicrogrid ) return dimensions;

    // Preserve scene positioning and offset using the source grid
    const {grid, width, height, padding} = this._source;
    const sourceGrid = new this.grid.constructor(grid);
    const sourceDimensions = sourceGrid.calculateDimensions(width, height, padding);
    const {x: sx, y: sy, width: sw, height: sh} = sourceDimensions;
    Object.assign(dimensions, {
      rect: new PIXI.Rectangle(0, 0, sw, sh),
      sceneRect: new PIXI.Rectangle(sx, sy, width, height),
      sceneX: sx,
      sceneY: sy
    });
    return dimensions;
  }

  /* -------------------------------------------- */

  /**
   * Assign the default Crucible grid configuration.
   * @returns {Promise<void>}
   */
  async configureDefaultGrid() {
    await this.update({
      grid: {
        distance: 5,
        units: "ft",
        style: "diamondPoints",
        thickness: 4,
        color: "#000000",
        opacity: 0.5
      }
    });
  }

  /* -------------------------------------------- */
  /*  Surfaces                                    */
  /* -------------------------------------------- */

  /**
   * Find the lowest movement-restricting surface at or above an elevation which any of a set of test points touches.
   * The surface region must also span the elevation, so that it can be clung to from there.
   * @param {Point[]} points                      Test points, any one of which the surface must contain
   * @param {object} options
   * @param {number} options.elevation            The elevation from which to search upward
   * @param {string} options.level                The id of the level from which to search
   * @returns {{elevation: number, region: RegionDocument, level: Level}|null}
   */
  findClimbableSurface(points, {elevation, level}) {
    const surfaces = this.getSurfaces({level, type: "move"});
    for ( const surface of surfaces ) {
      if ( (surface.elevation < elevation) || (surface.region.elevation.bottom > elevation) ) continue;
      if ( points.some(p => surface.region.polygonTree.testPoint(p)) ) {
        const restLevel = this.#findRestingLevel(surface.region, surface.elevation, level);
        return {elevation: surface.elevation, region: surface.region, level: restLevel};
      }
    }
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Find the supporting surface at or below an elevation which contains a set of test points.
   * A scene that defines any movement surface uses those surfaces as its only floors (surface mode); a scene with no
   * surfaces treats the base of every level as an implied floor (level mode).
   * @param {Point[]} points                      Test points which the surface must contain; used in surface mode
   * @param {object} options
   * @param {number} options.elevation            The elevation from which to search downward
   * @param {string} options.level                The id of the level from which to search
   * @param {number} [options.coverage=1]         The fraction of test points which a surface must contain
   * @returns {{elevation: number, region: RegionDocument|null, level: Level}|null}
   */
  findSupportingSurface(points, {elevation, level, coverage=1}) {

    // Surface mode: surfaces are the only floors. Walk surfaces from highest to lowest (Scene#getSurfaces orders by
    // elevation) and return the first at or below the elevation which contains the required share of test points.
    // If none is beneath, nothing provides support - a gap with no surface is an explicit authoring choice.
    if ( this.usesSurfaces ) {
      const surfaces = this.getSurfaces({level, type: "move"});
      if ( !surfaces.length ) return null;
      const required = Math.ceil(points.length * coverage);
      const allowedMisses = points.length - required;
      for ( let i = surfaces.length; i--; ) {
        const surface = surfaces[i];
        if ( surface.elevation > elevation ) continue;
        let inside = 0;
        let missed = 0;
        for ( const p of points ) {
          if ( surface.region.polygonTree.testPoint(p) ) {
            if ( ++inside >= required ) {
              const restLevel = this.#findRestingLevel(surface.region, surface.elevation, level);
              return {elevation: surface.elevation, region: surface.region, level: restLevel};
            }
          }
          else if ( ++missed > allowedMisses ) break;
        }
      }
      return null;
    }

    // Level mode: with no surfaces defined, the base of every level is an implied floor. The supporting surface is the
    // highest level base at or below the elevation, which also becomes the resting level.
    let floorLevel = null;
    for ( const lvl of this.levels ) {
      if ( lvl.elevation.base > elevation ) continue;
      if ( !floorLevel || (lvl.elevation.base > floorLevel.elevation.base) ) floorLevel = lvl;
    }
    if ( !floorLevel ) return null;
    return {elevation: floorLevel.elevation.base, region: null, level: floorLevel};
  }

  /* -------------------------------------------- */

  /**
   * Resolve the level which comes to rest on a surface region at a given elevation. Candidates are the levels the
   * region belongs to (an unrestricted region belongs to all); the result is the single candidate whose elevation
   * range is home to the landing elevation, or the current level when there is no unambiguous home.
   * @param {RegionDocument} region   The landed surface's region
   * @param {number} elevation        The landing elevation
   * @param {string} levelId          The current level id
   * @returns {Level|null}            The level which comes to rest
   */
  #findRestingLevel(region, elevation, levelId) {
    const current = this.levels.get(levelId) ?? null;
    const candidates = region.levels.size
      ? Array.from(region.levels, id => this.levels.get(id))
      : this.levels.contents;
    let home = null;
    for ( const level of candidates ) {
      if ( !level ) continue;
      if ( (elevation >= level.elevation.bottom) && (elevation < level.elevation.top) ) {
        if ( home ) return current;  // Ambiguous - more than one candidate level is home to this elevation
        home = level;
      }
    }
    return home ?? current;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static async fromImport(source, context) {
    const sceneSystem = source._stats?.systemId ?? source._stats?.exportSource?.systemId;
    if ( sceneSystem && (sceneSystem !== "crucible") && source.tokens?.length && this.useMicrogrid(source).canUse ) {
      for ( const token of source.tokens ) CrucibleScene.#rescaleForMicrogrid(token);
    }
    return super.fromImport(source, context);
  }

  /* -------------------------------------------- */

  /**
   * Evaluate whether scene data intends (shouldUse) and can support (canUse) the Crucible microgrid.
   * @param {object} sceneData
   * @returns {{shouldUse: boolean, canUse: boolean, warning: string|undefined}}
   */
  static useMicrogrid(sceneData) {
    const g = sceneData.grid;
    const shouldUse = (g.type === CONST.GRID_TYPES.SQUARE) && (g.units === "ft");
    const canUse = shouldUse && (g.distance === 5) && ((g.size % 5) === 0);
    let warning;
    if ( shouldUse && !canUse ) {
      warning = _loc("SCENE.WARNINGS.MicrogridUnavailable", {name: sceneData.name, distance: g.distance, size: g.size});
    }
    return {shouldUse, canUse, warning};
  }

  /* -------------------------------------------- */

  /**
   * Multiply the spatial dimensions of a token from a foreign system's grid units into Crucible microgrid units.
   * @param {object} token
   */
  static #rescaleForMicrogrid(token) {
    token.width *= 5;
    token.height *= 5;
    token.depth = Number.isInteger(token.depth) ? token.depth * 5 : token.width;
  }
}
