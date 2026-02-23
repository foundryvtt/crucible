/**
 * Handle incoming socket events dispatched to the Crucible system.
 * Not yet used.
 * @param {object} event
 * @param {string|null} event.action
 * @param {object} event.data
 */
export function handleSocketEvent({action=null, data={}}={}) {
  switch (action) {
    case "diceContest":
    case "diceGroupCheck":
      break;
  }
}

