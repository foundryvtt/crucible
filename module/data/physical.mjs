import DocumentData from "/common/abstract/data.mjs";
import * as fields from "/common/data/fields.mjs";

/**
 * A data structure which is shared by all physical items
 * @extends {foundry.abstract.DocumentData}
 */
export default class PhysicalItemData extends DocumentData {
  static defineSchema() {
    return {
      category: fields.field(fields.REQUIRED_STRING, {default: this.DEFAULT_CATEGORY}),
      quantity: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {default: 1}),
      weight: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {default: 0}),
      price: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {default: 0}),
      quality: fields.field(fields.REQUIRED_STRING, {default: "standard"}),
      enchantment: fields.field(fields.REQUIRED_STRING, {default: "mundane"}),
      equipped: fields.BOOLEAN_FIELD,
      properties: {
        type: [String],
        required: true,
        default: [],
        validate: tags => tags.every(t => t in this.ITEM_PROPERTIES),
        validationError: '{name} {field} "{value}" must all be valid keys in ITEM_PROPERTIES for this item type'
      },
      description: fields.BLANK_STRING
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
