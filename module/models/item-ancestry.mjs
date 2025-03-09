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
      movement: new fields.SchemaField({
        size: new fields.NumberField({...reqInt, min: 1, initial: 4}),
        stride: new fields.NumberField({...reqInt, min: 1, initial: 10})
      }),
      resistances: new fields.SchemaField({
        resistance: new fields.StringField({...reqChoice, choices: SYSTEM.DAMAGE_TYPES}),
        vulnerability: new fields.StringField({...reqChoice, choices: SYSTEM.DAMAGE_TYPES})
      }, {validate: CrucibleAncestryItem.#validateResistances}),
      talents: new fields.SetField(new fields.DocumentUUIDField({type: "Item"}))
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
