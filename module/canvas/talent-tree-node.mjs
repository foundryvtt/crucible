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
    attack: "icons/skills/melee/hand-grip-sword-strike-orange.webp",
    defense: "icons/skills/melee/shield-block-gray-orange.webp",
    default: "icons/magic/symbols/question-stone-yellow.webp",
    magic: "icons/magic/symbols/circled-gem-pink.webp",
    move: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
    utility: "icons/magic/symbols/cog-shield-white-blue.webp",
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

