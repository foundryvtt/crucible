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
    const variety = state.purchased ? this.node.abilities.first() : "inactive";
    const src = `systems/crucible/ui/tree/nodes/${this.node.iconPrefix}-${variety}.webp`;
    config.texture = foundry.canvas.getTexture(src);

    // Configure based on node style
    switch ( this.node.style ) {
      case "circle":
        config.shape = "circle";
        config.size = 48;
        config.borderRadius = config.size / 2;
        break;
      case "hex":
        config.shape = "hex";
        config.size = 48;
        break;
      case "rect":
        config.shape = "rect";
        config.size = 48;
        config.borderRadius = config.size / 6;
        break;
      case "largeHex":
        config.shape = "hex";
        config.size = 80;
        config.borderRadius = 80;
        break;
    }

    // Is the node accessible or not?
    if ( state.accessible ) {
      config.alpha = 0.4;
      config.borderColor = 0x827f7d;
    } else {
      config.alpha = 0.1;
      config.borderColor = 0x262322;
    }

    // Has the node been purchased?
    if ( state.purchased ) {
      config.alpha = 1.0;
      config.borderColor = this.node.color;
      config.borderWidth = 3;
    }

    // Has the node been banned?
    else if ( state.banned ) {
      config.borderColor = 0x330000;
    }

    // Draw Icon
    await super.draw(config);

    // Node interaction
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
    if ( this.isActive ) {
      tree.deactivateNode();
      this.#onPointerOut(event);
    }
    else {
      this.#onPointerOver(event);
      tree.activateNode(this);
    }
  }

  /* -------------------------------------------- */

  #onPointerOver(event) {
    const tree = game.system.tree;
    // TODO why are these safeguards necessary?
    if ( !tree.app.renderer.enabled ) return;
    if ( document.elementFromPoint(event.globalX, event.globalY)?.id !== "crucible-talent-tree" ) return;
    tree.hud.activate(this);
    this.scale.set(1.2, 1.2);
  }

  /* -------------------------------------------- */

  #onPointerOut(event) {
    const tree = game.system.tree;
    // TODO why are these safeguards necessary?
    if ( !tree.app.renderer.enabled ) return;
    if ( document.elementFromPoint(event.globalX, event.globalY)?.id !== "crucible-talent-tree" ) return;
    tree.hud.clear();
    if ( this.isActive ) return; // Don't un-hover an active node
    this.scale.set(1.0, 1.0);
  }
}

