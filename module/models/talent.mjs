import CrucibleAction from "./action.mjs";
import CrucibleTalentNode from "../config/talent-tree.mjs";

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
 * @typedef {Object<AdvancementPrerequisite>} AdvancementPrerequisites
 */

/**
 * The data schema of a Talent type Item in the Crucible system.
 *
 * @property {TalentRankData} currentRank             The current rank in this talent
 * @property {number} cost                            The action point cost to have obtained the current rank
 * @property {TalentRankData} nextRank                The next rank in this talent
 * @property {CrucibleAction[]} actions               The actions which have been unlocked by this talent
 * @property {AdvancementPrerequisites} prerequisites The derived prerequisites required for this rank
 */
export default class CrucibleTalent extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      node: new fields.StringField({required: false, choices: () => Array.from(CrucibleTalentNode.nodes.keys())}),
      description: new fields.HTMLField(),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(CrucibleAction)),
      rune: new fields.StringField({required: false, choices: SYSTEM.SPELL.RUNES, initial: undefined}),
      gesture: new fields.StringField({required: false, choices: SYSTEM.SPELL.GESTURES, initial: undefined}),
      inflection: new fields.StringField({required: false, choices: SYSTEM.SPELL.INFLECTIONS, initial: undefined}),
      actorHooks: new fields.ArrayField(new fields.SchemaField({
        hook: new fields.StringField({required: true, blank: false, choices: SYSTEM.ACTOR_HOOKS}),
        fn: new fields.StringField({required: true, blank: false, nullable: false, gmOnly: true}),
      }))
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    let node = this.node = CrucibleTalentNode.nodes.get(this._source.node);
    this.prerequisites = CrucibleTalent.preparePrerequisites(node?.requirements || {});
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure of talent prerequisites
   * @param {AdvancementPrerequisites} nodeReqs
   * @returns {AdvancementPrerequisites}
   */
  static preparePrerequisites(nodeReqs={}) {
    return Object.entries(foundry.utils.flattenObject(nodeReqs)).reduce((obj, r) => {
      const [k, v] = r;
      const o = obj[k] = {value: v};
      if ( k.startsWith("abilities.") ) o.label = SYSTEM.ABILITIES[k.split(".")[1]].label;
      else if ( k === "advancement.level" ) o.label = "Level"
      else if ( k.startsWith("skills.") ) o.label = SYSTEM.SKILLS[k.split(".")[1]].label;
      else o.label = k;
      o.tag = `${o.label} ${o.value}`;
      return obj;
    }, {});
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
    if ( !points.available ) {
      if ( strict ) throw new Error(game.i18n.format("TALENT.WARNINGS.CannotAfford", {
        name: this.parent.name,
        cost: 1
      }));
      else return false;
    }

    // Check Node state
    const state = this.node.getState(actor);
    state.accessible = (this.node.tier === 0) || this.node.isConnected(actor);

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
