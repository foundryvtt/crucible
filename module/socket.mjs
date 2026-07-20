import CrucibleAction from "./models/action.mjs";

/**
 * Handle incoming socket events dispatched to the Crucible system.
 * @param {object} event
 * @param {string|null} event.action
 * @param {object} event.data
 */
export function handleSocketEvent({action=null, data={}}={}) {
  switch (action) {
    case "replayActionVFX":
      _onReplayActionVFX(data);
      break;
    case "toggleDoor":
      _onToggleDoorRequest(data);
      break;
    case "toggleDoorResult":
      _onToggleDoorResult(data);
      break;
  }
}

/* -------------------------------------------- */

/**
 * Handle a socket request to replay a VFX animation from a confirmed action ChatMessage.
 * @param {object} data
 * @param {string} data.messageId     The ID of the ChatMessage containing the action
 */
function _onReplayActionVFX({messageId}) {
  if ( !game.settings.get("crucible", "enableVFX") ) return;
  const message = game.messages.get(messageId);
  if ( !message ) return;
  const flags = message.flags.crucible || {};
  if ( !flags.action || !flags.confirmed || !flags.vfxConfig ) return;
  const action = CrucibleAction.fromChatMessage(message);
  const {references, ...vfxConfig} = flags.vfxConfig;
  action.playVFXEffect(vfxConfig, references);
}

/* -------------------------------------------- */
/*  Door Toggle Serialization                    */
/* -------------------------------------------- */

/**
 * Per-wall promise chains used by the active GM's client to serialize concurrent door toggle requests, so two
 * near-simultaneous requests for the same door are applied one after another (each reading the door's current
 * state immediately before acting) rather than racing against each other's stale reads.
 * @type {Map<string, Promise>}
 */
const _doorToggleQueues = new Map();

/**
 * Pending toggleDoor requests awaiting a response from the active GM, keyed by request id.
 * @type {Map<string, {resolve: Function, reject: Function}>}
 */
const _pendingDoorToggles = new Map();

/* -------------------------------------------- */

/**
 * Request that the door represented by a given Wall be toggled open/closed, serialized through the active GM's
 * client so that concurrent requests for the same door cannot race. If the requesting user is themselves the
 * active GM, the toggle is performed locally (still through the same serialization queue, in case multiple GM
 * clients are connected). Falls back to a direct, unserialized local update if no GM is connected to arbitrate.
 * @param {string} wallId
 * @returns {Promise<number|null>}   The resulting door state (CONST.WALL_DOOR_STATES), or null if no door was found
 */
export async function requestDoorToggle(wallId) {
  if ( game.users.activeGM?.isSelf ) return _applyDoorToggle(wallId);

  if ( !game.users.activeGM ) {
    console.warn("Crucible | No active GM connected to arbitrate door toggles; applying locally.");
    return _applyDoorToggle(wallId);
  }

  const requestId = foundry.utils.randomID();
  const result = new Promise((resolve, reject) => {
    _pendingDoorToggles.set(requestId, {resolve, reject});
    setTimeout(() => {
      if ( !_pendingDoorToggles.has(requestId) ) return;
      _pendingDoorToggles.delete(requestId);
      reject(new Error("Timed out waiting for the GM to confirm the door toggle."));
    }, 5000);
  });
  game.socket.emit("system.crucible", {action: "toggleDoor", data: {wallId, requestId}});
  return result;
}

/* -------------------------------------------- */

/**
 * The active GM's handler for an incoming toggleDoor request from another client.
 * @param {object} data
 * @param {string} data.wallId
 * @param {string} data.requestId
 */
function _onToggleDoorRequest({wallId, requestId}) {
  if ( !game.users.activeGM?.isSelf ) return; // only one GM client services requests
  _applyDoorToggle(wallId)
    .then(ds => game.socket.emit("system.crucible", {action: "toggleDoorResult", data: {requestId, ds}}))
    .catch(err => {
      console.error(new Error("Crucible | Failed to apply a requested door toggle", {cause: err}));
      game.socket.emit("system.crucible", {action: "toggleDoorResult", data: {requestId, error: err.message}});
    });
}

/* -------------------------------------------- */

/**
 * The requesting client's handler for the GM's response to a toggleDoor request.
 * @param {object} data
 * @param {string} data.requestId
 * @param {number} [data.ds]
 * @param {string} [data.error]
 */
function _onToggleDoorResult({requestId, ds, error}) {
  const pending = _pendingDoorToggles.get(requestId);
  if ( !pending ) return; // not our request, or already timed out
  _pendingDoorToggles.delete(requestId);
  if ( error ) pending.reject(new Error(error));
  else pending.resolve(ds);
}

/* -------------------------------------------- */

/**
 * Toggle a door's open/closed state, serialized per-wall so overlapping calls for the same door apply in order
 * and each reads the door's live state immediately before acting.
 * @param {string} wallId
 * @returns {Promise<number|null>}
 */
function _applyDoorToggle(wallId) {
  const previous = _doorToggleQueues.get(wallId) ?? Promise.resolve();
  const next = previous.then(async () => {
    const door = canvas.walls?.get(wallId);
    if ( !door ) return null;
    const states = CONST.WALL_DOOR_STATES;
    const ds = door.document.ds === states.OPEN ? states.CLOSED : states.OPEN;
    await door.document.update({ds}, {crucibleAction: true});
    return ds;
  }).finally(() => {
    if ( _doorToggleQueues.get(wallId) === next ) _doorToggleQueues.delete(wallId);
  });
  _doorToggleQueues.set(wallId, next);
  return next;
}

