import CrucibleBackgroundItemSheet from "./item-background-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "archetype" type.
 */
export default class CrucibleArchetypeItemSheet extends CrucibleBackgroundItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "archetype"
    }
  };

  /**
   * The template partial used to render an included equipment item.
   * @type {string}
   */
  // TODO: Move over to using item#renderInline for this
  static INCLUDED_EQUIPMENT_TEMPLATE = "systems/crucible/templates/sheets/item/included-equipment.hbs";

  /** @override */
  static PARTS = {
    ...super.PARTS,
    equipment: {
      id: "equipment",
      template: "systems/crucible/templates/sheets/item/item-equipment.hbs",
      templates: [this.INCLUDED_EQUIPMENT_TEMPLATE],
      scrollable: [".equipment-list"]
    },
    spells: {
      id: "spells",
      template: "systems/crucible/templates/sheets/item/item-spells.hbs",
      scrollable: [".spells-list"]
    }
  };

  /** @inheritDoc */
  static TABS = foundry.utils.deepClone(super.TABS);
  static {
    this.TABS.sheet.push({id: "equipment", group: "sheet", icon: "fa-solid fa-suitcase", label: "ITEM.TABS.Equipment"});
    this.TABS.sheet.push({id: "spells", group: "sheet", icon: "fa-solid fa-wand-magic-sparkles", label: "ITEM.TABS.Spells"});
  }

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
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
      equipmentPartial: this.constructor.INCLUDED_EQUIPMENT_TEMPLATE,

      // TODO: Make use of each spell's `level` in UI
      spells: await this._prepareSpells()
    });
  }

  /* -------------------------------------------- */

  /**
   * Retrieve equipment and prepare for rendering.
   * @returns {Promise<{uuid: string, name: string, img: string, description: string, tags: object[], quantity: number, equipped: boolean}>}
   * @protected
   */
  async _prepareEquipment() {
    const equipment = this.document.system.equipment;
    const promises = [];
    for ( const {item: uuid, quantity, equipped} of equipment ) {
      promises.push(fromUuid(uuid).then(item => {
        if ( !item ) return {uuid, name: "INVALID", img: "", description: "", tags: {}, quantity: 1, equipped: false};
        return {
          uuid,
          name: item.name,
          img: item.img,
          description: item.system.description.public,
          tags: item.getTags(),
          cssClass: [item.type, equipped ? "equipped" : ""].filterJoin(" "),
          quantity,
          equipped
        };
      }));
    }
    return Promise.all(promises);
  }

  /* -------------------------------------------- */

  /**
   * Retrieve spells and prepare for rendering
   * @returns {Promise<{uuid: string, name: string, img: string, description: string, tags: object[], item: string}>}
   */
  async _prepareSpells() {
    const spells = this.document.system.spells;
    const promises = spells.map(async ({item: uuid, level}) => {
      const spell = await fromUuid(uuid);
      if ( !spell ) return {uuid, name: "INVALID", img: "", description: "", tags: {}};
      return {
        uuid,
        name: spell.name,
        img: spell.img,
        description: spell.system.description,
        tags: spell.getTags(),
        item: await spell.renderInline({showRemove: this.isEditable}),
        level
      };
    });
    return Promise.all(promises);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#updateAbilitySum();
    if ( !this.isEditable ) return;
    const dropZoneEquipment = this.element.querySelector(".equipment-drop");
    dropZoneEquipment?.addEventListener("drop", this.#onDropEquipment.bind(this));
    const dropZoneSpells = this.element.querySelector(".spell-drop");
    dropZoneSpells?.addEventListener("drop", this.#onDropSpell.bind(this));
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
    if ( (data.type !== "Item") || equipment.map(e => e.item).includes(data.uuid) ) return;
    const item = await fromUuid(data.uuid);
    if ( !(item?.system instanceof crucible.api.models.CruciblePhysicalItem) ) {
      ui.notifications.warn("ARCHETYPE.WARNINGS.NotEquipment", {localize: true});
      return;
    }

    // Update Actor detail or permanent Item
    const updateData = {system: {equipment: [...equipment, {item: data.uuid, quantity: item.system.quantity ?? 1, equipped: !!item.system.equipped}]}};
    if ( this.document.parent instanceof foundry.documents.Actor ) {
      return this._processSubmitData(event, this.form, updateData);
    }
    return this.document.update(updateData);
  }

  /* -------------------------------------------- */

  /**
   * Handle drop events for a spell item added to this sheet
   * @param {DragEvent} event 
   * @returns {Promise<*>}
   */
  async #onDropSpell(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    const spells = this.document.system.spells;
    if ( (data.type !== "Item") || spells.some(s => s.item === data.uuid) ) return;
    const spell = await fromUuid(data.uuid);
    if ( !(spell?.system instanceof crucible.api.models.CrucibleSpellItem) ) {
      ui.notifications.warn("ARCHETYPE.WARNINGS.NotSpell", {localize: true});
      return;
    }

    // Update Actor detail or permanent Item
    const talents = this.document.system.talents;
    const components = [
      {cls: crucible.api.models.CrucibleSpellcraftRune, required: spell.system.runes},
      {cls: crucible.api.models.CrucibleSpellcraftGesture, required: spell.system.gestures},
      {cls: crucible.api.models.CrucibleSpellcraftInflection, required: spell.system.inflections}
    ];
    const requisiteTalents = [];
    for ( const {cls, required} of components ) {
      for ( const component of required ) {
        const grantingTalents = cls.grantingTalents[component];
        if ( grantingTalents.some(({uuid}) => talents.some(t => t.item === uuid)) ) continue;
        const minTalent = cls.getGrantingTalent(component);
        requisiteTalents.push({item: minTalent.uuid, level: SYSTEM.TALENT.NODE_TIERS[minTalent.tier].level});
      }
    }
    const updateData = {system: {spells: [...spells, {item: data.uuid}]}};
    if ( requisiteTalents.length ) {
      const addRequisites = await foundry.applications.api.Dialog.confirm({
        window: {title: "SPELL.SHEET.Knowledge"},
        content: game.i18n.format("ARCHETYPE.SHEET.RequiredComponents", {spell: spell.name})
      });
      if ( addRequisites ) {
        updateData.system.talents = [...talents, ...requisiteTalents];
      }
    }
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

    // Handle equipment quantity changes
    if ( submitData.system.equipment ) {
      const updatedEquipment = [...this.document.system._source.equipment];
      for ( const [idx, changes] of Object.entries(submitData.system.equipment) ) {
        foundry.utils.mergeObject(updatedEquipment[idx], changes);
      }
      submitData.system.equipment = updatedEquipment;
    }

    // Force replace ability progression
    if ( fields.abilities.validate(submitData.system.abilities) === undefined ) {
      submitData.system["==abilities"] = submitData.system.abilities;
    }
    delete submitData.system.abilities;
    return submitData;
  }
}
