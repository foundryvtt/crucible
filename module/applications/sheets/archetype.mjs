import { SYSTEM } from "../../config/system.js";
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
      talents: await ArchetypeSheet.#prepareTalents(this.document.system.talents)
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare talent data for the Background.
   * @param {string[]} uuids      The UUIDs of talents associated with this Background.
   * @returns {Promise<{uuid: string, name: string, img: string}[]>}
   */
  static async #prepareTalents(uuids) {
    const talents = [];
    for ( const uuid of uuids ) {
      const talent = await fromUuid(uuid)
      if ( !talent ) continue;
      talents.push(this.#getTalentHTML(talent));
    }
    return talents;
  }

  /* -------------------------------------------- */

  /**
   * Construct the HTML for a talent displayed on the Background sheet.
   * @param {CrucibleItem} talent     The talent item being displayed
   * @returns {string}                The rendered HTML string
   */
  static #getTalentHTML(talent) {
    return `<div class="talent line-item" data-uuid="${talent.uuid}">
      <header class="talent-header flexrow">
        <img class="icon" src="${talent.img}" alt="${talent.name}">
        <h4 class="title">${talent.name}</h4>
        <div class="tags">${Object.entries(talent.system.getTags()).map(([type, tag]) => {
      return `<span class="tag" data-tag="${type}">${tag}</span>`;
    }).join("")}</div>
        <a class="button remove-talent" data-action="removeTalent" data-tooltip="BACKGROUND.RemoveTalent">
            <i class="fa-solid fa-times"></i>
        </a>
      </header>
      <div class="description">${talent.system.description}</div>
    </div>`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", "[data-action]", this.#onClickAction.bind(this));
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

  #onClickAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "removeTalent":
        const fd = this._getSubmitData();
        fd["system.talents"] = [];
        return this._updateObject(event, fd);
    }
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
    talents.insertAdjacentHTML("beforebegin", ArchetypeSheet.#getTalentHTML(talent));
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
