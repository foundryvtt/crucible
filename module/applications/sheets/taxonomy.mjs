import CrucibleSheetMixin from "./crucible-sheet.mjs";

/**
 * A sheet application for displaying and configuring Items with the Taxonomy type.
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class TaxonomySheet extends CrucibleSheetMixin(ItemSheet) {

  /** @override */
  static documentType = "taxonomy";

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    const source = this.document.toObject();
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.object,
      source,
      abilities: Object.values(SYSTEM.ABILITIES).map(ability => ({
        id: ability.id,
        label: ability.label,
        value: source.system.abilities[ability.id]
      })),
      categories: SYSTEM.ADVERSARY.TAXONOMY_CATEGORIES,
      resistances: Object.values(SYSTEM.DAMAGE_TYPES).map(damage => ({
        id: damage.id,
        label: damage.label,
        value: source.system.resistances[damage.id]
      }))
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    this.#updateAbilitySum();
    this.#updateResistanceSum();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    const name = event.currentTarget.name;
    if ( name.includes("abilities") ) this.#updateAbilitySum();
    else if ( name.includes("resistances") ) this.#updateResistanceSum();
  }

  /* -------------------------------------------- */

  /**
   * Update the indicator for whether the ability configuration for the Taxonomy is valid.
   */
  #updateAbilitySum() {
    const abilities = this.element.find(".abilities input[type='number']");
    const sum = Array.from(abilities).reduce((t, input) => t + input.valueAsNumber, 0);
    const icon = sum === 18 ? "fa-solid fa-check" : "fa-solid fa-times";
    this.element.find("span.ability-sum").html(`${sum} <i class="${icon}"></i>`);
  }

  /* -------------------------------------------- */

  /**
   * Update the indicator for whether the resistance configuration for the Taxonomy is valid.
   */
  #updateResistanceSum() {
    const resistances = this.element.find(".resistances input[type='number']");
    const sum = Array.from(resistances).reduce((t, input) => t + input.valueAsNumber, 0);
    const icon = sum === 0 ? "fa-solid fa-check" : "fa-solid fa-times";
    this.element.find("span.resistance-sum").html(`${sum} <i class="${icon}"></i>`);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if ( this.document.parent instanceof Actor ) {
      const diff = this.object.updateSource(formData);
      if ( !foundry.utils.isEmpty(diff) ) return this.actor.system.applyTaxonomy(this.object);
    }
    return this.document.update(formData);
  }
}
