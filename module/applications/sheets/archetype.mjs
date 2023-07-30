import CrucibleSheetMixin from "./crucible-sheet.mjs";

/**
 * A sheet application for displaying and configuring Items with the Archetype type.
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class ArchetypeSheet extends CrucibleSheetMixin(ItemSheet) {

  /** @override */
  static documentType = "archetype";

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      dragDrop: [{dragSelector: null, dropSelector: ".talents .droppable"}]
    });
  }

  /**
   * The template path for the included talent partial.
   * @type {string}
   */
  static includedTalentPartial = "systems/crucible/templates/sheets/partials/included-talent.hbs";

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    const source = this.document.toObject();
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.object,
      source: source,
      abilities: Object.values(SYSTEM.ABILITIES).map(ability => ({
        id: ability.id,
        label: ability.label,
        value: source.system.abilities[ability.id]
      })),
      talents: await this.#prepareTalents()
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare talent data for the Archetype.
   * @returns {Promise<{uuid: string, name: string, img: string}[]>}
   */
  async #prepareTalents() {
    const uuids = this.document.system.talents;
    const talents = [];
    for ( const uuid of uuids ) {
      const talent = await fromUuid(uuid)
      if ( !talent ) continue;
      talents.push(await this.#renderTalentHTML(talent));
    }
    return talents;
  }

  /* -------------------------------------------- */

  /**
   * Construct the HTML for a talent displayed on the Background sheet.
   * @param {CrucibleItem} talent     The talent item being displayed
   * @param {boolean} editable        Is the sheet currently editable?
   * @returns {Promise<string>}       The rendered HTML string
   */
  async #renderTalentHTML(talent) {
    return renderTemplate(this.constructor.includedTalentPartial, {
      talent,
      tags: talent.system.getTags(),
      editable: this.isEditable
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    this.#updateAbilitySum();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    const name = event.currentTarget.name;
    if ( name.includes("abilities") ) this.#updateAbilitySum();
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

  /** @override */
  async _handleAction(action, event, button) {
    switch ( action ) {
      case "removeTalent":
        button.closest(".talent").remove();
        const fd = this._getSubmitData();
        await this._updateObject(event, fd);
        this.setPosition({height: "auto"});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _canDragDrop(selector) {
    return this.isEditable;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDrop(event) {
    if ( !this.isEditable ) return;
    const data = TextEditor.getDragEventData(event);
    if ( data.type !== "Item" ) return;
    const talent = await fromUuid(data.uuid);
    if ( talent?.type !== "talent" ) return;
    const talents = this.element[0].querySelector(".talents .droppable");
    talents.insertAdjacentHTML("beforebegin", await this.#renderTalentHTML(talent));
    this.setPosition({height: "auto"});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getSubmitData(updateData={}) {
    const formData = super._getSubmitData(updateData);
    const talents = this.element[0].querySelectorAll(".talents .talent");
    formData["system.talents"] = Array.from(talents).map(t => t.dataset.uuid);
    return formData;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if ( this.document.parent instanceof Actor ) {
      const diff = this.object.updateSource(formData);
      if ( !foundry.utils.isEmpty(diff) ) return this.actor.system.applyArchetype(this.object);
    }
    return this.document.update(formData);
  }
}
