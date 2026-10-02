/**
 * A specialized DoorControl which routes a player's left-click on a door icon during Combat through the "interact"
 * CrucibleAction, so that toggling the door draws from the acting Actor's Action economy like any other Action.
 *
 * The "interact" Action enforces its own reach and turn-order requirements (see module/hooks/action.mjs). GM
 * clicks, clicks outside of combat, and clicks on locked doors are left entirely to the default core behavior.
 * @extends {CONFIG.Canvas.doorControlClass}
 */
export default class CrucibleDoorControl extends CONFIG.Canvas.doorControlClass {

  /** @override */
  async _onMouseDown(event) {
    if ( !this._shouldUseAction() ) return super._onMouseDown(event);
    event.stopPropagation();
    return this._useInteractAction();
  }

  /* -------------------------------------------- */

  /**
   * Should this click be routed through the "interact" Action instead of the default core door toggle?
   * @returns {boolean}
   */
  _shouldUseAction() {
    if ( game.user.isGM ) return false;
    if ( !game.combat?.started ) return false;
    if ( this.wall.document.ds === CONST.WALL_DOOR_STATES.LOCKED ) return false;
    return this.wall.document.isDoor;
  }

  /* -------------------------------------------- */

  /**
   * Resolve the Actor performing the click: the user's own controlled Token if exactly one is selected, otherwise
   * their assigned character. Clicking a door doesn't imply acting as whoever's turn it is; if the resolved Actor
   * isn't the active combatant, the "interact" Action's canUse hook raises its own warning.
   * @returns {CrucibleActor|null}
   */
  _getActingActor() {
    const controlled = canvas.tokens?.controlled ?? [];
    if ( controlled.length === 1 ) return controlled[0].actor;
    return game.user.character ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Perform the "interact" Action against this door's wall. The targeted wall is recorded on the Action's usage
   * before it is used, in the same fashion as forcedTargets, so the Action doesn't have to guess which door was
   * meant.
   * @returns {Promise<void>}
   */
  async _useInteractAction() {
    const actor = this._getActingActor();
    if ( !actor ) return ui.notifications.warn(_loc("ACTOR.WARNINGS.NoToken"));
    const action = actor.actions.interact;
    if ( !action ) {
      return ui.notifications.warn(_loc("ACTOR.WARNINGS.NoAction", {actor: actor.name, action: "interact"}));
    }
    action.usage.wallId = this.wall.document.id;
    await action.use({dialog: false});
  }
}
