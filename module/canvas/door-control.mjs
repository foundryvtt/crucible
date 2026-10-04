/**
 * A DoorControl which routes door toggles by a combatant during tracked combat through the Interact action.
 * @extends {foundry.canvas.containers.DoorControl}
 */
export default class CrucibleDoorControl extends foundry.canvas.containers.DoorControl {

  /**
   * The maximum separation in feet between a token's border and a door it may interact with.
   * @type {number}
   */
  static #INTERACTION_RANGE = 1;

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onMouseDown(event) {
    if ( !this.#requiresAction(event) ) return super._onMouseDown(event);
    const actor = this.#identifyActor();
    if ( !actor && !game.user.isGM ) {
      event.stopPropagation();
      return ui.notifications.warn(_loc("ACTOR.WARNINGS.NoToken"));
    }
    if ( !actor || !game.combat.getCombatantsByActor(actor).length ) return super._onMouseDown(event);
    event.stopPropagation();
    return this.#interact(actor);
  }

  /* -------------------------------------------- */

  /**
   * Identify the actor on whose behalf the user interacts with this door.
   * @returns {CrucibleActor|null}
   */
  #identifyActor() {
    const controlled = canvas.tokens.controlled;
    if ( !game.user.isGM ) return (controlled.length === 1) ? controlled[0].actor : game.user.character;

    // A Gamemaster acts only as a controlled combatant, preferring the one whose turn it is
    const combatants = controlled.filter(t => t.actor && game.combat.getCombatantsByActor(t.actor).length);
    const current = combatants.find(t => t.actor === game.combat.combatant?.actor);
    return (current ?? combatants[0])?.actor ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Measure the separation in feet between a token's border and the nearest point of this door.
   * @param {CrucibleTokenObject} token
   * @returns {number}
   */
  #measureDistance(token) {
    const r = token.bounds;
    const [x0, y0, x1, y1] = this.wall.document.c;
    const a = {x: x0, y: y0};
    const b = {x: x1, y: y1};
    if ( r.lineSegmentIntersects(a, b, {inside: true}) ) return 0;
    let d = Infinity;
    const {left, right, top, bottom} = r;
    for ( const c of [{x: left, y: top}, {x: right, y: top}, {x: right, y: bottom}, {x: left, y: bottom}] ) {
      const p = foundry.utils.closestPointToSegment(c, a, b);
      d = Math.min(d, Math.hypot(p.x - c.x, p.y - c.y));
    }
    for ( const p of [a, b] ) {
      d = Math.min(d, Math.hypot(p.x - Math.clamp(p.x, r.left, r.right), p.y - Math.clamp(p.y, r.top, r.bottom)));
    }
    return d / (canvas.grid.size / canvas.grid.distance);
  }

  /* -------------------------------------------- */

  /**
   * Use the Interact action to toggle this door.
   * @param {CrucibleActor} actor
   * @returns {Promise<void>}
   */
  async #interact(actor) {
    const interact = actor.actions.interact;
    if ( game.combat.combatant?.actor !== actor ) {
      ui.notifications.warn(_loc("ACTION.WARNINGS.NotYourTurn", {action: interact.name}));
      return;
    }
    const token = canvas.tokens.controlled.find(t => t.actor === actor) ?? actor.getActiveTokens()[0];
    if ( !token || (this.#measureDistance(token) > CrucibleDoorControl.#INTERACTION_RANGE) ) {
      ui.notifications.warn(_loc("ACTION.WARNINGS.InteractRange"));
      return;
    }

    // Record the door toggle as the interaction applied when the action is confirmed
    const {OPEN, CLOSED} = CONST.WALL_DOOR_STATES;
    const prior = this.wall.document.ds;
    const ds = (prior === OPEN) ? CLOSED : OPEN;
    const label = _loc(`ACTION.DEFAULT_ACTIONS.Interact.${ds === OPEN ? "OpenDoor" : "CloseDoor"}`);
    const interaction = {uuid: this.wall.document.uuid, changes: {ds}, prior: {ds: prior}};
    const action = interact.clone({name: `${interact._source.name} (${label})`}, {metadata: {interaction}});
    await action.use({dialog: false});
  }

  /* -------------------------------------------- */

  /**
   * Should this click be routed through the Interact action rather than toggling the door directly?
   * @param {PIXI.FederatedEvent} event
   * @returns {boolean}
   */
  #requiresAction(event) {
    if ( (event.button !== 0) || !game.combat?.started ) return false;
    if ( !game.user.can("WALL_DOORS") || (game.paused && !game.user.isGM) ) return false;
    return this.wall.document.ds !== CONST.WALL_DOOR_STATES.LOCKED;
  }
}
