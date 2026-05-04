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
    if ( message.flags.crucible?.confirmed ) {
      await crucible.api.models.CrucibleAction.confirmMessage(message, {reverse: true});
    }
    await message.delete();
  }
}
