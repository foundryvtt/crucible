
export default class CrucibleRuler extends Ruler {

  #actionUses;
  #actionCost;
  #totalDistance;

  /** @override */
  _canMove(token) {
    super._canMove(token);
    const actor = token.actor;
    if ( !actor || !actor.combatant ) return true;  // Don't track cost outside of combat

    // Determine movement costs
    const hasMoved = actor.system.status.hasMoved;
    const firstCost = token.actor.actions.move.cost.action;
    const firstDistance = hasMoved && actor.talentIds.has("distancerunner00") ? 5 : 4;
    const nextCost = !hasMoved && actor.equipment.canFreeMove ? firstCost + 1 : firstCost;
    const nextDistance = actor.talentIds.has("distancerunner00") ? 5 : 4;

    // Determine total distance and cost
    this.#totalDistance = this.segments.reduce((t, s) => t + s.distance, 0);
    this.#actionCost = firstCost;
    this.#actionUses = 1;
    if ( this.#totalDistance > firstDistance ) {
      const nextUses = Math.ceil((this.#totalDistance - firstDistance) / nextDistance);
      this.#actionUses += nextUses;
      this.#actionCost += (nextUses * nextCost);
    }

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
    if ( this.#totalDistance > 0 ) {

      // Chat Message
      const moveName = `Move ${this.#totalDistance} Spaces (x${this.#actionUses})`;
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
