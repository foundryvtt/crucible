/**
 * The data structure and functionality of an Arcane Rune in the Crucible spellcraft system.
 */
export default class CrucibleSpellcraftRune extends foundry.abstract.DataModel {
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

  /**
   * A mapping from rune ID to a list of talent UUIDs & tiers that grant the rune.
   * Dynamically populated in `CrucibleTalentNode.initialize`
   * @type {Record<string, {tier: number, uuid: string}[]>}
   */
  static grantingTalents = {};

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
    const runes = SYSTEM.SPELL.RUNES; // Intentionally mutated
    for ( const [k, v] of Object.entries(runes) ) {
      runes[k] = new CrucibleSpellcraftRune(v);
    }

    // Deprecated runes
    Object.defineProperties(runes, {
      shadow: {
        get() {
          foundry.utils.logCompatibilityWarning(`You are referencing the Crucible spellcraft rune "shadow" which 
          has been removed in favor of "illusion" or "oblivion" depending on your use case.`);
          return runes.oblivion;
        }
      },
      spirit: {
        get() {
          foundry.utils.logCompatibilityWarning(`You are referencing the Crucible spellcraft rune "spirit" which 
          has been renamed to "soul".`);
          return runes.soul;
        }
      },
      stasis: {
        get() {
          foundry.utils.logCompatibilityWarning(`You are referencing the Crucible spellcraft rune "stasis" which 
          has been removed in favor of "control".`);
          return runes.control;
        }
      }
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  clone(data, {once=false, ...context}={}) {
    if ( once && (this !== SYSTEM.SPELL.RUNES[this.id]) ) {
      this.updateSource(data);
      return this;
    }
    return super.clone(data, context);
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
