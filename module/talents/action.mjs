import * as fields from "/common/data/fields.mjs";
import * as TALENT from "../config/talent.mjs";

/**
 * The data schema used for an Action within a talent Item
 */
export default class ActionData extends foundry.abstract.DocumentData {
  static defineSchema() {
    return {
      id: fields.REQUIRED_STRING,
      name: fields.REQUIRED_STRING,
      img: fields.IMAGE_FIELD,
      description: fields.REQUIRED_STRING,
      targetType: fields.field(fields.REQUIRED_STRING, {
        default: "single",
        validate: v => v in TALENT.ACTION_TARGET_TYPES
      }),
      targetNumber: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 1}),
      targetDistance: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 1}),
      actionCost: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 0}),
      focusCost: fields.field(fields.NONNEGATIVE_INTEGER_FIELD, {required: true, default: 0}),
      affectAllies: fields.field(fields.BOOLEAN_FIELD, {default: false}),
      affectEnemies: fields.field(fields.BOOLEAN_FIELD, {default: true}),
      tags: {
        type: [String],
        required: true,
        default: []
      }
    }
  }

  getActivationTags() {
    return [
      TALENT.ACTION_TARGET_TYPES[this.targetType].label,
      this.actionCost ? `${this.actionCost}A` : null,
      this.focusCost ? `${this.focusCost}F` : null,
    ].filter(t => !!t);
  }

  getActionTags() {
    const tags = [];
    for (let t of this.tags) {
      const tag = TALENT.ACTION_TAGS[t];
      if (tag.label) tags.push(tag.label);
    }
    return tags;
  }

  async getHTML(actor) {
    const data = this.toObject();
    data.activationTags = this.getActivationTags();
    data.actionTags = this.getActionTags();
    return renderTemplate("systems/crucible/templates/dice/action-use-chat.html", data);
  }
}
