import {SYSTEM} from "../const/system.mjs";
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
      talents: new fields.ArrayField(new fields.SchemaField({
        item: new fields.DocumentUUIDField({type: "Item"}),
        level: new fields.NumberField({required: true, nullable: true, integer: true, initial: null})
      })),
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
   * @param {DataFieldValidationOptions} [options={}]  Options which affect validation
   * @throws {Error}              An error if the ability choices are invalid
   */
  static #validateAbilities(abilities, options) {
    if ( options.partial === true ) return;
    const {primary, secondary} = abilities;
    if ( !(primary && secondary) ) return;
    if ( primary === secondary ) throw new Error(_loc("ANCESTRY.WARNINGS.Abilities"));
  }

  /* -------------------------------------------- */

  /**
   * Validate that resistances and vulnerabilities exist and are different.
   * @param {object} resistances  Resistance choices
   * @param {DataFieldValidationOptions} [options={}]  Options which affect validation
   * @throws {Error}              An error if the resistance choices are invalid
   */
  static #validateResistances(resistances, options) {
    if ( options.partial === true ) return;
    const {resistance: res, vulnerability: vuln} = resistances;
    if ( !res && !vuln ) return;
    if ( res === vuln ) throw new Error(_loc("ANCESTRY.WARNINGS.ResistancesDifferent"));
    if ( !res !== !vuln ) throw new Error(_loc("ANCESTRY.WARNINGS.ResistancesBoth"));
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Convert the Ancestry to a Taxonomy used for adversary Actors.
   * @returns {CrucibleItem}
   */
  toTaxonomy() {
    const {abilities, description, identifier, movement, resistances, talents} = this.toObject();

    // Determine ability allocation
    const {primary, secondary} = abilities;
    let tertiary;
    if ( ![primary, secondary].includes("toughness") ) tertiary = "toughness";
    else {
      const opposites = {strength: "intellect", wisdom: "dexterity", intellect: "strength", dexterity: "wisdom"};
      tertiary = opposites[primary === "toughness" ? secondary : primary];
    }

    // Prepare system data
    const system = {
      description,
      identifier,
      size: movement.size,
      stride: movement.stride,
      category: "humanoid",
      abilities: Object.values(SYSTEM.ABILITIES).reduce((obj, {id}) => {
        if ( id === primary ) obj[id] = 4;
        else if ( id === secondary ) obj[id] = tertiary ? 3: 4;
        else if ( id === tertiary ) obj[id] = 2;
        else obj[id] = 1;
        return obj;
      }, {}),
      resistances: Object.values(SYSTEM.DAMAGE_TYPES).reduce((obj, {id}) => {
        if ( id === resistances.resistance ) obj[id] = {value: 1};
        else if ( id === resistances.vulnerability ) obj[id] = {value: -1};
        else obj[id] = {value: 0};
        obj[id].immune = false;
        return obj;
      }, {}),
      characteristics: {
        equipment: true,
        spells: true
      },
      talents
    };
    return this.parent.clone({type: "taxonomy", system: _replace(system)}, {keepId: true, save: false});
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
    tags.size = _loc("ACTOR.SizeSpecific", {size: this.movement.size});
    return tags;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    source = super.migrateData(source);

    if ( source.talents?.length ) {
      if ( typeof source.talents[0] === "string") {
        source.talents = source.talents.map(t => ({item: t, level: null}));
      }
    }

    /** @deprecated since 0.7.0 until 0.8.0 */
    const {primary, secondary, resistance, vulnerability, size, stride} = source;
    if ( !source.abilities && (primary || secondary) ) {
      source.abilities = {primary: primary || "", secondary: secondary || ""};
      delete source.primary;
      delete source.secondary;
    }

    /** @deprecated since 0.7.0 until 0.8.0 */
    if ( !source.resistances && (resistance || vulnerability) ) {
      source.resistances = {resistance: resistance || "", vulnerability: vulnerability || ""};
      delete source.resistance;
      delete source.vulnerability;
    }

    /** @deprecated since 0.7.0 until 0.8.0 */
    if ( !source.movement && (size || stride) ) {
      source.movement = {size, stride};
      delete source.size;
      delete source.stride;
    }

    return source;
  }
}
