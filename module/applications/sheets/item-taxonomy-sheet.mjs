import CrucibleActorDetailsItemSheet from "./item-actor-details-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "taxonomy" type.
 */
export default class CrucibleTaxonomyItemSheet extends CrucibleActorDetailsItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "taxonomy"
    }
  };

  static {
    this._initializeItemSheetClass();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const {SetField, StringField} = foundry.data.fields;
    return Object.assign(context, {
      abilities: Object.values(SYSTEM.ABILITIES).map(ability => ({
        field: context.fields.abilities.fields[ability.id],
        id: ability.id,
        label: ability.label,
        value: context.source.system.abilities[ability.id]
      })),
      resistances: Object.values(SYSTEM.DAMAGE_TYPES).map(damage => ({
        field: context.fields.resistances.fields[damage.id].fields.value,
        id: damage.id,
        label: damage.label,
        value: context.source.system.resistances[damage.id].value,
        dataset: {
          damageType: damage.id
        }
      })),
      immunities: {
        field: new SetField(new StringField({choices: SYSTEM.DAMAGE_TYPES}), {label: "TAXONOMY.FIELDS.resistances.immune.label"}),
        immune: Object.entries(context.source.system.resistances).reduce((arr, [k, {immune}]) => {
          if ( immune ) arr.push(k);
          return arr;
        }, [])
      }
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#handleImmunities(context.immunities.immune);
    this.#updateAbilitySum();
    this.#updateResistanceSum();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const group = event.target.closest(".form-group");
    if ( group?.classList.contains("abilities") ) this.#updateAbilitySum();
    else if ( group?.classList.contains("resistances") ) {
      this.#updateResistanceSum();
    } else if ( group?.classList.contains("immunities") ) {
      this.#handleImmunities(event.target.value);
      this.#updateResistanceSum();
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the indicator for whether the ability configuration for the Taxonomy is valid.
   */
  #updateAbilitySum() {
    const abilities = this.element.querySelector(".abilities");
    const inputs = abilities.querySelectorAll("input[type=number]");
    const total = Array.from(inputs).reduce((t, input) => t + input.valueAsNumber, 0);
    const valid = total === 12;
    const icon = valid ? "fa-solid fa-check" : "fa-solid fa-times";
    const span = abilities.querySelector(".sum");
    span.innerHTML = `${total} <i class="${icon}"></i>`;
    span.classList.toggle("invalid", !valid);
  }

  /* -------------------------------------------- */

  /**
   * Update the resistance numerical inputs when a change is made to selected immunities,
   * disabling the corresponding inputs and overriding their visual value as 4.
   * @param {string[]} selected The ids of the damage types which are currently selected as immunities
   */
  #handleImmunities(selected) {
    const resistances = this.element.querySelector(".resistances");
    const inputs = resistances.querySelectorAll("input[type=number],input[type=text]");
    for ( const input of inputs ) {
      if ( selected.includes(input.dataset.damageType) ) {
        input.disabled = true;
        input.type = "text";
        input.value = "∞";
      } else {
        input.disabled = false;
        input.type = "number";
        input.value = foundry.utils.getProperty(this.document, input.name);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the indicator for whether the resistance configuration for the Taxonomy is valid.
   */
  #updateResistanceSum() {
    const resistances = this.element.querySelector(".resistances");
    const inputs = resistances.querySelectorAll("input[type=number]");
    const immuneTotal = resistances.querySelector("[name='immunities']").value.length * 4;
    const total = Array.from(inputs).reduce((t, input) => t + input.valueAsNumber, immuneTotal);
    const valid = total === 0;
    const icon = valid ? "fa-solid fa-check" : "fa-solid fa-times";
    const span = resistances.querySelector(".sum");
    span.innerHTML = `${total} <i class="${icon}"></i>`;
    span.classList.toggle("invalid", !valid);
  }

  /* -------------------------------------------- */

  /** @override */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    const fields = this.document.system.schema.fields;
    const {abilities, resistances} = submitData.system;
    for ( const resType of Object.keys(SYSTEM.DAMAGE_TYPES) ) {
      resistances[resType] ??= {};
      resistances[resType].value ??= this.document.system.resistances[resType].value;
      resistances[resType].immune = submitData.immunities.includes(resType);
    }
    delete submitData.immunities;
    if ( fields.abilities.validate(abilities) !== undefined ) return {};
    if ( fields.resistances.validate(resistances) !== undefined ) return {};
    return submitData;
  }
}
