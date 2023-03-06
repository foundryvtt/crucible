
export default class CrucibleRuler extends Ruler {

  #action;
  #actor;
  #actionUses;
  #totalDistance;

  get cost() {
    return this.#action.cost.action;
  }

  /** @inheritDoc */
  _onDragStart(event) {
    super._onDragStart(event);
    const token = this._getMovementToken();
    if ( !token?.actor ) return false;
    this.#actor = token.actor;
    this.#action = this.#actor.actions.move.clone();
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
    const tag = CONFIG.SYSTEM.ACTION.TAGS.movement;

    // Determine movement costs
    const hasMoved = actor.system.status.hasMoved;
    const firstDistance = hasMoved && actor.talentIds.has("distancerunner00") ? 5 : 4;
    const nextDistance = actor.talentIds.has("distancerunner00") ? 5 : 4;

    // Record Costs
    this.#actionUses = 1;
    if ( this.totalDistance > firstDistance ) {
      const nextUses = Math.ceil((this.totalDistance - firstDistance) / nextDistance);
      this.#actionUses += nextUses;
    }

    // Update cost
    this.#action.name = this.#actionUses > 1 ? `Move (x${this.#actionUses})` : "Move";
    this.#action.cost.action = this.#actionUses - 1;
    tag.prepare(actor, this.#action);
  }

  /* -------------------------------------------- */

  /** @override */
  _getSegmentLabel(segment, totalDistance) {
    if ( !segment.last ) return null;
    const cost = this.cost;
    let label = `${totalDistance} ${totalDistance === 1 ? "Space" : "Spaces"}`;
    if ( !this.#actor?.isOwner ) return label;
    const costLabel = cost > 0 ? `${cost} AP` : "Free";
    return `${label} [${costLabel}]`
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawMeasuredPath() {
    super._drawMeasuredPath();
    if ( this.#actor?.isOwner ) {
      const label = this.segments.at(-1).label;
      label.tint = this.cost > this.#actor.system.resources.action.value ? 0xDD0011 : 0xFFFFFF;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _canMove(token) {
    super._canMove(token);
    this.#action._can();
    return true;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preMove(token) {
    if ( this.totalDistance > 0 ) {
      const moveName = `Move ${this.totalDistance} (x${this.#actionUses})`;
      this.#action.updateSource({
        name: moveName,
        "cost.action": this.#actionUses - 1
      });
      await this.#action.use({chatMessage: true, dialog: false});
    }
  }
}
