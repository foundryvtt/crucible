import {SKILL_CATEGORIES, SKILL_RANKS, SKILLS} from "./skills.js";
import * as ARMOR from "./armor.js";
import * as dice from "./dice.js";
import * as TALENT from "./talent.mjs";
import * as WEAPON from "./weapon.js";
import {QUALITY_TIERS, ENCHANTMENT_TIERS} from "./items.js";
export const SYSTEM_ID = "crucible";

/**
 * The primary attributes which are called abilities.
 * @type {{
 *   dexterity: {label: string, abbreviation: string},
 *   constitution: {label: string, abbreviation: string},
 *   intellect: {label: string, abbreviation: string},
 *   strength: {label: string, abbreviation: string},
 *   charisma: {label: string, abbreviation: string},
 *   wisdom: {label: string, abbreviation: string}
 * }}
 */
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
    type: "burst",
    tooltip: "((2 * Constitution) + Strength + Dexterity) * Level",
    color: {
      high: 0xEE0000,
      low: 0xAA0000
    },
  },
  "wounds": {
    label: "ATTRIBUTES.Wounds",
    abbreviation: "ATTRIBUTES.Wounds",
    type: "sustain",
    tooltip: "Health * 2",
    color: {
      high: 0xEE0000,
      low: 0xAA0000
    },
  },
  "morale": {
    label: "ATTRIBUTES.Morale",
    abbreviation: "ATTRIBUTES.Morale",
    type: "burst",
    tooltip: "((2 * Charisma) + Intellect + Wisdom) * Level",
    color: {
      high: 0x9900CC,
      low: 0x6600AA
    }
  },
  "madness": {
    label: "ATTRIBUTES.Madness",
    abbreviation: "ATTRIBUTES.Madness",
    type: "sustain",
    tooltip: "Morale * 2",
    color: {
      high: 0x9900CC,
      low: 0x6600AA
    }
  },
  "action": {
    label: "ATTRIBUTES.Action",
    abbreviation: "ATTRIBUTES.Action",
    type: "burst",
    tooltip: "3 + Action Bonus",
    color: {
      high: 0xFF9900,
      low: 0xCC6600
    }
  },
  "focus": {
    label: "ATTRIBUTES.Focus",
    abbreviation: "ATTRIBUTES.Focus",
    type: "sustain",
    tooltip: "(Level * 2) + Focus Bonus",
    color: {
      high: 0x0066FF,
      low: 0x0033CC
    }
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
  ARMOR,
  dice: dice,
  ABILITIES,
  ATTRIBUTE_CATEGORIES,
  DAMAGE_CATEGORIES,
  DAMAGE_TYPES,
  ENCHANTMENT_TIERS,
  PASSIVE_BASE,
  QUALITY_TIERS,
  RESOURCES,
  SAVE_DEFENSES,
  SKILL_CATEGORIES,
  SKILL_RANKS,
  SKILLS,
  TALENT,
  WEAPON,
};
