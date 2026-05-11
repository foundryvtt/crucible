export default class CrucibleHazardRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["REGION_BEHAVIORS.HAZARD"];

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const {TOKEN_ENTER, TOKEN_EXIT, TOKEN_MOVE_IN, TOKEN_MOVE_OUT, TOKEN_MOVE_WITHIN,
      TOKEN_TURN_START, TOKEN_TURN_END, TOKEN_ROUND_START, TOKEN_ROUND_END} = CONST.REGION_EVENTS;
    const validEvents = [TOKEN_ENTER, TOKEN_EXIT, TOKEN_MOVE_IN, TOKEN_MOVE_OUT, TOKEN_MOVE_WITHIN,
      TOKEN_TURN_START, TOKEN_TURN_END, TOKEN_ROUND_START, TOKEN_ROUND_END];
    const {armor, block, dodge, parry, ...defenseTypes} = foundry.utils.deepClone(SYSTEM.DEFENSES);
    const {action, focus, heroism, ...resources} = foundry.utils.deepClone(SYSTEM.RESOURCES);
    const tags = Object.values(SYSTEM.ACTION.TAGS).reduce((acc, t) => {
      if ( t.internal || (t.category !== "modifiers") ) return acc;
      const cat = SYSTEM.ACTION.TAG_CATEGORIES[t.category];
      const group = cat?.label;
      return {...acc, [t.tag]: {label: t.label, group}};
    }, {});
    return {
      name: new fields.StringField(),
      danger: new fields.NumberField({initial: 0, required: true, nullable: false, integer: true}),
      defenseType: new fields.StringField({initial: "physical", choices: defenseTypes, required: true}),
      damageType: new fields.StringField({initial: "void", required: true, choices: {
        healing: {label: _loc("ACTION.TAG.Healing")},
        rallying: {label: _loc("ACTION.TAG.Rallying")},
        ...SYSTEM.DAMAGE_TYPES
      }}),
      resource: new fields.StringField({initial: "health", choices: resources, required: true}),
      tags: new fields.SetField(new fields.StringField({required: true, choices: tags})),
      promptGM: new fields.BooleanField({initial: false}),
      events: this._createEventsField({events: validEvents, initial: ["tokenEnter"]})
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleRegionEvent(event) {
    if ( this.promptGM && !game.user.isActiveGM ) return;
    if ( !this.promptGM && !event.user.isSelf ) return;
    const {token} = event.data;
    const actor = token.actor;
    if ( !actor ) return;
    const tags = [...this.tags, this.damageType];
    const hazardData = {
      actor,
      danger: this.danger,
      tags,
      defenseType: this.defenseType,
      resource: this.resource,
      name: this.name
    };
    const action = crucible.api.models.CrucibleAction.createHazard(hazardData);
    await action.use({dialog: this.promptGM});
  }
}
