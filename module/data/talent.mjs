import DocumentData from "/common/abstract/data.mjs";
import * as fields from "/common/data/fields.mjs";
import ActionData from "./action.mjs";
import {SYSTEM} from "../config/system.js";

/**
 * @typedef {Object<string, {value: number, label: string}>}  TalentPrerequisiteData
 */

/**
 * The data schema of a Talent type Item in the Crucible system.
 * @extends {DocumentData}
 *
 * @property {TalentRankData} currentRank             The current rank in this talent
 * @property {number} cost                            The action point cost to have obtained the current rank
 * @property {TalentRankData} nextRank                The next rank in this talent
 * @property {ActionData[]} actions                   The actions which have been unlocked by this talent
 * @property {TalentPrerequisiteData} prerequisites   The derived prerequisites required for this rank
 * @property {TalentPrerequisiteData} requirements    The derived requirements required for the next rank
 */
export class TalentData extends DocumentData {
  static defineSchema() {
    return {
      description: fields.BLANK_STRING,
      type: fields.field(fields.BLANK_STRING, {
        validate: t => this.TALENT_TYPES.includes(t),
        validationError: '{name} {field} "{value}" is not a valid type in TalentData.TALENT_TYPES'
      }),
      tags: {
        type: [String],
        required: true,
        default: [],
        validate: tags => tags.every(t => t in SYSTEM.TALENT.ACTION_TAGS),
        validationError: '{name} {field} "{value}" must all be valid tags in TALENT.ACTION_TAGS'
      },
      ranks: {
        type: [TalentRankData],
        required: true,
        default: []
      },
      rank: fields.field(fields.INTEGER_FIELD, {default: 0})
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
  prepareData() {

    // Identify current rank and cost
    this.currentRank = this.ranks[this.rank-1] || null;
    this.cost = this.ranks.reduce((cost, r, i) => {
      if ( i < this.rank ) cost += r.cost;
      return cost;
    }, 0);
    this.nextRank = this.ranks[this.rank] || null;
    if ( !this.ranks.length ) this.actions = [];
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
    const rank = new TalentRankData({description: "New Rank"});
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


/* -------------------------------------------- */


/**
 * The data schema of a Talent type Item in the Crucible system.
 * @extends DocumentData
 *
 * @property {string} description
 * @property {number} tier
 * @property {number} cost
 * @property {number} ranks
 * @property {{[key: string]: number}} requirements
 * @property {ActionData[]} actions
 */
export class TalentRankData extends DocumentData {
  static defineSchema() {
    return {
      description: fields.BLANK_STRING,
      cost: fields.field(fields.POSITIVE_INTEGER_FIELD, {default: 1}),
      requirements: fields.OBJECT_FIELD,
      actions: {
        type: [ActionData],
        required: true,
        default: []
      },
      passives: {
        type: [TalentPassiveData],
        required: true,
        default: []
      },
    }
  }
}

export class TalentPassiveData extends DocumentData {
  static defineSchema() {
    return {
      key: fields.BLANK_STRING,
      value: fields.BLANK_STRING,
      mode: {
        type: Number,
        required: true,
        default: CONST.ACTIVE_EFFECT_MODES.ADD,
        validate: m => Object.values(CONST.ACTIVE_EFFECT_MODES).includes(m),
        validationError: "Invalid mode specified for change in ActiveEffectData"
      }
    }
  }
}
