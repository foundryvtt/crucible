import * as crucibleFields from "./fields.mjs";

/**
 * @typedef CrucibleAffixConfig
 * @property {string} identifier        The programmatic identifier of this affix
 * @property {string} name              The display name of this affix
 * @property {string} [img]             An optional icon path for this affix
 * @property {number} cost              The budget cost of this affix
 * @property {string} [namePrefix]      Optional text prepended before the item category label in a composed name
 * @property {string} [nameSuffix]      Optional text appended after "of" in a composed name
 * @property {string} [description]     A description of the affix effect
 * @property {Array<{hook: string, fn: Function|string}>} actorHooks  Actor hooks this affix contributes
 */

/**
 * A DataModel representing an affix embedded within an affixable equipment item.
 * Affixes extend item behavior through actor hooks and optionally contribute to the item's composed name.
 * The primary mechanism for affix hooks is module-level registration via crucible.api.hooks.affix,
 * with the actorHooks field reserved for future user-defined affix content.
 */
export default class CrucibleAffixData extends foundry.abstract.DataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      identifier: new crucibleFields.ItemIdentifierField(),
      name: new fields.StringField({required: true, blank: false}),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      cost: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1}),
      namePrefix: new fields.StringField({required: false, blank: true, initial: ""}),
      nameSuffix: new fields.StringField({required: false, blank: true, initial: ""}),
      description: new fields.HTMLField(),
      actorHooks: new crucibleFields.ItemActorHooks()
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["AFFIX"];
}
