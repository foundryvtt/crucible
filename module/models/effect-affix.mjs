import {SYSTEM} from "../const/system.mjs";
import * as crucibleFields from "./fields.mjs";

/**
 * @typedef CrucibleAffixEffectData
 * @property {string} identifier              A unique identifier for the affix, max 16 characters
 * @property {string} adjective               An adjective used when composing the enchanted item name
 * @property {string} affixType               The affix category, "prefix" or "suffix"
 * @property {Set<string>} itemTypes          Item types this affix may be applied to, empty allows any
 * @property {{min: number, max: number, value: number}} tier   The power tier with configurable range (1-3)
 */

/**
 * An ActiveEffect subtype data model representing an affix embedded on an equipment item.
 * Affixes extend item behavior through module-level hook functions registered in crucible.api.hooks.affix.
 * @extends {foundry.data.ActiveEffectTypeDataModel<CrucibleAffixEffectData>}
 */
export default class CrucibleAffixActiveEffect extends foundry.data.ActiveEffectTypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    schema.identifier = new crucibleFields.ItemIdentifierField({maxLength: 16});
    schema.adjective = new fields.StringField({required: false, blank: true, initial: ""});
    schema.affixType = new fields.StringField({required: true, blank: false,
      choices: SYSTEM.ITEM.AFFIX_TYPES, initial: "prefix"});
    schema.itemTypes = new fields.SetField(new fields.StringField({blank: false, required: true,
      choices: () => Array.from(SYSTEM.ITEM.AFFIXABLE_ITEM_TYPES)}));
    schema.tier = new fields.SchemaField({
      min: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3, initial: 1}),
      max: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3, initial: 3}),
      value: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3, initial: 1})
    });
    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "AFFIX"];

  /* -------------------------------------------- */

  /**
   * Generate a deterministic document ID from an affix identifier.
   * The identifier is padded with trailing zeros to reach exactly 16 characters.
   * @param {string} identifier     The affix identifier
   * @returns {string}              A 16-character document ID
   */
  static generateId(identifier) {
    return identifier.padEnd(16, "0");
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    const ae = this.parent;
    ae.transfer = false;
    this.changes = [];
    this.tier.value = Math.clamp(this.tier.value, this.tier.min, this.tier.max);
  }
}
