import DataModel from "/common/abstract/data.mjs";
import * as fields from "/common/data/fields.mjs";
import { SYSTEM } from "../config/system.js";

/**
 * A data structure which is shared by all physical items.
 * @extends {DataModel}
 */
export default class PhysicalItemData extends DataModel {
  static defineSchema() {
    return {
      category: new fields.StringField({required: true, blank: false, initial: this.DEFAULT_CATEGORY}),
      quantity: new fields.NumberField({required: true, nullable: false, integer: true, min: 0}),
      weight: new fields.NumberField({required: true, nullable: false, integer: true, min: 0}),
      price: new fields.NumberField({required: true, nullable: false, integer: true, min: 0}),
      quality: new fields.StringField({required: true, choices: SYSTEM.QUALITY_TIERS, initial: "standard"}),
      enchantment: new fields.StringField({required: true, choices: SYSTEM.ENCHANTMENT_TIERS, initial: "mundane"}),
      equipped: new fields.BooleanField(),
      properties: new fields.SetField(new fields.StringField({required: true, choices: this.ITEM_PROPERTIES})),
      description: new fields.StringField()
    }
  }

  /**
   * The default category for new items of this type
   * @type {string}
   */
  static DEFAULT_CATEGORY = "";

  /**
   * Define the set of property tags which can be applied to this item type.
   * @type {string[]}
   */
  static ITEM_PROPERTIES = [];
}
