import {SKILLS} from "./skills.mjs";
import {TRAINING as WEAPON_TRAINING} from "./weapon.mjs";

/**
 * The types of talent nodes which are supported.
 * @type {Readonly<Record<
 *  "attack"|"defense"|"heal"|"spell"|"move"|"utility"|"signature"|"training",
 *  {label: string, style: string, icon: string}
 * >>}
 */
export const NODE_TYPES = Object.freeze({
  attack: {label: "TALENT.NODES.ATTACK", style: "rect", icon: "attack"},
  defense: {label: "TALENT.NODES.DEFENSE", style: "rect", icon: "defense"},
  heal: {label: "TALENT.NODES.HEALING", style: "rect", icon: "heal"},
  spell: {label: "TALENT.NODES.SPELL", style: "rect", icon: "magic"},
  move: {label: "TALENT.NODES.MOVEMENT", style: "rect", icon: "move"},
  utility: {label: "TALENT.NODES.UTILITY", style: "rect", icon: "utility"},
  signature: {label: "TALENT.NODES.SIGNATURE", style: "largeHex", icon: "signature"},
  training: {label: "TALENT.NODES.TRAINING", style: "hex", icon: "utility"}
});

/**
 * Configuration for each tier of the tree.
 * @type {Readonly<Record<"root"|0|1|2|3|4, {level: number, ability: number, angle: number, offset: number}>>}
 */
export const NODE_TIERS = Object.freeze({
  "root": {level: 0, ability: 0, distance: 0, angle: 0, offset: 0},
  0: {level: 0, ability: 3, distance: 200, angle: 30, offset: 15},
  1: {level: 1, ability: 4, distance: 400, angle: 20, offset: 0},
  2: {level: 2, ability: 5, distance: 600, angle: 15, offset: 0},
  3: {level: 3, ability: 6, distance: 800, angle: 15, offset: 0},
  4: {level: 4, ability: 7, distance: 1000, angle: 12, offset: 0},
});

/**
 * The types of training which are available in the system.
 * @type {Readonly<Record<string, {group: string, label: string}>>}
 */
export const TRAINING_TYPES = Object.freeze({
  ...Object.entries(SKILLS).reduce((obj, [id, cfg]) => {
    obj[id] = {group: "TALENT.TRAINING.SKILL", label: cfg.label};
    return obj;
  }, {}),
  ...Object.entries(WEAPON_TRAINING).reduce((obj, [id, cfg]) => {
    obj[id] = {group: "TALENT.TRAINING.WEAPON", label: cfg.label};
    return obj;
  }, {})
});

/**
 * The possible training ranks.
 * @type {Readonly<Record<1|2|3|4, {label: string}>>}
 */
export const TRAINING_RANKS = Object.freeze({
  1: {label: "TALENT.RANKS.NOVICE"},
  2: {label: "TALENT.RANKS.JOURNEYMAN"},
  3: {label: "TALENT.RANKS.ADEPT"},
  4: {label: "TALENT.RANKS.MASTER"},
});
