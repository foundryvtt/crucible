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
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0})
      }),
      damage: new fields.SchemaField({
        base: new fields.NumberField({required: true, integer: true, min: 0})
      }),
      hands: new fields.NumberField({required: true, integer: true, min: 0, max: 2}),
      scaling: new fields.StringField({required: true, choices: SYSTEM.ABILITIES}),
      tier: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3})
    }
  }

  /* -------------------------------------------- */

  /**
   * One-time initialization to instantiate SYSTEM.SPELL.GESTURES.
   */
  static initialize() {
    const gestures = SYSTEM.SPELL.GESTURES;
    for ( const [k, v] of Object.entries(gestures) ) {
      v.name = game.i18n.localize(v.name);
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
      `${this.damage.base} Damage`,
      `${this.hands}H`
    ];
    if ( this.cost.action !== 0 ) tags.push(`${this.cost.action}A`);
    if ( this.cost.focus !== 0 ) tags.push(`${this.cost.focus}F`);
    return tags;
  }
}
