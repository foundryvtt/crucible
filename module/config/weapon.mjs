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
 */

import Enum from "./enum.mjs";

/**
 * Enumerate the weapon categories which are allowed by the system.
 * Record certain mechanical metadata which applies to weapons in each category.
 * @enum {WeaponCategory}
 */
export const CATEGORIES = {

  // Natural Attacks
  natural: {
    id: "natural",
    label: "WEAPON.CATEGORIES.NATURAL",
    hands: 0,
    main: true,
    off: true,
    scaling: "strength",
    actionCost: 2,
    damage: 3,
    range: 1,
    training: "natural"
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
    training: "unarmed"
  },
  light1: {
    id: "light1",
    label: "WEAPON.CATEGORIES.LIGHT1",
    hands: 1,
    main: true,
    off: true,
    scaling: "dexterity",
    actionCost: 2,
    damage: 3,
    range: 1,
    training: "finesse"
  },
  simple1: {
    id: "simple1",
    label: "WEAPON.CATEGORIES.SIMPLE1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength",
    damage: 4,
    actionCost: 2,
    range: 1,
    training: "heavy"
  },
  balanced1: {
    id: "balanced1",
    label: "WEAPON.CATEGORIES.BALANCED1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength.dexterity",
    damage: 4,
    actionCost: 2,
    range: 2,
    training: "balanced"
  },
  heavy1: {
    id: "heavy1",
    label: "WEAPON.CATEGORIES.HEAVY1",
    hands: 1,
    main: true,
    off: false,
    scaling: "strength",
    damage: 6,
    actionCost: 3,
    range: 2,
    training: "heavy"
  },

  // Two-Handed Melee
  simple2: {
    id: "simple2",
    label: "WEAPON.CATEGORIES.SIMPLE2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    actionCost: 3,
    damage: 6,
    range: 2,
    training: "heavy"
  },
  balanced2: {
    id: "balanced2",
    label: "WEAPON.CATEGORIES.BALANCED2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength.dexterity",
    damage: 6,
    actionCost: 3,
    range: 3,
    training: "balanced"
  },
  heavy2: {
    id: "heavy2",
    label: "WEAPON.CATEGORIES.HEAVY2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    damage: 8,
    actionCost: 4,
    range: 3,
    training: "heavy"
  },

  // One-Handed Ranged
  projectile1: {
    id: "projectile1",
    label: "WEAPON.CATEGORIES.PROJECTILE1",
    hands: 1,
    main: true,
    off: true,
    ranged: true,
    scaling: "strength.dexterity",
    actionCost: 2,
    damage: 4,
    range: 60,
    training: "projectile"
  },
  talisman1: {
    id: "talisman1",
    label: "WEAPON.CATEGORIES.TALISMAN1",
    hands: 1,
    main: true,
    off: true,
    ranged: false,
    scaling: "presence",
    actionCost: 2,
    damage: 2,
    range: 30,
    training: "talisman"
  },
  mechanical1: {
    id: "mechanical1",
    label: "WEAPON.CATEGORIES.MECHANICAL1",
    hands: 1,
    main: true,
    off: true,
    ranged: true,
    reload: true,
    scaling: "dexterity",
    actionCost: 2,
    damage: 4,
    range: 60,
    training: "mechanical"
  },

  // Two-Handed Ranged
  projectile2: {
    id: "projectile2",
    label: "WEAPON.CATEGORIES.PROJECTILE2",
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    scaling: "strength.dexterity",
    actionCost: 3,
    damage: 6,
    range: 120,
    training: "projectile"
  },
  talisman2: {
    id: "talisman2",
    label: "WEAPON.CATEGORIES.TALISMAN2",
    hands: 2,
    main: true,
    off: false,
    ranged: false,
    scaling: "presence",
    actionCost: 3,
    damage: 3,
    range: 30,
    training: "talisman"
  },
  mechanical2: {
    id: "mechanical2",
    label: "WEAPON.CATEGORIES.MECHANICAL2",
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    reload: true,
    scaling: "dexterity",
    actionCost: 2,
    damage: 6,
    range: 120,
    training: "mechanical"
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
    training: "shield"
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
    training: "shield"
  },

};

/**
 * The boolean properties which a Weapon may have.
 * @enum {object}
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
    tooltip: "WEAPON.TAGS.KeenTooltip"
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
    tooltip: "WEAPON.TAGS.ReliableTooltip"
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
 * @type {CrucibleWeapon}
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

/* -------------------------------------------- */

/**
 * Valid weapon animation types supported by the JB2A library
 * @type {string[]}
 */
export const ANIMATION_TYPES = Object.freeze([
  "arrow",
  "bolt",
  "boomerang",
  "bullet",
  "club",
  "dagger",
  "dagger",
  "falchion",
  "glaive",
  "greataxe",
  "greatclub",
  "greatsword",
  "halberd",
  "hammer",
  "handaxe",
  "katana",
  "mace",
  "maul",
  "quarterstaff",
  "rapier",
  "scimitar",
  "shortsword",
  "spear",
  "sword",
  "unarmed_strike",
  "warhammer",
  "wrench",
  "bite",
  "claws"
]);
