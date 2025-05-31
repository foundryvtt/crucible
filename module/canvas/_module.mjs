import CrucibleTokenRuler from "./token-ruler.mjs";
import CrucibleTokenHUD from "../applications/hud/token-hud.mjs";

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
  CONFIG.Token.movement.actions = {
    walk: {
      order: 0,
      label: "TOKEN.MOVEMENT.ACTIONS.walk.label",
      icon: "fa-solid fa-person-walking",
      costMultiplier: 1,
      speedMultiplier: 1
    },
    step: {
      order: 1,
      label: "TOKEN.MOVEMENT.ACTIONS.step.label",
      icon: "fa-solid fa-diamond-exclamation",
      costMultiplier: 2,
      speedMultiplier: 0.5,
      deriveTerrainDifficulty: walkTerrain,
    },
    crawl: {
      order: 2,
      label: "TOKEN.MOVEMENT.ACTIONS.crawl.label",
      icon: "fa-solid fa-worm",
      costMultiplier: 2,
      speedMultiplier: 0.25,
      deriveTerrainDifficulty: walkTerrain,
    },
    jump: {
      order: 3,
      label: "TOKEN.MOVEMENT.ACTIONS.jump.label",
      icon: "fa-solid fa-person-running-fast",
      costMultiplier: 2,
      speedMultiplier: 1.5,
      deriveTerrainDifficulty: ({walk, fly}) => Math.max(walk, fly)
    },
    climb: {
      order: 4,
      label: "TOKEN.MOVEMENT.ACTIONS.climb.label",
      icon: "fa-solid fa-person-through-window",
      costMultiplier: 2,
      speedMultiplier: 0.25,
      deriveTerrainDifficulty: walkTerrain
    },
    swim: {
      order: 5,
      label: "TOKEN.MOVEMENT.ACTIONS.swim.label",
      icon: "fa-solid fa-person-swimming",
      costMultiplier: 2,
      speedMultiplier: 0.5
    },
    fly: {
      order: 6,
      label: "TOKEN.MOVEMENT.ACTIONS.fly.label",
      icon: "fa-solid fa-person-fairy",
      speedMultiplier: 1.5
    },
    blink: {
      order: 7,
      label: "TOKEN.MOVEMENT.ACTIONS.blink.label",
      icon: "fa-solid fa-person-from-portal",
      teleport: true,
      speedMultiplier: Infinity,
      deriveTerrainDifficulty: noTerrain
    },
    displace: {
      order: 8,
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
}
