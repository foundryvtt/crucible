/**
 * @typedef {Object} WeaponCategory       A category of weapon which can exist in the system
 * @property {string} id                  The category id
 * @property {string} label               The localized label for the category
 * @property {number} hands               The number of hands required, 1 or 2
 * @property {boolean} main               Can this weapon be used in the main-hand
 * @property {boolean} off                Can this weapon be used in the off-hand
 * @property {string} scaling             What scaling formula does this weapon use? "str", "dex", or "strdex"
 * @property {{base: number, [multiplier]: number}} damage  The damage attributes of the weapon
 * @property {number} actionCost          The action point cost to strike with this weapon
 */

/**
 * Enumerate the weapon categories which are allowed by the system.
 * Record certain mechanical metadata which applies to weapons in each category.
 * @enum {WeaponCategory}
 */
export const CATEGORIES = {
  unarmed: {
    id: "unarmed",
    label: "WEAPON.Unarmed",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength.dexterity",
    damage: {
      base: 4
    },
    actionCost: 1,
    training: "unarmed"
  },
  natural: {
    id: "natural",
    label: "WEAPON.Natural",
    hands: 0,
    main: true,
    off: true,
    scaling: "strength",
    damage: {
      base: 4
    },
    actionCost: 1,
    training: "unarmed"
  },
  light1: {
    id: "light1",
    label: "WEAPON.Light1",
    hands: 1,
    main: true,
    off: true,
    scaling: "dexterity",
    damage: {
      base: 4
    },
    actionCost: 1,
    training: "finesse"
  },
  simple1: {
    id: "simple1",
    label: "WEAPON.Simple1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength",
    damage: {
      base: 6
    },
    actionCost: 1,
    training: "heavy"
  },
  balanced1: {
    id: "balanced1",
    label: "WEAPON.Balanced1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength.dexterity",
    damage: {
      base: 8
    },
    actionCost: 1,
    training: "balanced"
  },
  heavy1: {
    id: "heavy1",
    label: "WEAPON.Heavy1",
    hands: 1,
    main: true,
    off: false,
    scaling: "strength",
    damage: {
      base: 8
    },
    actionCost: 1,
    training: "heavy"
  },
  simple2: {
    id: "simple2",
    label: "WEAPON.Simple2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    damage: {
      base: 10
    },
    actionCost: 2,
    training: "heavy"
  },
  balanced2: {
    id: "balanced2",
    label: "WEAPON.Balanced2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength.dexterity",
    damage: {
      base: 12
    },
    actionCost: 2,
    training: "balanced"
  },
  heavy2: {
    id: "heavy2",
    label: "WEAPON.Heavy2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    damage: {
      base: 12
    },
    actionCost: 2,
    training: "heavy"
  },
  projectile2: {
    id: "projectile2",
    label: "WEAPON.Projectile2",
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    scaling: "strength.dexterity",
    damage: {
      base: 8
    },
    actionCost: 1,
    training: "projectile"
  },
  mechanical1: {
    id: "mechanical1",
    label: "WEAPON.Mechanical1",
    hands: 1,
    main: true,
    off: true,
    ranged: true,
    reload: true,
    scaling: "dexterity",
    damage: {
      base: 6
    },
    actionCost: 1,
    training: "mechanical"
  },
  mechanical2: {
    id: "mechanical2",
    label: "WEAPON.Mechanical2",
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    reload: true,
    scaling: "dexterity",
    damage: {
      base: 12
    },
    actionCost: 1,
    training: "mechanical"
  },
  shieldLight: {
    id: "shieldLight",
    label: "WEAPON.ShieldLight",
    hands: 1,
    main: false,
    off: true,
    ranged: false,
    scaling: "strength.dexterity",
    damage: {
      base: 2
    },
    defense: {
      block: 2
    },
    actionCost: 1,
    training: "shield"
  },
  shieldHeavy: {
    id: "shieldHeavy",
    label: "WEAPON.ShieldHeavy",
    hands: 1,
    main: false,
    off: true,
    ranged: false,
    scaling: "strength",
    damage: {
      base: 4
    },
    defense: {
      block: 4
    },
    actionCost: 1,
    training: "shield"
  },
  talisman1: {
    id: "talisman1",
    label: "WEAPON.Talisman1",
    hands: 1,
    main: false,
    off: true,
    ranged: false,
    scaling: "presence",
    damage: {
      base: 2
    },
    actionCost: 1,
    training: "talisman"
  },
  talisman2: {
    id: "talisman2",
    label: "WEAPON.Talisman2",
    hands: 2,
    main: true,
    off: false,
    ranged: false,
    scaling: "presence",
    damage: {
      base: 6
    },
    actionCost: 1,
    training: "talisman"
  }
}


/**
 * The boolean properties which a Weapon may have.
 * @enum {object}
 */
export const PROPERTIES = {
  ambush: {
    label: "WEAPON.TagAmbush",
    tooltip: "WEAPON.TagAmbushTooltip"
  },
  blocking: {
    label: "WEAPON.TagBlocking",
    tooltip: "WEAPON.TagBlockingTooltip"
  },
  grasping: {
    label: "WEAPON.TagGrasping",
    tooltip: "WEAPON.TagGraspingTooltip"
  },
  keen: {
    label: "WEAPON.TagKeen",
    tooltip: "WEAPON.TagKeenTooltip"
  },
  oversized: {
    label: "WEAPON.TagOversized",
    tooltip: "WEAPON.TagOversizedTooltip"
  },
  parrying: {
    label: "WEAPON.TagParrying",
    tooltip: "WEAPON.TagParryingTooltip"
  },
  reach: {
    label: "WEAPON.TagReach",
    tooltip: "WEAPON.TagReachTooltip"
  },
  reliable: {
    label: "WEAPON.TagReliable",
    tooltip: "WEAPON.TagReliableTooltip"
  },
  thrown: {
    label: "WEAPON.TagThrown",
    tooltip: "WEAPON.TagThrownTooltip"
  },
  versatile: {
    label: "WEAPON.TagVersatile",
    tooltip: "WEAPON.TagVersatileTooltip"
  }
}

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
  "wrench"
]);
