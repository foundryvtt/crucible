/**
 * A specialized DoorControl which routes a player's left-click on a door icon through the "openDoor" CrucibleAction
 * instead of letting the click perform the raw core door toggle directly.
 *
 * Door open/close cost, refund, actor, and turn handling all live on the "openDoor" Action (see
 * module/hooks/action.mjs). The preUpdateWall hook in crucible.mjs stops a raw wall update from bypassing that
 * system while the cost setting is active in combat, but on its own it only blocks the click and shows a warning -
 * it doesn't do anything to route the click into the Action itself. This class is what makes clicking the door
 * icon actually *work* under those conditions: it resolves the clicking user's own Actor and asks it to use
 * "openDoor" with this specific wall pre-targeted, so the Action doesn't have to guess which nearby door was meant.
 *
 * GM clicks, and player clicks when the cost setting or combat conditions don't apply, are left alone entirely -
 * they fall through to the default core behavior.
 * @extends {foundry.canvas.containers.DoorControl}
 */
export default class CrucibleDoorControl extends CONFIG.Canvas.doorControlClass {

  /** @override */
  async _onMouseDown(event) {
    if ( !this._shouldUseAction() ) return super._onMouseDown(event);
    event.stopPropagation();
    return this._useDoorAction();
  }

  /* -------------------------------------------- */

  /**
   * Should this click be routed through the "openDoor" Action instead of the default core door toggle?
   * Mirrors the same gating conditions as the preUpdateWall hook in crucible.mjs, since this is the other half of
   * the same feature: whatever the hook would otherwise block here, this method should intercept instead.
   * @returns {boolean}
   */
  _shouldUseAction() {
    if ( game.user.isGM ) return false; // GMs may freely toggle doors
    if ( !game.settings.get("crucible", "doorActionCost") ) return false;
    if ( !game.combat?.started ) return false; // combat only
    return this.wall.document.isDoor;
  }

  /* -------------------------------------------- */

  /**
   * Resolve the Actor performing the click: the user's own controlled token if exactly one is selected, otherwise
   * their assigned character. This deliberately does *not* default to the current combatant - clicking a door
   * doesn't imply you're acting as whoever's turn it is, and HOOKS.openDoor#canUse already throws a WrongTurn
   * warning of its own once the Action actually runs if this actor isn't the current combatant.
   * @returns {CrucibleActor|null}
   */
  _getActingActor() {
    const controlled = canvas.tokens?.controlled ?? [];
    if ( controlled.length === 1 ) return controlled[0].actor;
    return game.user.character ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Route the click into the "openDoor" Action for the resolved acting Actor, pre-seeding the specific wall that
   * was clicked so CrucibleAction's "openDoor" hook doesn't fall back to guessing the nearest door out of
   * everything within reach.
   * @returns {Promise<void>}
   */
  async _useDoorAction() {
    const actor = this._getActingActor();
    const action = actor?.actions.openDoor;
    if ( !action ) {
      ui.notifications.warn(game.i18n.localize("WARNING.DoorUseAction"));
      return;
    }
    await actor.useAction("openDoor", {usage: {forcedDoorWallId: this.wall.document.id}});
  }
}
