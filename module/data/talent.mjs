import ActionData from "./action.mjs";
import {SYSTEM} from "../config/system.js";

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
      description: new fields.StringField(),
      type: new fields.StringField({required: true, choices: this.TALENT_TYPES}),
      tags: new fields.SetField(new fields.StringField({required: true, choices: SYSTEM.TALENT.ACTION_TAGS})),
      ranks: new fields.ArrayField(new fields.SchemaField({
        description: new fields.StringField(),
        tier: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1}),
        cost: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1}),
        requirements: new fields.ObjectField(),
        actions: new fields.ArrayField(new fields.EmbeddedDataField(ActionData)), // todo
        passives: new fields.ArrayField(new fields.ObjectField()) // todo
      })),
      rank: new fields.NumberField({required: true, nullable: false, integer: true, min: 0})
    }
  }

  /**
   * Allowed talent types which can be assigned to TalentData
   * @type {string[]}
   */
  static TALENT_TYPES = ["armor", "defensive", "weaponry"];

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /**
   * Prepare derived data specific to the talent type.
   */
  prepareBaseData() {

    // Identify current rank and cost
    this.currentRank = this.ranks[this.rank-1] || null;
    this.cost = this.ranks.reduce((cost, r, i) => {
      if ( i < this.rank ) cost += r.cost;
      return cost;
    }, 0);
    this.nextRank = this.ranks[this.rank] || null;
    if ( !this.ranks.length )this.actions = [];
    else this.actions = this.rank > 0 ? this.currentRank.actions : this.nextRank.actions;

    // Identify requirements
    const getReqs = reqs => {
      return Object.entries(reqs).reduce((obj, r) => {
        const [k, v] = r;
        obj[k] = {value: v};
        if ( k.startsWith("attributes.") ) obj[k].label = SYSTEM.ABILITIES[k.split(".")[1]].label;
        else if ( k === "advancement.level" ) obj[k].label = "Level"
        else if ( k.startsWith("skills.") ) obj[k].label = SYSTEM.SKILLS[k.split(".")[1]].label;
        else obj[k].label = k;
        return obj;
      }, {});
    }
    this.prerequisites = getReqs(foundry.utils.flattenObject(this.currentRank?.requirements || {}));
    this.requirements = getReqs(foundry.utils.flattenObject(this.nextRank?.requirements || {}));

    // Prepare action data
    for ( let a of this.actions ) {
      a.prepareData();
    }
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
    if ( this.nextRank ) {
      const cost = this.nextRank.cost;
      tags.cost = `${cost} ${cost > 1 ? "Points" : "Point"}`;
    }
    for ( let [k, v] of Object.entries(this.requirements || {}) ) {
      tags[k] = `${v.label} ${v.value}`;
    }
    return tags;
  }

  /* -------------------------------------------- */

  addRank() {
    const source = this.toObject();
    const rank = {cost: 1, description: "New Rank"};
    source.ranks.push(rank);
    return this.document.update({data: source});
  }

  /* -------------------------------------------- */

  addAction(rank) {
    const source = this.toObject();
    const action = new ActionData({
      id: "new-action",
      name: "New Action",
      description: "New action description"
    });
    source.ranks[rank].actions.push(action);
    return this.document.update({data: source});
  }
}
