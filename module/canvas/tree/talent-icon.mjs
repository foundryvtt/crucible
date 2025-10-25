/**
 * @typedef CrucibleTalentIconConfig
 * @property {number} alpha
 * @property {PIXI.ColorSource} backgroundColor
 * @property {number} size
 * @property {string} [text]
 * @property {PIXI.Texture} [texture]
 * @property {PIXI.Texture} [frameTexture]
 * @property {PIXI.ColorSource} frameTint
 * @property {PIXI.ColorSource} iconTint
 * @property {PIXI.ColorSource|null} splooshColor
 * @property {PIXI.ColorSource|null} underglowColor
 * @property {number} underglowSize
 */

export default class CrucibleTalentIcon extends PIXI.Container {

  /**
   * The shared filter instance used by all inaccessible icons
   * @type {PIXI.filters.ColorMatrixFilter}
   */
  static greyscaleFilter = new PIXI.ColorMatrixFilter();

  /* -------------------------------------------- */

  /**
   * Talent icon configuration
   * @type {CrucibleTalentIconConfig}
   */
  static DEFAULT_CONFIG = {
    alpha: 1.0,
    backgroundColor: 0x000000,
    size: 64,
    text: undefined,
    texture: undefined,
    frameTexture: undefined,
    frameTint: 0xFFFFFF,
    iconTint: 0xFFFFFF,
    splooshColor: null,
    underglowColor: null,
    underglowSize: 128
  };

  /**
   * The current configuration of the icon. Defined at draw-time.
   */
  config;

  /* -------------------------------------------- */

  /**
   * Customize configuration values for the icon being drawn.
   * @param {Partial<CrucibleTalentIconConfig>} config
   * @returns {CrucibleTalentIconConfig}
   * @protected
   */
  _configure(config) {
    return this.config = {...this.constructor.DEFAULT_CONFIG, config};
  }

  /* -------------------------------------------- */

  /**
   * Draw the talent tree icon
   * @param {Partial<CrucibleTalentIconConfig>} config     New configuration values to apply
   * @returns {Promise<void>}
   */
  async draw(config={}) {
    const c = this._configure(config);
    const spritesheet = crucible.tree.spritesheet;
    this.removeChildren().forEach(c => c.destroy());

    // Icon Shape
    this.shape = this._getShape();

    // Background
    this.underglow = this.addChild(new PIXI.Sprite());
    this.bg = this.addChild(new PIXI.Graphics());
    this.sploosh = this.addChild(new PIXI.Sprite());

    // Icon
    this.icon = this.addChild(new PIXI.Sprite());
    this.icon.anchor.set(0.5, 0.5);
    this.icon.mask = this.addChild(new PIXI.Graphics());

    // Border
    this.frame = this.addChild(new PIXI.Sprite());

    // Number
    const textStyle = foundry.canvas.containers.PreciseText.getTextStyle({fontSize: 24});
    this.number = this.addChild(new foundry.canvas.containers.PreciseText("", textStyle));
    this.number.anchor.set(0.5, 0.5);
    this.number.position.set(this.config.size / 3, -this.config.size / 3);

    // Under glow
    this.underglow.texture = spritesheet.BackgroundGradient;
    this.underglow.width = this.underglow.height = c.underglowSize;
    this.underglow.anchor.set(0.5, 0.5);
    this.underglow.tint = c.underglowColor || 0xFFFFFF;
    this.underglow.alpha = 0.75;
    this.underglow.visible = !!c.underglowColor;

    // Background fill
    this.bg.clear().beginFill(this.config.backgroundColor).drawShape(this.shape).endFill();

    // Sploosh
    if ( c.splooshColor ) {
      this.sploosh.texture = spritesheet.BackgroundGradient;
      this.sploosh.width = this.sploosh.height = c.size;
      this.sploosh.anchor.set(0.5, 0.5);
      this.sploosh.tint = c.splooshColor;
      this.sploosh.visible = true;
    }
    else this.sploosh.visible = false;

    // Draw icon
    this.icon.texture = c.texture;
    this.icon.width = this.icon.height = c.size;
    this.icon.tint = c.iconTint ?? 0xFFFFFF;

    this._drawFrame();
    this._drawMask();

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
  _drawFrame() {
    this.frame.anchor.set(0.5, 0.5);
    const scale = this.config.size / this.config.frameTexture.height;
    this.frame.scale.set(scale, scale);
    this.frame.texture = this.config.frameTexture;
    this.frame.tint = this.config.frameTint;

  }
}
CrucibleTalentIcon.greyscaleFilter.desaturate();
