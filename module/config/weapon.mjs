/**
 * @typedef {Object} WeaponCategory       A category of weapon which can exist in the system
 * @property {string} id                  The category id
 * @property {string} label               The localized label for the category
 * @property {number} hands               The number of hands required, 1 or 2
 * @property {boolean} main               Can this weapon be used in the main-hand
 * @property {boolean} off                Can this weapon be used in the off-hand
 * @property {string} scaling             What scaling formula does this weapon use?
 * @property {number} damage              Base damage for the weapon category
 * @property {number} actionCost          The action point cost to strike with this weapon
 * @property {WeaponTrainingTypes[]} training Training categories which apply skill bonuses to this weapon category
 */

import Enum from "./enum.mjs";

/**
 * @typedef {"talisman"|"heavy"|"light"|"mechanical"|"natural"|"projectile"|"shield"|"simple"|"unarmed"} WeaponTrainingTypes
 */

/**
 * Training categories which apply to weapons.
 * @type {Record<WeaponTrainingTypes, {label: string}>}
 **/
export const TRAINING = Object.freeze({
  talisman: {label: "WEAPON.CATEGORIES.TALISMAN"},
  heavy: {label: "WEAPON.CATEGORIES.HEAVY"},
  light: {label: "WEAPON.CATEGORIES.LIGHT"},
  mechanical: {label: "WEAPON.CATEGORIES.MECHANICAL"},
  natural: {label: "WEAPON.CATEGORIES.NATURAL"},
  projectile: {label: "WEAPON.CATEGORIES.PROJECTILE"},
  shield: {label: "WEAPON.CATEGORIES.SHIELD"},
  simple: {label: "WEAPON.CATEGORIES.SIMPLE"},
  unarmed: {label: "WEAPON.CATEGORIES.UNARMED"}
});

// Helper function for labeling categories
const label = (category, hands) => {
  category = game.i18n.localize(category);
  return game.i18n.format("WEAPON.CATEGORIES.CATEGORY_HANDS", {category, hands});
}

/**
 * Enumerate the weapon categories which are allowed by the system.
 * Record certain mechanical metadata which applies to weapons in each category.
 * @type {Record<string, WeaponCategory>}
 */
export const CATEGORIES = Object.freeze({

  // Natural Attacks
  natural: {
    id: "natural",
    label: "WEAPON.CATEGORIES.NATURAL",
    hands: 0,
    main: true,
    off: true,
    scaling: "strength.toughness",
    actionCost: 2,
    damage: 3,
    range: 1,
    training: ["natural"]
  },

  // One-Handed Melee
  unarmed: {
    id: "unarmed",
    label: "WEAPON.CATEGORIES.UNARMED",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength.dexterity",
    actionCost: 2,
    damage: 3,
    range: 1,
    training: ["unarmed"]
  },
  light1: {
    id: "light1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.LIGHT", 1),
    hands: 1,
    main: true,
    off: true,
    scaling: "dexterity",
    actionCost: 2,
    damage: 3,
    range: 1,
    training: ["light"]
  },
  simple1: {
    id: "simple1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.SIMPLE", 1),
    hands: 1,
    main: true,
    off: true,
    scaling: "strength",
    damage: 4,
    actionCost: 2,
    range: 1,
    training: ["heavy"]
  },
  balanced1: {
    id: "balanced1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.BALANCED", 1),
    hands: 1,
    main: true,
    off: true,
    scaling: "strength.dexterity",
    damage: 4,
    actionCost: 2,
    range: 2,
    training: ["heavy", "light"]
  },
  heavy1: {
    id: "heavy1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.HEAVY", 1),
    hands: 1,
    main: true,
    off: false,
    scaling: "strength",
    damage: 6,
    actionCost: 3,
    range: 2,
    training: ["heavy"]
  },

  // Two-Handed Melee
  simple2: {
    id: "simple2",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.SIMPLE", 2),
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    actionCost: 3,
    damage: 6,
    range: 2,
    training: ["heavy"]
  },
  balanced2: {
    id: "balanced2",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.BALANCED", 2),
    hands: 2,
    main: true,
    off: false,
    scaling: "strength.dexterity",
    damage: 6,
    actionCost: 3,
    range: 3,
    training: ["light", "heavy"]
  },
  heavy2: {
    id: "heavy2",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.HEAVY", 2),
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    damage: 8,
    actionCost: 4,
    range: 3,
    training: ["heavy"]
  },

  // One-Handed Ranged
  projectile1: {
    id: "projectile1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.PROJECTILE", 1),
    hands: 1,
    main: true,
    off: true,
    ranged: true,
    scaling: "strength.dexterity",
    actionCost: 2,
    damage: 4,
    range: 60,
    training: ["projectile"]
  },
  talisman1: {
    id: "talisman1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.TALISMAN", 1),
    hands: 1,
    main: true,
    off: true,
    ranged: false,
    scaling: "presence",
    actionCost: 2,
    damage: 2,
    range: 30,
    training: ["talisman"]
  },
  mechanical1: {
    id: "mechanical1",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.MECHANICAL", 1),
    hands: 1,
    main: true,
    off: true,
    ranged: true,
    reload: true,
    scaling: "dexterity",
    actionCost: 2,
    damage: 4,
    range: 60,
    training: ["mechanical"]
  },

  // Two-Handed Ranged
  projectile2: {
    id: "projectile2",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.PROJECTILE", 2),
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    scaling: "strength.dexterity",
    actionCost: 3,
    damage: 6,
    range: 120,
    training: ["projectile"]
  },
  talisman2: {
    id: "talisman2",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.TALISMAN", 2),
    hands: 2,
    main: true,
    off: false,
    ranged: false,
    scaling: "presence",
    actionCost: 3,
    damage: 3,
    range: 30,
    training: ["talisman"]
  },
  mechanical2: {
    id: "mechanical2",
    label: label.bind(globalThis, "WEAPON.CATEGORIES.MECHANICAL", 2),
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    reload: true,
    scaling: "dexterity",
    actionCost: 2,
    damage: 6,
    range: 120,
    training: ["mechanical"]
  },

  // Shields
  shieldLight: {
    id: "shieldLight",
    label: "WEAPON.CATEGORIES.SHIELD_LIGHT",
    hands: 1,
    main: false,
    off: true,
    ranged: false,
    scaling: "dexterity",
    actionCost: 2,
    damage: 2,
    defense: {
      block: 2
    },
    range: 1,
    training: ["shield"]
  },
  shieldHeavy: {
    id: "shieldHeavy",
    label: "WEAPON.CATEGORIES.SHIELD_HEAVY",
    hands: 1,
    main: false,
    off: true,
    ranged: false,
    scaling: "strength",
    actionCost: 2,
    damage: 3,
    range: 1,
    defense: {
      block: 4
    },
    training: ["shield"]
  }
});

/**
 * The boolean properties which a Weapon may have.
 * @enum {{label: string, tooltip: string, [rarity]: number}}
 */
export const PROPERTIES = {
  ambush: {
    label: "WEAPON.TAGS.Ambush",
    tooltip: "WEAPON.TAGS.AmbushTooltip"
  },
  blocking: {
    label: "WEAPON.TAGS.Blocking",
    tooltip: "WEAPON.TAGS.BlockingTooltip"
  },
  engaging: {
    label: "WEAPON.TAGS.Engaging",
    tooltip: "WEAPON.TAGS.EngagingTooltip"
  },
  keen: {
    label: "WEAPON.TAGS.Keen",
    tooltip: "WEAPON.TAGS.KeenTooltip",
    rarity: 1
  },
  oversized: {
    label: "WEAPON.TAGS.Oversized",
    tooltip: "WEAPON.TAGS.OversizedTooltip"
  },
  parrying: {
    label: "WEAPON.TAGS.Parrying",
    tooltip: "WEAPON.TAGS.ParryingTooltip"
  },
  reach: {
    label: "WEAPON.TAGS.Reach",
    tooltip: "WEAPON.TAGS.ReachTooltip"
  },
  reliable: {
    label: "WEAPON.TAGS.Reliable",
    tooltip: "WEAPON.TAGS.ReliableTooltip",
    rarity: 1
  },
  returning: {
    label: "WEAPON.TAGS.Returning",
    tooltip: "WEAPON.TAGS.ReturningTooltip",
    rarity: 1
  },
  thrown: {
    label: "WEAPON.TAGS.Thrown",
    tooltip: "WEAPON.TAGS.ThrownTooltip"
  },
  versatile: {
    label: "WEAPON.TAGS.Versatile",
    tooltip: "WEAPON.TAGS.VersatileTooltip"
  }
};

/**
 * Designate which equipped slot the weapon is used in.
 * @type {Enum<number>}
 */
export const SLOTS = new Enum({
  EITHER: {value: 0, label: "WEAPON.SLOTS.EITHER"},
  MAINHAND: {value: 1, label: "WEAPON.SLOTS.MAINHAND"},
  OFFHAND: {value: 2, label: "WEAPON.SLOTS.OFFHAND"},
  TWOHAND: {value: 3, label: "WEAPON.SLOTS.TWOHAND"}
});

/**
 * The configuration of the default unarmed Weapon.
 * @type {object}
 */
export const UNARMED_DATA = {
  name: "Unarmed",
  type: "weapon",
  img: "icons/skills/melee/unarmed-punch-fist.webp",
  system: {
    category: "unarmed",
    quality: "standard",
    enchantment: "mundane",
    damageType: "bludgeoning"
  }
}

/**
 * A special weapon configuration used for Nosferatu bite attack.
 * @type {CrucibleWeaponItem}
 */
export const VAMPIRE_BITE = {
  name: "Vampire Bite",
  type: "weapon",
  img: "icons/magic/death/mouth-bite-fangs-vampire.webp",
  system: {
    category: "natural",
    quality: "superior",
    enchantment: "mundane",
    damageType: "piercing"
  }
}
