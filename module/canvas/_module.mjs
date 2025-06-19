import CrucibleTokenRuler from "./token-ruler.mjs";
import CrucibleTokenHUD from "../applications/hud/token-hud.mjs";
import {TRAVEL_PACES} from "../config/actor.mjs";

export * as tree from "./tree/_module.mjs";
export * as grid from "./grid.mjs";
export {default as CrucibleTokenObject} from "./token.mjs";
export {default as CrucibleTokenRuler} from "./token-ruler.mjs";

export function configure() {
  CONFIG.Token.rulerClass = CrucibleTokenRuler;
  CONFIG.Token.hudClass = CrucibleTokenHUD;
  CONFIG.Token.movement.defaultSpeed = 20;

  // Movement Actions
  const walkTerrain = ({walk}) => walk;
  const noTerrain = () => 1;
  const groupOnly = token => token.actor?.type === "group";
  const notGroup = token => token.actor?.type !== "group";
  CONFIG.Token.movement.actions = {
    walk: {
      order: 0,
      label: "TOKEN.MOVEMENT.ACTIONS.walk.label",
      icon: "fa-solid fa-person-walking",
      costMultiplier: 1,
      speedMultiplier: 1,
      canSelect: notGroup
    },
    step: {
      order: 1,
      label: "TOKEN.MOVEMENT.ACTIONS.step.label",
      icon: "fa-solid fa-diamond-exclamation",
      costMultiplier: 2,
      speedMultiplier: 0.5,
      deriveTerrainDifficulty: walkTerrain,
      canSelect: notGroup
    },
    crawl: {
      order: 2,
      label: "TOKEN.MOVEMENT.ACTIONS.crawl.label",
      icon: "fa-solid fa-worm",
      costMultiplier: 2,
      speedMultiplier: 0.25,
      deriveTerrainDifficulty: walkTerrain,
      canSelect: notGroup
    },
    jump: {
      order: 3,
      label: "TOKEN.MOVEMENT.ACTIONS.jump.label",
      icon: "fa-solid fa-person-running-fast",
      costMultiplier: 2,
      speedMultiplier: 1.5,
      deriveTerrainDifficulty: ({walk, fly}) => Math.max(walk, fly),
      canSelect: notGroup
    },
    climb: {
      order: 4,
      label: "TOKEN.MOVEMENT.ACTIONS.climb.label",
      icon: "fa-solid fa-person-through-window",
      costMultiplier: 2,
      speedMultiplier: 0.25,
      deriveTerrainDifficulty: walkTerrain,
      canSelect: notGroup
    },
    swim: {
      order: 5,
      label: "TOKEN.MOVEMENT.ACTIONS.swim.label",
      icon: "fa-solid fa-person-swimming",
      costMultiplier: 2,
      speedMultiplier: 0.5,
      canSelect: notGroup
    },
    fly: {
      order: 6,
      label: "TOKEN.MOVEMENT.ACTIONS.fly.label",
      icon: "fa-solid fa-person-fairy",
      speedMultiplier: 1.5,
      canSelect: notGroup
    },
    blink: {
      order: 7,
      label: "TOKEN.MOVEMENT.ACTIONS.blink.label",
      icon: "fa-solid fa-person-from-portal",
      teleport: true,
      speedMultiplier: Infinity,
      deriveTerrainDifficulty: noTerrain,
      canSelect: notGroup
    },

    displace: {
      order: 999,
      label: "TOKEN.MOVEMENT.ACTIONS.displace.label",
      icon: "fa-solid fa-transporter-1",
      teleport: true,
      measure: false,
      walls: null,
      visualize: false,
      costMultiplier: 0,
      speedMultiplier: Infinity,
      canSelect: () => false,
      deriveTerrainDifficulty: noTerrain
    }
  };

  // Add party travel options
  for ( const [id, cfg] of Object.entries(TRAVEL_PACES) ) {
    CONFIG.Token.movement.actions[id] = {...cfg, canSelect: groupOnly};
  }
}
