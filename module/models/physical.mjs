import CrucibleAction from "./action.mjs";

/**
 * A data structure which is shared by all physical items.
 */
export default class CruciblePhysicalItem extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      category: new fields.StringField({required: true, choices: this.ITEM_CATEGORIES, initial: this.DEFAULT_CATEGORY}),
      quantity: new fields.NumberField({required: true, nullable: false, integer: true, initial: 1, min: 0}),
      weight: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0, min: 0}),
      price: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0, min: 0}),
      quality: new fields.StringField({required: true, choices: SYSTEM.QUALITY_TIERS, initial: "standard"}),
      broken: new fields.BooleanField({initial: false}),
      enchantment: new fields.StringField({required: true, choices: SYSTEM.ENCHANTMENT_TIERS, initial: "mundane"}),
      equipped: new fields.BooleanField(),
      properties: new fields.SetField(new fields.StringField({required: true, choices: this.ITEM_PROPERTIES})),
      description: new fields.StringField(),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(CrucibleAction))
    }
  }

  /**
   * A prefix used to automatically localize the label and hint properties of this data model.
   * @type {string[]}
   */
  static LOCALIZATION_PATHS = ["ITEM.FIELDS"];

  /**
   * Allowed categories for this item type.
   * @type {Record<string, {id: string, label: string}>}
   */
  static ITEM_CATEGORIES;

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
