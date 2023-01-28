import ActionData from "./action.mjs";
import {SYSTEM} from "../config/system.js";
import CrucibleTalentNode from "../config/talent-tree.mjs";

/**
 * @typedef {Object} TalentRankData
 * @property {string} description
 * @property {number} tier
 * @property {number} cost
 * @property {{[key: string]: number}} requirements
 * @property {ActionData[]} actions
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
 * @property {ActionData[]} actions                   The actions which have been unlocked by this talent
 * @property {AdvancementPrerequisites} prerequisites The derived prerequisites required for this rank
 * @property {AdvancementPrerequisites} requirements  The derived requirements required for the next rank
 */
export default class TalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      node: new fields.StringField({required: false, choices: () => Array.from(CrucibleTalentNode.nodes.keys())}),
      description: new fields.HTMLField(),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(ActionData)),
      requirements: new fields.ObjectField(),
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    let node = CrucibleTalentNode.nodes.get(this.node);
    if ( !node ) {
      console.warn(`Talent ${this.parent.name} "${this.parent.id}" does not define a valid talent tree node`);
      node = {requirements: {}}
    }

    // Prepare prerequisites
    this.prerequisites = TalentData.preparePrerequisites(node.requirements, this.requirements);

    // Prepare Action data
    for ( let a of this.actions ) {
      a.prepareData();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure of talent prerequisites
   * @param {AdvancementPrerequisites} nodeReqs
   * @param {AdvancementPrerequisites} talentReqs
   * @returns {AdvancementPrerequisites}
   */
  static preparePrerequisites(nodeReqs={}, talentReqs={}) {
    const reqs = foundry.utils.mergeObject(nodeReqs, talentReqs);
    return Object.entries(foundry.utils.flattenObject(reqs)).reduce((obj, r) => {
      const [k, v] = r;
      const o = obj[k] = {value: v};
      if ( k.startsWith("attributes.") ) o.label = SYSTEM.ABILITIES[k.split(".")[1]].label;
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
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Object<string, string>}    The tags which describe this Talent
   */
  getTags(scope="full") {
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
  assertPrerequisites(actor, prerequisites, strict=true) {
    for ( let [k, v] of Object.entries(this.prerequisites) ) {
      const current = foundry.utils.getProperty(actor.system, k);
      if ( current < v.value ) {
        const err = game.i18n.format("TALENT.MissingRequirement", {
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
