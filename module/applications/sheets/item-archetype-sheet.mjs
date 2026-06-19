import CrucibleBackgroundItemSheet from "./item-background-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "archetype" type.
 */
export default class CrucibleArchetypeItemSheet extends CrucibleBackgroundItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "archetype",
      includesEquipment: true
    }
  };

  /** @override */
  static PARTS = {
    ...super.PARTS,
    spells: {
      id: "spells",
      template: "systems/crucible/templates/sheets/item/item-spells.hbs",
      scrollable: [".spells-list"]
    }
  };

  /** @override */
  static TABS = foundry.utils.deepClone(super.TABS);

  static {
    this._initializeItemSheetClass();
    this.TABS.sheet.tabs.push({id: "spells", icon: "fa-solid fa-wand-magic-sparkles"});
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

      // TODO: Make use of each spell's `level` in UI
      spells: await this._prepareSpells()
    });
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
    const dropZoneSpells = this.element.querySelector(".spell-drop");
    dropZoneSpells?.addEventListener("drop", this.#onDropSpell.bind(this));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const group = event.target.closest(".form-group");
    if ( group?.classList.contains("abilities") ) this.#updateAbilitySum();
  }

  /* -------------------------------------------- */

  /**
   * Update the indicator for whether the ability configuration for the Archetype is valid.
   */
  #updateAbilitySum() {
    const abilities = this.element.querySelector(".abilities");
    const inputs = abilities.querySelectorAll("input[type=number]");
    const total = this._sumValidatedInputs(inputs);
    const valid = total === 12;
    const icon = valid ? "fa-solid fa-check" : "fa-solid fa-times";
    const span = abilities.querySelector(".sum");
    span.innerHTML = `${total} <i class="${icon}"></i>`;
    span.classList.toggle("invalid", !valid);
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
      ui.notifications.warn(_loc("ARCHETYPE.WARNINGS.NotSpell"));
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
        content: _loc("ARCHETYPE.SHEET.RequiredComponents", {spell: spell.name})
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

    // Force replace ability progression
    if ( fields.abilities.validate(submitData.system.abilities) === undefined ) {
      submitData.system.abilities = _replace(submitData.system.abilities);
    } else {
      delete submitData.system.abilities;
    }
    return submitData;
  }
}
