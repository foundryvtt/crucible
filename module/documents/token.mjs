export default class CrucibleToken extends foundry.documents.TokenDocument {

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
  _onUpdateMovement(movement, operation, user) {
    if ( !user.isSelf || !this.actor ) return;
    if ( movement.method !== "dragging" ) return; // Only auto-create Move actions for drag+drop
    if ( !this.actor.inCombat ) return;           // Only create movement actions while in turn order
    this.actor.useMove(movement.passed.cost, {dialog: false});
  }
}
