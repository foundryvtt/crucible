import CrucibleAction from "./action.mjs";
import CrucibleSpellItemSheet from "../applications/sheets/item-spell-sheet.mjs";

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
   * The partial template used to render a feature granted item.
   * @type {string}
   */
  static INLINE_TEMPLATE_PATH = "systems/crucible/templates/sheets/item/spell-inline.hbs";

  /**
   * The partial template used to render a feature granted item.
   * @type {string}
   */
  static CARD_TEMPLATE_PATH = "systems/crucible/templates/sheets/item/spell-card.hbs";

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
   * Test whether a spell can be known based on the contents of a grimoire?
   * @param {CrucibleActorGrimoire} grimoire
   * @returns {boolean}
   */
  canKnowSpell(grimoire) {
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

  /**
   * Render this Iconic Spell as HTML for inline display.
   * @returns {Promise<string>}
   */
  async renderInline() {
    return foundry.applications.handlebars.renderTemplate(this.constructor.INLINE_TEMPLATE_PATH, {
      spell: this,
      uuid: this.parent.uuid,
      name: this.parent.name,
      img: this.parent.img,
      tags: this.getTags()
    });
  }

  /* -------------------------------------------- */

  /**
   * Render this Iconic Spell as HTML for a tooltip card.
   * @param {object} options
   * @param {CrucibleActor} [options.actor]
   * @returns {Promise<string>}
   */
  async renderCard({actor}={}) {

    // Load necessary templates
    await foundry.applications.handlebars.loadTemplates([
      this.constructor.CARD_TEMPLATE_PATH,
      "systems/crucible/templates/sheets/item/spell-summary.hbs"
    ]);

    // Prepare spell data
    const spell = this.parent;
    actor ||= spell.parent;

    const runeReqs = [...this.runes].map(req => ({
      tag: SYSTEM.SPELL.RUNES[req]?.name ?? req,
      met: actor.itemTypes.talent.some(i => i.system.rune === req)
    }));
    const gestureReqs = [...this.gestures].map(req => ({
      tag: SYSTEM.SPELL.GESTURES[req]?.name ?? req,
      met: actor.itemTypes.talent.some(i => i.system.gesture === req)
    }));
    const inflectionReqs = [...this.inflections].map(req => ({
      tag: SYSTEM.SPELL.INFLECTIONS[req]?.name ?? req,
      met: actor.itemTypes.talent.some(i => i.system.inflection === req)
    }));

    // Render the card
    return foundry.applications.handlebars.renderTemplate(this.constructor.CARD_TEMPLATE_PATH, {
      spell,
      descriptionHTML: await CONFIG.ux.TextEditor.enrichHTML(spell.system.description, {
        relativeTo: spell,
        secrets: spell.isOwner
      }),
      source: spell,
      uuid: spell.uuid,
      name: spell.name,
      img: spell.img,
      actions: await CrucibleSpellItemSheet.prepareActions(spell),
      tags: this.getTags(),
      prerequisites: [...runeReqs, ...gestureReqs, ...inflectionReqs]
    });
  }
}
