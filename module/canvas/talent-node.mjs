

export default class CrucibleTalentTreeNode extends PIXI.Container {
  constructor(node) {
    super();
    this.node = node;
    this.position.set(node.point.x, node.point.y);

    // Border
    this.border = this.addChild(new PIXI.Graphics());

    // Icon
    this.icon = this.addChild(new PIXI.Sprite());
    this.icon.width = 100;
    this.icon.height = 100;
    this.icon.anchor.set(0.5, 0.5);

    // Icon Mask
    this.icon.mask = this.addChild(new PIXI.Graphics());
    this.icon.mask.beginFill(0x000000, 1.0).drawRoundedRect(-50, -50, 100, 100, 20).endFill();


    // Number
    const textStyle = PreciseText.getTextStyle({fontSize: 48});
    this.number = this.addChild(new PreciseText("", textStyle));
    this.number.anchor.set(0.5, 0.5);
    this.number.position.set(30, -30);

    // Mouse Interaction
    this.interactionManager = new MouseInteractionManager(this, canvas.stage, {
      hoverIn: true,
      hoverOut: true
    }, {
      hoverIn: this.#onPointerOver,
      hoverOut: this.#onPointerOut
    });
    this.interactionManager.activate();
  }

  async draw({radius=50}={}) {

    // Draw Icon
    if ( this.node.talents.size ) {
      const t = this.node.talents.first();
      const tex = await loadTexture(t.img);
      this.icon.texture = tex;
    }

    // Draw Border
    this.border.clear().lineStyle({width: 6, color: this.node.color}).beginFill(0x000000, 1.0);
    this.border.drawRoundedRect(-60, -60, 120, 120, 30);
    this.border.endFill();

    // Number
    this.number.text = this.node.talents.size > 1 ? this.node.talents.size : "";
  }

  #onPointerOver(event) {
    this.scale.set(1.2, 1.2);
    console.log("HOVER IN");
  }

  #onPointerOut(event) {
    this.scale.set(1.0, 1.0);
    console.log("HOVER OUT");
  }
}

