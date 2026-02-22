import CrucibleSpellItemSheet from "../applications/sheets/item-spell-sheet.mjs";
import * as crucibleFields from "./fields.mjs";
import CrucibleSpellAction from "./spell-action.mjs";

/**
 * An Item subtype that defines an Iconic Spell composition.
 */
export default class CrucibleSpellItem extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      description: new fields.HTMLField(),
      actions: new fields.ArrayField(new crucibleFields.CrucibleActionField(CrucibleSpellAction)),
      runes: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.RUNES})),
      gestures: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.GESTURES})),
      inflections: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.INFLECTIONS})),
      actorHooks: new fields.ArrayField(new fields.SchemaField({
        hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTOR.HOOKS}),
        fn: new fields.JavaScriptField({async: true, gmOnly: true})
      }))
    };
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

  /**
   * Is this Iconic Spell fully configured or is it missing some required components?
   */
  get isConfigured() {
    const {runes, gestures, inflections} = this._source;
    return !!(runes.length && gestures.length && inflections.length);
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Ensure every Action provided by this item type is tagged as an iconic spell.
   * @inheritDoc
   */
  _initializeSource(source, options) {
    source = super._initializeSource(source, options);
    const {runes, gestures, inflections} = source;

    // Remove actions if the spell is not fully configured
    if ( !(runes.length && gestures.length && inflections.length) ) source.actions.length = 0;

    // Configure spell-provided actions
    for ( const action of source.actions ) {
      action.tags.unshift("spell", "iconicSpell");
      action.rune = runes[0]; // TODO eventually support multi-component spell actions?
      action.gesture = gestures[0];
      action.inflection = inflections[0];
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
    if ( !this.isConfigured ) return false;
    const ifc = grimoire.iconicFreeComponents;
    let fc = 0;
    for ( const runeId of this.runes ) {
      if ( !grimoire.runes.has(runeId) && (++fc > ifc) ) return false;
    }
    for ( const gestureId of this.gestures ) {
      if ( !grimoire.gestures.has(gestureId) && (++fc > ifc) ) return false;
    }
    for ( const inflectionId of this.inflections ) {
      if ( !grimoire.inflections.has(inflectionId) && (++fc > ifc) ) return false;
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
    if ( this.parent.parent && !this.isKnown ) tags.known = game.i18n.localize("ITEM.PROPERTIES.NotKnown");
    const {runes, gestures, inflections} = this;

    // Runes
    if ( !runes.size ) tags.rune = {label: game.i18n.localize("SPELL.COMPONENTS.MissingRune"), unmet: true};
    else for ( const runeId of runes ) tags[runeId] = SYSTEM.SPELL.RUNES[runeId].name;

    // Gestures
    if ( !gestures.size ) tags.gesture = {label: game.i18n.localize("SPELL.COMPONENTS.MissingGesture"), unmet: true};
    else for ( const gestureId of gestures ) tags[gestureId] = SYSTEM.SPELL.GESTURES[gestureId].name;

    // Inflections
    if ( !inflections.size ) tags.inflection = {label: game.i18n.localize("SPELL.COMPONENTS.MissingInflection"), unmet: true};
    else for ( const inflectionId of inflections ) tags[inflectionId] = SYSTEM.SPELL.INFLECTIONS[inflectionId].name;
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Render this Iconic Spell as HTML for inline display.
   * @param {object} [options]
   * @param {boolean} [options.showRemove]  Whether to show "Remove Spell" button
   * @returns {Promise<string>}
   */
  async renderInline({showRemove=false}={}) {
    return foundry.applications.handlebars.renderTemplate(this.constructor.INLINE_TEMPLATE_PATH, {
      spell: this,
      uuid: this.parent.uuid,
      name: this.parent.name,
      img: this.parent.img,
      tags: this.getTags(),
      showRemove
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
      met: !actor || actor.itemTypes.talent.some(i => i.system.rune === req)
    }));
    const gestureReqs = [...this.gestures].map(req => ({
      tag: SYSTEM.SPELL.GESTURES[req]?.name ?? req,
      met: !actor || actor.itemTypes.talent.some(i => i.system.gesture === req)
    }));
    const inflectionReqs = [...this.inflections].map(req => ({
      tag: SYSTEM.SPELL.INFLECTIONS[req]?.name ?? req,
      met: !actor || actor.itemTypes.talent.some(i => i.system.inflection === req)
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
