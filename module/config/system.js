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
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  activeCheckFormula: "3d8",
  ...ATTRIBUTES,
  ACTION,
  ARMOR,
  dice: dice,
  ANCESTRIES,
  COMPENDIUM_PACKS,
  EFFECTS,
  ENCHANTMENT_TIERS,
  QUALITY_TIERS,
  SKILL_CATEGORIES,
  SKILL_RANKS,
  SKILLS,
  SPELL,
  WEAPON,
};
