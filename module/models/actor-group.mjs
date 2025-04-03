/**
 * Data schema, attributes, and methods specific to Group type Actors.
 */
export default class CrucibleGroupActor extends foundry.abstract.TypeDataModel {

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = {required: true, nullable: false, integer: true};
    const schema = {};

    // Group Members
    schema.members = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.DocumentIdField({nullable: false}),
      quantity: new fields.NumberField({...requiredInteger, min: 1, initial: 1})
    }));

    // Movement Attributes
    schema.movement = new fields.SchemaField({
      pace: new fields.StringField({required: true, choices: SYSTEM.ACTOR.TRAVEL_PACES, initial: "normal"}),
      land: new fields.NumberField({required: true, nullable: false, min: 0, initial: 2, step: 0.5}),
      water: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0.5, step: 0.5}),
      air: new fields.NumberField({required: true, nullable: false, min: 0, initial: 0, step: 0.5}),
    });

    // Description
    schema.details = new fields.SchemaField({
      biography: new fields.SchemaField({
        public: new fields.HTMLField(),
        private: new fields.HTMLField()
      })
    });

    // Advancement
    schema.advancement = new fields.SchemaField({
      milestones: new fields.NumberField({...requiredInteger, min: 0, initial: 0})
    });
    return schema;
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ACTOR.GROUP"];

  /**
   * The median level of the group
   * @type {number}
   */
  medianLevel;

  /* -------------------------------------------- */
  /*  Embedded Document Preparation               */
  /* -------------------------------------------- */

  /** @override */
  prepareItems(items) {}

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Derived data prepared for group actors.
   * @override
   */
  prepareDerivedData() {
    const levels = [];
    for ( const m of this.members ) {
      m.actor = game.actors.get(m.actorId);
      if ( !m.actor ) continue;
      for ( let i=0; i<m.quantity; i++ ) levels.push(m.actor.level);
    }

    // Median member level
    const nl = levels.length;
    levels.sort();
    let medianLevel = levels[Math.floor((nl-1) / 2)];
    if ( levels.length % 2 !== 0 ) medianLevel = (medianLevel + levels[Math.ceil((nl-1) / 2)]) / 2;
    this.medianLevel = medianLevel;
  }

  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this group Actor.
   * @returns {Record<string, string>}
   */
  getTags() {
    const tags = {};
    const plurals = new Intl.PluralRules(game.i18n.lang);

    // Member Count
    const membersLabel = `ACTOR.GROUP.FIELDS.members.${plurals.select(this.members.length)}`;
    tags.members = `${this.members.length} ${game.i18n.localize(membersLabel)}`;

    // Median Level
    if ( this.members.length ) {
      tags.level = `${game.i18n.localize("ACTOR.GROUP.LABELS.medianLevel")} ${this.medianLevel}`;
    }
    return tags;
  }
}
