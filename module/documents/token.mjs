export default class CrucibleToken extends foundry.documents.TokenDocument {

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
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _inferMovementAction() {
    return this.isGroup ? "normal" : "walk";
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
  async _preUpdateMovement(movement, operation) {
    await super._preUpdateMovement(movement, operation);
    if ( !this.parent?.useMicrogrid ||          // Must be a crucible 1ft grid scene
      !this.actor?.inCombat ||                  // Must have an Actor in combat
      (movement.method !== "dragging") ||       // Must be a drag action
      movement.chain.length ) return;           // Must be the first segment

    // Verify that the movement cost is affordable and either prevent movement or record the total cost
    const {cost} = this.actor.getMovementActionCost(movement.passed.cost + movement.pending.cost);
    const isUnconstrained = game.user.isGM && ui.controls.controls.tokens.tools.unconstrainedMovement.active;
    if ( (cost > this.actor.resources.action.value) && !isUnconstrained ) {
      ui.notifications.warn(game.i18n.format("ACTION.WarningCannotAffordMove", {name: this.actor.name, cost,
        action: this.actor.actions.move.name}));
      return false;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdateMovement(movement, operation, user) {
    super._onUpdateMovement(movement, operation, user);
    if ( !user.isSelf ||                        // Must be the user who initiated movement
      !this.parent?.useMicrogrid ||             // Must be a crucible 1ft grid scene
      !this.actor?.inCombat ||                  // Must have an Actor in combat
      (movement.method !== "dragging") ||       // Must be a drag action
      movement.chain.length ) return;           // Must be the first segment
    const actions = new Set();
    for ( const w of movement.passed.waypoints ) actions.add(w.action);
    for ( const w of movement.pending.waypoints ) actions.add(w.action);
    this.actor.useMove(movement.passed.cost + movement.pending.cost, {dialog: false, movement: movement, actions});
  }
}
