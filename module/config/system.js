import {SKILL_CATEGORIES, SKILL_RANKS, SKILLS} from "./skills.js";
import * as dice from "./dice.js";
export const SYSTEM_ID = "crucible";

/* -------------------------------------------- */

export const ABILITIES = {
  strength: {
    label: "Strength",
    abbreviation: "Str"
  },
  dexterity: {
    label: "Dexterity",
    abbreviation: "Dex"
  },
  constitution: {
    label: "Constitution",
    abbreviation: "Con"
  },
  intellect: {
    label: "Intellect",
    abbreviation: "Int"
  },
  wisdom: {
    label: "Wisdom",
    abbreviation: "Wis"
  },
  charisma: {
    label: "Charisma",
    abbreviation: "Cha"
  }
};

/* -------------------------------------------- */

/**
 * Define the top level damage categories.
 * @type {object}
 */
export const DAMAGE_CATEGORIES = {
  "physical": {
    label: "DAMAGE.Physical",
    abbreviation: "DAMAGE.PhysicalAbr",
  },
  "elemental": {
    label: "DAMAGE.Elemental",
    abbreviation: "DAMAGE.ElementalAbr",
  },
  "spiritual": {
    label: "DAMAGE.Spiritual",
    abbreviation: "DAMAGE.SpiritualAbr",
  }
};

/* -------------------------------------------- */

/**
 * Define the individual damage types within each damage category.
 * @type {object}
 */
export const DAMAGE_TYPES = {
  "bludgeoning": {
    label: "DAMAGE.Bludgeoning",
    abbreviation: "DAMAGE.BludgeoningAbr",
    type: "physical"
  },
  "piercing": {
    label: "DAMAGE.Piercing",
    abbreviation: "DAMAGE.PiercingAbr",
    type: "physical"
  },
  "slashing": {
    label: "DAMAGE.Slashing",
    abbreviation: "DAMAGE.SlashingAbr",
    type: "physical"
  },
  "acid": {
    label: "DAMAGE.Acid",
    abbreviation: "DAMAGE.AcidAbr",
    type: "elemental"
  },
  "fire": {
    label: "DAMAGE.Fire",
    abbreviation: "DAMAGE.FireAbr",
    type: "elemental"
  },
  "frost": {
    label: "DAMAGE.Frost",
    abbreviation: "DAMAGE.FrostAbr",
    type: "elemental"
  },
  "lightning": {
    label: "DAMAGE.Lightning",
    abbreviation: "DAMAGE.LightningAbr",
    type: "elemental"
  },
  "psychic": {
    label: "DAMAGE.Psychic",
    abbreviation: "DAMAGE.PsychicAbr",
    type: "spiritual"
  },
  "radiant": {
    label: "DAMAGE.Radiant",
    abbreviation: "DAMAGE.RadiantAbr",
    type: "spiritual"
  },
  "unholy": {
    label: "DAMAGE.Unholy",
    abbreviation: "DAMAGE.UnholyAbr",
    type: "spiritual"
  }
};


/* -------------------------------------------- */


/**
 * Define the resource pools which are tracked for each character
 * @type{object}
 */
export const RESOURCES = {
  "health": {
    label: "ATTRIBUTES.Health",
    abbreviation: "ATTRIBUTES.Health",
    type: "burst"
  },
  "wounds": {
    label: "ATTRIBUTES.Wounds",
    abbreviation: "ATTRIBUTES.Wounds",
    type: "sustain"
  },
  "morale": {
    label: "ATTRIBUTES.Morale",
    abbreviation: "ATTRIBUTES.Morale",
    type: "burst"
  },
  "madness": {
    label: "ATTRIBUTES.Madness",
    abbreviation: "ATTRIBUTES.Madness",
    type: "sustain"
  },
  "action": {
    label: "ATTRIBUTES.Action",
    abbreviation: "ATTRIBUTES.Action",
    type: "burst"
  },
  "focus": {
    label: "ATTRIBUTES.Focus",
    abbreviation: "ATTRIBUTES.Focus",
    type: "sustain"
  }
};


/* -------------------------------------------- */


/**
 * Define the high level attribute categories tracked for each character
 * @type{object}
 */
export const ATTRIBUTE_CATEGORIES = {
  "abilities": {
    label: "ATTRIBUTES.Abilities",
    values: Object.keys(ABILITIES)
  },
  "pools": {
    label: "ATTRIBUTES.Pools",
    values: Object.keys(RESOURCES)
  },
  "resistances": {
    label: "ATTRIBUTES.Resistances",
    values: Object.keys(DAMAGE_TYPES)
  }
};

/* -------------------------------------------- */


/**
 * The magical defense saving throws which can be applied.
 * @type {object}
 */
export const SAVE_DEFENSES = {
  "fortitude": {
    label: "DEFENSES.Fortitude",
    abbreviation: "DEFENSES.FortitudeAbr",
    abilities: ["strength", "constitution"]
  },
  "reflex": {
    label: "DEFENSES.Reflex",
    abbreviation: "DEFENSES.ReflexAbr",
    abilities: ["dexterity", "intellect"]
  },
  "willpower": {
    label: "DEFENSES.Willpower",
    abbreviation: "DEFENSES.WillpowerAbr",
    abilities: ["wisdom", "charisma"]
  }
};


/* -------------------------------------------- */


/**
 * The base threshold for passive checks onto which bonuses are added.
 * @type {number}
 */
export const PASSIVE_BASE = 12;


/**
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  name: "Crucible (WIP)",
  activeCheckFormula: "3d8",
  dice: dice,
  ABILITIES,
  ATTRIBUTE_CATEGORIES,
  DAMAGE_CATEGORIES,
  DAMAGE_TYPES,
  RESOURCES,
  SAVE_DEFENSES,
  SKILL_CATEGORIES,
  SKILL_RANKS,
  SKILLS,
  PASSIVE_BASE
};
