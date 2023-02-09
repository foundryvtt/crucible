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
      damageType: new fields.StringField({choices: SYSTEM.DAMAGE_TYPES, required: false, initial: undefined}),
      resource: new fields.StringField({choices: SYSTEM.RESOURCES, initial: "health"}),
      restoration: new fields.BooleanField({initial: false}),
      opposed: new fields.StringField({required: true, blank: false}),
      save: new fields.StringField({choices: SYSTEM.SAVE_DEFENSES}),
      scaling: new fields.StringField({choices: SYSTEM.ABILITIES})
    }
  }

  /* -------------------------------------------- */

  /**
   * One-time initialization to instantiate SYSTEM.SPELL.RUNES.
   */
  static initialize() {
    const runes = SYSTEM.SPELL.RUNES;
    for ( const [k, v] of Object.entries(runes) ) {
      v.name = game.i18n.localize(v.name);
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
      SYSTEM.SAVE_DEFENSES[this.save].label
    ];

    // Damage Type
    if ( this.damageType ) {
      const dt = SYSTEM.DAMAGE_TYPES[this.damageType];
      tags.push(`${dt.label} Damage`);
    }

    // Restoration
    if ( this.restoration ) {
      tags.push("Restoration");
    }
    return tags;
  }
}
