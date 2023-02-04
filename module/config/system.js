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
 *   strength: {label: string, abbreviation: string},
 *   toughness: {label: string, abbreviation: string},
 *   dexterity: {label: string, abbreviation: string},
 *   intellect: {label: string, abbreviation: string},
 *   presence: {label: string, abbreviation: string},
 *   wisdom: {label: string, abbreviation: string}
 * }}
 */
export const ABILITIES = {
  strength: {
    label: "Strength",
    abbreviation: "Str"
  },
  toughness: {
    label: "Toughness",
    abbreviation: "Tou"
  },
  dexterity: {
    label: "Dexterity",
    abbreviation: "Dex"
  },
  intellect: {
    label: "Intellect",
    abbreviation: "Int"
  },
  presence: {
    label: "Presence",
    abbreviation: "Pre"
  },
  wisdom: {
    label: "Wisdom",
    abbreviation: "Wis"
  }
};

/* -------------------------------------------- */

/**
 * The amount of damage resistance granted by ancestries.
 * @type {object}
 */
export const ANCESTRIES = {
  primaryAttributeStart: 3,
  secondaryAttributeStart: 2,
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
 * @typedef {Object}  ActorResource       A resource pool available to an Actor within the system
 * @property {string} id                  The resource id
 * @property {string} label               The localized full label for the resource
 * @property {string} abbreviation        The localized abbreviation for the resource
 * @property {string} type                The type of resource, "active" or "reserve"
 * @property {string} tooltip             The tooltip formula for the resource
 * @property {{high: number, low: number, heal: number}} color  Displayed colors for the resource
 */

/**
 * Define the resource pools which are tracked for each character
 * @enum {ActorResource}
 */
export const RESOURCES = {
  "health": {
    id: "health",
    label: "ATTRIBUTES.Health",
    abbreviation: "ATTRIBUTES.Health",
    type: "active",
    tooltip: "(4 * (Level + Toughness)) + (2 * (Strength + Dexterity))",
    color: {
      high: Color.from(0xEE0000),
      low: Color.from(0xAA0000),
      heal: Color.from(0x00EE00)
    },
  },
  "wounds": {
    id: "wounds",
    label: "ATTRIBUTES.Wounds",
    abbreviation: "ATTRIBUTES.Wounds",
    type: "reserve",
    tooltip: "Health * 2",
    color: {
      high: Color.from(0xEE0000),
      low: Color.from(0xAA0000),
      heal: Color.from(0x00EE00)
    },
  },
  "morale": {
    id: "morale",
    label: "ATTRIBUTES.Morale",
    abbreviation: "ATTRIBUTES.Morale",
    type: "active",
    tooltip: "(4 * (Level + Presence)) + (2 * (Intellect + Wisdom))",
    color: {
      high: Color.from(0x9900CC),
      low: Color.from(0x6600AA),
      heal: Color.from(0x9900CC)
    }
  },
  "madness": {
    id: "madness",
    label: "ATTRIBUTES.Madness",
    abbreviation: "ATTRIBUTES.Madness",
    tooltip: "Morale * 2",
    type: "reserve",
    color: {
      high: Color.from(0x9900CC),
      low: Color.from(0x6600AA),
      heal: Color.from(0x9900CC)
    }
  },
  "action": {
    id: "action",
    label: "ATTRIBUTES.Action",
    abbreviation: "ATTRIBUTES.Action",
    tooltip: "3 + Action Bonus",
    type: "active",
    color: {
      high: Color.from(0xFF9900),
      low: Color.from(0xCC6600),
      heal: Color.from(0xFF9900)
    }
  },
  "focus": {
    id: "focus",
    label: "ATTRIBUTES.Focus",
    abbreviation: "ATTRIBUTES.Focus",
    tooltip: "(Level / 2) + Max(Wisdom, Presence, Intellect)",
    type: "active",
    color: {
      high: Color.from(0x0066FF),
      low: Color.from(0x0033CC),
      heal: Color.from(0x0066FF)
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
    abilities: ["strength", "toughness"],
    tooltip: "12 + Strength + Toughness"
  },
  "reflex": {
    label: "DEFENSES.Reflex",
    abbreviation: "DEFENSES.ReflexAbr",
    abilities: ["dexterity", "intellect"],
    tooltip: "12 + Dexterity + Intellect"
  },
  "willpower": {
    label: "DEFENSES.Willpower",
    abbreviation: "DEFENSES.WillpowerAbr",
    abilities: ["wisdom", "presence"],
    tooltip: "12 + Wisdom + Presence"
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
  ANCESTRIES,
  ATTRIBUTE_CATEGORIES,
  COMPENDIUM_PACKS,
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
