import {SKILLS} from "./skills.mjs";
import {TRAINING as WEAPON_TRAINING} from "./weapon.mjs";
import {TRAINING as CRAFTING_TRAINING} from "./crafting.mjs";
import {TRAINING as SPELLCRAFT_TRAINING} from "./spellcraft.mjs";
import {defineEnum} from "./enum.mjs";

/**
 * The groups into which training types are gathered for display.
 * Skills are further subdivided for display by their own SKILL.CATEGORIES, which carry their own colors.
 * @type {Readonly<Record<string, {id: string, label: string, color: string}>>}
 */
export const GROUPS = defineEnum({
  skill: {label: "TALENT.TRAINING.Skill", color: "#81cc44"},
  weapon: {label: "TALENT.TRAINING.Weapon", color: "#c0553d"},
  spell: {label: "TALENT.TRAINING.Spell", color: "#4d8fd1"},
  craft: {label: "TALENT.TRAINING.Craft", color: "#c9a227"}
});

/**
 * The types of training which are available in the system.
 * Every type declares the abilities which scale it, so a check bonus can be computed uniformly.
 * `label` is the full and formal name, correct wherever a training is cited on its own. `short` is optional
 * shorthand for use beside the type's own group heading; display it as `short || label`.
 * @type {Readonly<Record<string, {id: string, group: string, label: string, short?: string,
 *   abilities: string[]}>>}
 */
export const TYPES = defineEnum({
  ...Object.entries(SKILLS).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.skill.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(WEAPON_TRAINING).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.weapon.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(SPELLCRAFT_TRAINING).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.spell.label, label, short, abilities};
    return obj;
  }, {}),
  ...Object.entries(CRAFTING_TRAINING).reduce((obj, [id, {label, short, abilities}]) => {
    obj[id] = {group: GROUPS.craft.label, label, short, abilities};
    return obj;
  }, {})
});

/**
 * @typedef CrucibleTrainingRank
 * @property {string} id
 * @property {number} rank        The integer rank, ascending from zero for untrained.
 * @property {string} label
 * @property {number} bonus       The check bonus conferred by this rank.
 * @property {number} required    Training points required to attain this rank.
 */

/**
 * The possible training ranks, their skill bonuses, and the points required to attain them.
 * Requirements double their interval, so each rank costs as much to reach as every rank before it combined.
 * @type {Readonly<Record<string, CrucibleTrainingRank>>}
 */
export const RANKS = defineEnum({
  untrained: {
    rank: 0,
    label: "TALENT.RANKS.Untrained",
    bonus: -4,
    required: 0
  },
  trained: {
    rank: 1,
    label: "TALENT.RANKS.Trained",
    bonus: 0,
    required: 2
  },
  proficient: {
    rank: 2,
    label: "TALENT.RANKS.Proficient",
    bonus: 1,
    required: 6
  },
  expert: {
    rank: 3,
    label: "TALENT.RANKS.Expert",
    bonus: 2,
    required: 14
  },
  master: {
    rank: 4,
    label: "TALENT.RANKS.Master",
    bonus: 3,
    required: 30
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
 * The greatest number of training points any one type may hold, being those which attain the highest rank.
 * @type {number}
 */
export const POINTS_MAX = Math.max(...Object.values(RANKS).map(r => r.required));

/**
 * Proficiency Points awarded to a hero, which are allocated to advance training.
 * This rate also caps how many points a single training may hold, so allocation alone can carry exactly one
 * training to mastery; talents advance further trainings rather than carrying any one of them higher.
 * @type {Readonly<{initial: number, perLevel: number}>}
 */
export const PROFICIENCY_POINTS = Object.freeze({
  initial: 4,
  perLevel: 2
});

/**
 * The number of training points a Background is expected to grant, free of Proficiency Point cost.
 * @type {number}
 */
export const BACKGROUND_POINTS = 2;
