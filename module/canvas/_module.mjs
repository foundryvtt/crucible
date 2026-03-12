import CrucibleTokenRuler from "./token-ruler.mjs";
import CrucibleTokenHUD from "../applications/hud/token-hud.mjs";
import {MOVEMENT_ACTIONS, TRAVEL_PACES} from "../const/actor.mjs";

export * as tree from "./tree/_module.mjs";
export * as grid from "./grid/_module.mjs";
export * as vfx from "./vfx/_module.mjs";
export {default as CrucibleTokenObject} from "./token.mjs";
export {CrucibleTokenRuler};

/**
 * Configure canvas extensions for the Crucible system.
 */
export function configure() {
  CONFIG.Token.rulerClass = CrucibleTokenRuler;
  CONFIG.Token.hudClass = CrucibleTokenHUD;
  CONFIG.Token.movement.defaultSpeed = 20;

  // TODO enable experimental VFX framework
  CONFIG.Canvas.vfx.enabled = true;

  // Movement Actions
  const groupOnly = token => token.actor?.type === "group";
  const notGroup = token => token.actor?.type !== "group";
  CONFIG.Token.movement.actions = {};
  for ( const [id, cfg] of Object.entries(MOVEMENT_ACTIONS) ) {
    CONFIG.Token.movement.actions[id] = {...cfg, canSelect: notGroup};
  }
  CONFIG.Token.movement.actions.displace = {
    order: 999,
    label: "TOKEN.MOVEMENT.ACTIONS.displace.label",
    icon: "fa-solid fa-transporter-1",
    img: "icons/svg/portal.svg",
    teleport: true,
    measure: false,
    walls: null,
    visualize: false,
    costMultiplier: 0,
    speedMultiplier: Infinity,
    canSelect: false,
    terrainAction: null
  };

  // Add party travel options
  for ( const [id, cfg] of Object.entries(TRAVEL_PACES) ) {
    CONFIG.Token.movement.actions[id] = {...cfg, canSelect: groupOnly, group: true};
  }
}
