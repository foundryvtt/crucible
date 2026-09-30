/* -------------------------------------------- */
/*  Door Open cost Function                       */
/* -------------------------------------------- */
Hooks.on("preUpdateWall", (wall, changes, options, userId) => {
  if ( !("ds" in changes) ) return;                      // not a door-state change, ignore
  if ( !game.settings.get("crucible", "doorActionCost") ) return;
  if ( !game.combat?.started ) return;                    // combat only

  const token = canvas.tokens.controlled[0];
  if ( !token?.actor ) return;                            // nobody selected, don't enforce
  const actor = token.actor;

  // Distance check
  const wallMidpoint = {x: (wall.c[0] + wall.c[2]) / 2, y: (wall.c[1] + wall.c[3]) / 2};
  const {distance} = canvas.grid.measurePath([token.center, wallMidpoint]);
  const MAX_DOOR_RANGE = 5; // distance from the door
  if ( distance > MAX_DOOR_RANGE ) {
    ui.notifications.warn(`${actor.name} is too far from the door to interact with it.`);
    return false;
  }

  // Action point check
  if ( actor.resources.action.value < 1 ) {
    ui.notifications.warn(`${actor.name} does not have enough Action Points to open/close this door.`);
    return false;
  }

  // Spend the AP - fire and forget, this is async and preUpdateWall can't await it
  actor.alterResources({action: -1});
});