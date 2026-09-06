import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "talent" type.
 */
export default class CrucibleTalentItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "talent",
      includesActions: true,
      includesHooks: true
    },
    actions: {
      requirementRemove: CrucibleTalentItemSheet.#onRequirementRemove
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.requirements = this.#prepareRequirements(context);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Split the proficiencies into those already required and those still available to require.
   * @param {object} context   The prepared sheet context
   * @returns {{rows: object[], options: object[], groups: string[], field: StringField}}
   */
  #prepareRequirements(context) {
    const {PROFICIENCIES, GROUPS} = SYSTEM.PROFICIENCY;
    const required = context.source.system.requirements.training ?? {};
    const element = context.fields.requirements.fields.training.element;
    const rows = [];
    const options = [];
    for ( const [id, config] of Object.entries(PROFICIENCIES) ) {
      if ( id in required ) rows.push({
        field: element,
        id,
        label: config.label,
        name: `system.requirements.training.${id}`,
        value: required[id]
      });
      else options.push({value: id, label: config.label, group: GROUPS[config.group].label});
    }
    return {
      rows,
      options,
      groups: Object.values(GROUPS).map(g => g.label),
      field: new foundry.data.fields.StringField({required: false, blank: true})
    };
  }

  /* -------------------------------------------- */

  /**
   * Remove a required proficiency rank, which the numeric input alone cannot express.
   * @this {CrucibleTalentItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onRequirementRemove(event, target) {
    const {proficiency} = target.closest(".training-requirement").dataset;
    const training = {...this.document._source.system.requirements.training};
    delete training[proficiency];
    return this._processSubmitData(event, this.form, {system: {requirements: {training: _replace(training)}}});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);

    // Requirements replace rather than merge, so a removed proficiency is actually dropped
    const added = submitData.requirementAdd;
    delete submitData.requirementAdd;
    const training = {};
    for ( const [id, rank] of Object.entries(submitData.system.requirements?.training ?? {}) ) {
      // A typed value can exceed the max attribute, so clamp rather than fail validation
      if ( Number.isFinite(rank) && (rank >= 1) ) training[id] = Math.clamp(rank, 1, SYSTEM.PROFICIENCY.RANK_MAX);
    }
    if ( added ) training[added] ??= 1;
    submitData.system.requirements ??= {};
    submitData.system.requirements.training = _replace(training);
    return submitData;
  }
}
