import {SYSTEM} from "../const/system.mjs";
import * as crucibleFields from "./fields.mjs";

/**
 * An ActiveEffect subtype data model representing an affix embedded on an equipment item.
 * Affixes extend item behavior through module-level hook functions registered in crucible.api.hooks.affix
 * and optionally contribute to the item's composed name.
 */
export default class CrucibleAffixActiveEffect extends foundry.data.ActiveEffectTypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    schema.identifier = new crucibleFields.ItemIdentifierField({maxLength: 16});
    schema.adjective = new fields.StringField({required: false, blank: true, initial: ""});
    schema.affixType = new fields.StringField({required: true, choices: SYSTEM.ITEM.AFFIX_TYPES, initial: "prefix"});
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
    ae.changes = [];
    this.tier.value = Math.clamp(this.tier.value, this.tier.min, this.tier.max);
  }
}
