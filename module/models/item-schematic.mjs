import CruciblePhysicalItem from "./item-physical.mjs";
import {SCHEMATIC_CATEGORIES, SCHEMATIC_PROPERTIES} from "../config/items.mjs";
import {PASSIVE_BASE} from "../config/attributes.mjs";

/**
 * Data schema, attributes, and methods specific to "consumable" type Items.
 *
 * @example Example Schematic System Data
 * {
 *   identifier: "healingPotionRecipe",
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
 *   inputs: {
 *     ingredients: [
 *       {items: [healingHerbsUUID, glassVialUUID], consumed: true, currency: 100, mode: "AND"},
 *       {items: [alchemistsToolsUUID], consumed: false, currency: 0, mode: "AND"}
 *     ],
 *     mode: "AND"
 *   },
 *   outputs: [{
 *     items: [healingElixirUUID],
 *     mode: "AND"
 *   }],
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

  /**
   * The operator modes supported for ingredient combination.
   */
  static #MODES = ["AND", "OR"];

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
    const mode = {required: true, blank: false, choices: CrucibleSchematicItem.#MODES, initial: "AND"};
    Object.assign(schema, {
      inputs: new fields.SchemaField({
        ingredients: new fields.ArrayField(new fields.SchemaField({
          items: new fields.ArrayField(new fields.DocumentUUIDField({type: "Item", embedded: false})),
          consumed: new fields.BooleanField({initial: true}),
          currency: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 0}),
          mode: new fields.StringField({...mode})
        })),
        mode: new fields.StringField({...mode})
      }),
      outputs: new fields.ArrayField(new fields.SchemaField({
        items: new fields.ArrayField(new fields.DocumentUUIDField({type: "Item", embedded: false})),
        mode: new fields.StringField({...mode})
      })),
      dc: new fields.NumberField({required: true, nullable: false, min: 1, integer: true, initial: PASSIVE_BASE}),
      hours: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0})
    });
    return schema;
  }
}
