/**
 * A Scene subclass which extends the base Scene document with some Crucible-specific functionalities.
 */
export default class CrucibleScene extends Scene {

  /** @inheritDoc */
  prepareBaseData() {
    if ( !(this.grid instanceof foundry.grid.BaseGrid) ) {
      const g = this._source.grid;
      if ( (g.units === "ft") && (g.distance === 5) ) {
        this.grid.size = g.size / 5;
        this.grid.distance = 1;
      }
    }
    super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /** @override */
  getDimensions() {

    // Get Scene data
    const grid = this.grid;
    const sceneWidth = this.width;
    const sceneHeight = this.height;

    // Compute the correct grid sizing
    const sourceGrid = new grid.constructor({...grid, size: this._source.grid.size, distance: this._source.grid.distance});
    const dimensions = sourceGrid.calculateDimensions(sceneWidth, sceneHeight, this.padding);
    const {width, height} = dimensions;
    const sceneX = dimensions.x - this.background.offsetX;
    const sceneY = dimensions.y - this.background.offsetY;

    // Define Scene dimensions
    return {
      width, height, size: grid.size,
      rect: {x: 0, y: 0, width, height},
      sceneX, sceneY, sceneWidth, sceneHeight,
      sceneRect: {x: sceneX, y: sceneY, width: sceneWidth, height: sceneHeight},
      distance: grid.distance,
      distancePixels: grid.size / grid.distance,
      ratio: sceneWidth / sceneHeight,
      maxR: Math.hypot(width, height),
      rows: dimensions.rows * 5,
      columns: dimensions.columns * 5
    };
  }
}
