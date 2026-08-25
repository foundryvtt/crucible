import {SKILLS} from "./skills.mjs";
import {TRAINING as WEAPON_TRAINING} from "./weapon.mjs";
import {TRAINING as CRAFTING_TRAINING} from "./crafting.mjs";
import {RUNES as SPELLCRAFT_RUNES} from "./spellcraft.mjs";
import {defineEnum} from "./enum.mjs";

/**
 * The types of training which are available in the system.
 * @type {Readonly<Record<string, {id: string, group: string, label: string}>>}
 */
export const TYPES = defineEnum({
  ...Object.entries(SKILLS).reduce((obj, [id, {label}]) => {
    obj[id] = {group: "TALENT.TRAINING.Skill", label};
    return obj;
  }, {}),
  ...Object.entries(WEAPON_TRAINING).reduce((obj, [id, {label}]) => {
    obj[id] = {group: "TALENT.TRAINING.Weapon", label};
    return obj;
  }, {}),
  ...Object.entries(SPELLCRAFT_RUNES).reduce((obj, [id, {name: label}]) => {
    obj[id] = {group: "TALENT.TRAINING.Spell", label};
    return obj;
  }, {}),
  ...Object.entries(CRAFTING_TRAINING).reduce((obj, [id, {label}]) => {
    obj[id] = {group: "TALENT.TRAINING.Craft", label};
    return obj;
  }, {})
});

/**
 * @typedef CrucibleTrainingRank
 * @property {string} id
 * @property {number} rank      The integer rank, ascending from zero for untrained.
 * @property {string} label
 * @property {number} bonus     The check bonus conferred by this rank.
 * @property {number} cost      Proficiency Points spent to advance into this rank from the one below.
 * @property {number} [level]   A character level required to advance into this rank, if any.
 */

/**
 * The possible training ranks, their skill bonuses, and costs to acquire.
 * @type {Readonly<Record<string, CrucibleTrainingRank>>}
 */
export const RANKS = defineEnum({
  untrained: {
    rank: 0,
    label: "TALENT.RANKS.Untrained",
    bonus: -4,
    cost: 0
  },
  trained: {
    rank: 1,
    label: "TALENT.RANKS.Trained",
    bonus: 0,
    cost: 1
  },
  proficient: {
    rank: 2,
    label: "TALENT.RANKS.Proficient",
    bonus: 1,
    cost: 1
  },
  expert: {
    rank: 3,
    label: "TALENT.RANKS.Expert",
    bonus: 2,
    cost: 2
  },
  master: {
    rank: 4,
    label: "TALENT.RANKS.Master",
    bonus: 3,
    cost: 3
  }
});

/**
 * A reverse mapping of training rank integers to rank definitions.
 * @type {Readonly<Record<number, CrucibleTrainingRank>>}
 */
export const RANK_VALUES = Object.freeze(Object.values(RANKS).reduce((obj, e) => {
  obj[e.rank] = e;
  return obj;
}, {}));

/**
 * The highest training rank which may be attained.
 * @type {number}
 */
export const RANK_MAX = Math.max(...Object.values(RANKS).map(r => r.rank));

/**
 * Proficiency Points awarded to a hero, which are spent to advance training ranks.
 * @type {Readonly<{background: number, initial: number, perLevel: number}>}
 */
export const PROFICIENCY_POINTS = Object.freeze({
  background: 2,
  initial: 2,
  perLevel: 2
});
