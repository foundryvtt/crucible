import * as ATTRIBUTES from "./attributes.mjs";
import * as ACTION from "./action.mjs";
import * as ADVERSARY from "./adversaries.mjs";
import * as ARMOR from "./armor.js";
import * as dice from "./dice.js";
import * as EFFECTS from "./effects.mjs";
import * as SKILL from "./skills.mjs"
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
  archetype: "crucible.archetype",
  background: "crucible.background",
  talent: "crucible.talent",
  talentExtensions: null,
  taxonomy: "crucible.taxonomy"
}

/* -------------------------------------------- */

/**
 * The statures which a creature type may have.
 * @enum {{label: string, grid: number}}
 */
export const CREATURE_STATURES = {
  tiny: {
    label: "ACTOR.StatureTiny",
    grid: 0.5,
    engagement: 0
  },
  small: {
    label: "ACTOR.StatureSmall",
    grid: 1,
    engagement: 1
  },
  medium: {
    label: "ACTOR.StatureMedium",
    grid: 1,
    engagement: 1
  },
  large: {
    label: "ACTOR.StatureLarge",
    grid: 1,
    engagement: 2
  },
  giant: {
    label: "ACTOR.StatureGiant",
    grid: 2,
    engagement: 3
  },
  huge: {
    label: "ACTOR.StatureHuge",
    grid: 3,
    engagement: 4
  },
  gargantuan: {
    label: "ACTOR.StatureGargantuan",
    grid: 4,
    engagement: 5
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
 * Define the actor preparation hooks which are supported for Talent configuration.
 * @enum {{signature: string, argNames: string[]}}
 */
export const ACTOR_HOOKS = {
  defendSkillAttack: {
    argNames: ["action", "origin", "rollData"]
  },
  defendSpellAttack: {
    argNames: ["spell", "origin", "rollData"]
  },
  defendWeaponAttack: {
    argNames: ["weapon", "origin", "rollData"]
  },
  prepareResources: {
    argNames: ["resources"]
  },
  prepareDefenses: {
    argNames: ["defenses"]
  },
  prepareInitiativeCheck: {
    argNames: ["rollData"]
  },
  prepareMovement: {
    argNames: ["movement"]
  },
  prepareResistances: {
    argNames: ["resistances"]
  },
  prepareSkillCheck: {
    argNames: ["skill", "rollData"]
  },
  prepareSpellAttack: {
    argNames: ["spell", "target", "rollData"]
  },
  prepareStandardCheck: {
    argNames: ["rollData"]
  },
  prepareTraining: {
    argNames: ["training"]
  },
  prepareWeaponAttack: {
    argNames: ["weapon", "target", "rollData"]
  },
}


/* -------------------------------------------- */

/**
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  ABILITIES: ATTRIBUTES.ABILITIES,
  ACTION,
  ACTOR_HOOKS,
  ADVERSARY,
  ANCESTRIES,
  ARMOR,
  COMPENDIUM_PACKS,
  CREATURE_STATURES,
  DAMAGE_CATEGORIES: ATTRIBUTES.DAMAGE_CATEGORIES,
  DAMAGE_TYPES: ATTRIBUTES.DAMAGE_TYPES,
  DEFENSES: ATTRIBUTES.DEFENSES,
  EFFECTS,
  ENCHANTMENT_TIERS,
  PASSIVE_BASE: ATTRIBUTES.PASSIVE_BASE,
  QUALITY_TIERS,
  RESOURCES: ATTRIBUTES.RESOURCES,
  SKILL,
  SKILLS: SKILL.SKILLS, // alias
  SPELL,
  THREAT_LEVELS,
  WEAPON,
  activeCheckFormula: "3d8",
  dice: dice
};
