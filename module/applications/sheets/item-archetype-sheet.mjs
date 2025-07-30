import CrucibleBackgroundItemSheet from "./item-background-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "archetype" type.
 */
export default class CrucibleArchetypeItemSheet extends CrucibleBackgroundItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "archetype"
    },
    actions: {
      removeEquipment: CrucibleArchetypeItemSheet.#onRemoveEquipment
    }
  };

  /**
   * The template partial used to render an included equipment item.
   * @type {string}
   */
  static INCLUDED_EQUIPMENT_TEMPLATE = "systems/crucible/templates/sheets/item/included-equipment.hbs";

  /** @override */
  static PARTS = {
    ...super.PARTS,
    equipment: {
      id: "equipment",
      template: "systems/crucible/templates/sheets/item/item-equipment.hbs",
      templates: [this.INCLUDED_EQUIPMENT_TEMPLATE],
      scrollable: [".equipment-list"]
    }
  };

  /** @inheritDoc */
  static TABS = foundry.utils.deepClone(super.TABS);
  static {
    this.TABS.sheet.push({id: "equipment", group: "sheet", icon: "fa-solid fa-suitcase", label: "ITEM.TABS.EQUIPMENT"});
  }

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
      })),
      equipment: await this._prepareEquipment(),
      equipmentPartial: this.constructor.INCLUDED_EQUIPMENT_TEMPLATE
    });
  }

  /* -------------------------------------------- */

  /**
   * Retrieve equipment and prepare for rendering.
   * @returns {Promise<object[]>}
   * @protected
   */
  async _prepareEquipment() {
    const uuids = this.document.system.equipment;
    const promises = [];
    for ( const uuid of uuids ) {
      promises.push(fromUuid(uuid).then(item => {
        if ( !item ) return {uuid, name: "INVALID", img: "", description: "", tags: {}};
        return {
          uuid,
          name: item.name,
          img: item.img,
          description: item.system.description.public,
          tags: item.getTags()
        }
      }));
    }
    return Promise.all(promises);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#updateAbilitySum();
    if ( !this.isEditable ) return;
    const dropZone = this.element.querySelector(".equipment-drop");
    dropZone?.addEventListener("drop", this.#onDropEquipment.bind(this));
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
    const valid = total === 12;
    const icon = valid ? "fa-solid fa-check" : "fa-solid fa-times";
    const span = abilities.querySelector(".sum");
    span.innerHTML = `${total} <i class="${icon}"></i>`;
    span.classList.toggle("invalid", !valid);
  }

  /* -------------------------------------------- */

  /**
   * Handle drop events for an equipment item added to this sheet.
   * @param {DragEvent} event 
   * @returns {Promise<*>}
   */
  async #onDropEquipment(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    const equipment = this.document.system.equipment;
    if ( (data.type !== "Item") || equipment.has(data.uuid) ) return;
    const item = await fromUuid(data.uuid);
    if ( !["armor", "accessory", "consumable", "weapon"].includes(item?.type) ) return;

    // Update Actor detail or permanent Item
    const updateData = {system: {equipment: [...equipment, data.uuid]}};
    if ( this.document.parent instanceof foundry.documents.Actor ) {
      return this._processSubmitData(event, this.form, updateData);
    }
    return this.document.update(updateData);
  }

  
  /* -------------------------------------------- */

  /**
   * @this {CrucibleArchetypeItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveEquipment(event) {
    const item = event.target.closest(".equipment");
    const equipment = new Set(this.document.system.equipment);
    const uuid = item.dataset.uuid;
    equipment.delete(uuid);

    // Update Actor detail or permanent Item
    const updateData = {system: {equipment: [...equipment]}};
    if ( this.document.parent instanceof foundry.documents.Actor ) {
      return this._processSubmitData(event, this.form, updateData);
    }
    return this.document.update(updateData);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    const fields = this.document.system.schema.fields;
    if ( fields.abilities.validate(submitData.system.abilities) === undefined ) {
      submitData.system["==abilities"] = submitData.system.abilities;
    }
    delete submitData.system.abilities;
    return submitData;
  }
}
