
export default class CrucibleRuler extends Ruler {

  #actor;
  #actionUses;
  #actionCost;
  #totalDistance;

  /** @inheritDoc */
  _onDragStart(event) {
    super._onDragStart(event);
    const token = this._getMovementToken();
    if ( !token?.actor ) return false;
    this.#actor = token.actor;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _computeDistance(gridSpaces) {
    super._computeDistance(gridSpaces);
    this.#computeCost()
  }

  /* -------------------------------------------- */

  /**
   * Compute the cost of the measured move
   */
  #computeCost() {
    const actor = this.#actor;
    if ( !actor ) return;

    // Determine movement costs
    const hasMoved = actor.system.status.hasMoved;
    const firstCost = actor.actions.move.cost.action;
    const firstDistance = hasMoved && actor.talentIds.has("distancerunner00") ? 5 : 4;
    const nextCost = !hasMoved && actor.equipment.canFreeMove ? firstCost + 1 : firstCost;
    const nextDistance = actor.talentIds.has("distancerunner00") ? 5 : 4;

    // Record Costs
    this.#actionCost = firstCost;
    this.#actionUses = 1;
    if ( this.totalDistance > firstDistance ) {
      const nextUses = Math.ceil((this.totalDistance - firstDistance) / nextDistance);
      this.#actionUses += nextUses;
      this.#actionCost += (nextUses * nextCost);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _getSegmentLabel(segment, totalDistance) {
    if ( !segment.last ) return null;
    let label = `${totalDistance} ${totalDistance === 1 ? "Space" : "Spaces"}`;
    if ( !this.#actor?.isOwner ) return label;
    const costLabel = this.#actionCost > 0 ? `${this.#actionCost} AP` : "Free";
    return `${label} [${costLabel}]`
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawMeasuredPath() {
    super._drawMeasuredPath();
    if ( this.#actor?.isOwner ) {
      const label = this.segments.at(-1).label;
      label.tint = this.#actionCost > this.#actor.system.resources.action.value ? 0xDD0011 : 0xFFFFFF;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _canMove(token) {
    super._canMove(token);
    const actor = token.actor;
    if ( !actor || !actor.combatant ) return true;  // Don't track cost outside of combat

    // Can the movement be afforded?
    if ( this.#actionCost > actor.system.resources.action.value ) {
      throw new Error(game.i18n.format("RULER.CannotAffordMove", {
        distance: this.#totalDistance,
        action: this.#actionCost
      }));
    }
    return true;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preMove(token) {
    if ( this.totalDistance > 0 ) {

      // Chat Message
      const moveName = `Move ${this.totalDistance} Spaces (x${this.#actionUses})`;
      const action = token.actor.actions.move.clone({name: moveName}, {actor: token.actor});
      action.cost.action = this.#actionCost;
      await action.toMessage();

      // Spend Action
      await token.actor.alterResources(
        {action: -this.#actionCost},
        {"system.status.hasMoved": true},
        {statusText: "Movement"}
      );
      this.#actionCost = undefined;
    }
  }
}
