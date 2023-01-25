
export default class CrucibleTalentIcon extends PIXI.Container {
  constructor(...args) {
    super(...args);

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
   * Configuration for this icon
   * @type {{borderColor: Color, text: string, texture: PIXI.Texture}}
   */
  config = {
    borderColor: undefined,
    borderWidth: 4,
    disabled: false,
    size: 50,
    text: undefined,
    texture: undefined
  };

  /**
   * The shared filter instance used by all disabled icons
   * @type {PIXI.filters.ColorMatrixFilter}
   */
  static disabledFilter = new PIXI.filters.ColorMatrixFilter();

  /**
   * Draw the talent tree icon
   * @param config
   * @returns {Promise<void>}
   */
  async draw(config={}) {
    foundry.utils.mergeObject(this.config, config);
    const {borderColor, borderWidth, disabled, text, texture, size} = this.config;
    const rr = [];

    // Draw icon
    this.icon.texture = texture;
    this.icon.width = this.icon.height = size;
    this.icon.mask.clear().beginFill(0x000000, 1.0).drawRoundedRect(size/-2, size/-2, size, size, size/5);
    this.icon.filters = disabled ? [this.constructor.disabledFilter] : [];

    // Draw Border
    this.border.clear().lineStyle({
      width: borderWidth,
      color: disabled ? 0x444444 : borderColor
    }).beginFill(0x000000, 1.0);
    const bs = size + 10;
    this.border.drawRoundedRect(bs/-2, bs/-2, bs, bs, bs/4);
    this.border.endFill();

    // Number
    this.number.text = text || "";
    this.number.visible = !!this.number.text;
  }
}

// Set disabled filter to desaturate
CrucibleTalentIcon.disabledFilter.desaturate();
