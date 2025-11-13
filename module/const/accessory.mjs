import {PROPERTIES as ITEM_PROPERTIES} from "./items.mjs";

/**
 * @import {CrucibleItemCategory} from "./items.mjs";
 */

/**
 * Named accessory categories which are allowed by the system.
 * @enum {CrucibleItemCategory}
 */
export const CATEGORIES = {
  clothing: {
    id: "clothing",
    label: "ACCESSORY.CATEGORIES.CLOTHING"
  },
  jewelry: {
    id: "jewelry",
    label: "ACCESSORY.CATEGORIES.JEWELRY"
  },
  trinket: {
    id: "trinket",
    label: "ACCESSORY.CATEGORIES.TRINKET"
  },
  other: {
    id: "other",
    label: "ACCESSORY.CATEGORIES.OTHER"
  }
};

/**
 * Item properties that accessory Items can have.
 * @enum {CrucibleItemCategory}
 */
export const PROPERTIES = {
  ...foundry.utils.deepClone(ITEM_PROPERTIES),
};
