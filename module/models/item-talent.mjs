import CrucibleAction from "./action.mjs";
import CrucibleTalentNode from "../config/talent-node.mjs";
import CrucibleTalentItemSheet from "../applications/sheets/item-talent-sheet.mjs";

/**
 * @typedef {Object} TalentData
 * @property {string[]} nodes
 * @property {string} description
 * @property {CrucibleAction[]} actions   The actions which have been unlocked by this talent
 * @property {string} [rune]
 * @property {string} [gesture]
 * @property {string} [inflection]
 * @property {{hook: string, fn: function}} actorHooks
 */

/**
 * @typedef {Object} TalentRankData
 * @property {string} description
 * @property {number} tier
 * @property {number} cost
 * @property {{[key: string]: number}} requirements
 * @property {CrucibleAction[]} actions
 * @property {object[]} passives
 */

/**
 * @typedef {Object} AdvancementPrerequisite
 * @property {number} value       A numeric value that must be satisfied
 * @property {string} [label]     The string label of the prerequisite type
 * @property {string} [tag]       The formatted display for the prerequisite tag
 * @property {boolean} [met]      Is this prerequisite met for a certain Actor?
 */

/**
 * @typedef {Record<string, AdvancementPrerequisite>} AdvancementPrerequisites
 */

/**
 * The data schema of a Talent type Item in the Crucible system.
 * @mixes {TalentData}
 * @property {TalentRankData} currentRank             The current rank in this talent
 * @property {number} cost                            The action point cost to have obtained the current rank
 * @property {TalentRankData} nextRank                The next rank in this talent
 * @property {AdvancementPrerequisites} prerequisites The derived prerequisites required for this rank
 */
export default class CrucibleTalentItem extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const blankString = {required: true, blank: true, initial: ""};
    return {
      nodes: new fields.SetField(new fields.StringField({required: true, blank: false, choices: () => CrucibleTalentNode.getChoices()})),
      description: new fields.HTMLField(),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(CrucibleAction)),
      rune: new fields.StringField({...blankString, choices: SYSTEM.SPELL.RUNES}),
      gesture: new fields.StringField({...blankString, choices: SYSTEM.SPELL.GESTURES}),
      inflection: new fields.StringField({...blankString, choices: SYSTEM.SPELL.INFLECTIONS}),
      iconicSpells: new fields.NumberField({required: true, nullable: false, initial: 0, integer: true, min: 0}),
      training: new fields.SchemaField({
        type: new fields.StringField({...blankString, choices: SYSTEM.TALENT.TRAINING_TYPES}),
        rank: new fields.NumberField({required: true, nullable: true, initial: null, integer: true, min: 1, max: 4})
      }),
      actorHooks: new fields.ArrayField(new fields.SchemaField({
        hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTOR.HOOKS}),
        fn: new fields.JavaScriptField({async: true, gmOnly: true})
      }))
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["TALENT"];

  /**
   * The partial template used to render a feature granted item.
   * @type {string}
   */
  static INLINE_TEMPLATE_PATH = "systems/crucible/templates/sheets/item/talent-inline.hbs";

  /**
   * The partial template used to render a feature granted item.
   * @type {string}
   */
  static CARD_TEMPLATE_PATH = "systems/crucible/templates/sheets/item/talent-card.hbs";

  /**
   * Is this a signature talent?
   * @type {boolean}
   */
  isSignature = false;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Initialize this Talent as belonging to the Talent Tree.
   */
  initializeTree() {
    const talent = this.parent;
    if ( !this.nodes.size ) throw new Error(`Talent "${talent.name}" does not configure any valid tree nodes.`);

    // Register Talents
    for ( const node of this.nodes ) node.talents.add(talent);

    // Update Metadata
    if ( this.rune ) {
      const rune = SYSTEM.SPELL.RUNES[this.rune];
      rune.img = talent.img;
    }
    if ( this.gesture ) {
      const gesture = SYSTEM.SPELL.GESTURES[this.gesture];
      gesture.img = talent.img;
    }
    if ( this.inflection ) {
      const inflection = SYSTEM.SPELL.INFLECTIONS[this.inflection];
      inflection.img = talent.img;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.nodes.clear();
    for ( const id of this._source.nodes ) {
      const node = CrucibleTalentNode.nodes.get(id);
      if ( node ) this.nodes.add(node);
      if ( node.type === "signature" ) this.isSignature = true;
    }
    this.prerequisites = this.#preparePrerequisites();
  }

  /* -------------------------------------------- */

  /**
   * Customize prerequisites for this specific Talent that may differ from the prerequisites of its Node.
   * @returns {AdvancementPrerequisites}
   */
  #preparePrerequisites() {
    if ( !this.nodes.size ) return {};
    const requirements = {};
    for ( const node of this.nodes ) {
      Object.assign(requirements, foundry.utils.deepClone(node.requirements));
    }
    if ( this.training.rank > 1 ) {
      foundry.utils.setProperty(requirements, `training.${this.training.type}`, this.training.rank - 1);
    }
    return CrucibleTalentNode.preparePrerequisites(requirements);
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Return an object of string formatted tag data which describes this item type.
   * @returns {Object<string, string>}    The tags which describe this Talent
   */
  getTags() {
    const tags = {};
    for ( let [k, v] of Object.entries(this.prerequisites || {}) ) {
      tags[k] = `${v.label} ${v.value}`;
    }
    if ( this.iconicSpells ) {
      tags.iconicSpells = this.iconicSpells === 1 ? game.i18n.localize("SPELL.Iconic")
        : `${this.iconicSpells} ${game.i18n.localize("SPELL.IconicPl")}`;
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Test each prerequisite for a talent, returning a data structure that describes whether they are met.
   * @param {CrucibleActor} actor                       The Actor to evaluate
   * @param {AdvancementPrerequisites} prerequisites    The prerequisites to test
   * @returns {AdvancementPrerequisites}                An object of tested prerequisites
   */
  static testPrerequisites(actor, prerequisites) {
    const reqs = {};
    for ( let [k, v] of Object.entries(prerequisites) ) {
      const current = foundry.utils.getProperty(actor.system, k);
      reqs[k] = v;
      reqs[k].met = current >= v.value;
    }
    return reqs;
  }

  /* -------------------------------------------- */

  /**
   * Assert that an Actor meets the prerequisites for this Talent.
   * @param {CrucibleActor} actor         The Actor to test
   * @param {boolean} strict              Throw an error if prerequisites are not met, otherwise return a boolean
   * @returns {boolean}                   Only if testing is not strict
   * @throws {Error}                      A formatted error message if the prerequisites are unmet and testing is strict
   */
  assertPrerequisites(actor, strict=true) {

    // Ensure the Talent is not already owned
    if ( actor.items.find(i => (i.type === "talent") && (i.name === this.parent.name)) ) {
      if ( strict ) throw new Error(game.i18n.format("TALENT.WARNINGS.AlreadyOwned", {name: this.parent.name}));
      else return false;
    }

    // Require available talent points
    const points = actor.points.talent;
    if ( points.available < 1 ) {
      if ( strict ) throw new Error(game.i18n.format("TALENT.WARNINGS.CannotAfford", {
        name: this.parent.name,
        cost: 1
      }));
      else return false;
    }

    // Check Node state
    const state = {};
    for ( const node of this.nodes ) {
      const s = node.getState(actor);
      state.accessible ||= ((node.tier === 0) || node.isConnected(actor));
      if ( s.banned && (state.banned !== false) ) state.banned = true;
    }
    if ( state.banned ) {
      if ( strict ) throw new Error(game.i18n.localize("TALENT.WARNINGS.Banned"));
      return false;
    }
    if ( !state.accessible ) {
      if ( strict ) throw new Error(game.i18n.format("TALENT.WARNINGS.Inaccessible", {name: this.parent.name}));
      return false;
    }

    // Require prerequisite stats
    for ( let [k, v] of Object.entries(this.prerequisites) ) {
      const current = foundry.utils.getProperty(actor.system, k) ?? 0;
      if ( current < v.value ) {
        const err = game.i18n.format("TALENT.WARNINGS.Locked", {
          name: this.parent.name,
          requirement: v.label,
          requires: v.value
        });
        if ( strict ) throw new Error(err);
        else return false;
      }
    }
    return true;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Render this Talent as HTML for inline display.
   * @returns {Promise<string>}
   */
  async renderInline() {
    return foundry.applications.handlebars.renderTemplate(this.constructor.INLINE_TEMPLATE_PATH, {
      talent: this,
      uuid: this.parent.uuid,
      name: this.parent.name,
      img: this.parent.img,
      tags: this.getTags()
    });
  }

  /* -------------------------------------------- */

  /**
   * Render this Talent as HTML for a tooltip card.
   * @param {object} options
   * @param {CrucibleActor} [options.actor]
   * @returns {Promise<string>}
   */
  async renderCard({actor}={}) {

    // Load necessary templates
    await foundry.applications.handlebars.loadTemplates([
      this.constructor.CARD_TEMPLATE_PATH,
      "systems/crucible/templates/sheets/item/talent-summary.hbs"
    ]);

    // Prepare talent data
    const talent = this.parent;
    actor ||= talent.parent;
    const reqs = actor ? CrucibleTalentItem.testPrerequisites(actor, talent.system.prerequisites)
      : talent.system.prerequisites;

    // Render the card
    return foundry.applications.handlebars.renderTemplate(this.constructor.CARD_TEMPLATE_PATH, {
      talent,
      descriptionHTML: await CONFIG.ux.TextEditor.enrichHTML(talent.system.description, {
        relativeTo: talent,
        secrets: talent.isOwner
      }),
      source: talent,
      uuid: talent.uuid,
      name: talent.name,
      img: talent.img,
      actions: await CrucibleTalentItemSheet.prepareActions(talent),
      tags: this.getTags(),
      prerequisites: reqs
    });
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    super.migrateData(source);
    if ( (typeof source.node === "string") && !source.nodes ) {
      source.nodes = source.node ? [source.node] : [];
      delete source.node;
    }
  }
}
