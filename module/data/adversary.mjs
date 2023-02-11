import ArchetypeData from "./archetype.mjs";
import {SYSTEM} from "../config/system.js";

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
    const defenseField = (opts={}) => new fields.SchemaField({
      base: new fields.NumberField({...requiredInteger, initial: 0, ...opts}),
      bonus: new fields.NumberField({...requiredInteger, initial: 0})
    });
    const resourceField = (opts={}) => new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0, min: 0, ...opts})
    });

    return {
      attributes: new fields.SchemaField({
        strength: resourceField({max: 20}),
        toughness: resourceField({max: 20}),
        dexterity: resourceField({max: 20}),
        intellect: resourceField({max: 20}),
        presence: resourceField({max: 20}),
        wisdom: resourceField({max: 20})
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
        poison: defenseField(),
        acid: defenseField(),
        fire: defenseField(),
        frost: defenseField(),
        lightning: defenseField(),
        psychic: defenseField(),
        radiant: defenseField(),
        unholy: defenseField(),
        void: defenseField()
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
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    if ( this.details.archetype ) this.#applyArchetype();
  }

  /* -------------------------------------------- */

  /**
   * Apply an archetype to automatically configure attributes and resistances.
   */
  #applyArchetype() {
    const {archetype, level, threat} = this.details;
    const factor = AdversaryData.THREAT_SCALING[threat] || 1;

    // Scale attributes
    for ( const a of Object.keys(this.attributes) ) {
      const scale = archetype.attributes[a];
      this.attributes[a].value = scale === 0 ? 0 : Math.min(1 + Math.floor(((level + 3) * factor) / scale), 20);
    }

    // Scale resistances
    for ( const r of Object.keys(this.resistances) ) {
      const scale = archetype.resistances[r];
      this.resistances[r].base = scale === 0 ? 0
        : Math.floor(((level + 4) * factor) / Math.abs(scale)) * Math.sign(scale);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    this.#prepareResources();
    this.#prepareMagicDefenses();
    this.#prepareResistances();
  }

  /* -------------------------------------------- */

  /**
   * Prepare resource pools.
   */
  #prepareResources() {
    const l = this.details.level;
    const r = this.resources;
    const a = this.attributes;

    // Health
    r.health.max = (4 * (l + a.toughness.value)) + (2 * (a.strength.value + a.dexterity.value));
    r.health.value = Math.clamped(r.health.value, 0, r.health.max);

    // Morale
    r.morale.max = (4 * (l + a.presence.value)) + (2 * (a.intellect.value + a.wisdom.value));
    r.morale.value = Math.clamped(r.morale.value, 0, r.morale.max);

    // Action
    r.action.max = 3;
    r.action.value = Math.clamped(r.action.value, 0, r.action.max);

    // Focus
    r.focus.max = Math.floor(l / 2) + Math.max(a.wisdom.value, a.presence.value, a.intellect.value);
    r.focus.value = Math.clamped(r.focus.value, 0, r.focus.max);
  }

  /* -------------------------------------------- */

  /**
   * Prepare non-physical defense scores.
   */
  #prepareMagicDefenses() {
    for ( let [k, sd] of Object.entries(SYSTEM.DEFENSES) ) {
      if ( k === "physical" ) continue;
      let d = this.defenses[k];
      d.base = sd.abilities.reduce((t, a) => t + this.attributes[a].value, SYSTEM.PASSIVE_BASE);
      d.total = d.base + d.bonus;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare damage resistances.
   */
  #prepareResistances() {
    for ( const r of Object.values(this.resistances) ) {
      r.total = r.base + r.bonus;
    }
  }
}
