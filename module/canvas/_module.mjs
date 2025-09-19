import CrucibleTokenRuler from "./token-ruler.mjs";
import CrucibleTokenHUD from "../applications/hud/token-hud.mjs";
import {TRAVEL_PACES} from "../config/actor.mjs";

export * as tree from "./tree/_module.mjs";
export * as grid from "./grid/_module.mjs";
export * as vfx from "./vfx/_module.mjs";
export {default as CrucibleTokenObject} from "./token.mjs";
export {default as CrucibleTokenRuler} from "./token-ruler.mjs";

export function configure() {
  CONFIG.Token.rulerClass = CrucibleTokenRuler;
  CONFIG.Token.hudClass = CrucibleTokenHUD;
  CONFIG.Token.movement.defaultSpeed = 20;

  // Movement Actions
  const coreActions = CONFIG.Token.movement.actions;
  const walkTerrain = ({walk}) => walk;
  const noTerrain = () => 1;
  const groupOnly = token => token.actor?.type === "group";
  const notGroup = token => token.actor?.type !== "group";
  CONFIG.Token.movement.actions = {
    walk: {
      order: 0,
      label: coreActions.walk.label,
      icon: coreActions.walk.icon,
      img: coreActions.walk.img,
      costMultiplier: 1,
      speedMultiplier: 1,
      canSelect: notGroup
    },
    step: {
      order: 1,
      label: "TOKEN.MOVEMENT.ACTIONS.step.label",
      icon: "fa-solid fa-diamond-exclamation",
      img: "icons/svg/hazard.svg",
      costMultiplier: 2,
      speedMultiplier: 0.5,
      deriveTerrainDifficulty: walkTerrain,
      canSelect: notGroup
    },
    crawl: {
      order: 2,
      label: coreActions.crawl.label,
      icon: coreActions.crawl.icon,
      img: coreActions.crawl.img,
      costMultiplier: 2,
      speedMultiplier: 0.25,
      deriveTerrainDifficulty: walkTerrain,
      canSelect: notGroup
    },
    jump: {
      order: 3,
      label: coreActions.jump.label,
      icon: coreActions.jump.icon,
      img: coreActions.jump.img,
      costMultiplier: 2,
      speedMultiplier: 1.5,
      deriveTerrainDifficulty: ({walk, fly}) => Math.max(walk, fly),
      canSelect: notGroup
    },
    climb: {
      order: 4,
      label: coreActions.climb.label,
      icon: coreActions.climb.icon,
      img: coreActions.climb.img,
      costMultiplier: 2,
      speedMultiplier: 0.25,
      deriveTerrainDifficulty: walkTerrain,
      canSelect: notGroup
    },
    swim: {
      order: 5,
      label: coreActions.swim.label,
      icon: coreActions.swim.icon,
      img: coreActions.swim.img,
      costMultiplier: 2,
      speedMultiplier: 0.5,
      canSelect: notGroup
    },
    fly: {
      order: 6,
      label: coreActions.fly.label,
      icon: coreActions.fly.icon,
      img: coreActions.fly.img,
      speedMultiplier: 1.5,
      canSelect: notGroup
    },
    blink: {
      order: 7,
      label: coreActions.blink.label,
      icon: coreActions.blink.icon,
      img: coreActions.blink.img,
      teleport: true,
      speedMultiplier: Infinity,
      deriveTerrainDifficulty: noTerrain,
      canSelect: notGroup
    },

    displace: {
      order: 999,
      label: coreActions.displace.label,
      icon: coreActions.displace.icon,
      img: coreActions.displace.img,
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
