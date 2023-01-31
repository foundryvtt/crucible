import CrucibleTalentNode from "../config/talent-tree.mjs";
import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentChoiceWheel from "./talent-choice-wheel.mjs";
import CrucibleTalentHUD from "./talent-hud.mjs";
import TalentData from "../data/talent.mjs";


export default class CrucibleTalentTree extends InteractionLayer {
  constructor(...args) {
    super(...args);
    game.system.tree = this;
    this.visible = false;
  }

  static #TREE_SCENE_ID = "XTz8NrEeavbUDh4r";

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

  /**
   * A reference to the talent tree choice wheel
   * @type {CrucibleTalentChoiceWheel}
   */
  wheel;

  /**
   * A mapping which tracks the current node states
   * @type {Map<CrucibleTalentNode,number>}
   */
  state = new Map();

  /**
   * Record the prior Scene that was active before switching to the Talent Tree.
   * @type {Scene}
   */
  priorScene;

  /* -------------------------------------------- */

  get tree() {
    return CrucibleTalentNode.nodes;
  }

  /* -------------------------------------------- */

  /** @override */
  async open(actor) {

    // Assign the actor
    this.actor = actor;
    actor.sheet.render(false);

    // Activate the Scene
    if ( canvas.id !== CrucibleTalentTree.#TREE_SCENE_ID ) {
      this.priorScene = canvas.scene;
      const scene = game.scenes.get(CrucibleTalentTree.#TREE_SCENE_ID);
      await scene.view();
    }
    else await this.draw();

    // Activate the layer
    this.activate();
  }

  /* -------------------------------------------- */

  /** @override */
  async close() {

    // Deactivate the layer
    this.deactivate();

    // Clear the actor
    const actor = this.actor;
    this.actor = null;
    actor?.sheet.render(false);

    // Switch Scenes
    const scene = this.priorScene;
    this.priorScene = null;
    if ( scene ) await scene.view();
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
    this.wheel.deactivate();
    this.hud.clear();
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw() {
    this.center = canvas.dimensions.rect.center;

    // Draw Background
    this.bg = this.addChild(new PIXI.Graphics());
    this.#drawBackground();

    // Draw Center
    const textStyle = PreciseText.getTextStyle({fontSize: 28});
    this.character = this.addChild(new PIXI.Container());
    this.character.icon = this.character.addChild(new PIXI.Sprite());
    this.character.points = this.character.addChild(new PreciseText("", textStyle));
    this.character.name = this.character.addChild(new PreciseText("", textStyle));

    // Draw character portrait
    const actorTexture = this.actor ? await loadTexture(this.actor.img) : undefined;
    this.#drawCharacter(actorTexture);

    // Background connections
    this.edges = this.addChild(new PIXI.Graphics());
    this.edges.lineStyle({color: 0x000000, alpha: 0.2, width: 4});

    // Active connections
    this.connections = this.addChild(new PIXI.Graphics());

    // Draw Nodes and Edges
    this.nodes = this.addChild(new PIXI.Container());
    this.nodes.sortableChildren = true;
    const origin = CrucibleTalentNode.nodes.get("origin");
    await this.#drawNodes(origin.connected, new Set([origin]));
    this.#drawCircles();

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
    const ox = (r.width  - width) / 2;
    const oy = (r.height - height) / 2;
    const points = HexagonalGrid.FLAT_HEX_BORDERS["1"].map(d => [(width * d[0]) + ox, (height * d[1]) + oy]);

    // Sectors
    const colors = Object.values(CrucibleTalentNode.ABILITY_COLORS);
    for ( let i=0; i<points.length; i++ ) {
      const shape = new PIXI.Polygon([this.center.x, this.center.y, ...points.at(i-1), ...points.at(i)]);
      this.bg.beginFill(colors[i].multiply(0.4), 1.0).drawShape(shape).endFill();
    }

    // Center Hex
    const cd = HexagonalGrid.computeDimensions({columns: true, even: true, size: 400});
    const ocx = this.center.x - (cd.width / 2);
    const ocy = this.center.y - (cd.height / 2);
    const cp = HexagonalGrid.FLAT_HEX_BORDERS["1"].flatMap(d => [ocx + (cd.width * d[0]), ocy + (cd.height * d[1])]);
    this.bg.lineStyle({color: 0x444444, width: 4})
      .beginFill(0x111111, 1.0)
      .drawPolygon(cp)
      .endFill();
  }

  /* -------------------------------------------- */

  #drawCharacter(texture) {
    if ( !this.actor ) return this.character.visible = false;
    this.character.position.set(this.center.x, this.center.y);
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
    this.getActiveNodes();

    // Draw node changes
    this.connections.clear();
    const seen = new Set();
    for ( const node of CrucibleTalentNode.nodes.values() ) {
      if ( node.tier < 0 ) continue;
      const state = this.state.get(node);
      node.icon?.draw({active: state === 2, accessible: state > 0});
      if ( state === 2 ) this.#drawConnections(node, seen);
      seen.add(node);
    }

    // Refresh talent wheel
    this.wheel.refresh();
  }

  /* -------------------------------------------- */

  #drawConnections(node, seen) {
    for ( const c of node.connected ) {
      if ( seen.has(c) || (c.tier < 0) || (this.state.get(c) < 2) ) continue;
      this.connections.lineStyle({color: 0x000000, width: 8, alpha: 1.0})
        .moveTo(node.point.x, node.point.y)
        .lineTo(c.point.x, c.point.y)
        .lineStyle({color: c.color, width: 4, alpha: 1.0})
        .moveTo(node.point.x, node.point.y)
        .lineTo(c.point.x, c.point.y);
    }
  }

  /* -------------------------------------------- */

  async #drawNodes(nodes, seen=new Set()) {
    const next = [];
    for ( const node of nodes ) {
      if ( seen.has(node) ) continue;
      await this.#drawNode(node);
      this.#drawEdges(node, seen);
      seen.add(node);
      next.push(...node.connected);
      if ( node.twin ) next.push(CrucibleTalentNode.nodes.get(node.twin));
    }
    if ( next.length ) await this.#drawNodes(next, seen);
  }

  /* -------------------------------------------- */

  async #drawNode(node) {

    // Configure the node icon
    const config = {};
    const icons = CrucibleTalentTreeNode.NODE_TYPE_ICONS;
    config.texture = await loadTexture(icons[node.type] || icons.default);
    config.borderColor = node.color;
    config.text = node.talents.size;

    // Create the Node icon
    const icon = node.icon = new CrucibleTalentTreeNode(node, config);
    await icon.draw();
    this.nodes.addChild(icon);
  }

  /* -------------------------------------------- */

  #drawEdges(node, seen) {
    for ( const c of node.connected ) {
      if ( seen.has(c) ) continue;
      this.edges.moveTo(node.point.x, node.point.y);
      this.edges.lineTo(c.point.x, c.point.y);
    }
  }

  /* -------------------------------------------- */

  #drawCircles() {
    this.edges.drawCircle(this.center.x, this.center.y, 800);
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

  /* -------------------------------------------- */

  /**
   * Traverse the talent tree, acquiring a Set of nodes which are currently accessible.
   * @returns {Map<CrucibleTalentNode, number>}
   */
  getActiveNodes() {
    const state = this.state;
    const actor = this.actor;
    state.clear();

    function isPurchased(node, actor) {
      for ( const talent of node.talents ) {
        if ( actor.talentIds.has(talent.id) ) return true;
      }
      return false;
    }

    function updateBatch(nodes) {
      const next = [];
      for ( const n of nodes ) {
        if ( state.has(n) ) continue;

        // Verify whether the node is accessible
        const a = TalentData.testPrerequisites(actor, n.prerequisites);
        const accessible = Object.values(a).every(r => r.met);
        if ( !accessible ) {
          state.set(n, 0);
          continue;
        }

        // Check whether a talent has been purchased
        const p = isPurchased(n, actor);
        const s = p ? 2 : 1;
        state.set(n, s);

        // If the node was accessible, add connected nodes to the next batch
        if ( (n.id === "origin") || p ) next.push(...n.connected);

        // Record twinned nodes
        if ( n.twin ) {
          const twin = CrucibleTalentNode.nodes.get(n.twin);
          state.set(twin, s);
          next.push(...twin.connected);
        }
      }
      if ( next.length ) updateBatch(next);
    }

    updateBatch([CrucibleTalentNode.nodes.get("origin")]);
    return state;
  }
}
