
export default class CrucibleTalentIcon extends PIXI.Container {
  constructor(config) {
    super(config);

    /**
     * Configuration for this icon
     * @type {object}
     */
    this.config = Object.assign({
      alpha: 1.0,
      backgroundColor: 0x000000,
      borderColor: undefined,
      borderWidth: 2,
      borderRadius: undefined,
      size: 48,
      text: undefined,
      texture: undefined,
      tint: 0xFFFFFF
    }, config);

    // Background
    this.bg = this.addChild(new PIXI.Graphics());

    // Icon
    this.icon = this.addChild(new PIXI.Sprite());
    this.icon.anchor.set(0.5, 0.5);
    this.icon.mask = this.addChild(new PIXI.Graphics());

    // Border
    this.border = this.addChild(new PIXI.Graphics());

    // Number
    const textStyle = foundry.canvas.containers.PreciseText.getTextStyle({fontSize: 24});
    this.number = this.addChild(new foundry.canvas.containers.PreciseText("", textStyle));
    this.number.anchor.set(0.5, 0.5);
    this.number.position.set(this.config.size / 3, -this.config.size / 3);
  }

  /* -------------------------------------------- */

  /**
   * The shared filter instance used by all inaccessible icons
   * @type {PIXI.filters.ColorMatrixFilter}
   */
  static greyscaleFilter = new PIXI.filters.ColorMatrixFilter();

  /* -------------------------------------------- */

  /**
   * Draw the talent tree icon
   * @param config
   * @returns {Promise<void>}
   */
  async draw(config={}) {
    const c = Object.assign(this.config, config);

    // Icon Shape
    this.shape = this._getShape();
    this.bg.clear().beginFill(0x000000).drawShape(this.shape).endFill();

    // Draw icon
    this.icon.texture = c.texture;
    this.icon.width = this.icon.height = c.size;
    this.icon.alpha = c.alpha ?? 1.0;
    this.icon.tint = c.tint ?? 0xFFFFFF;

    // Draw mask
    this._drawMask();

    // Active icons have a colorful border
    this._drawBorder();

    // Number
    this.number.text = c.text ?? "";
    this.number.visible = !!this.number.text;

    // Interactive hit area
    this.hitArea = new PIXI.Rectangle(-c.size/2, -c.size/2, c.size, c.size);
  }

  /* -------------------------------------------- */

  /**
   * Get the icon shape
   * @returns {PIXI.RoundedRectangle|PIXI.Polygon|PIXI.Circle}
   * @protected
   */
  _getShape() {
    const {shape, size, borderRadius: br} = this.config;
    const hs = size / 2;
    switch ( shape ) {
      case "rect":
        return new PIXI.RoundedRectangle(-hs, -hs, size, size, br);
      case "circle":
        return new PIXI.Circle(0, 0, hs);
      case "hex":
        const borders = [[0, 0.5], [0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1]];
        const width = size * 2 / Math.sqrt(3)
        const height = size;
        const points = borders.reduce((arr, [ox, oy]) => {
          arr.push((ox * width) - (width / 2));
          arr.push((oy * height) - (height / 2));
          return arr;
        }, []);
        return new PIXI.Polygon(points);
      default:
        return new PIXI.Circle(0, 0, hs);
    }
  }

  /* -------------------------------------------- */

  /**
   * Draw a mask shape for the node icon.
   * @protected
   */
  _drawMask() {
    this.icon.mask.clear().beginFill(0xFFFFFF, 1.0).drawShape(this.shape);
  }

  /* -------------------------------------------- */

  /**
   * Draw border graphics for the node.
   * @protected
   */
  _drawBorder() {
    const {borderColor, borderWidth} = this.config;
    this.border.clear().lineStyle({alignment: 0.5, color: borderColor, width: borderWidth}).drawShape(this.shape);
  }
}
CrucibleTalentIcon.greyscaleFilter.desaturate();
