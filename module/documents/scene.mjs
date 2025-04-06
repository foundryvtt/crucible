/**
 * A Scene subclass which extends the base Scene document with some Crucible-specific functionalities.
 */
export default class CrucibleScene extends Scene {

  useMicrogrid = false;

  /** @inheritDoc */
  prepareBaseData() {
    if ( !(this.grid instanceof foundry.grid.BaseGrid) ) {
      const g = this._source.grid;
      if ( (g.units === "ft") && (g.distance === 5) ) {
        this.useMicrogrid = true;
        this.grid.size = g.size / 5;
        this.grid.distance = 1;
      }
    }
    super.prepareBaseData();
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
}
