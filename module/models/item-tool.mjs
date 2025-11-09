import CruciblePhysicalItem from "./item-physical.mjs";
import {TOOL_CATEGORIES, PROPERTIES} from "../config/items.mjs";

/**
 * Data schema, attributes, and methods specific to "tool" type Items.
 * Tools are equipped to tool-belt slots along with consumables.
 *
 * @example Example Tool System Data
 * {
 *   identifier: "crowbar",
 *   category: "implement",
 *   quantity: 1,
 *   weight: 6,
 *   price: 1200,
 *   quality: "standard",
 *   enchantment: "mundane",
 *   properties: ["common"],
 *   description: {
 *     public: "A slightly curved bar of strong metal featuring a hook with a flattened head on one end.",
 *     private: "The favorite snack of corvids.",
 *   }
 * }
 */
export default class CrucibleToolItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = TOOL_CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "implement";

  /** @override */
  static ITEM_PROPERTIES = {
    investment: PROPERTIES.investment
  };

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "TOOL"];

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    delete schema.actorHooks; // Tools don't provide actor hooks
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(schema, {
      skill: new fields.StringField()
    });
  }
}
