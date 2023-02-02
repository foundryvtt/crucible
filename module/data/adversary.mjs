import ArchetypeData from "./archetype.mjs";

/**
 * Data schema, attributes, and methods specific to Adversary type Actors.
 */
export default class AdversaryData extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const defenseField = ({min}={}) => new fields.SchemaField({
      base: new fields.NumberField({...requiredInteger, initial: 0, min}),
      bonus: new fields.NumberField({...requiredInteger, initial: 0})
    });
    const resourceField = () => new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
    });

    return {
      attributes: new fields.SchemaField({
        strength: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
        toughness: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
        dexterity: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
        intellect: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
        presence: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12}),
        wisdom: new fields.NumberField({...requiredInteger, initial: 0, min: 0, max: 12})
      }),
      defenses: new fields.SchemaField({
        armor: defenseField({min: 0}),
        dodge: defenseField({min: 0}),
        parry: defenseField({min: 0}),
        block: defenseField({min: 0}),
        fortitude: defenseField({min: 0}),
        reflex: defenseField({min: 0}),
        willpower: defenseField({min: 0}),
      }),
      resources: new fields.SchemaField({
        health: resourceField(),
        morale: resourceField(),
        action: resourceField(),
        focus: resourceField(),
      }),
      resistances: new fields.SchemaField({
        bludgeoning: defenseField(),
        piercing: defenseField(),
        slashing: defenseField(),
        acid: defenseField(),
        fire: defenseField(),
        frost: defenseField(),
        lightning: defenseField(),
        psychic: defenseField(),
        radiant: defenseField(),
        unholy: defenseField()
      }),
      details: new fields.SchemaField({
        archetype: new fields.SchemaField({
          name: new fields.StringField(),
          ...ArchetypeData.defineSchema()
        }, {required: false, initial: undefined}),
        level: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
        category: new fields.StringField({required: true, choices: AdversaryData.CATEGORIES, initial: "humanoid"}),
        threat: new fields.StringField({required: true, choices: AdversaryData.THREATS, initial: "normal"}),
        biography: new fields.SchemaField({
          public: new fields.HTMLField(),
          private: new fields.HTMLField()
        })
      })
    }
  }

  /**
   * The categories that an adversary may have
   * @enum {number}
   */
  static CATEGORIES = Object.freeze({
    beast: "CRUCIBLE.AdversaryCategoryBeast",
    humanoid: "CRUCIBLE.AdversaryCategoryHumanoid",
    undead: "CRUCIBLE.AdversaryCategoryUndead"
  });

  /**
   * The threat levels that an adversary may have.
   * @enum {number}
   */
  static THREATS = Object.freeze({
    minion: "CRUCIBLE.AdversaryThreatMinion",
    normal: "CRUCIBLE.AdversaryThreatNormal",
    elite: "CRUCIBLE.AdversaryThreatElite",
    boss: "CRUCIBLE.AdversaryThreatBoss"
  });

  /**
   * Multiplicative factors which adjust how threat levels interact with archetype scaling.
   * @enum {number}
   */
  static THREAT_SCALING = Object.freeze({
    minion: 0.75,
    normal: 1,
    elite: 1.25,
    boss: 1.5
  })

  /* -------------------------------------------- */

  prepareBaseData() {
    if ( this.details.archetype ) this.#applyArchetype();
  }

  /* -------------------------------------------- */

  #applyArchetype() {
    const {archetype, level, threat} = this.details;
    const factor = AdversaryData.THREAT_SCALING[threat] || 1;

    // Scale attributes
    for ( const a of Object.keys(this.attributes) ) {
      const scale = archetype.attributes[a];
      this.attributes[a] = scale === 0 ? 0 : Math.min(1 + Math.floor(((level + 3) * factor) / scale), 20);
    }

    // Scale resistances
    for ( const r of Object.keys(this.resistances) ) {
      const scale = archetype.resistances[r];
      this.resistances[r].base = scale === 0 ? 0
        : Math.floor(((level + 4) * factor) / Math.abs(scale)) * Math.sign(scale);
    }
  }
}
