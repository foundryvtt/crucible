import {defineEnum} from "./enum.mjs";
import {PROPERTIES as COMMON_PROPERTIES} from "./items.mjs";

/**
 * @import {CrucibleItemCategory} from "./items.mjs";
 */

/**
 * Named accessory categories which are allowed by the system.
 * @enum {CrucibleItemCategory}
 */
export const CATEGORIES = defineEnum({
  ammunition: {
    label: "CONSUMABLE.CATEGORIES.Ammunition"
  },
  bomb: {
    label: "CONSUMABLE.CATEGORIES.Bomb"
  },
  flask: {
    label: "CONSUMABLE.CATEGORIES.Flask"
  },
  kit: {
    label: "CONSUMABLE.CATEGORIES.Kit"
  },
  scroll: {
    label: "CONSUMABLE.CATEGORIES.Scroll"
  },
  trap: {
    label: "CONSUMABLE.CATEGORIES.Trap"
  },
  other: {
    label: "CONSUMABLE.CATEGORIES.Other"
  }
});

/**
 * Item properties that accessory Items can have.
 * @enum {CrucibleItemCategory}
 */
export const PROPERTIES = defineEnum({
  ...COMMON_PROPERTIES,
  thrown: {
    label: "WEAPON.TAGS.Thrown",
    tooltip: "WEAPON.TAGS.ThrownTooltip"
  }
});
