import DocumentData from "/common/abstract/data.mjs";
import * as fields from "/common/data/fields.mjs";
import ActionData from "../talents/action.mjs";

/**
 * The data schema of a Talent type Item in the Crucible system.
 * @extends DocumentData
 *
 * @property {string} type              The talent type in
 * @property {string} description
 * @property {string[]} tags
 * @property {number} ranks
 * @property {number} rank
 * @property {ActionData[]} actions
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
        validate: tags => tags.every(t => this.TALENT_TAGS.includes(t)),
        validationError: '{name} {field} "{value}" must all be valid tags in TalentData.TALENT_TAGS'
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
  static TALENT_TYPES = ["armor", "weaponry"];

  /**
   * Allowed talent tags which can be assigned to TalentData or ActionData
   * @type {string[]}
   */
  static TALENT_TAGS = ["melee", "mainhand", "twohand", "offhand", "shield"];
}

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
