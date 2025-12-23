/**
 * Active Effect subtype specific to "flanked" effect.
 */
export default class CrucibleFlankedActiveEffect extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*                  Data Schema                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      allies: new fields.NumberField({required: true, integer: true, nullable: false}),
      enemies: new fields.NumberField({required: true, integer: true, nullable: false}),
      flanked: new fields.NumberField({required: true, integer: true, nullable: false})
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "FLANKED_EFFECT"];
}