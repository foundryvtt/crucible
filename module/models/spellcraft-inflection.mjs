/**
 * The data structure and functionality of a Metamagic Inflection in the Crucible spellcraft system.
 */
export default class CrucibleSpellcraftInflection extends foundry.abstract.DataModel {
  constructor({hooks={}, ...data}, options) {
    super(data, options);
    this.hooks = Object.freeze(hooks);
  }

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({required: true, blank: false}),
      name: new fields.StringField(),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      adjective: new fields.StringField(),
      cost: new fields.SchemaField({
        action: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        focus: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        heroism: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
        hands: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0, min: -2, max: 2})
      })
    }
  }

  /**
   * Action Hooks which applied to spells with this Inflection
   * @type {Record<string, function>}
   */
  hooks;

  /* -------------------------------------------- */

  /**
   * A mapping from inflection ID to a list of talent UUIDs & tiers that grant the inflection.
   * Dynamically populated in `CrucibleTalentNode.initialize`
   * @type {Record<string, {tier: number, uuid: string}[]>}
   */
  static grantingTalents = {};

  /* -------------------------------------------- */

  /**
   * Return the minimum-tier talent (tier & uuid) which grants the given Inflection
   * @param {string} component 
   * @returns {tier: number, uuid: string}
   */
  static getGrantingTalent(component) {
    const talents = CrucibleSpellcraftInflection.grantingTalents[component];
    const minTalent = talents.reduce((currMin, t) => (currMin.tier < t.tier) ? currMin : t);
    return minTalent;
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
      inflections[k] = new CrucibleSpellcraftInflection(v);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  clone(data, {once=false, ...context}={}) {
    if ( once && (this !== SYSTEM.SPELL.INFLECTIONS[this.id]) ) {
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
   * Tags used to annotate this Inflection.
   * @returns {string[]}
   */
  get tags() {
    const tags = [];
    if ( this.cost.action !== 0 ) tags.push(`${this.cost.action}A`);
    if ( this.cost.focus !== 0 ) tags.push(`${this.cost.focus}F`);
    if ( this.cost.heroism !== 0 ) tags.push(`${this.cost.heroism}H`);
    if ( this.cost.hands !== 0 ) tags.push(`${this.cost.hands} Hands`);
    return tags;
  }
}
