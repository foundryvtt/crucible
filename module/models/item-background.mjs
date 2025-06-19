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
      knowledge: new fields.SetField(new fields.StringField({choices: () => crucible.CONFIG.knowledge})),
      skills: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.SKILLS})),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"})),
      ui: new fields.SchemaField({
        color: new fields.ColorField()
      })
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["BACKGROUND"];
}
