import {ItemIdentifierField} from "./fields.mjs";

/**
 * Data schema, attributes, and methods specific to Background type Items.
 */
export default class CrucibleBackgroundItem extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField({required: true, blank: true}),
      identifier: new ItemIdentifierField(),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"})),
      ui: new fields.SchemaField({
        color: new fields.ColorField()
      })
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["BACKGROUND"];
}
