import {defineEnum} from "./enum.mjs";
import {PROPERTIES as ITEM_PROPERTIES} from "./items.mjs";

/**
 * @import {CrucibleItemCategory} from "./items.mjs";
 */

/**
 * Named accessory categories which are allowed by the system.
 * @type {Readonly<Record<string, CrucibleItemCategory>>}
 */
export const CATEGORIES = defineEnum({
  clothing: {
    label: "ACCESSORY.CATEGORIES.Clothing"
  },
  jewelry: {
    label: "ACCESSORY.CATEGORIES.Jewelry"
  },
  trinket: {
    label: "ACCESSORY.CATEGORIES.Trinket"
  },
  other: {
    label: "ACCESSORY.CATEGORIES.Other"
  }
});

/**
 * Item properties that accessory Items can have.
 * @type {Readonly<Record<string, CrucibleItemCategory>>}
 */
export const PROPERTIES = defineEnum({
  ...foundry.utils.deepClone(ITEM_PROPERTIES)
});
