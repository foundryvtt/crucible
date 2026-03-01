/**
 * Handle incoming socket events dispatched to the Crucible system.
 * @param {object} event
 * @param {string|null} event.action
 * @param {object} event.data
 */
export function handleSocketEvent({action=null, data={}}={}) {
  switch (action) {
    case "diceContest":
      break;
    case "diceGroupCheck":
      return;
  }
}

