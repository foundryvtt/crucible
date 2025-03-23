import CrucibleAction from "./action.mjs";
import CrucibleTalentNode from "../config/talent-node.mjs";

/**
 * @typedef {Object} TalentData
 * @property {string} node
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
    return {
      node: new fields.StringField({required: true, blank: true, choices: () => CrucibleTalentNode.getChoices()}),
      description: new fields.HTMLField(),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(CrucibleAction)),
      rune: new fields.StringField({required: false, choices: SYSTEM.SPELL.RUNES, initial: undefined}),
      gesture: new fields.StringField({required: false, choices: SYSTEM.SPELL.GESTURES, initial: undefined}),
      inflection: new fields.StringField({required: false, choices: SYSTEM.SPELL.INFLECTIONS, initial: undefined}),
      iconicSpells: new fields.NumberField({required: true, nullable: false, initial: 0, integer: true, min: 0}),
      training: new fields.SchemaField({
        type: new fields.StringField({required: true, blank: true, choices: SYSTEM.TALENT.TRAINING_TYPES, initial: ""}),
        rank: new fields.NumberField({required: true, nullable: true, choices: SYSTEM.TALENT.TRAINING_RANKS, initial: null})
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
   * Is this a signature talent?
   * @type {boolean}
   */
  get isSignature() {
    return this.node?.type === "signature";
  }

  /**
   * A talent tree node other than the primary one for this talent which is also unlocked.
   * @type {CrucibleTalentNode|null}
   */
  get teleportNode() {
    return this.#teleportNode;
  }
  #teleportNode = null;

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Initialize this Talent as belonging to the Talent Tree.
   */
  initializeTree() {
    const node = this.node;
    const talent = this.parent;
    if ( !node ) throw new Error(`Talent "${talent.name}" does not configure a valid Talent Tree node "${this._source.node}".`);

    // Register Talents
    node.talents.add(talent);

    // Update Metadata
    if ( this.rune ) {
      const rune = SYSTEM.SPELL.RUNES[this.rune];
      rune.img = talent.img;
      rune.description = this.description;
    }
    if ( this.gesture ) {
      const gesture = SYSTEM.SPELL.GESTURES[this.gesture];
      gesture.img = talent.img;
      gesture.description = this.description;
    }
    if ( this.inflection ) {
      const inflection = SYSTEM.SPELL.INFLECTIONS[this.inflection];
      inflection.img = talent.img;
      inflection.description = this.description;
    }

    // Teleport Node
    if ( node.type === "signature" ) {
      const group = node.groups?.[this._source.node];
      if ( group ) {
        this.#teleportNode = CrucibleTalentNode.nodes.get(group.teleport);
        this.#teleportNode.talents.add(talent);
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.node = CrucibleTalentNode.nodes.get(this._source.node);
    this.prerequisites = this.#preparePrerequisites();
  }

  /* -------------------------------------------- */

  /**
   * Customize prerequisites for this specific Talent that may differ from the prerequisites of its Node.
   * @returns {AdvancementPrerequisites}
   */
  #preparePrerequisites() {
    if ( !this.node ) return {};
    const requirements = foundry.utils.deepClone(this.node.requirements);
    const group = this.node.groups?.[this._source.node];
    if ( group ) {
      for ( const a of group.abilities ) {
        requirements[`abilities.${a}.value`] = this.node.tier + 2;
      }
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
   * @throws a formatted error message if the prerequisites are not met and testing is strict
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
    const state = this.node.getState(actor);
    state.accessible = (this.node.tier === 0) || this.node.isConnected(actor) || this.teleportNode?.isConnected(actor);

    // Require a connected node
    if ( !state.accessible ) {
      if ( strict ) throw new Error(game.i18n.format("TALENT.WARNINGS.Inaccessible", {
        name: this.parent.name
      }));
      else return false;
    }

    // Block banned nodes
    if ( state.banned ) {
      if ( strict ) throw new Error(game.i18n.localize("TALENT.WARNINGS.Banned"));
      else return false;
    }

    // Require prerequisite stats
    for ( let [k, v] of Object.entries(this.prerequisites) ) {
      const current = foundry.utils.getProperty(actor.system, k);
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
}
