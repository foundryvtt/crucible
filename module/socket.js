import StandardCheck from "./dice/standard-check.mjs";


export function handleSocketEvent({action=null, data={}}={}) {
  switch (action) {
    case "diceCheck":
      return StandardCheck.handle(data);
    case "diceContest":
      return;
    case "diceGroupCheck":
      return;
  }
}

