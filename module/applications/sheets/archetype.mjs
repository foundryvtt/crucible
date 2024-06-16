import BackgroundSheet from "./background.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "archetype" type.
 */
export default class ArchetypeSheet extends BackgroundSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "archetype"
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      abilities: Object.values(SYSTEM.ABILITIES).map(ability => ({
        field: context.fields.abilities.fields[ability.id],
        id: ability.id,
        label: ability.label,
        value: context.source.system.abilities[ability.id]
      }))
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#updateAbilitySum();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const group = event.target.closest(".form-group");
    if ( group?.classList.contains("abilities") )  this.#updateAbilitySum();
  }

  /* -------------------------------------------- */

  /**
   * Update the indicator for whether the ability configuration for the Archetype is valid.
   */
  #updateAbilitySum() {
    const abilities = this.element.querySelector(".abilities");
    const inputs = abilities.querySelectorAll("input[type=number]");
    const total = Array.from(inputs).reduce((t, input) => t + input.valueAsNumber, 0);
    const valid = total === 18;
    const icon = valid ? "fa-solid fa-check" : "fa-solid fa-times";
    const span = abilities.querySelector(".sum");
    span.innerHTML = `${total} <i class="${icon}"></i>`;
    span.classList.toggle("invalid", !valid);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    const fields = this.document.system.schema.fields;
    if ( fields.abilities.validate(submitData.system.abilities) !== undefined ) {
      delete submitData.system.abilities;
    }
    const talents = form.querySelectorAll(".talents .talent");
    submitData.system.talents = Array.from(talents).map(t => t.dataset.uuid);
    return submitData;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _processSubmitData(event, form, submitData) {
    if ( this.document.parent instanceof Actor ) {
      const diff = this.document.updateSource(submitData, {dryRun: true});
      if ( !foundry.utils.isEmpty(diff) ) await this.actor.system.applyArchetype(this.document);
      return;
    }
    return super._processFormData(event, form, submitData);
  }
}
