import CrucibleAction from "./action.mjs";

/**
 * An Item subtype that defines an Iconic Spell composition.
 */
export default class CrucibleSpellItem extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField(),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(CrucibleAction)),
      runes: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.RUNES})),
      gestures: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.GESTURES})),
      inflections: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.INFLECTIONS})),
      actorHooks: new fields.ArrayField(new fields.SchemaField({
        hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTOR.HOOKS}),
        fn: new fields.JavaScriptField({async: true, gmOnly: true})
      }))
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "SPELL"];

  /**
   * Is this Iconic Spell currently known by the Actor which owns it?
   */
  isKnown = false;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Ensure every Action provided by this item type is tagged as an iconic spell.
   * @inheritDoc
   */
  _initializeSource(source, options) {
    super._initializeSource(source, options);
    for ( const action of source.actions ) {
      action.tags[0] = "iconicSpell"; // Potentially fragile?
    }
    return source;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a certain Actor can know an Iconic Spell.
   * @param {CrucibleActor} actor
   * @returns {boolean}
   * @internal
   */
  canKnowSpell(actor) {
    const grimoire = actor.grimoire;
    for ( const runeId of this.runes ) {
      const rune = SYSTEM.SPELL.RUNES[runeId];
      if ( !grimoire.runes.has(rune) ) return false;
    }
    for ( const gestureId of this.gestures ) {
      const gesture = SYSTEM.SPELL.GESTURES[gestureId];
      if ( !grimoire.gestures.has(gesture) ) return false;
    }
    for ( const inflectionId of this.inflections ) {
      const inflection = SYSTEM.SPELL.INFLECTIONS[inflectionId];
      if ( !grimoire.inflections.has(inflection) ) return false;
    }
    return true;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @param {"full"|"short"} [scope="full"]   The scope of tags being retrieved, "full" or "short"
   * @returns {Object<string, string>}        The tags which describe this spell
   */
  getTags(scope="full") {
    const tags = {};
    if ( this.parent.parent && !this.isKnown ) tags.known = "Not Known";
    for ( const runeId of this.runes ) {
      const rune = SYSTEM.SPELL.RUNES[runeId];
      tags[runeId] = rune.name;
    }
    for ( const gestureId of this.gestures ) {
      const gesture = SYSTEM.SPELL.GESTURES[gestureId];
      tags[gestureId] = gesture.name;
    }
    for ( const inflectionId of this.inflections ) {
      const inflection = SYSTEM.SPELL.INFLECTIONS[inflectionId];
      tags[inflectionId] = inflection.name;
    }
    return tags;
  }
}
