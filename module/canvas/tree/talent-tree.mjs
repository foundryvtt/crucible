import CrucibleTalentNode from "../../config/talent-node.mjs";
import CrucibleTalentTreeControls from "./talent-tree-controls.mjs";
import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentChoiceWheel from "./talent-choice-wheel.mjs";
import CrucibleTalentHUD from "./talent-hud.mjs";

/**
 * The Crucible Talent Tree, constructed as a subclass of PIXI.Container.
 */
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
   * @type {Map<CrucibleTalentNode,CrucibleTalentNodeState>}
   */
  state = new CrucibleTalentNodeStates();

  /**
   * Spritesheet textures loaded for use in the tree.
   * @type {Record<string, PIXI.Texture>}
   */
  spritesheet = {};

  /**
   * Is the talent tree currently embedded within some other Application?
   * @type {CrucibleHeroCreationSheet|ApplicationV2|null}
   */
  #parentApp = null;

  /**
   * The dimensions of the talent tree
   * @type {{width: number, height: number}}
   */
  #dimensions = {
    width: 12000,
    height: 12000
  }

  #hudAlignOriginal;

  /* -------------------------------------------- */

  get tree() {
    return CrucibleTalentNode.nodes;
  }

  /* -------------------------------------------- */

  /**
   * Initialize the secondary canvas used for the talent tree.
   */
  #initialize() {

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
        background: 0x0b0909,
        antialias: false, // Not needed because we use SmoothGraphics
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

    // Load Textures
    await this.#loadTextures();

    // Draw Background
    this.backdrop = this.background.addChild(await this.#drawBackdrop());

    // Background connections
    this.edges = this.background.addChild(new PIXI.Graphics());
    this.edges.lineStyle({color: 0x000000, alpha: 0.6, width: 2, alignment: 0.5});

    // Active connections
    this.connections = this.background.addChild(new PIXI.Graphics());

    // Draw Nodes and Edges
    this.nodes = this.background.addChild(new PIXI.Container());
    const origin = CrucibleTalentNode.nodes.get("origin");
    const seen = new Set();
    await this.#drawNodes(new Set([origin]), seen);
    this.#drawCircles();

    // Background fade and filter
    this.background.darken = this.background.addChild(new PIXI.Graphics());
    this.background.blurFilter = new PIXI.filters.BlurFilter(1);
    this.background.filters = [this.background.blurFilter];
    this.background.blurFilter.enabled = false;

    // Create Choice Wheel
    this.wheel = this.foreground.addChild(new CrucibleTalentChoiceWheel());

    // Ensure the main Canvas HUD is rendered
    this.#hudAlignOriginal = canvas.hud.align;
    canvas.hud.align = () => {};
    await canvas.hud.render({force: true});

    // Enable interactivity
    this.#activateInteractivity();

    // Draw initial conditions
    this.refresh();
    this.#drawn = true;
  }

  /* -------------------------------------------- */

  /**
   * Load all necessary textures for rendering the talent tree.
   * @returns {Promise<void[]>}
   */
  async #loadTextures() {
    const toLoad = ["systems/crucible/ui/tree/Tree0.json"];
    await foundry.canvas.TextureLoader.loader.load(toLoad);
    for ( const path of toLoad ) {
      const spritesheet = foundry.canvas.getTexture(path);
      const spritesheets = [spritesheet, ...spritesheet.linkedSheets];
      for ( const sheet of spritesheets ) {
        for ( const [asset, texture] of Object.entries(sheet.textures) ) {
          this.spritesheet[asset] = texture;
        }
      }
    }
  }

  /* -------------------------------------------- */

  async #drawBackdrop() {
    return new PIXI.Sprite(this.spritesheet.Background);
  }

  /* -------------------------------------------- */

  #drawConnections(node, seen) {
    for ( const c of node.connected ) {
      if ( seen.has(c) || (c.tier < 0) || !this.state.get(c).purchased ) continue;
      this.connections.lineStyle({color: c.color, width: 3, alpha: 1.0})
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
    }
    if ( next.length ) await this.#drawNodes(next, seen);
  }

  /* -------------------------------------------- */

  async #drawNode(node) {
    const config = {};
    config.borderColor = node.color;
    const icon = node.icon = new CrucibleTalentTreeNode(node, config);
    this.nodes.addChild(icon);
  }

  /* -------------------------------------------- */

  #drawEdges(node, seen) {
    if ( node.id === "origin" ) return;
    for ( const c of node.connected ) {
      if ( seen.has(c) ) continue;
      this.edges.moveTo(node.point.x, node.point.y);
      this.edges.lineTo(c.point.x, c.point.y);
    }
  }

  /* -------------------------------------------- */

  #drawCircles() {
    // this.edges.drawCircle(0, 0, 800);
    this.edges.drawCircle(0, 0, 1400);
    this.edges.drawCircle(0, 0, 2000);
  }

  /* -------------------------------------------- */
  /*  Tree Management                             */
  /* -------------------------------------------- */

  /**
   * Open the Talent Tree, binding it to a certain Actor
   * @param {CrucibleActor} actor         The Actor to bind to the talent tree
   * @param {object} [options]            Options which modify how the talent tree is opened
   * @param {boolean} [options.resetView]   Reset the view coordinates of the tree to the center?
   */
  async open(actor, {parentApp=null, resetView=true}={}) {
    if ( !(actor instanceof Actor) ) throw new Error("You must provide an actor to bind to the Talent Tree.");
    this.developmentMode = !!CONFIG.debug.talentTree;
    this.#parentApp = parentApp;

    // Draw the tree (once only)
    await this.draw();
    for ( const layer of canvas.layers ) layer.hud?.close();
    this.darkenBackground(false);

    // Associate Actor
    this.actor = actor;
    await actor.sheet.render({force: false, left: 20, top: 20});
    if ( actor.sheet.rendered ) {
      actor.sheet.setPosition({left: 20, top: 20});
      actor.sheet.minimize();
    }

    // Refresh tree state
    this.pan(resetView ? {x: 0, y: 0, scale: 1.0} : {});
    this.refresh();

    // Enable the talent tree canvas
    this.app.renderer.enabled = true;
    canvas.stage.eventMode = "none";
    this.stage.eventMode = "static";
    this.stage.interactiveChildren = true;
    this.canvas.hidden = false;
    if ( this.developmentMode ) this.canvas.style.zIndex = 0;
    else canvas.hud.element.style.zIndex = 9999;  // Move HUD above our canvas
  }

  /* -------------------------------------------- */

  /** @override */
  async close() {
    this.#parentApp = null;

    // Disassociate Actor
    const actor = this.actor;
    this.actor = null;
    await actor?.sheet.render(false);
    actor.sheet.maximize();

    // Deactivate UI
    this.wheel.deactivate();
    this.hud.close();
    this.controls.close();

    // Disable the talent tree canvas
    this.app.renderer.enabled = false;
    this.canvas.hidden = true;
    this.stage.eventMode = "none";
    this.stage.interactiveChildren = false;
    canvas.stage.eventMode = "static";

    // Restore HUD alignment
    canvas.hud.align = this.#hudAlignOriginal;
    canvas.hud.element.style.zIndex = ""; // Move HUD back to normal
    if ( canvas.ready ) canvas.hud.align();
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
      const nPurchased = state.purchased && node.talents.reduce((n, t) => n + this.actor.talentIds.has(t.id), 0);
      let text = nPurchased > 1 ? nPurchased : "";
      if ( this.developmentMode ) text = node.talents.size;
      node.icon?.draw({state, text});
      if ( state.purchased ) this.#drawConnections(node, seen);
      seen.add(node);
    }

    // Refresh talent wheel
    this.wheel.refresh();

    // Refresh controls
    if ( !this.#parentApp ) this.controls.render(true);

    // Refresh parent app
    if ( this.#parentApp?._onRefreshTalentTree instanceof Function ) this.#parentApp._onRefreshTalentTree();
  }

  /* -------------------------------------------- */

  /**
   * Pan the visual position of the talent tree canvas.
   * @param {number} x
   * @param {number} y
   * @param {number} scale
   */
  pan({x, y, scale}={}) {
    x ??= this.stage.pivot.x;
    y ??= this.stage.pivot.y;
    scale ??= this.stage.scale.x;
    this.stage.pivot.set(x, y);
    this.stage.scale.set(scale, scale);
    this.#alignHUD();
  }

  /* -------------------------------------------- */
  /*  Talent Management                           */
  /* -------------------------------------------- */

  activateNode(node) {
    if ( this.active ) this.deactivateNode({click: false});
    this.hud.clear();
    this.active = node;
    this.wheel.activate(node);
    this.darkenBackground(true);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  deactivateNode({click=true}={}) {
    if ( !this.active ) return;
    this.wheel.deactivate();
    this.hud.clear();
    this.active.scale.set(1.0, 1.0);
    this.active = null;
    this.darkenBackground(false);
    if ( click ) crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  darkenBackground(fade=true) {
    this.background.darken.clear();
    const w = this.#dimensions.width;
    if ( fade ) this.background.darken.beginFill(0x000000, 0.5).drawRect(-w/2, -w/2, w, w).endFill();
    this.background.blurFilter.enabled = fade;
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

    // Classify the number of signature nodes that have been purchased
    const signatures = CrucibleTalentNode.getSignatureTalents(actor);

    // Recursive testing function
    function updateBatch(nodes, accessible=false) {
      const next = [];
      for ( const node of nodes ) {

        // Record Node state
        if ( state.has(node) ) continue;
        const s = node.getState(actor, signatures);
        s.accessible = accessible && s.unlocked;
        state.set(node, s);

        // Traverse Outwards
        if ( (node.id === "origin") || s.purchased ) next.push(...node.connected);
      }

      // Recursively test
      if ( next.length ) updateBatch(next, true);
    }

    // Explore outwards from the origin node
    updateBatch([CrucibleTalentNode.nodes.get("origin")], true);

    // Specifically record the state of all signature nodes
    updateBatch(CrucibleTalentNode.signature, false);
    return state;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  #activateInteractivity() {
    this.background.eventMode = "passive";
    this.background.children.forEach(c => c.eventMode = "none");
    this.nodes.eventMode = "passive";       // Capture hover/click events on nodes
    this.backdrop.eventMode = "static";     // Capture drag events on the backdrop
    this.foreground.eventMode = "passive";  // Capture hover/click events on the wheel

    // Mouse Interaction Manager
    this.interactionManager = new foundry.canvas.interaction.MouseInteractionManager(this, this, {}, {
      clickLeft: this.#onClickLeft,
      dragRightStart: null,
      dragRightMove: this.#onDragRightMove,
      dragRightDrop: null,
      dragRightCancel: null
    }, {
      application: this.app,
      dragResistance: 25
    }).activate();

    // Window Events
    window.addEventListener("resize", this.#onResize.bind(this));
    window.addEventListener("wheel", this.#onWheel.bind(this), {passive: false});
    this.#onResize();  // set initial dimensions
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click events on the talent tree
   * @param {PIXI.FederatedEvent}   event
   */
  #onClickLeft(event) {
    event.stopPropagation();
    this.deactivateNode();
  }

  /* -------------------------------------------- */

  /**
   * Handle right-mouse drag events occurring on the Canvas.
   * @param {PIXI.FederatedEvent} event
   */
  #onDragRightMove(event) {
    const DRAG_SPEED_MODIFIER = 0.8;
    const {origin, destination} = event.interactionData;
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
    if ( this.canvas.hidden || (event.target?.id !== "crucible-talent-tree") ) return;
    let dz = ( event.delta < 0 ) ? 1.05 : 0.95;
    this.pan({scale: dz * this.stage.scale.x});
  }

  /* -------------------------------------------- */

  /**
   * Align the position of the HUD layer to the current position of the canvas.
   */
  #alignHUD() {
    const {width, height} = this.#dimensions;
    const hud = canvas.hud.element;
    const {x, y} = this.getGlobalPosition();
    const scale = this.stage.scale.x;
    Object.assign(hud.style, {
      width: `${width}px`,
      height: `${height}px`,
      left: `${x}px`,
      top: `${y}px`,
      transform: `scale(${scale})`
    });
  }
}

/* -------------------------------------------- */

/**
 * @typedef CrucibleTalentNodeState
 * @property {boolean} [accessible]
 * @property {boolean} unlocked
 * @property {boolean} purchased
 * @property {boolean} banned
 */

/**
 * A specialized subclass of Map which falls back for undefined node IDs to an inaccessible state.
 */
class CrucibleTalentNodeStates extends Map {

  /**
   * The default Talent node state.
   * @type {CrucibleTalentNodeState}
   */
  static DEFAULT_STATE = Object.freeze({accessible: false, unlocked: false, purchased: false, banned: false});

  /**
   * @inheritDoc
   * @returns {CrucibleTalentNodeState}
   */
  get(key) {
    /** @type {CrucibleTalentNodeState} */
    const state = super.get(key);
    return state || CrucibleTalentNodeStates.DEFAULT_STATE;
  }
}
