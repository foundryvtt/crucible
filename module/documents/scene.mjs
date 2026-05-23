/**
 * A Scene subclass which extends the base Scene document with some Crucible-specific functionalities.
 */
export default class CrucibleScene extends Scene {

  useMicrogrid = false;

  /**
   * Cached microgrid assessment populated on first prepareBaseData.
   * @type {{shouldUse: boolean, canUse: boolean, warning: string|undefined}}
   * @internal
   */
  _microgrid;

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
