/**
 * The data structure and functionality of a Metamagic Inflection in the Crucible spellcraft system.
 */
export default class CrucibleInflection extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      adjective: new fields.StringField(),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0})
      }),
      tier: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, max: 3})
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
   * One-time initialization to instantiate SYSTEM.SPELL.INFLECTIONS.
   */
  static initialize() {
    const inflections = SYSTEM.SPELL.INFLECTIONS;
    for ( const [k, v] of Object.entries(inflections) ) {
      inflections[k] = new CrucibleInflection(v);
    }
    Object.freeze(inflections);
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
      `Tier ${this.tier}`
    ];
    if ( this.cost.action !== 0 ) tags.push(`${this.cost.action}A`);
    if ( this.cost.focus !== 0 ) tags.push(`${this.cost.focus}F`);
    return tags;
  }
}
