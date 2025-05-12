import {SYSTEM} from "../config/system.mjs";
import {ItemIdentifierField} from "./fields.mjs";

/**
 * Data schema, attributes, and methods specific to Ancestry type Items.
 */
export default class CrucibleAncestryItem extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const reqChoice = {required: true, blank: true, initial: ""};
    const reqInt = {required: true, nullable: false, integer: true};
    return {
      abilities: new fields.SchemaField({
        primary: new fields.StringField({...reqChoice, choices: SYSTEM.ABILITIES}),
        secondary: new fields.StringField({...reqChoice, choices: SYSTEM.ABILITIES})
      }, {validate: CrucibleAncestryItem.#validateAbilities}),
      description: new fields.HTMLField(),
      identifier: new ItemIdentifierField(),
      movement: new fields.SchemaField({
        size: new fields.NumberField({...reqInt, min: 1, initial: 4}),
        stride: new fields.NumberField({...reqInt, min: 1, initial: 10})
      }),
      resistances: new fields.SchemaField({
        resistance: new fields.StringField({...reqChoice, choices: SYSTEM.DAMAGE_TYPES}),
        vulnerability: new fields.StringField({...reqChoice, choices: SYSTEM.DAMAGE_TYPES})
      }, {validate: CrucibleAncestryItem.#validateResistances}),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"})),
      ui: new fields.SchemaField({
        color: new fields.ColorField()
      })
    };
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ANCESTRY"];

  /* -------------------------------------------- */

  /**
   * Validate that primary and secondary abilities are different.
   * @param {object} abilities    Ability choices
   * @throws {Error}              An error if the ability choices are invalid
   */
  static #validateAbilities(abilities) {
    const {primary, secondary} = abilities;
    const isNew = !primary && !secondary;
    if ( isNew ) return;
    if ( primary === secondary ) throw new Error(game.i18n.localize("ANCESTRY.WARNINGS.ABILITIES"));
  }

  /* -------------------------------------------- */

  /**
   * Validate that resistances and vulnerabilities exist and are different.
   * @param {object} resistances  Resistance choices
   * @throws {Error}              An error if the resistance choices are invalid
   */
  static #validateResistances(resistances) {
    const {resistance: res, vulnerability: vuln} = resistances;
    if ( !res && !vuln ) return;
    if ( res === vuln ) throw new Error(game.i18n.localize("ANCESTRY.WARNINGS.RESISTANCES_DIFFERENT"));
    if ( !res !== !vuln ) throw new Error(game.i18n.localize("ANCESTRY.WARNINGS.RESISTANCES_BOTH"));
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Convert the Ancestry to a Taxonomy used for adversary Actors.
   * @returns {CrucibleItem}
   */
  toTaxonomy() {
    const {abilities, description, movement, resistances, talents} = this.toObject();
    const system = {
      description,
      size: movement.size,
      stride: movement.stride,
      category: "humanoid",
      abilities: Object.values(SYSTEM.ABILITIES).reduce((obj, {id}) => {
        if ( id === abilities.primary ) obj[id] = 6;
        else if ( id === abilities.secondary ) obj[id] = 4;
        else obj[id] = 2;
        return obj;
      }, {}),
      resistances: Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, {id}) => {
        if ( id === resistances.resistance ) obj[id] = 2;
        else if ( id === resistances.vulnerability ) obj[id] = -2;
        else obj[id] = 0;
        return obj;
      }, {}),
      talents
    };
    return this.parent.clone({type: "taxonomy", "==system": system}, {keepId: true, save: false});
  }

  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @returns {Record<string, string>}    The tags which describe this Ancestry
   */
  getTags() {
    const tags = {};
    if ( this.abilities.primary ) tags.a1 = SYSTEM.ABILITIES[this.abilities.primary].label;
    if ( this.abilities.secondary ) tags.a2 = SYSTEM.ABILITIES[this.abilities.secondary].label;
    tags.size = `Size ${this.movement.size}`;
    return tags;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    super.migrateData(source);

    /** @deprecated since 0.7.0 until 0.8.0 */
    const {primary, secondary, resistance, vulnerability, size, stride} = source;
    if ( primary || secondary ) {
      source.abilities ||= {};
      Object.assign(source.abilities, {primary, secondary});
    }
    if ( resistance || vulnerability ) {
      source.resistances ||= {};
      Object.assign(source.resistances, {resistance, vulnerability});
    }
    if ( size || stride ) {
      source.movement ||= {};
      Object.assign(source.movement, {size, stride});
    }
  }
}
