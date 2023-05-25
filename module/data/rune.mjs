import {SYSTEM} from "../config/system.js";

/**
 * The data structure and functionality of an Arcane Rune in the Crucible spellcraft system.
 */
export default class CrucibleRune extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      damageType: new fields.StringField({required: false, initial: undefined,
        choices: ["physical"].concat(Object.keys(SYSTEM.DAMAGE_TYPES))}),
      resource: new fields.StringField({choices: SYSTEM.RESOURCES, initial: "health"}),
      restoration: new fields.BooleanField({initial: false}),
      opposed: new fields.StringField({required: true, blank: false}),
      defense: new fields.StringField({choices: Object.values(SYSTEM.DEFENSES).reduce((obj, d) => {
        if ( (d.id === "physical") || (d.type === "save") ) obj[d.id] = d.label;
        return obj;
      }, {})}),
      nameFormat: new fields.NumberField({choices: Object.values(SYSTEM.SPELL.NAME_FORMATS)}),
      scaling: new fields.StringField({choices: SYSTEM.ABILITIES})
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize() {
    super._initialize();
    this.adjective = game.i18n.localize(`${this.name}Adj`);
    this.name = game.i18n.localize(this.name);
  }

  /* -------------------------------------------- */

  /**
   * One-time initialization to instantiate SYSTEM.SPELL.RUNES.
   */
  static initialize() {
    const runes = SYSTEM.SPELL.RUNES;
    for ( const [k, v] of Object.entries(runes) ) {
      runes[k] = new CrucibleRune(v);
    }
    Object.freeze(runes);
  }

  /* -------------------------------------------- */

  /** @override */
  toString() {
    return this.name;
  }

  /* -------------------------------------------- */

  /**
   * Tags used to annotate this Rune.
   * @returns {string[]}
   */
  get tags() {
    const tags = [
      SYSTEM.ABILITIES[this.scaling].label,
      SYSTEM.RESOURCES[this.resource].label,
      SYSTEM.DEFENSES[this.defense].label
    ];

    // Damage Type
    if ( this.damageType ) {
      if ( this.damageType === "physical" ) {
        tags.push(`${game.i18n.localize("DAMAGE.Physical")} ${game.i18n.localize("DAMAGE.Damage")}`)
      }
      else {
        const dt = SYSTEM.DAMAGE_TYPES[this.damageType];
        tags.push(`${dt.label} ${game.i18n.localize("DAMAGE.Damage")}`);
      }
    }

    // Restoration
    if ( this.restoration ) {
      tags.push(game.i18n.localize("DAMAGE.Restoration"));
    }
    return tags;
  }
}
