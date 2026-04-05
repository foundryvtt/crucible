import {SYSTEM} from "../const/system.mjs";
import * as crucibleFields from "./fields.mjs";

/**
 * @typedef CrucibleAffixSummary
 * @property {string} identifier      The affix identifier
 * @property {string} affixType       "prefix" or "suffix"
 * @property {number} tierValue       The tier value (capacity cost)
 * @property {Set<string>} itemTypes  Allowed item types (empty means any)
 */

/**
 * An ActiveEffect subtype data model representing an affix embedded on an equipment item.
 * Affixes extend item behavior through module-level hook functions registered in crucible.api.hooks.affix.
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

  /**
   * Validate the proposed set of affixes for an item.
   * This is the single point of affix composition validation, called by all lifecycle hooks.
   * In a future world where ClientDatabaseBackend invokes parent.validate({joint: true}) for embedded
   * document operations, this method could be called from CrucibleItem.validateJoint instead.
   * @param {CrucibleItem} item                       The parent item document
   * @param {CrucibleAffixSummary[]} proposedAffixes  The full proposed set of affixes after the operation
   * @returns {string|void}     A rejection reason, or undefined if the composition is valid
   */
  static validateAffixes(item, proposedAffixes) {

    // The item type must support affixes
    if ( !item.system.constructor.AFFIXABLE ) {
      return `Item type "${item.type}" does not support affixes.`;
    }

    // Validate each individual affix and accumulate budget
    const identifiers = new Set();
    let prefixSpent = 0;
    let suffixSpent = 0;
    for ( const affix of proposedAffixes ) {

      // No duplicate identifiers
      if ( identifiers.has(affix.identifier) ) {
        return `Duplicate affix identifier "${affix.identifier}" on item "${item.name}".`;
      }
      identifiers.add(affix.identifier);

      // Item type restriction
      if ( affix.itemTypes.size && !affix.itemTypes.has(item.type) ) {
        return `Affix "${affix.identifier}" cannot be applied to item type "${item.type}".`;
      }

      // Accumulate budget by type
      if ( affix.affixType === "prefix" ) prefixSpent += affix.tierValue;
      else suffixSpent += affix.tierValue;
    }

    // Check budget
    const quality = SYSTEM.ITEM.QUALITY_TIERS[item.system.quality] ?? SYSTEM.ITEM.QUALITY_TIERS.standard;
    const halfCapacity = quality.capacity / 2;
    if ( prefixSpent > halfCapacity ) {
      return `Prefix affixes (cost ${prefixSpent}) exceed the available prefix capacity of ${halfCapacity}.`;
    }
    if ( suffixSpent > halfCapacity ) {
      return `Suffix affixes (cost ${suffixSpent}) exceed the available suffix capacity of ${halfCapacity}.`;
    }
  }

  /* -------------------------------------------- */

  /**
   * Build an affix summary from an ActiveEffect document instance.
   * @param {CrucibleActiveEffect} effect
   * @returns {CrucibleAffixSummary}
   */
  static summarizeEffect(effect) {
    return {
      identifier: effect.system.identifier,
      affixType: effect.system.affixType,
      tierValue: effect.system.tier.value,
      itemTypes: effect.system.itemTypes
    };
  }

  /* -------------------------------------------- */

  /**
   * Build an affix summary from raw creation or update data, falling back to an existing effect for missing fields.
   * @param {object} data                           The creation data or update changes
   * @param {CrucibleActiveEffect} [existing]       The existing effect being updated, if any
   * @returns {CrucibleAffixSummary}
   */
  static summarizeData(data, existing) {
    return {
      identifier: data.system?.identifier ?? existing?.system.identifier,
      affixType: data.system?.affixType ?? existing?.system.affixType,
      tierValue: data.system?.tier?.value ?? existing?.system.tier.value ?? 1,
      itemTypes: data.system?.itemTypes ? new Set(data.system.itemTypes) : (existing?.system.itemTypes ?? new Set())
    };
  }

  /* -------------------------------------------- */

  /**
   * Build the proposed affix set for an item, starting from its current affixes and applying modifications.
   * @param {CrucibleItem} item       The parent item
   * @param {object} [options]
   * @param {object[]} [options.create]   New affix data being created
   * @param {object[]} [options.update]   Update changes being applied to existing affixes
   * @param {string[]} [options.delete]   IDs of affixes being deleted
   * @returns {CrucibleAffixSummary[]}
   */
  static buildProposedAffixes(item, {create=[], update=[], delete: del=[]}={}) {
    const deleteIds = new Set(del);
    const updateMap = new Map(update.map(u => [u._id, u]));

    // Start with current affixes, applying updates and filtering deletions
    const proposed = [];
    for ( const effect of item.effects ) {
      if ( effect.type !== "affix" ) continue;
      if ( deleteIds.has(effect.id) ) continue;
      const changes = updateMap.get(effect.id);
      if ( changes ) proposed.push(CrucibleAffixActiveEffect.summarizeData(changes, effect));
      else proposed.push(CrucibleAffixActiveEffect.summarizeEffect(effect));
    }

    // Add new affixes
    for ( const data of create ) {
      if ( data.type !== "affix" ) continue;
      proposed.push(CrucibleAffixActiveEffect.summarizeData(data));
    }
    return proposed;
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
