
export default class CrucibleRuler extends Ruler {

  #action;
  #actor;
  #actionUses;

  /**
   * String labels applied to the measured distance
   * @type {{cost: string, distance: string}}
   */
  #labels = {
    distance: undefined,
    cost: undefined
  }

  get cost() {
    return this.#action?.cost.action || 0;
  }

  /** @inheritDoc */
  _onDragStart(event) {
    super._onDragStart(event);
    const token = this._getMovementToken();
    if ( token?.actor ) {
      this.waypoints[0] = event.interactionData.origin = token.center;
      this.#actor = token.actor;
      this.#action = this.#actor.actions.move.clone();
    }
    else this.#actor = this.#action = null;
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
    const {distance, units} = canvas.scene.grid;
    this.#action.usage.distance = this.totalDistance / distance;
    SYSTEM.ACTION.TAGS.movement.prepare.call(this.#action);
    this.#labels.distance = `${this.totalDistance.toNearest(0.01)} ${units}`;
    const ap = this.#action.cost.action;
    this.#labels.cost = ap > 0 ? `${ap}AP` : "Free";
  }

  /* -------------------------------------------- */

  /** @override */
  _getSegmentLabel(segment, totalDistance) {
    if ( !segment.last ) return null;
    if ( !this.#actor?.isOwner ) return this.#labels.distance;
    return `${this.#labels.distance} [${this.#labels.cost}]`;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _drawMeasuredPath() {
    super._drawMeasuredPath();
    if ( this.#actor?.isOwner && this.segments.length ) {
      const label = this.segments.at(-1).label;
      label.tint = this.cost > this.#actor.system.resources.action.value ? 0xDD0011 : 0xFFFFFF;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _canMove(token) {
    super._canMove(token);
    this.#action._canUse();
    return true;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preMove(token) {
    if ( !this.totalDistance ) return;
    this.#action.updateSource({
      name: `Move ${this.#labels.distance}`,
      cost: this.#action.cost
    });
    await this.#action.use({chatMessage: true, dialog: false});
  }
}
