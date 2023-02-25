import {SYSTEM} from "../config/system.js";

/**
 * The data structure and functionality of a Somatic Gesture in the Crucible spellcraft system.
 */
export default class CrucibleGesture extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      description: new fields.HTMLField(),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0})
      }),
      damage: new fields.SchemaField({
        base: new fields.NumberField({required: true, integer: true, min: 0})
      }),
      hands: new fields.NumberField({required: true, integer: true, min: 0, max: 2}),
      nameFormat: new fields.NumberField({required: false, choices: Object.values(SYSTEM.SPELL.NAME_FORMATS),
        initial: undefined}),
      scaling: new fields.StringField({required: true, choices: SYSTEM.ABILITIES}),
      target: new fields.SchemaField({
        type: new fields.StringField({required: true, choices: SYSTEM.ACTION.TARGET_TYPES}),
        number: new fields.NumberField({required: false, nullable: false, integer: true, min: 0, initial: undefined}),
        distance: new fields.NumberField({required: false, nullable: false, integer: true, min: 0, initial: undefined})
      }),
      tier: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3})
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize() {
    super._initialize();
    this.name = game.i18n.localize(this.name);
  }

  /* -------------------------------------------- */

  /**
   * One-time initialization to instantiate SYSTEM.SPELL.GESTURES.
   */
  static initialize() {
    const gestures = SYSTEM.SPELL.GESTURES;
    for ( const [k, v] of Object.entries(gestures) ) {
      gestures[k] = new CrucibleGesture(v);
    }
    Object.freeze(gestures);
  }

  /* -------------------------------------------- */

  /** @override */
  toString() {
    return this.name;
  }

  /* -------------------------------------------- */

  /**
   * Tags used to annotate this Gesture.
   * @returns {string[]}
   */
  get tags() {
    const tags = [
      `Tier ${this.tier}`,
      SYSTEM.ABILITIES[this.scaling].label,

    ];

    // Damage
    if ( this.damage.base ) tags.push(`${this.damage.base} Damage`);

    // Target
    if ( this.target.type !== "none" ) {
      let target = SYSTEM.ACTION.TARGET_TYPES[this.target.type].label;
      if ( this.target.number > 1 ) target += ` ${this.target.number}`;
      tags.push(target);
    }

    // Range
    if ( this.target.distance ) tags.push(`Range ${this.target.distance}`);

    // Cost
    if ( this.cost.action !== 0 ) tags.push(`${this.cost.action}A`);
    if ( this.cost.focus !== 0 ) tags.push(`${this.cost.focus}F`);
    return tags;
  }
}
