import CrucibleTalentNode from "../config/talent-tree.mjs";
import CrucibleTalentIcon from "./talent-icon.mjs";

export default class CrucibleTalentTreeNode extends CrucibleTalentIcon {
  constructor(node, config) {
    super(config);
    this.node = node;
    this.position.set(node.point.x, node.point.y);
  }

  /**cc
   * The icons used for different node types
   * @enum {string}
   */
  static NODE_TYPE_ICONS = {
    attack: "systems/crucible/icons/nodes/attack.webp",
    defense: "systems/crucible/icons/nodes/defense.webp",
    default: "systems/crucible/icons/nodes/unassigned.webp",
    heal: "systems/crucible/icons/nodes/healing.webp",
    magic: "systems/crucible/icons/nodes/magic.webp",
    move: "systems/crucible/icons/nodes/movement.webp",
    utility: "systems/crucible/icons/nodes/utility.webp",
    signature: "systems/crucible/icons/nodes/signature.webp"
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
  async draw({state=0, ...config}={}) {
    const states = CrucibleTalentNode.STATES;

    // Signature nodes
    if ( this.node.type === "signature" ) {
      config.size = 80;
      config.borderRadius = 80;
    }

    // Node state
    switch ( state ) {
      case states.BANNED:
        config.borderColor = config.tint = 0x330000;
        break;
      case states.PURCHASED:
        config.borderColor = this.node.color;
        config.tint = this.node.color.mix(new Color(0xFFFFFF), 0.25);
        break;
      case states.UNLOCKED:
        config.borderColor = 0x444444;
        config.tint = this.node.color.mix(new Color(0xFFFFFF), 0.25);
        break;
      case states.LOCKED:
        config.borderColor = 0x444444;
        config.tint = 0xFFFFFF;
        break;
    }
    config.alpha = state === states.PURCHASED ? 1.0 : 0.6;

    // Draw Icon
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
    if ( document.elementFromPoint(event.globalX, event.globalY).id !== "crucible-talent-tree" ) return;
    tree.hud.activate(this);
    this.scale.set(1.2, 1.2);
  }

  /* -------------------------------------------- */

  #onPointerOut(event) {
    const tree = game.system.tree;
    // TODO why are these safeguards necessary?
    if ( !tree.app.renderer.enabled ) return;
    if ( document.elementFromPoint(event.globalX, event.globalY).id !== "crucible-talent-tree" ) return;
    tree.hud.clear();
    if ( this.isActive ) return; // Don't un-hover an active node
    this.scale.set(1.0, 1.0);
  }
}

