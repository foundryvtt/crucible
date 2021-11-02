import DocumentData from "/common/abstract/data.mjs";
import * as fields from "/common/data/fields.mjs";
import ActionData from "../talents/action.mjs";

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
export class TalentData extends DocumentData {
  static defineSchema() {
    return {
      description: fields.BLANK_STRING,
      type: fields.BLANK_STRING,
      ranks: {
        type: [TalentRankData],
        required: true,
        default: []
      },
      rank: fields.field(fields.INTEGER_FIELD, {default: 0})
    }
  }
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
