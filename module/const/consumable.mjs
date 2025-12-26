import {PROPERTIES as COMMON_PROPERTIES} from "./items.mjs";

/**
 * @import {CrucibleItemCategory} from "./items.mjs";
 */

/**
 * Named accessory categories which are allowed by the system.
 * @enum {CrucibleItemCategory}
 */
export const CATEGORIES = {
  ammunition: {
    id: "ammunition",
    label: "CONSUMABLE.CATEGORIES.Ammunition"
  },
  bomb: {
    id: "bomb",
    label: "CONSUMABLE.CATEGORIES.Bomb"
  },
  flask: {
    id: "flask",
    label: "CONSUMABLE.CATEGORIES.Flask"
  },
  kit: {
    id: "kit",
    label: "CONSUMABLE.CATEGORIES.Kit"
  },
  other: {
    id: "other",
    label: "CONSUMABLE.CATEGORIES.Other"
  }
};

/**
 * Item properties that accessory Items can have.
 * @enum {CrucibleItemCategory}
 */
export const PROPERTIES = {
  ...COMMON_PROPERTIES,
  thrown: {
    label: "WEAPON.TAGS.Thrown",
    tooltip: "WEAPON.TAGS.ThrownTooltip"
  },
};
