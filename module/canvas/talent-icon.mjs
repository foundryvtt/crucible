
export default class CrucibleTalentIcon extends PIXI.Container {
  constructor(config) {
    super(config);

    /**
     * Configuration for this icon
     * @type {object}
     */
    this.config = Object.assign({
      active: false,
      accessible: false,
      backgroundColor: 0x000000,
      borderColor: undefined,
      borderWidth: 4,
      borderRadius: undefined,
      size: 50,
      text: undefined,
      texture: undefined
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

  /**
   * The shared filter instance used by all inaccessible icons
   * @type {PIXI.filters.ColorMatrixFilter}
   */
  static greyscaleFilter = new PIXI.filters.ColorMatrixFilter();

  /**
   * Draw the talent tree icon
   * @param config
   * @returns {Promise<void>}
   */
  async draw(config={}) {
    const {active, accessible, backgroundColor, borderColor, borderRadius, borderWidth,
      text, texture, size} = Object.assign(this.config, config);

    // Draw icon
    this.icon.texture = texture;
    this.icon.width = this.icon.height = size;
    this.icon.mask.clear().beginFill(0x000000, 1.0).drawRoundedRect(size/-2, size/-2, size, size, borderRadius || size/5);

    // Inaccessible icons are greyscale
    this.icon.filters = accessible ? [] : [this.constructor.greyscaleFilter];
    this.icon.alpha = active ? 1.0 : 0.6;

    // Active icons have a colorful border
    this.border.clear().lineStyle({
      width: borderWidth,
      color: active ? borderColor : 0x444444
    })
    if ( typeof backgroundColor === "number" ) this.border.beginFill(backgroundColor, 1.0);
    const bs = size + 10;
    this.border.drawRoundedRect(bs/-2, bs/-2, bs, bs, borderRadius || bs/4);
    this.border.endFill();

    // Number
    this.number.text = text || "";
    this.number.visible = !!this.number.text;
  }
}
CrucibleTalentIcon.greyscaleFilter.desaturate();
