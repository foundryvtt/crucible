import {SKILLS} from "./skills.mjs";
import {TRAINING as WEAPON_TRAINING} from "./weapon.mjs";
import {TRAINING as CRAFTING_TRAINING} from "./crafting.mjs";

/**
 * The types of talent nodes which are supported.
 * @type {Readonly<Record<string, {label: string, style: string, icon: string, [passive]: boolean}>>}
 */
export const NODE_TYPES = Object.freeze({
  origin: {label: "TALENT.NODES.ORIGIN", style: "originHex", icon: "GlyphOrigin", passive: false},
  attack: {label: "TALENT.NODES.ATTACK", style: "rect", icon: "GlyphMelee", passive: false},
  melee: {label: "TALENT.NODES.MELEE", style: "rect", icon: "GlyphMelee", passive: false},
  ranged: {label: "TALENT.NODES.RANGED", style: "rect", icon: "GlyphRanged", passive: false},
  magic: {label: "TALENT.NODES.MAGIC", style: "rect", icon: "GlyphMagic", passive: false},
  defense: {label: "TALENT.NODES.DEFENSE", style: "rect", icon: "GlyphDefense"},
  heal: {label: "TALENT.NODES.HEAL", style: "rect", icon: "GlyphHealing"},
  spell: {label: "TALENT.NODES.SPELL", style: "rect", icon: "GlyphSpellcraft"},
  move: {label: "TALENT.NODES.MOVEMENT", style: "rect", icon: "GlyphMovement"},
  utility: {label: "TALENT.NODES.UTILITY", style: "rect", icon: "GlyphUtility"},
  skill: {label: "TALENT.NODES.SKILL", style: "rect", icon: "GlyphSkill"},
  signature: {label: "TALENT.NODES.SIGNATURE", style: "largeHex", icon: "GlyphSignature", passive: false},
  training: {label: "TALENT.NODES.TRAINING", style: "hex", icon: "GlyphTraining", passive: true}
});

/**
 * Configuration for each tier of the tree.
 * @type {Readonly<Record<"root"|number, {level: number, ability: number}>>}
 */
export const NODE_TIERS = Object.freeze({
  "root": {level: 0, ability: 0},
  0: {level: 0, ability: 2},
  1: {level: 0, ability: 3},
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
  }, {}),
  ...Object.entries(CRAFTING_TRAINING).reduce((obj, [id, cfg]) => {
    obj[id] = {group: "TALENT.TRAINING.CRAFT", label: cfg.label};
    return obj;
  }, {})
});


/**
 * @typedef CrucibleTrainingRank
 * @property {string} id
 * @property {number} rank
 * @property {string} label
 * @property {number} bonus
 */

/**
 * The possible training ranks.
 * @type {Readonly<Record<string, CrucibleTrainingRank>>}
 */
export const TRAINING_RANKS = Object.freeze({
  untrained: {
    id: "untrained",
    rank: 0,
    label: "TALENT.RANKS.UNTRAINED",
    bonus: -4
  },
  trained: {
    id: "trained",
    rank: 1,
    label: "TALENT.RANKS.TRAINED",
    bonus: 0
  },
  proficient: {
    id: "proficient",
    rank: 2,
    label: "TALENT.RANKS.PROFICIENT",
    bonus: 1,
  },
  expert: {
    id: "expert",
    rank: 3,
    label: "TALENT.RANKS.EXPERT",
    bonus: 2
  },
  master: {
    id: "master",
    rank: 4,
    label: "TALENT.RANKS.MASTER",
    bonus: 3
  }
});

/**
 * A reverse mapping of training rank integers to rank IDs.
 * @type {Readonly<Record<0|1|2|3|4, CrucibleTrainingRank>>}
 */
export const TRAINING_RANK_VALUES = Object.freeze(Object.values(TRAINING_RANKS)).reduce((obj, e) => {
  obj[e.rank] = e;
  return obj;
}, {});
