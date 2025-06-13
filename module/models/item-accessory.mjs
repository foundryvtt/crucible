import CruciblePhysicalItem from "./item-physical.mjs";
import * as ACCESSORY from "../config/accessory.mjs";

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

  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Object<string, string>}    The tags which describe this weapon
   */
  getTags(scope="full") {
    const tags = {};
    tags.category = this.config.category.label;
    if ( this.equipped ) tags.equipped = this.schema.fields.equipped.label;
    if ( this.dropped ) tags.dropped = this.schema.fields.dropped.label;
    if ( this.requiresInvestment ) tags.invested = this.invested ? this.schema.fields.invested.label : "Not Invested";
    return tags;
  }
}
