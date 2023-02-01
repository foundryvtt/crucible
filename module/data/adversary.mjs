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
        health: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
        morale: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
        action: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
        focus: new fields.NumberField({...requiredInteger, initial: 0, min: 0})
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
        }),
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

  /* -------------------------------------------- */

  prepareBaseData() {
    debugger;
  }
}
