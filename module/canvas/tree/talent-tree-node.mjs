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

  /** @override */
  async draw({state, ...config}={}) {
    const spritesheet = crucible.tree.spritesheet;
    config.texture = spritesheet[`${this.node.iconPrefix}`];
    config.backgroundColor = 0x000000;
    config.underglow = false;

    // Accessible Nodes
    if ( state.accessible ) {
      config.alpha = 0.4;
      config.borderColor = 0x827f7d;
      config.tint = 0xFFFFFF;
      config.frameTint = 0xFFFFFF;
      config.splooshColor = this.node.color;
    }

    // Inaccessible Nodes
    else {
      config.alpha = 0.1;
      config.borderColor = 0x262322;
      config.tint = Color.fromHSL([this.node.color.hsl[0], 0.2, 0.15]);
      config.frameTint = Color.from(0xFFFFFF).multiply(0.25);
      config.splooshColor = Color.fromHSL([this.node.color.hsl[0], 0.33, 0.15]);
    }

    // Empty Nodes
    if ( !this.node.talents.size ) config.borderColor = Color.from("#210d45");

    // Purchased Nodes
    if ( state.purchased ) {
      config.alpha = 1.0;
      config.underglow = true;
    }

    // Banned Nodes
    else if ( state.banned ) config.borderColor = 0x330000;

    // Further configuration based on node style
    let style = this.node.style;
    if ( (style === "rect") && this.node.isPassive ) style = "circle";
    switch (style ) {
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
        break;
    }

    // Draw icon and activate interactivity
    await super.draw(config);
    this.#activateInteraction();
  }

  /* -------------------------------------------- */

  #activateInteraction() {
    this.removeAllListeners();
    this.on("pointerover", this.#onPointerOver.bind(this));
    this.on("pointerout", this.#onPointerOut.bind(this));
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

    // Empty Nodes
    if ( !nodeTalents.size ) return this.#onToggleEmptyNode();

    // Deactivate Node
    if ( this.isActive ) {
      tree.deactivateNode();
      this.#onPointerOut(event);
    }

    // Activate Node
    else {
      this.#onPointerOver(event);
      tree.activateNode(this);
    }
  }

  /* -------------------------------------------- */

  #onPointerOver(event) {
    const tree = crucible.tree;
    if ( !tree.app.renderer.enabled || (event.nativeEvent.target !== tree.canvas) ) return;
    tree.hud.activate(this);
    this.scale.set(1.2, 1.2);
  }

  /* -------------------------------------------- */

  #onPointerOut(event) {
    const tree = game.system.tree;
    if ( !tree.app.renderer.enabled || (event.nativeEvent.target !== tree.canvas) ) return;
    tree.hud.clear();
    if ( this.isActive ) return; // Don't un-hover an active node
    this.scale.set(1.0, 1.0);
  }

  /* -------------------------------------------- */

  /**
   * Toggle ownership of an empty node.
   * @returns {Promise<void>}
   */
  async #onToggleEmptyNode() {
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

