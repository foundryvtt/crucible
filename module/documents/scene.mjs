/**
 * A Scene subclass which extends the base Scene document with some Crucible-specific functionalities.
 */
export default class CrucibleScene extends Scene {

  useMicrogrid = false;

  /** @inheritDoc */
  prepareBaseData() {
    if ( !(this.grid instanceof foundry.grid.BaseGrid) ) {
      const g = this._source.grid;
      if ( (g.type === CONST.GRID_TYPES.SQUARE) && (g.units === "ft") && (g.distance === 5) ) {
        this.useMicrogrid = true;
        this.grid.size = g.size / 5;
        this.grid.distance = 1;
      }
    }
    super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(changed, options, userId) {
    const allowed = await super._preUpdate(changed, options, userId);
    if ( allowed === false ) return false;
    if ( !changed._stats ) return;
    if ( (changed._stats.systemId ?? changed._stats.exportSource?.systemId) === SYSTEM.id ) return;
    const g = changed.grid;
    if ( (g.type !== CONST.GRID_TYPES.SQUARE) || (g.units !== "ft") || (g.distance !== 5) ) return;
    for ( const token of changed.tokens ?? [] ) {
      token.height *= 5;
      token.width *= 5;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _preCreate(data, options, userId) {
    const allowed = await super._preUpdate(data, options, userId);
    if ( allowed === false ) return false;
    if ( !data._stats ) return;
    if ( (data._stats.systemId ?? data._stats.exportSource?.systemId) === SYSTEM.id ) return;
    const g = data.grid;
    if ( (g.type !== CONST.GRID_TYPES.SQUARE) || (g.units !== "ft") || (g.distance !== 5) ) return;
    for ( const token of data.tokens ?? [] ) {
      token.height *= 5;
      token.width *= 5;
    }
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
}
