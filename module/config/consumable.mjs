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
    label: "CONSUMABLE.CATEGORIES.AMMUNITION"
  },
  bomb: {
    id: "bomb",
    label: "CONSUMABLE.CATEGORIES.BOMB"
  },
  flask: {
    id: "flask",
    label: "CONSUMABLE.CATEGORIES.FLASK"
  },
  kit: {
    id: "kit",
    label: "CONSUMABLE.CATEGORIES.KIT"
  },
  other: {
    id: "other",
    label: "CONSUMABLE.CATEGORIES.OTHER"
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
