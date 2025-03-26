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
 * @type {Readonly<Record<"root"|number, {level: number, ability: number}>>}
 */
export const NODE_TIERS = Object.freeze({
  "root": {level: 0, ability: 0},
  0: {level: 0, ability: 3},
  1: {level: 1, ability: 4},
  2: {level: 2, ability: 4},
  3: {level: 3, ability: 5},
  4: {level: 4, ability: 5},
  5: {level: 5, ability: 6},
  6: {level: 6, ability: 6},
  7: {level: 7, ability: 7},
  8: {level: 8, ability: 7},
  9: {level: 9, ability: 8},
  10: {level: 10, ability: 8},
  11: {level: 11, ability: 9},
  12: {level: 12, ability: 9},
  13: {level: 13, ability: 10},
  14: {level: 14, ability: 10},
  15: {level: 15, ability: 11},
  16: {level: 16, ability: 11},
  17: {level: 17, ability: 12},
  18: {level: 18, ability: 12}
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
