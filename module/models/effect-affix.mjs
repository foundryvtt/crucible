import {SYSTEM} from "../const/system.mjs";
import * as crucibleFields from "./fields.mjs";

/**
 * @import {CrucibleTag} from "./action.mjs";
 * @import CrucibleItem from "../documents/item.mjs";
 */

/**
 * @typedef CrucibleAffixEffectData
 * @property {string} identifier              A unique identifier for the affix
 * @property {string} adjective               An adjective used when composing the item name, defaults to the name
 * @property {string} affixType               The affix category, "prefix" or "suffix"
 * @property {Set<string>} itemTypes          Item types ("weapon") or categories ("weapon.heavy1"), empty allows any
 * @property {Set<string>} properties         Boolean property tags which this affix possesses
 * @property {{min: number, max: number, value: number}} tier   The power tier with configurable range (1-3)
 * @property {CrucibleActionData[]} actions   Actions granted to items that bear this affix
 */

/**
 * @typedef CrucibleAffixSuppression
 * @property {string} reason                  A localization key describing why the affix is suppressed
 * @property {CrucibleActiveEffect} [source]  The affix which caused this one to be suppressed, if any
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
    schema.identifier = new crucibleFields.ItemIdentifierField();
    schema.adjective = new fields.StringField({required: false, blank: true, initial: ""});
    schema.affixType = new fields.StringField({required: true, blank: false,
      choices: SYSTEM.ITEM.AFFIX_TYPES, initial: "prefix"});
    schema.itemTypes = new fields.SetField(new fields.StringField({blank: false, required: true,
      choices: () => this.getItemTypeChoices()}));
    schema.properties = new fields.SetField(new fields.StringField({required: true,
      choices: SYSTEM.ITEM.AFFIX_PROPERTIES}));
    schema.tier = new fields.SchemaField({
      min: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3, initial: 1}),
      max: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3, initial: 3}),
      value: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3, initial: 1})
    });
    schema.actions = new fields.ArrayField(new crucibleFields.CrucibleActionField());
    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTIVE_EFFECT", "AFFIX"];

  /**
   * Why this affix is prevented from taking effect, assigned during preparation of the owning Actor.
   * @type {CrucibleAffixSuppression|null}
   * @internal
   */
  _suppression = null;

  /* -------------------------------------------- */

  /**
   * Does this affix carry the "cursed" property?
   * @type {boolean}
   */
  get isCursed() {
    return this.properties.has("cursed");
  }

  /**
   * Is this affix prevented from taking effect? Read by {@link foundry.documents.ActiveEffect#isSuppressed}.
   * @type {boolean}
   */
  get isSuppressed() {
    return !!this._suppression;
  }

  /**
   * Is this affix restricted to weapons, either as a whole or to specific weapon categories?
   * @type {boolean}
   */
  get isWeaponOnly() {
    return !!this.itemTypes.size && Array.from(this.itemTypes).every(t => t.split(".")[0] === "weapon");
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    const ae = this.parent;
    ae.transfer = false;
    this.changes = [];
    this._suppression = ae.parent?.system.broken ? {reason: "AFFIX.SUPPRESSION.Broken"} : null;
    this.tier.value = Math.clamp(this.tier.value, this.tier.min, this.tier.max);
    this.adjective ||= ae.name;
    if ( this.isCursed ) ae.name = _loc("AFFIX.CursedName", {name: ae.name});
  }

  /* -------------------------------------------- */

  /**
   * Can this affix be applied to the given item?
   * @param {CrucibleItem} item     The candidate item
   * @returns {boolean}
   */
  allowsItem(item) {
    return this.constructor.allowsItemType(this.itemTypes, item.type, item.system.category);
  }

  /* -------------------------------------------- */

  /**
   * Descriptive tags rendered on the affix sheet header.
   * @returns {Record<string, string|CrucibleTag>}
   */
  getTags() {
    const tags = {};
    const affixType = SYSTEM.ITEM.AFFIX_TYPES[this.affixType];
    if ( affixType ) tags.affixType = _loc(affixType);
    tags.tier = _loc("AFFIX.TierDisplay", {value: this.tier.value, max: this.tier.max});
    if ( this.properties.has("cursed") ) {
      tags.cursed = {label: SYSTEM.ITEM.AFFIX_PROPERTIES.cursed.label, unmet: true};
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Does a set of item type restrictions allow an item of a given type and category?
   * @param {Iterable<string>} itemTypes  Allowed item types or "type.category" pairs, empty allows any
   * @param {string} type                 The item type
   * @param {string} category             The item category
   * @returns {boolean}
   */
  static allowsItemType(itemTypes, type, category) {
    itemTypes = new Set(itemTypes);
    return !itemTypes.size || itemTypes.has(type) || itemTypes.has(`${type}.${category}`);
  }

  /* -------------------------------------------- */

  /**
   * Item type and category choices for affix restrictions, grouped by item type.
   * @returns {Record<string, {label: string, group: string}>}
   */
  static getItemTypeChoices() {
    const choices = {};
    for ( const type of SYSTEM.ITEM.AFFIXABLE_ITEM_TYPES ) {
      const group = _loc(CONFIG.Item.typeLabels[type] ?? type);
      choices[type] = {label: _loc("AFFIX.ItemTypeAny", {type: group}), group};
      for ( const category of Object.values(CONFIG.Item.dataModels[type].ITEM_CATEGORIES) ) {
        choices[`${type}.${category.id}`] = {label: category.label, group};
      }
    }
    return choices;
  }
}
