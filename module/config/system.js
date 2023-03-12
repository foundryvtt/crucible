import * as ATTRIBUTES from "./attributes.mjs";
import {SKILL_CATEGORIES, SKILL_RANKS, SKILLS} from "./skills.js";
import * as ACTION from "./action.mjs";
import * as ARMOR from "./armor.js";
import * as dice from "./dice.js";
import * as EFFECTS from "./effects.mjs";
import * as SPELL from "./spellcraft.mjs";
import * as WEAPON from "./weapon.js";
import {QUALITY_TIERS, ENCHANTMENT_TIERS} from "./items.js";
export const SYSTEM_ID = "crucible";

/* -------------------------------------------- */

/**
 * The amount of damage resistance granted by ancestries.
 * @type {object}
 */
export const ANCESTRIES = {
  primaryAbilityStart: 3,
  secondaryAbilityStart: 2,
  resistanceAmount: 5
}

/* -------------------------------------------- */

/**
 * The compendium pack IDs which should be used as the source for character creation materials.
 * @enum {string}
 */
export const COMPENDIUM_PACKS = {
  ancestry: "crucible.ancestry",
  background: "crucible.background",
  talent: "crucible.talent"
}

/* -------------------------------------------- */

/**
 * The statures which a creature type may have.
 * @enum {{label: string, grid: number}}
 */
export const CREATURE_STATURES = {
  tiny: {
    label: "ACTOR.StatureTiny",
    grid: 0.5
  },
  small: {
    label: "ACTOR.StatureSmall",
    grid: 1
  },
  medium: {
    label: "ACTOR.StatureMedium",
    grid: 1
  },
  large: {
    label: "ACTOR.StatureLarge",
    grid: 1
  },
  giant: {
    label: "ACTOR.StatureGiant",
    grid: 2
  },
  huge: {
    label: "ACTOR.StatureHuge",
    grid: 3
  },
  gargantuan: {
    label: "ACTOR.StatureGargantuan",
    grid: 4
  }
}


/* -------------------------------------------- */

/**
 * The threat levels that an adversary may have.
 * @enum {number}
 */
export const THREAT_LEVELS = {
  minion: {
    id: "minion",
    actionMax: 2,
    label: "ADVERSARY.ThreatMinion",
    scaling: 0.5,
    icon: "fa-solid fa-chevron-down"
  },
  normal: {
    id: "normal",
    actionMax: 3,
    label: "ADVERSARY.ThreatNormal",
    scaling: 1.0,
    icon: "fa-solid fa-chevron-up"
  },
  elite: {
    id: "elite",
    actionMax: 4,
    label: "ADVERSARY.ThreatElite",
    scaling: 1.5,
    icon: "fa-solid fa-chevrons-up"
  },
  boss: {
    id: "boss",
    actionMax: 5,
    label: "ADVERSARY.ThreatBoss",
    scaling: 2.0,
    icon: "fa-solid fa-skull"
  }
};

/* -------------------------------------------- */

/**
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  activeCheckFormula: "3d8",
  ABILITIES: ATTRIBUTES.ABILITIES,
  DAMAGE_CATEGORIES: ATTRIBUTES.DAMAGE_CATEGORIES,
  DAMAGE_TYPES: ATTRIBUTES.DAMAGE_TYPES,
  RESOURCES: ATTRIBUTES.RESOURCES,
  PASSIVE_BASE: ATTRIBUTES.PASSIVE_BASE,
  DEFENSES: ATTRIBUTES.DEFENSES,
  ACTION,
  ARMOR,
  dice: dice,
  ANCESTRIES,
  COMPENDIUM_PACKS,
  CREATURE_STATURES,
  EFFECTS,
  ENCHANTMENT_TIERS,
  QUALITY_TIERS,
  SKILL_CATEGORIES,
  SKILL_RANKS,
  SKILLS,
  SPELL,
  THREAT_LEVELS,
  WEAPON,
};
