/**
 * @typedef {Object} WeaponCategory       A category of weapon which can exist in the system
 * @property {string} id                  The category id
 * @property {string} label               The localized label for the category
 * @property {number} hands               The number of hands required, 1 or 2
 * @property {boolean} main               Can this weapon be used in the main-hand
 * @property {boolean} off                Can this weapon be used in the off-hand
 * @property {string} scaling             What scaling formula does this weapon use? "str", "dex", or "strdex"
 * @property {number} bonus               The additive damage of this weapon
 * @property {number} multiplier          The multiplicative damage of this weapon
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
    scaling: "strength",
    bonus: 0,
    multiplier: 1,
    actionCost: 1
  },
  light1: {
    id: "light1",
    label: "WEAPON.Light1",
    hands: 1,
    main: true,
    off: true,
    scaling: "dexterity",
    bonus: 0,
    multiplier: 1,
    actionCost: 1
  },
  simple1: {
    id: "simple1",
    label: "WEAPON.Simple1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength",
    bonus: 0,
    multiplier: 1,
    actionCost: 1
  },
  balanced1: {
    id: "balanced1",
    label: "WEAPON.Balanced1",
    hands: 1,
    main: true,
    off: true,
    scaling: "strength.dexterity",
    bonus: 1,
    multiplier: 1,
    actionCost: 1
  },
  heavy1: {
    id: "heavy1",
    label: "WEAPON.Heavy1",
    hands: 1,
    main: true,
    off: false,
    scaling: "strength",
    bonus: 2,
    multiplier: 1,
    actionCost: 1
  },
  massive1: {
    id: "massive1",
    label: "WEAPON.Massive1",
    hands: 1,
    main: true,
    off: false,
    scaling: "strength",
    bonus: 2,
    multiplier: 2,
    actionCost: 2
  },
  simple2: {
    id: "simple2",
    label: "WEAPON.Simple2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    bonus: 0,
    multiplier: 2,
    actionCost: 2
  },
  balanced2: {
    id: "balanced2",
    label: "WEAPON.Balanced2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength.dexterity",
    bonus: 1,
    multiplier: 2,
    actionCost: 2
  },
  heavy2: {
    id: "heavy2",
    label: "WEAPON.Heavy2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    bonus: 2,
    multiplier: 2,
    actionCost: 2
  },
  massive2: {
    id: "massive2",
    label: "WEAPON.Massive2",
    hands: 2,
    main: true,
    off: false,
    scaling: "strength",
    bonus: 2,
    multiplier: 3,
    actionCost: 3
  },
  projectile2: {
    id: "projectile2",
    label: "WEAPON.Projectile2",
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    scaling: "strength.dexterity",
    bonus: 0,
    multiplier: 2,
    actionCost: 2
  },
  mechanical1: {
    id: "mechanical1",
    label: "WEAPON.Mechanical1",
    hands: 1,
    main: true,
    off: true,
    ranged: true,
    scaling: "dexterity",
    bonus: 0,
    multiplier: 1,
    actionCost: 2
  },
  mechanical2: {
    id: "mechanical2",
    label: "WEAPON.Mechanical2",
    hands: 2,
    main: true,
    off: false,
    ranged: true,
    scaling: "dexterity",
    bonus: 0,
    multiplier: 2,
    actionCost: 2
  },
  shield: {
    id: "shield",
    label: "WEAPON.Shield",
    hands: 1,
    main: false,
    off: true,
    ranged: false,
    scaling: "strength",
    bonus: 0,
    multiplier: 1,
    actionCost: 1
  }
}


/**
 * The boolean properties which a Weapon may have.
 * @enum {object}
 */
export const PROPERTIES = {
  ambush: {
    label: "WEAPON.PropertyAmbush"
  },
  blocking: {
    label: "WEAPON.PropertyBlocking"
  },
  grasping: {
    label: "WEAPON.PropertyGrasping"
  },
  keen: {
    label: "WEAPON.PropertyKeen"
  },
  slow: {
    label: "WEAPON.PropertySlow"
  },
  parrying: {
    label: "WEAPON.PropertyParrying"
  },
  reach: {
    label: "WEAPON.PropertyReach"
  },
  thrown: {
    label: "WEAPON.PropertyThrown"
  },
  versatile: {
    label: "WEAPON.PropertyVersatile"
  }
}

/**
 * The valid ways that weapon damage can scale
 * @type {object}
 */
export const SCALING_MODES = {
  "str": {
    label: "WEAPON.ScalingStr"
  },
  "strdex": {
    label: "WEAPON.ScalingStrDex"
  },
  "dex": {
    label: "WEAPON.ScalingDex"
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
  category: "unarmed",
  quality: "shoddy",
  enchantment: "mundane",
  damageType: "bludgeoning"
}
