import * as ATTRIBUTES from "./attributes.mjs";
import * as ACTION from "./action.mjs";
import * as ADVERSARY from "./adversaries.mjs";
import * as ARMOR from "./armor.mjs";
import * as dice from "./dice.mjs";
import * as EFFECTS from "./effects.mjs";
import * as SKILL from "./skills.mjs"
import * as SPELL from "./spellcraft.mjs";
import * as WEAPON from "./weapon.mjs";
import * as ACTOR from "./actor.mjs";
import * as TALENT from "./talents.mjs";

import {QUALITY_TIERS, ENCHANTMENT_TIERS} from "./items.mjs";
export const SYSTEM_ID = "crucible";

/* -------------------------------------------- */

/**
 * The amount of damage resistance granted by ancestries.
 * @type {object}
 */
export const ANCESTRIES = {
  primaryAbilityStart: 3,
  secondaryAbilityStart: 2,
  resistanceAmount: 3
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
  spell: "crucible.spells",
  spellExtensions: null,
  talent: "crucible.talent",
  talentExtensions: null,
  taxonomy: "crucible.taxonomy"
}

/* -------------------------------------------- */

/**
 * The threat levels that an adversary may have.
 * @enum {number}
 */
export const THREAT_LEVELS = {
  minion: {
    id: "minion",
    actionMax: 4,
    label: "ADVERSARY.ThreatMinion",
    scaling: 0.5,
    icon: "fa-solid fa-chevron-down"
  },
  normal: {
    id: "normal",
    actionMax: 6,
    label: "ADVERSARY.ThreatNormal",
    scaling: 1.0,
    icon: "fa-solid fa-chevron-up"
  },
  elite: {
    id: "elite",
    actionMax: 8,
    label: "ADVERSARY.ThreatElite",
    scaling: 1.5,
    icon: "fa-solid fa-chevrons-up"
  },
  boss: {
    id: "boss",
    actionMax: 10,
    label: "ADVERSARY.ThreatBoss",
    scaling: 2.0,
    icon: "fa-solid fa-skull"
  }
};

/* -------------------------------------------- */

/**
 * Define the Action life-cycle hooks which are supported for an Action.
 * @enum {Readonly<Object<{argNames: string[]}>>}
 */
export const ACTION_HOOKS = Object.freeze({
  prepare: {
    argNames: []
  },
  displayOnSheet: {
    argNames: ["combatant"]
  },
  canUse: {
    argNames: ["targets"]
  },
  preActivate: {
    argNames: ["targets"],
    async: true
  },
  roll: {
    argNames: ["target", "rolls"],
    async: true
  },
  postActivate: {
    argNames: ["outcome"],
    async: true
  },
  confirm: {
    argNames: [],
    async: true
  }
});

/* -------------------------------------------- */

/**
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  ABILITIES: ATTRIBUTES.ABILITIES,
  ACTION,
  ACTOR,
  ACTION_HOOKS,
  ADVERSARY,
  ANCESTRIES,
  ARMOR,
  COMPENDIUM_PACKS,
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
  TALENT,
  THREAT_LEVELS,
  WEAPON,
  activeCheckFormula: "3d8",
  dice: dice
};
