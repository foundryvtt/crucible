import CruciblePhysicalItem from "./item-physical.mjs";
import {QUALITY_TIERS, SCHEMATIC_CATEGORIES, SCHEMATIC_PROPERTIES} from "../const/items.mjs";
import {PASSIVE_BASE} from "../const/attributes.mjs";

/**
 * Data schema, attributes, and methods specific to "consumable" type Items.
 *
 * @example Example Schematic System Data
 * {
 *   identifier: "healingElixirRecipe",
 *   category: "alchemy",
 *   quantity: 1,
 *   weight: 1,
 *   price: 1500,
 *   quality: "standard",
 *   properties: ["common"],
 *   description: {
 *     public: "A commonly known recipe for creating a basic healing potion.",
 *     private: "You can turn particular healing herbs found in the wild into a bottled elixir using Alchemists Tools.",
 *   },
 *   inputs: [
 *    {
 *      ingredients: [
 *        {item: healingHerbsUUID, consumed: true, quantity: 1, quality: "standard"},
 *        {item: glassVialUUID, consumed: true, quantity: 1, quality: ""},
 *        {item: alchemistsToolsUUID, consumed: false, quantity: 1, quality: "standard"}
 *      ],
 *      currency: 150,
 *      mode: "AND"
 *    },
*    ],
 *   outputs: [
 *    [{item: healingElixirUUID, quantity: 1}]
*    ],
 *   dc: 15,
 *   hours: 4
 * }
 */
export default class CrucibleSchematicItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = SCHEMATIC_CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "alchemy";

  /** @override */
  static ITEM_PROPERTIES = SCHEMATIC_PROPERTIES;

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "SCHEMATIC"];

  /** @override */
  static EQUIPABLE = false;

  /**
   * The operator modes supported for ingredient combination.
   * @type {Record<string, string>}
   */
  static #MODES = {ALL: "SCHEMATIC.MODES.All", ANY: "SCHEMATIC.MODES.Any", TEMPLATE: "SCHEMATIC.MODES.Template"};

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();

    // Remove fields
    delete schema.actions;      // Schematics cannot provide actions
    delete schema.actorHooks;   // Schematics don't have actor hooks
    delete schema.broken;       // Schematics cannot be broken
    delete schema.equipped;     // Schematics cannot be equipped
    delete schema.enchantment;  // Schematics cannot be enchanted
    delete schema.invested;     // Schematics cannot be invested

    // Add fields
    const fields = foundry.data.fields;
    Object.assign(schema, {
      inputs: new fields.ArrayField(new fields.SchemaField({
        ingredients: new fields.ArrayField(new fields.SchemaField({
          item: new fields.DocumentUUIDField({type: "Item", embedded: false, nullable: false}),
          consumed: new fields.BooleanField({initial: true}),
          quantity: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1}),
          quality: new fields.StringField({required: true, blank: true, choices: QUALITY_TIERS}),
        })),
        currency: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 0}),
        mode: new fields.StringField({required: true, blank: false, choices: CrucibleSchematicItem.#MODES,
          initial: "ALL"})
      })),
      dc: new fields.NumberField({required: true, nullable: false, min: 1, integer: true, initial: PASSIVE_BASE}),
      hours: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0}),
      outputs: new fields.ArrayField(new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item", embedded: false, nullable: false}),
        quantity: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1})
      })))
    });
    return schema;
  }
}
