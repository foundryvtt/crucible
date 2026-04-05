import CruciblePhysicalItem from "./item-physical.mjs";
import {PROPERTIES, LOOT_CATEGORIES} from "../const/items.mjs";

/**
 * Data schema, attributes, and methods specific to "consumable" type Items.
 */
export default class CrucibleLootItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = LOOT_CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "other";

  /** @override */
  static ITEM_PROPERTIES = {stackable: PROPERTIES.stackable};

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "LOOT"];

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    delete schema.actorHooks; // Loot don't have actor hooks
    delete schema.equipped;   // Loot cannot be equipped
    delete schema.invested;   // Loot cannot be invested
    delete schema.actions;    // Loot cannot provide actions
    return schema;
  }
}
