import {SKILLS} from "./skills.mjs";
import {TRAINING as WEAPON_TRAINING} from "./weapon.mjs";
import {TRAINING as CRAFTING_TRAINING} from "./crafting.mjs";
import {RUNES as SPELLCRAFT_RUNES} from "./spellcraft.mjs";

/**
 * The types of talent nodes which are supported.
 * @type {Readonly<Record<string, {label: string, style: string, icon: string, [passive]: boolean}>>}
 */
export const NODE_TYPES = Object.freeze({
  origin: {label: "TALENT.NODES.Origin", style: "originHex", icon: "GlyphOrigin", passive: false},
  attack: {label: "TALENT.NODES.Attack", style: "rect", icon: "GlyphMelee", passive: false},
  melee: {label: "TALENT.NODES.Melee", style: "rect", icon: "GlyphMelee", passive: false},
  ranged: {label: "TALENT.NODES.Ranged", style: "rect", icon: "GlyphRanged", passive: false},
  magic: {label: "TALENT.NODES.Magic", style: "rect", icon: "GlyphMagic", passive: false},
  defense: {label: "TALENT.NODES.Defense", style: "rect", icon: "GlyphDefense"},
  heal: {label: "TALENT.NODES.Heal", style: "rect", icon: "GlyphHealing"},
  spell: {label: "TALENT.NODES.Spell", style: "rect", icon: "GlyphSpellcraft"},
  move: {label: "TALENT.NODES.Movement", style: "rect", icon: "GlyphMovement"},
  utility: {label: "TALENT.NODES.Utility", style: "rect", icon: "GlyphUtility"},
  skill: {label: "TALENT.NODES.Skill", style: "rect", icon: "GlyphSkill"},
  signature: {label: "TALENT.NODES.Signature", style: "largeHex", icon: "GlyphSignature", passive: false},
  training: {label: "TALENT.NODES.Training", style: "hex", icon: "GlyphTraining", passive: true}
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
    label: "TALENT.RANKS.Untrained",
    bonus: -4
  },
  trained: {
    id: "trained",
    rank: 1,
    label: "TALENT.RANKS.Trained",
    bonus: 0
  },
  proficient: {
    id: "proficient",
    rank: 2,
    label: "TALENT.RANKS.Proficient",
    bonus: 1,
  },
  expert: {
    id: "expert",
    rank: 3,
    label: "TALENT.RANKS.Expert",
    bonus: 2
  },
  master: {
    id: "master",
    rank: 4,
    label: "TALENT.RANKS.Master",
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


/**
 * A mapping of talent IDs which changed, used by CrucibleActor#syncTalents during migrations.
 * Mapping to a UUID string results in talent replacement.
 * Mapping to null results in talent deletion.
 * @type {Readonly<string, string|null>}
 */
export const TALENT_ID_MIGRATIONS = {

  // Spellcraft Rune Renames
  runecourage00000: "Compendium.crucible.talent.Item.runeSoul00000000",
  runedeath0000000: "Compendium.crucible.talent.Item.runeDeath0000000",
  runeearth0000000: "Compendium.crucible.talent.Item.runeEarth0000000",
  runeflame0000000: "Compendium.crucible.talent.Item.runeFlame0000000",
  runefrost0000000: "Compendium.crucible.talent.Item.runeFrost0000000",
  runekinesis00000: "Compendium.crucible.talent.Item.runeKinesis00000",
  runelife00000000: "Compendium.crucible.talent.Item.runeLife00000000",
  runelightning000: "Compendium.crucible.talent.Item.runeLightning000",
  runemind00000000: "Compendium.crucible.talent.Item.runeControl00000",
  runeradiance0000: "Compendium.crucible.talent.Item.runeIllumination",
  runetime00000000: "Compendium.crucible.talent.Item.runeIllusion0000",
  runevoid00000000: "Compendium.crucible.talent.Item.runeOblivion0000",

  // Weapon Trainings
  heavystrike00000: "Compendium.crucible.talent.Item.heavyWeaponTrain",
  wrestler00000000: "Compendium.crucible.talent.Item.unarmedCombatTra",
  shieldBash000000: "Compendium.crucible.talent.Item.shieldCombatTrai",
  lunge00000000000: "Compendium.crucible.talent.Item.lightWeaponTrain",
  rapidreload00000: "Compendium.crucible.talent.Item.mechanicalWeapon",
  mechanicalTraini: "Compendium.crucible.talent.Item.mechanicalWeapon",
  projectileTraini: "Compendium.crucible.talent.Item.projectileWeapon"
}
