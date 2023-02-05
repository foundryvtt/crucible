
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
      borderWidth: 4,
      borderRadius: undefined,
      size: 50,
      text: undefined,
      texture: undefined,
      tint: 0xFFFFFF
    }, config);

    // Border
    this.border = this.addChild(new PIXI.Graphics());

    // Icon
    this.icon = this.addChild(new PIXI.Sprite());
    this.icon.anchor.set(0.5, 0.5);
    this.icon.mask = this.addChild(new PIXI.Graphics());

    // Number
    const textStyle = PreciseText.getTextStyle({fontSize: 24});
    this.number = this.addChild(new PreciseText("", textStyle));
    this.number.anchor.set(0.5, 0.5);
    this.number.position.set(16, -16);
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

    // Draw icon
    this.icon.texture = c.texture;
    this.icon.width = this.icon.height = c.size;
    this.icon.mask.clear().beginFill(0x000000, 1.0)
      .drawRoundedRect(c.size/-2, c.size/-2, c.size, c.size, c.borderRadius || c.size/5);
    this.icon.alpha = c.alpha ?? 1.0;
    this.icon.tint = c.tint ?? 0xFFFFFF;

    // Active icons have a colorful border
    this.border.clear().lineStyle({width: c.borderWidth, color: c.borderColor});
    if ( typeof c.backgroundColor === "number" ) this.border.beginFill(c.backgroundColor, 1.0);
    const bs = c.size + 10;
    this.border.drawRoundedRect(bs/-2, bs/-2, bs, bs, c.borderRadius || bs/4);
    this.border.endFill();

    // Number
    this.number.text = c.text ?? "";
    this.number.visible = !!this.number.text;

    // Interactive hit area
    this.hitArea = new PIXI.Rectangle(-c.size/2, -c.size/2, c.size, c.size);
  }
}
CrucibleTalentIcon.greyscaleFilter.desaturate();
