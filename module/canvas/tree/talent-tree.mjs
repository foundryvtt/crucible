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

  static #SEXTANT_ABILITIES = ["dexterity", "toughness", "strength", "wisdom", "presence", "intellect"];

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
    await this.#drawBackground();

    // Background connections
    this.edges = this.background.addChild(new PIXI.Graphics());

    // Active connections
    this.connections = this.background.addChild(new PIXI.Graphics());

    // Draw Ability Scores
    this.abilities = await this.#drawAbilityScores();

    // Draw Nodes and Edges
    this.nodes = this.background.addChild(new PIXI.Container());
    const origin = CrucibleTalentNode.nodes.get("origin");
    const seen = new Set();
    await this.#drawNodes(new Set([origin]), seen);

    // Background fade and filter
    this.background.darken = this.background.addChild(new PIXI.Graphics());
    this.background.blurFilter = new PIXI.BlurFilter(1);
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
    const toLoad = ["systems/crucible/ui/tree/Tree0.json", "systems/crucible/ui/tree/BackgroundSlate.png"];
    await foundry.canvas.TextureLoader.loader.load(toLoad);
    const spritesheet = foundry.canvas.getTexture(toLoad[0]);
    const spritesheets = [spritesheet, ...spritesheet.linkedSheets];
    for ( const sheet of spritesheets ) {
      for ( const [asset, texture] of Object.entries(sheet.textures) ) {
        this.spritesheet[asset] = texture;
      }
    }
    this.spritesheet.BackgroundSlate = foundry.canvas.getTexture(toLoad[1]);
  }

  /* -------------------------------------------- */

  async #drawAbilityScores() {
    const scores = {};
    const textStyle = CONFIG.canvasTextStyle.clone();
    textStyle.fontFamily = "AwerySmallcaps";
    for ( const [i, abilityId] of CrucibleTalentTree.#SEXTANT_ABILITIES.entries() ) {
      const text = this.addChild(new PreciseText("12", textStyle));
      text.anchor.set(0.5, 0.5);
      const angle = 30 + (i * 60);
      const r = foundry.canvas.geometry.Ray.fromAngle(0, 0, Math.toRadians(angle), 220);
      text.position.set(r.B.x, r.B.y);
      this.background.addChild(text);
      scores[abilityId] = text;
    }
    return scores;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the text labels of ability scores when the Actor changes.
   */
  #refreshAbilityScores() {
    for ( const abilityId of CrucibleTalentTree.#SEXTANT_ABILITIES ) {
      this.abilities[abilityId].text = this.actor.abilities[abilityId].value;
    }
  }

  /* -------------------------------------------- */

  async #drawBackground() {

    // Repeating slate texture
    const {width, height} = this.#dimensions;
    const backdrop = new PIXI.TilingSprite(this.spritesheet.BackgroundSlate, width, height);
    backdrop.position.set(-width/2, -height/2);
    this.background.backdrop = this.background.addChild(backdrop);

    // Core Gradient
    const cg = new PIXI.Sprite(this.spritesheet.CoreGradient);
    cg.scale.set(1.5, 1.5);
    cg.alpha = 0.15;
    this.background.coreGradient = this.background.addChild(cg);

    // Sextant Overlay
    this.background.overlay = this.background.addChild(this.#drawSextantsOverlay());

    // Origin Tattoo
    const originTattoo = new PIXI.Sprite(this.spritesheet.TattooOrigin);
    originTattoo.alpha = 0.4;
    this.background.originTattoo = this.background.addChild(originTattoo);

    // Spokes
    this.background.spokes = [];
    for ( let i=0; i<6; i++ ) {
      const angle = 60 * i;
      const r = foundry.canvas.geometry.Ray.fromAngle(0, 0, Math.toRadians(60 * i), 820);
      const spoke = new PIXI.Sprite(this.spritesheet.TattooSpoke);
      spoke.alpha = 0.4;
      spoke.angle = angle;
      spoke.position.set(r.B.x, r.B.y);
      this.background.spokes.push(this.background.addChild(spoke));
    }

    // Molten Core
    const mc = new PIXI.Sprite(this.spritesheet.CoreMolten);
    this.background.coreMolten = this.background.addChild(mc);

    // Core
    const core = new PIXI.Sprite(this.spritesheet.Core);
    this.background.core = this.background.addChild(core);
  }

  /* -------------------------------------------- */

  /**
   * Draw a graphics overlay for the six sextants of the tree.
   * TODO this could perhaps be replaced by a pure shader approach if we need to squeeze performance.
   */
  #drawSextantsOverlay() {
    const overlay = new PIXI.Graphics();
    for ( const [i, ability] of CrucibleTalentTree.#SEXTANT_ABILITIES.entries() ) {
      const color = SYSTEM.ABILITIES[ability].color;
      const r0 = foundry.canvas.geometry.Ray.fromAngle(0, 0, Math.toRadians(60 * i), 8000);
      const r1 = foundry.canvas.geometry.Ray.fromAngle(0, 0, Math.toRadians((60 * i) + 30), 10000);
      const r2 = foundry.canvas.geometry.Ray.fromAngle(0, 0, Math.toRadians((60 * i) + 60), 8000);
      const polygon = new PIXI.Polygon([0, 0, r0.B.x, r0.B.y, r1.B.x, r1.B.y, r2.B.x, r2.B.y]);
      overlay.beginFill(color, 0.025).drawShape(polygon).endFill();
    }

    // Tier Circles
    overlay.lineStyle({width: 8, color: 0x000000, alpha: 0.25});
    overlay.drawCircle(0, 0, 1600);
    overlay.drawCircle(0, 0, 3200);
    overlay.drawCircle(0, 0, 4800);
    return overlay;
  }

  /* -------------------------------------------- */

  #drawConnections(node, seen) {
    if ( node.id === "origin" ) return; // No connection lines from the origin
    for ( const c of node.connected ) {
      if ( seen.has(c) || (c.tier < 0) || !this.state.get(c).purchased ) continue;
      this.connections.moveTo(node.point.x, node.point.y)
      this.connections.lineStyle({color: "#0e0906", width: 12, alpha: 1.0}).lineTo(c.point.x, c.point.y);
      this.connections.lineStyle({color: c.color, width: 6, alpha: 1.0}).lineTo(node.point.x, node.point.y);
    }
  }

  /* -------------------------------------------- */

  async #drawNodes(nodes, seen=new Set()) {
    const next = [];
    this.edges.lineStyle({color: 0x000000, alpha: 0.25, width: 4, alignment: 0.5});
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
    const icon = node.icon = new CrucibleTalentTreeNode(node);
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
    this.actor = actor;

    // Draw the tree (once only)
    await this.draw();
    for ( const layer of canvas.layers ) layer.hud?.close();
    this.darkenBackground(false);

    // Show Actor sheet
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

    // Refresh ability scores
    this.#refreshAbilityScores();

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
   * @param {number} [x]
   * @param {number} [y]
   * @param {number} [scale]
   */
  pan({x, y, scale}={}) {

    // Preserve current values for any unspecified inputs
    x ??= this.stage.pivot.x;
    y ??= this.stage.pivot.y;
    scale ??= this.stage.scale.x;

    // Constrain view
    const {width, height} = this.#dimensions;
    const w2 = width / 2;
    const h2 = height / 2;
    const {innerWidth, innerHeight} = window;
    scale = Math.clamp(scale, innerWidth / width, 1.0);
    const tx = (innerWidth / scale) / 2;
    x = Math.clamp(x, -w2 + tx, w2 - tx);
    const ty = (innerHeight / scale) / 2;
    y = Math.clamp(y, -h2 + ty, h2 - ty);

    // Set scale and pivot
    this.stage.pivot.set(x, y);
    this.stage.scale.set(scale, scale);
    this.#alignHUD();
  }

  /* -------------------------------------------- */
  /*  Talent Management                           */
  /* -------------------------------------------- */

  activateNode(node, {event}={}) {
    if ( this.active ) this.deactivateNode({click: false, event});
    this.active = node;
    this.hud.clear();
    this.wheel.activate(node);
    this.darkenBackground(true);
    crucible.api.audio.playClick();
  }

  /* -------------------------------------------- */

  deactivateNode({click=true, event, hover=true}={}) {
    const node = this.active;
    if ( !node ) return;
    this.active = null;
    if ( hover ) node._onPointerOut(event);
    this.wheel.deactivate();
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
    this.background.backdrop.eventMode = "static"; // Capture drag events on the backdrop
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
    this.deactivateNode({event});
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
