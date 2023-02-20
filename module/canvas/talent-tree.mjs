import CrucibleTalentNode from "../config/talent-tree.mjs";
import CrucibleTalentTreeControls from "./talent-tree-controls.mjs";
import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentChoiceWheel from "./talent-choice-wheel.mjs";
import CrucibleTalentHUD from "./talent-hud.mjs";
import CrucibleTalent from "../data/talent.mjs";


export default class CrucibleTalentTree extends PIXI.Container {
  constructor() {
    super();
    this.#initialize();
  }

  /**
   * Has the talent tree been drawn yet?
   * @type {boolean}
   */
  #drawn = false;

  /**
   * The canvas element used to draw the tree.
   * @type {HTMLCanvasElement}
   */
  canvas;

  /**
   * The PIXI Application that controls the secondary canvas.
   * @type {PIXI.Application}
   */
  app;

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

  /* -------------------------------------------- */

  get tree() {
    return CrucibleTalentNode.nodes;
  }

  /* -------------------------------------------- */

  /**
   * Initialize the secondary canvas used for the talent tree.
   */
  #initialize() {

    // TODO Development mode
    this.developmentMode = game.data.options.debug && game.user.isGM;

    // Create the HTML canvas element
    Object.defineProperty(this, "canvas", {value: document.createElement("canvas"), writable: false});
    this.canvas.id = "crucible-talent-tree";
    this.canvas.hidden = true;
    document.body.appendChild(this.canvas);

    // Create the PIXI Application
    Object.defineProperty(this, "app", {value: new PIXI.Application({
        view: this.canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        transparent: false,
        resolution: 1,
        autoDensity: true,
        antialias: false,  // Not needed because we use SmoothGraphics
        powerPreference: "high-performance" // Prefer high performance GPU for devices with dual graphics cards
    }), writable: false});
    Object.defineProperty(this, "stage", {value: this.app.stage, writable: false});

    // Create the controls app
    Object.defineProperty(this, "controls", {value: new CrucibleTalentTreeControls(), writable: false});

    // Add this class to the canvas stage
    this.stage.addChild(this);
  }

  /* -------------------------------------------- */
  /*  Drawing                                     */
  /* -------------------------------------------- */

  /**
   * Draw the Talent Tree to the secondary canvas.
   * @returns {Promise<void>}
   */
  async draw() {
    if ( this.#drawn ) return;
    this.background = this.addChild(new PIXI.Container());
    this.foreground = this.addChild(new PIXI.Container());

    // Draw Background
    this.backdrop = this.background.addChild(await this.#drawBackdrop());
    this.bg = this.background.addChild(this.#drawBackground());

    // Draw Center
    this.character = this.foreground.addChild(new PIXI.Sprite());

    // Background connections
    this.edges = this.background.addChild(new PIXI.Graphics());
    this.edges.lineStyle({color: 0x000000, alpha: 0.35, width: 4});

    // Active connections
    this.connections = this.background.addChild(new PIXI.Graphics());

    // Draw Nodes and Edges
    this.nodes = this.background.addChild(new PIXI.Container());
    const origin = CrucibleTalentNode.nodes.get("origin");
    await this.#drawNodes(origin.connected, new Set([origin]));
    this.#drawCircles();

    // Background fade and filter
    this.background.darken = this.background.addChild(new PIXI.Graphics());
    this.background.blurFilter = new PIXI.filters.BlurFilter(1);
    this.background.filters = [this.background.blurFilter];
    this.background.blurFilter.enabled = false;

    // Create Choice Wheel
    this.wheel = this.foreground.addChild(new CrucibleTalentChoiceWheel());

    // Enable interactivity
    this.#activateInteractivity();

    // Draw initial conditions
    this.refresh();
    this.#drawn = true;
  }

  /* -------------------------------------------- */

  async #drawBackdrop() {
    const tex = await loadTexture("ui/backgrounds/setup.webp");
    const bd = new PIXI.Sprite(tex);
    bd.anchor.set(0.5, 0.5);
    bd.alpha = 0.25;
    return bd;
  }

  /* -------------------------------------------- */

  #drawBackground() {
    const bg = new PIXI.Graphics();

    // Compute hex points
    const {width, height} = HexagonalGrid.computeDimensions({columns: true, even: true, size: 12000});
    const ox = width / 2;
    const oy = height / 2;
    const points = HexagonalGrid.FLAT_HEX_BORDERS["1"].map(d => [(width * d[0]) - ox, (height * d[1]) - oy]);

    // Sectors
    bg.lineStyle({color: 0x000000, width: 2});
    const colors = Object.values(CrucibleTalentNode.ABILITY_COLORS);
    for ( let i=0; i<points.length; i++ ) {
      const shape = new PIXI.Polygon([0, 0, ...points.at(i-1), ...points.at(i)]);
      bg.beginFill(colors[i], 0.06).drawShape(shape).endFill();
    }

    // Center Hex
    const cd = HexagonalGrid.computeDimensions({columns: true, even: true, size: 400});
    const cx = cd.width / 2;
    const cy = cd.height / 2;
    const cp = HexagonalGrid.FLAT_HEX_BORDERS["1"].flatMap(d => [(cd.width * d[0]) - cx, (cd.height * d[1]) - cy]);
    bg.lineStyle({color: 0x000000, width: 2})
      .beginFill(0x0b0a13, 1.0)
      .drawPolygon(cp)
      .endFill();
    return bg;
  }

  /* -------------------------------------------- */

  #drawCharacter(texture) {
    if ( !this.actor ) return this.character.visible = false;
    if ( texture ) this.character.texture = texture;
    this.character.width = this.character.height = 200;
    this.character.anchor.set(0.5, 0.5);
    this.character.visible = true;
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
    this.edges.drawCircle(0, 0, 800);
    this.edges.drawCircle(0, 0, 1200);
    this.edges.drawCircle(0, 0, 1600);
  }

  /* -------------------------------------------- */
  /*  Tree Management                             */
  /* -------------------------------------------- */

  /**
   * Open the Talent Tree, binding it to a certain Actor
   * @param {CrucibleActor} actor
   */
  async open(actor) {
    if ( !(actor instanceof Actor) ) throw new Error("You must provide an actor to bind to the Talent Tree.")

    // Draw the tree (once only)
    await this.draw();
    for ( const layer of canvas.layers ) {
      if ( layer.hud?.clear instanceof Function ) layer.hud.clear();
    }
    this.darkenBackground(false);

    // Associate Actor
    this.actor = actor;
    const actorTexture = this.actor ? await loadTexture(this.actor.img) : undefined;
    this.#drawCharacter(actorTexture);
    await actor.sheet._render(false, {left: 20, top: 20});
    actor.sheet.minimize();

    // Refresh tree state
    this.pan({x: 0, y: 0, scale: 1.0});
    this.refresh();

    // Toggle visibility of UI elements
    this.app.renderer.enabled = true;
    this.canvas.hidden = false;
    if ( this.developmentMode ) this.canvas.style.zIndex = 0;
    else canvas.hud.element[0].style.zIndex = 9999;  // Move HUD above our canvas
  }

  /* -------------------------------------------- */

  /** @override */
  async close() {

    // Disassociate Actor
    const actor = this.actor;
    this.actor = null;
    await actor?.sheet.render(false);
    actor.sheet.maximize();

    // Deactivate UI
    this.wheel.deactivate();
    this.hud.clear();
    this.controls.close();

    // Toggle visibility of UI elements
    this.app.renderer.enabled = false;
    this.canvas.hidden = true;
    canvas.hud.element[0].style.zIndex = ""; // Move HUD back to normal
    canvas.hud.align();
  }

  /* -------------------------------------------- */

  /**
   * Refresh display of the talent tree, incorporating updated data about the Actor's purchased Talents.
   */
  refresh() {
    if ( !this.actor ) return;

    // Draw node changes
    this.getActiveNodes();
    this.connections.clear();
    const seen = new Set();
    for ( const node of CrucibleTalentNode.nodes.values() ) {
      if ( node.tier < 0 ) continue;
      const state = this.state.get(node);
      let text = state === 2 ? node.talents.reduce((n, t) => n + this.actor.talentIds.has(t.id), 0) : "";
      if ( this.developmentMode ) text = node.talents.size;
      node.icon?.draw({state, text});
      if ( state === 2 ) this.#drawConnections(node, seen);
      seen.add(node);
    }

    // Refresh talent wheel
    this.wheel.refresh();

    // Refresh controls
    this.controls.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Pan the visual position of the talent tree canvas.
   * @param {number} x
   * @param {number} y
   * @param {number} scale
   */
  pan({x, y, scale}) {
    x ??= this.stage.pivot.x;
    y ??= this.stage.pivot.y;
    scale ??= this.stage.scale.x;
    // TODO - constrain x, y, scale
    this.stage.pivot.set(x, y);
    this.stage.scale.set(scale, scale);
    this.#alignHUD();
  }

  /* -------------------------------------------- */
  /*  Talent Management                           */
  /* -------------------------------------------- */

  activateNode(node) {
    if ( this.active ) this.deactivateNode();
    this.active = node;
    this.wheel.activate(node);
    this.darkenBackground(true);
  }

  /* -------------------------------------------- */

  deactivateNode() {
    if ( !this.active ) return;
    this.wheel.deactivate();
    this.active = null;
    this.darkenBackground(false);
  }

  /* -------------------------------------------- */

  darkenBackground(fade=true) {
    this.background.darken.clear();
    const w = 12000;
    if ( fade ) this.background.darken.beginFill(0x000000, 0.5).drawRect(-w/2, -w/2, w, w).endFill();
    this.background.blurFilter.enabled = fade;
  }

  /* -------------------------------------------- */

  /**
   * Traverse the talent tree, acquiring a Set of nodes which are currently accessible.
   * @returns {Map<CrucibleTalentNode, number>}
   */
  getActiveNodes() {
    const states = CrucibleTalentNode.STATES;
    const state = this.state;
    const actor = this.actor;
    state.clear();

    // Classify the number of signature nodes that have been purchased
    const signatures = CrucibleTalentNode.getSignatureTalents(actor);

    // Recursive testing function
    function updateBatch(nodes, defaultState=states.UNLOCKED) {
      const next = [];
      for ( const node of nodes ) {
        if ( state.has(node) ) continue;
        const s = node.getState(actor, signatures) ?? defaultState;
        const twin = node.twinNode;

        // Record State
        state.set(node, s);
        if ( twin ) state.set(twin, s);

        // Traverse Outwards
        if ( (node.id === "origin") || (s === states.PURCHASED) ) {
          next.push(...node.connected);
          if ( twin ) next.push(...twin.connected);
        }
      }

      // Recursively test
      if ( next.length ) updateBatch(next);
    }

    // Explore outwards from the origin node
    updateBatch([CrucibleTalentNode.nodes.get("origin")], states.UNLOCKED);

    // Specifically record the state of all signature nodes
    updateBatch(CrucibleTalentNode.signature, states.LOCKED);
    return state;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  #activateInteractivity() {

    // Mouse Interaction Manager
    this.interactionManager = new MouseInteractionManager(this, this, {
      clickLeft: false
    }, {
      dragRightStart: null,
      dragRightMove: this.#onDragRightMove,
      dragRightDrop: null,
      dragRightCancel: null
    }).activate();

    // Window Events
    window.addEventListener("resize", this.#onResize.bind(this));
    window.addEventListener("wheel", this.#onWheel.bind(this), {passive: false});
    this.#onResize();  // set initial dimensions
  }

  /* -------------------------------------------- */

  /**
   * Handle right-mouse drag events occurring on the Canvas.
   * @param {PIXI.InteractionEvent} event
   */
  #onDragRightMove(event) {
    const DRAG_SPEED_MODIFIER = 0.8;
    const {origin, destination} = event.data;
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    this.pan({
      x: this.stage.pivot.x - (dx * DRAG_SPEED_MODIFIER),
      y: this.stage.pivot.y - (dy * DRAG_SPEED_MODIFIER)
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle window resize events.
   */
  #onResize() {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    const {width, height} = this.app.renderer.screen;
    this.stage.position.set(width/2, height/2);
    this.pan(this.stage.pivot);
  }

  /* -------------------------------------------- */

  /**
   * Handle mousewheel events on the Talent Tree canvas.
   * @param {WheelEvent} event      The mousewheel event
   */
  #onWheel(event) {
    if ( this.canvas.hidden ) return;
    let dz = ( event.delta < 0 ) ? 1.05 : 0.95;
    this.pan({scale: dz * this.stage.scale.x});
  }

  /* -------------------------------------------- */

  /**
   * Align the position of the HUD layer to the current position of the canvas
   */
  #alignHUD() {
    const hud = canvas.hud.element[0];
    const {x, y} = this.getGlobalPosition();
    const scale = this.stage.scale.x;
    hud.style.left = `${x}px`;
    hud.style.top = `${y}px`;
    hud.style.transform = `scale(${scale})`;
  }
}
