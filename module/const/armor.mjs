import {PROPERTIES as ITEM_PROPERTIES} from "./items.mjs";

/**
 * @import {CrucibleItemCategory} from "./items.mjs";
 */

/**
 * @typedef {CrucibleItemCategory} CrucibleArmorCategory
 * @property {string} id
 * @property {string} label
 * @property {{min: number, max: number}} armor
 * @property {{scaling: number, base: (number) => number}} dodge
 */

/**
 * Named armor categories which are allowed by the system
 * @enum {CrucibleArmorCategory}
 */
export const CATEGORIES = {
  unarmored: {
    id: "unarmored",
    label: "ARMOR.CATEGORIES.Unarmored",
    armor: {min: 0, max: 0},
    dodge: {scaling: 0, base: _a => 8}
  },
  light: {
    id: "light",
    label: "ARMOR.CATEGORIES.Light",
    armor: {min: 4, max: 8},
    dodge: {scaling: 4, base: a => 10 - Math.floor(a / 2)}
  },
  medium: {
    id: "medium",
    label: "ARMOR.CATEGORIES.Medium",
    armor: {min: 9, max: 13},
    dodge: {scaling: 6, base: a => 10 - Math.floor((a+1) / 2)}
  },
  heavy: {
    id: "heavy",
    label: "ARMOR.CATEGORIES.Heavy",
    armor: {min: 14, max: 18},
    dodge: {scaling: 8, base: a => 10 - Math.floor((a+2) / 2)}
  },
  natural: {
    id: "natural",
    label: "ARMOR.CATEGORIES.Natural",
    armor: {min: 4, max: 18},
    dodge: {scaling: 2, base: a => 10 - Math.floor(a / 2)}
  }
};

/**
 * The boolean properties which a piece of Armor can have.
 * @type {Record<string, {label: string, [rarity]: number}>}
 */
export const PROPERTIES = {
  ...foundry.utils.deepClone(ITEM_PROPERTIES),
  bulky: {
    label: "ARMOR.PROPERTIES.Bulky"
  },
  natural: {
    label: "ARMOR.PROPERTIES.Natural"
  },
  noisy: {
    label: "ARMOR.PROPERTIES.Noisy"
  }
};

/**
 * Data representing the default "unarmored" armor item.
 * @type {ItemData}
 */
export const UNARMORED_DATA = {
  name: "ARMOR.SPECIFIC.Unarmored",
  img: "icons/equipment/chest/shirt-simple-white.webp",
  type: "armor",
  system: {
    category: "unarmored",
    armor: 0
  }
};

