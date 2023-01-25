import ActionData from "./action.mjs";
import {SYSTEM} from "../config/system.js";
import CrucibleTalentNode from "../config/talent-tree.mjs";

/**
 * @typedef {Object<string, {value: number, label: string}>}  TalentPrerequisiteData
 */

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
 * The data schema of a Talent type Item in the Crucible system.
 *
 * @property {TalentRankData} currentRank             The current rank in this talent
 * @property {number} cost                            The action point cost to have obtained the current rank
 * @property {TalentRankData} nextRank                The next rank in this talent
 * @property {ActionData[]} actions                   The actions which have been unlocked by this talent
 * @property {TalentPrerequisiteData} prerequisites   The derived prerequisites required for this rank
 * @property {TalentPrerequisiteData} requirements    The derived requirements required for the next rank
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
    this.prerequisites = this.#preparePrerequisites(node.requirements, this.requirements);

    // Prepare Action data
    for ( let a of this.actions ) {
      a.prepareData();
    }
  }

  /* -------------------------------------------- */

  #preparePrerequisites(nodeReqs, talentReqs) {
    const reqs = foundry.utils.mergeObject(nodeReqs, talentReqs);
    return Object.entries(foundry.utils.flattenObject(reqs)).reduce((obj, r) => {
      const [k, v] = r;
      obj[k] = {value: v};
      if ( k.startsWith("attributes.") ) obj[k].label = SYSTEM.ABILITIES[k.split(".")[1]].label;
      else if ( k === "advancement.level" ) obj[k].label = "Level"
      else if ( k.startsWith("skills.") ) obj[k].label = SYSTEM.SKILLS[k.split(".")[1]].label;
      else obj[k].label = k;
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
}
