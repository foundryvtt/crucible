import CruciblePhysicalItem from "./item-physical.mjs";
import * as ACCESSORY from "../const/accessory.mjs";

/**
 * Data schema, attributes, and methods specific to "accessory" type Items.
 */
export default class CrucibleAccessoryItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = ACCESSORY.CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "jewelry";

  /** @override */
  static ITEM_PROPERTIES = ACCESSORY.PROPERTIES;

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "ACCESSORY"];
}
