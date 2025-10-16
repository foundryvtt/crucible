import CrucibleTalentIcon from "./talent-icon.mjs";

export default class CrucibleTalentTreeNode extends CrucibleTalentIcon {
  constructor(node, config) {
    super(config);
    this.node = node;
    this.position.set(node.point.x, node.point.y);
  }

  /* -------------------------------------------- */

  /**
   * Is this node currently active?
   * @type {boolean}
   */
  get isActive() {
    return game.system.tree.active === this;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configure(config) {
    const state = config.state;
    config = super._configure(config);
    const spritesheet = crucible.tree.spritesheet;

    // Defaults
    config.texture = spritesheet[`${this.node.iconPrefix}`];
    config.splooshColor = this.node.color;
    config.underglowColor = null;

    // Purchased Nodes
    if ( state.purchased ) {
      config.underglowColor = this.node.color;
    }

    // Accessible Nodes
    else if ( state.accessible ) {
      config.tint = Color.fromHSL([this.node.color.hsl[0], 0.05, 0.4]);
      config.frameTint = Color.from(0xFFFFFF).multiply(0.5);
      config.splooshColor = this.node.color.multiply(0.5);
    }

    // Inaccessible Nodes
    else {
      config.borderColor = 0x262322;
      config.tint = Color.fromHSL([this.node.color.hsl[0], 0.1, 0.2]);
      config.frameTint = Color.from(0xFFFFFF).multiply(0.25);
      config.splooshColor = Color.fromHSL([this.node.color.hsl[0], 0.33, 0.15]);
    }

    // Further configuration based on node style
    let style = this.node.style;
    if ( (style === "rect") && this.node.isPassive ) style = "circle";
    switch ( style ) {
      case "circle":
        config.shape = "circle";
        config.size = 64;
        config.frameTexture = spritesheet.FrameCircleSmallBronze;
        break;
      case "hex":
        config.shape = "hex";
        config.size = 64;
        config.frameTexture = spritesheet.FrameHexSmallBronze;
        break;
      case "rect":
        config.shape = "rect";
        config.size = 64;
        config.frameTexture = spritesheet.FrameSquareSmallBronze;
        break;
      case "largeHex":
        config.shape = "hex";
        config.size = config.borderRadius = 130;
        config.frameTexture = spritesheet.FrameHexLargeBronze;
        break;
      case "originHex":
        config.alpha = 1.0;
        config.shape = "hex";
        config.size = config.borderRadius = 200;
        config.frameTexture = spritesheet.FrameHexOriginHeated;
        config.underglowColor = null;
        break;
    }
    return config;
  }

  /* -------------------------------------------- */

  /** @override */
  async draw(config={}) {
    await super.draw(config);

    // Smaller icons
    this.icon.width = this.icon.height = this.config.size * 0.75;
    this.#activateInteraction();
  }

  /* -------------------------------------------- */

  #activateInteraction() {
    this.removeAllListeners();
    this.on("pointerover", this._onPointerOver.bind(this));
    this.on("pointerout", this._onPointerOut.bind(this));
    this.on("pointerdown", this.#onClickLeft.bind(this));
    this.eventMode = "static";
    this.cursor = "pointer";
  }

  /* -------------------------------------------- */

  #onClickLeft(event) {
    event.stopPropagation();
    if ( event.data.originalEvent.button !== 0 ) return; // Only support standard left-click
    const tree = game.system.tree;
    const ownedTalents = tree.actor.system.talentNodes[this.node.id] || [];
    const nodeTalents = new Set([...this.node.talents, ...ownedTalents])

    // Toggle node active state
    if ( !nodeTalents.size ) return this.#onToggleEmptyNode();
    if ( this.isActive ) tree.deactivateNode({event, hover: false});
    else tree.activateNode(this, {event});
  }

  /* -------------------------------------------- */

  /** @internal */
  _onPointerOver(event) {
    const tree = crucible.tree;
    if ( !tree.app.renderer.enabled || (event.nativeEvent.target !== tree.canvas) ) return;
    tree.hud.activate(this);
    const s = (this.config.size + 8) / this.config.size;
    this.scale.set(s, s);
    if ( this.node.id !== "origin" ) {
      this.underglow.tint = this.node.color;
      this.underglow.visible = true;
    }
  }

  /* -------------------------------------------- */

  /** @internal */
  _onPointerOut(event) {
    const tree = game.system.tree;
    if ( !tree.app.renderer.enabled || (event.nativeEvent.target !== tree.canvas) ) return;
    tree.hud.clear();
    if ( this.isActive ) return; // Don't un-hover an active node
    this.scale.set(1.0, 1.0);
    this.underglow.visible = !!this.config.underglowColor;
  }

  /* -------------------------------------------- */

  /**
   * Toggle ownership of an empty node.
   * @returns {Promise<void>}
   */
  async #onToggleEmptyNode() {
    if ( this.node.id === "origin" ) return;
    const actor = game.system.tree.actor;
    const purchased = this.node.isPurchased(actor);
    if ( !purchased && !actor.points.talent.available ) return;
    const talents = new Set(actor.system.advancement.talentNodes);
    const msg = purchased ? `<p>Remove point spent on empty node "${this.node.id}"?</p>`
      : `<p>Spend talent point to purchase empty node "${this.node.id}"?</p>`;
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Purchase Talent Node?"
      },
      content: msg
    });
    if ( !confirm ) return;
    if ( purchased ) talents.delete(this.node.id);
    else talents.add(this.node.id);
    await actor.update({"system.advancement.talentNodes": talents});
  }
}

