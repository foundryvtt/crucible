import CrucibleTalentTree from "./talent-tree.mjs";
import CrucibleTalentIcon from "./talent-icon.mjs";

export default class CrucibleTalentTreeNode extends CrucibleTalentIcon {
  constructor(node, config) {
    super(config);

    // Node assignment
    this.node = node;
    this.position.set(node.point.x, node.point.y);

    // Mouse Interaction
    this.interactionManager = new MouseInteractionManager(this, canvas.stage, {
      hoverIn: true,
      hoverOut: true
    }, {
      hoverIn: this.#onPointerOver,
      hoverOut: this.#onPointerOut,
      clickLeft: this.#onClickLeft
    });
    this.interactionManager.activate();
  }

  /**
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
  }

  /** @override */
  async draw(config) {
    await super.draw(config);
    const {accessible, borderColor} = this.config;
    this.icon.tint = accessible ? borderColor.mix(new Color(0xFFFFFF), 0.25) : 0xFFFFFF;
  }

  /**
   * Is this node currently active?
   * @type {boolean}
   */
  get isActive() {
    return game.system.tree.active === this;
  }

  #onClickLeft(event) {
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

  #onPointerOver(event) {
    this.scale.set(1.2, 1.2);
    game.system.tree.hud.activate(this);
    if ( this.isActive ) return; // Don't un-hover an active node
    this.zIndex = CrucibleTalentTree.SORT_INDICES.HOVER;
  }

  #onPointerOut(event) {
    this.scale.set(1.0, 1.0);
    game.system.tree.hud.clear();
    if ( this.isActive ) return; // Don't un-hover an active node
    this.zIndex = CrucibleTalentTree.SORT_INDICES.INACTIVE;
  }
}

