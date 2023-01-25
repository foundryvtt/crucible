import CrucibleTalentTree from "./talent-tree.mjs";
import CrucibleTalentIcon from "./talent-icon.mjs";

export default class CrucibleTalentTreeNode extends CrucibleTalentIcon {
  constructor(node) {
    super();

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
    utility: "icons/magic/symbols/cog-shield-white-blue.webp",
  }

  /**
   * Is this node currently active?
   * @type {boolean}
   */
  get isActive() {
    return game.system.tree.active === this;
  }

  async draw(config={}) {

    // Is available?
    config.disabled = this.node.talents.size === 0;

    // Load Texture
    const icons = CrucibleTalentTreeNode.NODE_TYPE_ICONS;
    const icon = icons[this.node.type] || icons.default;
    config.texture = await loadTexture(icon);

    // Configure
    config.borderColor = this.node.color;
    config.text = this.node.talents.size > 1 ? this.node.talents.size : "";

    // Draw icon
    return super.draw(config);
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
    if ( this.isActive ) return; // Don't un-hover an active node
    this.scale.set(1.2, 1.2);
    this.zIndex = CrucibleTalentTree.SORT_INDICES.HOVER;
  }

  #onPointerOut(event) {
    if ( this.isActive ) return; // Don't un-hover an active node
    this.scale.set(1.0, 1.0);
    this.zIndex = CrucibleTalentTree.SORT_INDICES.INACTIVE;
  }
}

