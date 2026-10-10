/** @import {TokenMovementOperation} from "@client/documents/_types.mjs"; */

export default class CrucibleToken extends foundry.documents.TokenDocument {

  /**
   * Track Movement IDs that were confirmed via an ActionUseDialog before execution.
   * We need this secondary store because otherwise movement workflows lose context of how the Action was performed
   * and whether its cost has already been confirmed (via action usage) or still needs to be incurred (as a new move).
   * Lazily initialized on first use since most TokenDocument instances never require it.
   * @type {Set<string>|undefined}
   */
  _confirmedMovements;

  /**
   * Token size in grid squares.
   * @type {number}
   */
  get size() {
    return this.actor?.size ?? this.width;
  }

  /**
   * Does this Token represent a Group actor?
   * @type {boolean}
   */
  get isGroup() {
    return this.actor?.type === "group";
  }

  /** @override */
  static getTrackedAttributes(data, _path=[]) {
    return {
      bar: [
        ["resources", "health"],
        ["resources", "morale"],
        ["resources", "action"],
        ["resources", "focus"]
      ],
      value: []
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _inferMovementAction() {
    return this.isGroup ? "normal" : "walk";
  }

  /* -------------------------------------------- */

  /**
   * Allow Actor-level talent hooks to amend Token data after core preparation.
   * Detection modes are populated by `_prepareDetectionModes` during `prepareBaseData`,
   * so hooks can additively modify the resolved set here.
   * @inheritDoc
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    if ( this.actor ) {
      this.actor.callActorHooks("prepareToken", this);
      this.actor._hadTokenHooks = !!this.actor.hasTokenHooks;
    }
  }

  /* -------------------------------------------- */
  /*  Illumination                                */
  /* -------------------------------------------- */

  /**
   * Is the center of this Token exposed to bright light?
   * @returns {boolean}
   */
  isFullyIlluminated() {
    if ( !this.rendered ) return true; // Lighting is only known for the viewed Scene
    const point = this.getCenterPoint();
    if ( canvas.effects.testInsideDarkness(point) ) return false;

    // Global illumination is bright light within its configured range of darkness levels
    const globalLight = canvas.environment.globalLightSource;
    if ( globalLight.active ) {
      const {min, max} = globalLight.data.darkness;
      const darknessLevel = canvas.effects.getDarknessLevel(point);
      if ( (darknessLevel >= min) && (darknessLevel <= max) ) return true;
    }

    // A point light only brightens the point within its bright radius
    for ( const source of canvas.effects.lightSources ) {
      if ( !source.active || (source === globalLight) ) continue;
      if ( Math.hypot(point.x - source.data.x, point.y - source.data.y) > source.data.bright ) continue;
      if ( source.testPoint(point) ) return true;
    }
    return false;
  }

  /* -------------------------------------------- */
  /*  Database Operations                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;

    // Enforce Token size as prepared Actor size (Crucible microgrid scenes only)
    if ( !this.parent?.useMicrogrid ) return;
    const actor = this.actor ?? this.baseActor;
    if ( actor && (actor.type !== "group") ) {
      const size = actor.size;
      if ( Number.isInteger(size) && (this.width !== size) ) {
        this.updateSource({width: size, height: size, depth: size});
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(change, options, userId) {
    super._onUpdate(change, options, userId);
    if ( this.isGroup && ("movementAction" in change) && (game.userId === userId) && !options._crucibleRelatedUpdate ) {
      this.actor.update({"system.movement.pace": change.movementAction}, {_crucibleRelatedUpdate: true});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRelatedUpdate(update, operation) {
    super._onRelatedUpdate(update, operation);

    // Re-prepare token data if the actor has (or previously had) token hooks
    if ( this.actor && (this.actor.hasTokenHooks || this.actor._hadTokenHooks) ) {
      this.reset();
      if ( this.rendered ) {
        this.object.initializeSources();
        this.object.renderFlags.set({refresh: true});
      }
      return;
    }

    // Otherwise narrow refresh of bar resources
    const resources = update?.system?.resources;
    if ( this.rendered && (resources?.action || resources?.focus) ) {
      this.object.renderFlags.set({refreshBars: true});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdateMovement(movement, operation) {
    await super._preUpdateMovement(movement, operation);

    // Capture the movementId being undone so _onUpdateMovement can refund AP and free movement allowance
    if ( movement.method === "undo" ) {
      operation._crucibleUndoneMovementId = this._source._movementHistory.at(-1)?.movementId;
      return;
    }

    if ( !this.parent?.useMicrogrid                             // Must be a crucible 1ft grid scene
      || !this.actor?.inCombat                                  // Must have an Actor in combat
      || (movement.method !== "dragging")                       // Must be a drag action
      || movement.chain.length                                  // Must be the first segment
      || CrucibleToken.#isForcedMovement(movement)              // Forced Movement bypasses AP entirely
      || this._confirmedMovements?.has(movement.id) ) return;   // AP already spent via dialog

    // Verify that the movement cost is affordable and either prevent movement or record the total cost
    const {cost} = this.actor.getMovementActionCost(movement.passed.cost + movement.pending.cost);
    const isUnconstrained = game.user.isGM && ui.controls.controls.tokens.tools.unconstrainedMovement.active;
    if ( (cost > this.actor.resources.action.value) && !isUnconstrained ) {
      ui.notifications.warn(_loc("ACTION.WARNINGS.CannotAffordMove", {name: this.actor.name, cost,
        action: this.actor.actions.move.name}));
      return false;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdateMovement(movement, operation, user) {
    super._onUpdateMovement(movement, operation, user);
    if ( !user.isSelf                                           // Must be the user who initiated movement
      || !this.parent?.useMicrogrid                             // Must be a crucible 1ft grid scene
      || !this.actor?.inCombat ) return;                        // Must have an Actor in combat

    // Revert the corresponding movement action when a movement is undone
    if ( movement.method === "undo" ) {
      const undoneId = operation._crucibleUndoneMovementId;
      if ( undoneId ) this.#revertUndoneMovement(undoneId);
      return;
    }

    if ( (movement.method !== "dragging") || movement.chain.length ) return;

    // Forced Movement skips Move action creation
    if ( CrucibleToken.#isForcedMovement(movement) ) return;

    // AP already spent via dialog
    if ( this._confirmedMovements?.has(movement.id) ) {
      this._confirmedMovements.delete(movement.id);
      return;
    }
    const costFeet = movement.passed.cost + movement.pending.cost;
    this.actor.useMove(costFeet, {dialog: false, movement});
  }

  /* -------------------------------------------- */

  /**
   * Whether this movement is entirely forced, i.e. every waypoint uses the "push" action.
   * @param {TokenMovementOperation} movement
   * @returns {boolean}
   */
  static #isForcedMovement(movement) {
    return [...movement.passed.waypoints, ...movement.pending.waypoints].every(w => w.action === "push");
  }

  /* -------------------------------------------- */

  /**
   * Roll back a confirmed action when a movement is undone via CTRL+Z.
   * If the Action was confirmed, revert it.
   * Delete the generated Move chat message.
   * @param {string} movementId     The id of the movement being undone
   */
  async #revertUndoneMovement(movementId) {
    const message = game.messages.contents.findLast(m => m.flags?.crucible?.movement === movementId);
    if ( !message ) return;
    // The action's own reverse flow is already handling this message; do not re-reverse or delete it.
    if ( message._reversing ) return;
    if ( message.flags.crucible?.confirmed ) {
      await crucible.api.models.CrucibleAction.confirmMessage(message, {reverse: true});
    }
    await message.delete();
  }

  /* -------------------------------------------- */
  /*  Resting Movement State                      */
  /* -------------------------------------------- */

  /**
   * Update the at-rest movement state of a token, which could include flying, burrowing, or falling states.
   * This is ordinarily handled proactively as part of a CrucibleAction##deriveMovementStatus, but this method can be
   * called directly to enact ad-hoc corrections to that state, for example in response to a Region or Surface change.
   * @returns {Promise<void>}
   */
  async updateRestingMovementState() {
    const actor = this.actor;
    if ( !actor || this.isGroup || !this.parent?.useMicrogrid ) return;
    const {burrowing, falling, flying} = CONFIG.statusEffects;
    const state = this._testRestingMovementState(this._source, {action: this.movementAction});

    // Clear movement states which no longer apply, then apply flying or burrowing
    for ( const {id} of [burrowing, falling, flying] ) {
      if ( (id !== state) && actor.statuses.has(id) ) await actor.toggleStatusEffect(id, {active: false});
    }
    if ( !state || actor.statuses.has(state) ) return;

    // Enable a flying or burrowing state effect
    if ( state !== falling.id ) {
      await actor.toggleStatusEffect(state, {active: true});
      return;
    }
    const fall = actor.actions?.fall;
    if ( !fall ) return;

    // Handle falling specifically by routing through the action dialog
    await actor.toggleStatusEffect(falling.id, {active: true});
    const result = await fall.use({token: this});
    if ( result === null ) await actor.toggleStatusEffect(falling.id, {active: false});
  }

  /* -------------------------------------------- */

  /**
   * Find the supporting surface the token rests on or would fall onto, and the level it comes to rest on.
   * A surface must contain 75% of the token's footprint; see {@link CrucibleScene#findSupportingSurface}.
   * @param {TokenCoordinates} [position] The position to evaluate against. Defaults to the token's source position.
   * @returns {{elevation: number, region: RegionDocument|null, level: Level}|null}
   * @internal
   */
  _findSupportingSurface(position=this._source) {
    const scene = this.parent;
    if ( !scene ) return null;
    const { elevation, level } = position;
    const points = scene.usesSurfaces ? this.getContainmentTestPoints(position) : [];
    return scene.findSupportingSurface(points, {elevation, level, coverage: 0.75});
  }

  /* -------------------------------------------- */

  /**
   * Find the lowest movement-restricting surface at or above the given elevation that the token can cling to.
   * Require adjacency rather than overlap, test this by padding out the token's footprint one grid space on all sides.
   * See {@link CrucibleScene#findClimbableSurface}.
   * @param {TokenCoordinates} [position] The position to evaluate against. Defaults to the token's source position.
   * @returns {{elevation: number, region: RegionDocument, level: Level}|null}
   * @internal
   */
  _findClimbableSurface(position=this._source) {
    const scene = this.parent;
    if ( !scene ) return null;
    const { elevation, level } = position;

    // Pad the token footprint by one grid space per side so adjacent spaces register as overlap
    const { sizeX, sizeY } = scene.grid;
    const padded = {...position, x: position.x - sizeX, y: position.y - sizeY,
      width: (position.width ?? this._source.width) + 2, height: (position.height ?? this._source.height) + 2};
    const points = this.getContainmentTestPoints(padded);
    return scene.findClimbableSurface(points, {elevation, level});
  }

  /* -------------------------------------------- */

  /**
   * Test which movement state the token is left in when resting at a position, given the movement action it rests in.
   * @param {TokenCoordinates} [position]       The position to evaluate. Defaults to the token's source position.
   * @param {object} [options]
   * @param {string|null} [options.action]      The movement action the token rests in
   * @param {boolean} [options.suspended=false] Whether the creature holds its elevation regardless of support
   * @returns {"flying"|"burrowing"|"falling"|null}
   * @internal
   */
  _testRestingMovementState(position=this._source, {action=null, suspended=false}={}) {

    // Flying if above a supporting surface
    if ( action === "fly" ) {
      const surface = this._findSupportingSurface(position);
      return (surface && (surface.elevation < position.elevation)) ? "flying" : null;
    }

    // Burrowing if above a deeper surface, or below the level base if no surfaces are present
    if ( action === "burrow" ) {
      const surface = this._findSupportingSurface(position);
      let underground;
      if ( surface ) underground = surface.elevation < position.elevation;
      else {
        const base = this.parent?.levels.get(position.level)?.elevation.base;
        underground = (base !== undefined) && (position.elevation < base);
      }
      return underground ? "burrowing" : null;
    }

    // Otherwise falling if above its support, unless suspended or climbing adjacent to a climbable surface
    if ( suspended ) return null;
    const surface = this._findSupportingSurface(position);
    if ( !surface || (surface.elevation >= position.elevation) ) return null;
    if ( (action === "climb") && this._findClimbableSurface(position) ) return null;
    return "falling";
  }
}
