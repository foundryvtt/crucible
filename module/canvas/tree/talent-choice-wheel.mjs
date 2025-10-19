import CrucibleTalentTreeTalent from "./talent-tree-talent.mjs";

/**
 * A canvas UI element which displays a choice wheel for a talent tree node.
 * Only one choice wheel is displayed at a given time. The wheel is a singleton at canvas.tree.wheel.
 */
export default class CrucibleTalentChoiceWheel extends PIXI.Container {
  constructor() {
    super();

    /**
     * Background graphics for the wheel
     * @type {PIXI.Sprite}
     */
    this.bg = this.addChild(new PIXI.Sprite());

    /**
     * Edges for showing connections
     * @type {PIXI.Graphics}
     */
    this.edges = this.addChild(new PIXI.Graphics());

    /**
     * Talents available within this wheel
     * @type {PIXI.Container}
     */
    this.talents = this.addChild(new PIXI.Container());
  }

  /* -------------------------------------------- */

  /**
   * The node which the wheel is currently bound to, or null
   * @type {CrucibleTalentTreeNode|null}
   */
  node = null;

  /* -------------------------------------------- */

  /**
   * Activate the talent tree choice wheel for a given node
   * @param {CrucibleTalentTreeNode} node
   * @returns {Promise<void>}
   */
  async activate(node) {
    const tree = game.system.tree;

    // Swap the node
    this.node = node;
    tree.nodes.removeChild(node);
    tree.foreground.addChild(node);

    // Set position
    this.position.set(node.x, node.y);
    this.radius = node.config.size + 64;
    this.#drawBackground();
    await this.#drawTalents();
    this.refresh(); // Set initial display
    this.visible = true;
    this.eventMode = "passive";
  }

  /* -------------------------------------------- */

  /**
   * Activate the talent tree choice wheel.
   */
  deactivate() {
    const tree = game.system.tree;
    if ( this.node ) {
      tree.foreground.removeChild(this.node);
      tree.nodes.addChild(this.node);
    }
    this.edges.clear();
    this.talents.removeChildren().forEach(t => t.destroy());
    this.visible = false;
    this.node = null;
  }

  /* -------------------------------------------- */

  /**
   * Draw the wheel background.
   */
  #drawBackground() {
    this.bg.texture = crucible.tree.spritesheet.WheelMinimal;
    this.bg.anchor.set(0.5, 0.5);
    this.bg.width = this.bg.height = this.radius * 2.7; // 2.7 accounts for 35% wheel texture padding
  }

  /* -------------------------------------------- */

  /**
   * Draw TalentIcon containers to the wheel
   * @returns {Promise<void>}
   */
  async #drawTalents() {
    const talents = this.#getNodeTalents();
    const shape = new PIXI.Circle(0, 0, this.radius);
    const a = (2 * Math.PI) / talents.length;
    let i = 0;
    const color = this.node.node.color;
    for ( const talent of talents ) {
      const isOwned = crucible.tree.actor.talentIds.has(talent.id);
      const position = shape.pointAtAngle((i * a) - (Math.PI / 2) + (a/2));
      await foundry.canvas.loadTexture(talent.img);
      const icon = new CrucibleTalentTreeTalent(this.node, talent, position);
      this.talents.addChild(icon);
      i++;

      // Draw connecting line
      this.edges.moveTo(0, 0)
        .lineStyle({color: "#502c1a", width: 12}).lineTo(icon.x, icon.y)
        .lineStyle({color: isOwned ? color : "#24160f", width: 6}).lineTo(0, 0)
    }
  }

  /* -------------------------------------------- */

  /**
   * Get all the unique Talents which appear on this Node.
   * @returns {CrucibleItem[]}
   */
  #getNodeTalents() {
    const actor = game.system.tree.actor;
    const allTalents = [];
    const seen = new Set();

    // Talents configured for the node
    const nodeTalents = this.node.node.talents;
    for ( const t of nodeTalents ) {
      seen.add(t.id);
      allTalents.push(t);
    }

    // Talents that are owned but not ordinarily configured for the node
    const ownedTalents = actor.system.talentNodes[this.node.node.id]?.map(id => actor.items.get(id)) || [];
    for ( const t of ownedTalents ) {
      if ( seen.has(t.id) ) continue;
      allTalents.push(t);
    }
    return allTalents;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the display of the Talent wheel when the Actor's purchased Talents change.
   */
  refresh() {
    const tree = game.system.tree;
    const actor = tree.actor;
    if ( !actor ) return;
    for ( const talentIcon of this.talents.children ) {
      const {node, talent} = talentIcon;
      const active = actor.talentIds.has(talent.id);
      talentIcon.draw({
        accessible: active || (tree.state.get(node.node) && talent.system.assertPrerequisites(actor, false)),
        active
      });
    }
  }
}
