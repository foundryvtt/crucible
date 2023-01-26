import CrucibleTalentIcon from "./talent-icon.mjs";
import CrucibleTalentNode from "../config/talent-tree.mjs";
import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentChoiceWheel from "./talent-choice-wheel.mjs";
import CrucibleTalentHUD from "./talent-hud.mjs";

export default class CrucibleTalentTree extends InteractionLayer {
  constructor(...args) {
    super(...args);
    game.system.tree = this;
    this.visible = false;
  }

  static SORT_INDICES = {
    INACTIVE: 0,
    HOVER: 10,
    WHEEL: 20,
    ACTIVE: 30
  }

  /**
   * A reference to the Actor which is currently bound to the talent tree.
   * @type {CrucibleActor|null}
   */
  actor = null;

  /**
   * A reference to the active node
   * @type {CrucibleTalentTreeNode}
   */
  active;

  /**
   * A reference to the talent tree HUD
   * @type {CrucibleTalentHUD}
   */
  hud = new CrucibleTalentHUD();

  /* -------------------------------------------- */

  async activate({actor, ...options}={}) {
    this.actor = actor;
    const actorTexture = await loadTexture(this.actor.img);
    this.#drawCharacter(actorTexture);
    this.refresh();
    super.activate(options);
  }

  /* -------------------------------------------- */

  /** @override */
  _activate() {
    this.visible = true;
  }

  /* -------------------------------------------- */

  /** @override */
  _deactivate() {
    this.actor = null;
    this.visible = false;
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {

    // Draw Background
    this.bg = this.addChild(new PIXI.Graphics());
    this.#drawBackground();

    // Draw Center
    const textStyle = PreciseText.getTextStyle({fontSize: 28});
    this.character = this.addChild(new PIXI.Container());
    this.character.icon = this.character.addChild(new PIXI.Sprite());
    this.character.points = this.character.addChild(new PreciseText("", textStyle));
    this.character.name = this.character.addChild(new PreciseText("", textStyle));
    this.#drawCharacter();

    // Draw Nodes and Edges
    this.connections = this.addChild(new PIXI.Graphics());
    this.connections.lineStyle({color: 0x000000, width: 4});
    this.nodes = this.addChild(new PIXI.Container());
    this.nodes.sortableChildren = true;
    const origin = CrucibleTalentNode.nodes.get("origin");
    this.#drawNodes(origin.connected, new Set([origin]));

    // Create Choice Wheel
    this.wheel = this.nodes.addChild(new CrucibleTalentChoiceWheel());
    this.wheel.zIndex = CrucibleTalentTree.SORT_INDICES.WHEEL;

    // Set initial display
    this.refresh();
  }

  /* -------------------------------------------- */

  #drawBackground() {

    // Compute dimensions
    const r = canvas.dimensions.rect;
    const {width, height} = HexagonalGrid.computeDimensions({columns: true, even: true, size: 12000});
    const center = r.center;
    const ox = (r.width  - width) / 2;
    const oy = (r.height - height) / 2;
    const points = HexagonalGrid.FLAT_HEX_BORDERS["1"].map(d => [(width * d[0]) + ox, (height * d[1]) + oy]);

    // Sectors
    const colors = Object.values(CrucibleTalentNode.ABILITY_COLORS);
    for ( let i=0; i<points.length; i++ ) {
      const shape = new PIXI.Polygon([center.x, center.y, ...points.at(i-1), ...points.at(i)]);
      this.bg.beginFill(colors[i].multiply(0.4), 1.0).drawShape(shape).endFill();
    }

    // Center Hex
    const cd = HexagonalGrid.computeDimensions({columns: true, even: true, size: 400});
    const ocx = center.x - (cd.width / 2);
    const ocy = center.y - (cd.height / 2);
    const cp = HexagonalGrid.FLAT_HEX_BORDERS["1"].flatMap(d => [ocx + (cd.width * d[0]), ocy + (cd.height * d[1])]);
    this.bg.lineStyle({color: 0x444444, width: 4})
      .beginFill(0x111111, 1.0)
      .drawPolygon(cp)
      .endFill();
  }

  /* -------------------------------------------- */

  #drawCharacter(texture) {
    if ( !this.actor ) return this.character.visible = false;
    const r = canvas.dimensions.rect;
    const c = r.center;
    this.character.position.set(c.x, c.y);
    if ( texture ) this.character.icon.texture = texture;
    this.character.icon.width = this.character.icon.height = 200;
    this.character.icon.anchor.set(0.5, 0.5);

    // Nameplate
    this.character.name.text = this.actor.name;
    this.character.name.anchor.set(0.5, 1);
    this.character.name.position.set(0, -110);

    // Points
    this.character.points.anchor.set(0.5, 0);
    this.character.points.position.set(0, 110);

    // Visibility
    this.character.visible = true;
  }

  /* -------------------------------------------- */

  /**
   * Refresh display of the talent tree, incorporating updated data about the Actor's purchased Talents.
   */
  refresh() {
    if ( !this.actor ) return;
    this.character.points.text = `${this.actor.points.talent.available} Points Available`;
  }

  /* -------------------------------------------- */

  #drawNodes(nodes, seen=new Set()) {
    const next = [];
    for ( const node of nodes ) {
      if ( seen.has(node) ) continue;
      this.#drawNode(node);
      this.#drawEdges(node, seen);
      seen.add(node);
      next.push(...node.connected);
    }
    if ( next.length ) this.#drawNodes(next, seen);
  }

  /* -------------------------------------------- */

  #drawNode(node) {
    const g = new CrucibleTalentTreeNode(node);
    g.draw();
    this.nodes.addChild(g);
  }

  /* -------------------------------------------- */

  #drawEdges(node, seen) {
    for ( const c of node.connected ) {
      if ( seen.has(c) ) continue;
      this.connections.moveTo(node.point.x, node.point.y);
      this.connections.lineTo(c.point.x, c.point.y);
    }
  }

  /* -------------------------------------------- */

  activateNode(node) {
    if ( this.active ) this.deactivateNode();
    this.active = node;
    this.active.zIndex = CrucibleTalentTree.SORT_INDICES.ACTIVE;
    this.wheel.activate(node);
  }

  /* -------------------------------------------- */

  deactivateNode() {
    if ( !this.active ) return;
    this.active.zIndex = CrucibleTalentTree.SORT_INDICES.INACTIVE;
    this.wheel.deactivate();
    this.active = null;
  }
}
