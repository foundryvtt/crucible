/**
 * A Scene subclass which extends the base Scene document with some Crucible-specific functionalities.
 */
export default class CrucibleScene extends Scene {

  useMicrogrid = false;

  /** @inheritDoc */
  prepareBaseData() {
    if ( !(this.grid instanceof foundry.grid.BaseGrid) ) {
      if ( this.constructor.useMicrogrid(this._source) ) {
        this.useMicrogrid = true;
        this.grid.size = this._source.grid.size / 5;
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
    const systemChanged = (changed._stats.systemId ?? changed._stats.exportSource?.systemId) !== SYSTEM.id;
    if ( systemChanged && (options.recursive === false) && changed.tokens.length ) {
      if ( this.constructor.useMicrogrid(changed) ) {
        for ( const token of changed.tokens ?? [] ) {
          token.height *= 5;
          token.width *= 5;
        }
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _preCreate(data, options, userId) {
    const allowed = await super._preUpdate(data, options, userId);
    if ( allowed === false ) return false;
    const sceneSystem = data._stats?.systemId ?? data._stats?.exportSource?.systemId;
    if ( !sceneSystem || (sceneSystem === SYSTEM.id) ) return;
    if ( this.constructor.useMicrogrid(data) ) {
      for ( const token of data.tokens ?? [] ) {
        token.height *= 5;
        token.width *= 5;
      }
      this.updateSource({tokens: data.tokens});
    }
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

  /**
   * Determine whether input scene data will be made to use the microgrid automatically
   * @param {object} sceneData  The scene data to check
   * @returns {Boolean}
   */
  static useMicrogrid(sceneData) {
    const g = sceneData.grid;
    return (g.type === CONST.GRID_TYPES.SQUARE) && (g.units === "ft") && (g.distance === 5);
  }
}
