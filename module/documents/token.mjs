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
  /*  Database Operations                         */
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
      || CrucibleToken.#isForcedMovement                        // Forced Movement bypasses AP entirely
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
    if ( CrucibleToken.#isForcedMovement ) return;              // Forced Movement skips Move action creation
    if ( this._confirmedMovements?.has(movement.id) ) {         // AP already spent via dialog
      this._confirmedMovements.delete(movement.id);
      return;
    }
    const costFeet = movement.passed.cost + movement.pending.cost;
    this.actor.useMove(costFeet, {dialog: false, movement});
  }

  /* -------------------------------------------- */

  /**
   * Is the GM's "Forced Movement" scene controls toggle currently active?
   * @type {boolean}
   */
  static get #isForcedMovement() {
    return game.user.isGM && !!ui.controls.controls.tokens?.tools?.forcedMovement?.active;
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
  /*  Falling                                     */
  /* -------------------------------------------- */

  /**
   * Find the highest movement-restricting surface at or below the given elevation whose 2D footprint contains at least
   * 75% of the token's containment points. This is the surface the token is either standing on (when its elevation
   * matches it) or hovering above. When no defined surface is found beneath the token, the floor of the lowest level
   * visible from the token's own level is returned as a synthetic surface.
   * @param {TokenCoordinates} [position] The position to evaluate against. Defaults to the token's source position.
   * @returns {RegionSurface|{region: null, elevation: number}|null}
   * @internal
   */
  _findSupportingSurface(position=this._source) {
    const scene = this.parent;
    if ( !scene ) return null;
    const { elevation, level } = position;
    const surfaces = scene.getSurfaces({ level, type: "move" });

    // Walk surfaces from highest to lowest and return the first whose footprint contains the required share of the
    // token. Scene#getSurfaces already orders surfaces by elevation.
    if ( surfaces.length ) {
      const points = this.getContainmentTestPoints(position);
      const required = Math.ceil(points.length * .75);
      const allowedMisses = points.length - required;

      for ( let i = surfaces.length; i--; ) {
        const surface = surfaces[i];
        if ( surface.elevation > elevation ) continue;
        let inside = 0;
        let missed = 0;
        for ( const p of points ) {
          if ( surface.region.polygonTree.testPoint(p) ) {
            if ( ++inside >= required ) return surface;
          }
          else if ( ++missed > allowedMisses ) break;
        }
      }
    }

    // No defined surface was found beneath the token. Fall back to the floor of the lowest level visible from the
    // token's own level.
    const ownLevel = scene.levels.get(level);
    if ( !ownLevel ) return null;
    let { base } = ownLevel.elevation;
    for ( const id of ownLevel.visibility.levels ) {
      const visible = scene.levels.get(id);
      if ( visible ) base = Math.min(base, visible.elevation.base);
    }
    return elevation > base ? { region: null, elevation: base } : null;
  }

  /* -------------------------------------------- */

  /**
   * Find the lowest movement-restricting surface at or above the given elevation that the token can cling to.
   * Require adjacency rather than overlap, test this by padding out the token's footprint one grid space on all sides.
   * Require elevation overlap of the region with the climb position.
   * @param {TokenCoordinates} [position] The position to evaluate against. Defaults to the token's source position.
   * @returns {RegionSurface|null}
   * @internal
   */
  _findClimbableSurface(position=this._source) {
    const scene = this.parent;
    if ( !scene ) return null;
    const { elevation, level } = position;
    const surfaces = scene.getSurfaces({ level, type: "move" });
    if ( !surfaces.length ) return null;

    // Pad the token footprint by one grid space per side so adjacent spaces register as overlap
    const { sizeX, sizeY } = scene.grid;
    const padded = {...position, x: position.x - sizeX, y: position.y - sizeY,
      width: (position.width ?? this._source.width) + 2, height: (position.height ?? this._source.height) + 2};
    const points = this.getContainmentTestPoints(padded);

    // Search surfaces from lowest to highest, identifying the first which can be climbed.
    for ( const surface of surfaces ) {
      if ( (surface.elevation < elevation) || (surface.region.elevation.bottom > elevation) ) continue;
      if ( points.some(p => surface.region.polygonTree.testPoint(p)) ) return surface;
    }
    return null;
  }
}
