import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A common base class for Item types which contribute to Actor details definition:
 * 1. Ancestry
 * 2. Background
 * 3. Archetype
 * 4. Taxonomy
 */
export default class CrucibleActorDetailsItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      removeEquipment: CrucibleActorDetailsItemSheet.#onRemoveEquipment,
      toggleEquipped: CrucibleActorDetailsItemSheet.#toggleEquipped,
      removeTalent: CrucibleActorDetailsItemSheet.#onRemoveTalent,
      removeSpell: CrucibleActorDetailsItemSheet.#onRemoveSpell
    }
  };

  /** @override */
  static PARTS = {
    ...super.PARTS,
    talents: {
      id: "talents",
      template: "systems/crucible/templates/sheets/item/item-talents.hbs",
      scrollable: [".talents-list"]
    }
  };

  /**
   * Define the structure of tabs used by this Item Sheet.
   * @type {Record<string, Array<Record<string, ApplicationTab>>>}
   */
  static TABS = foundry.utils.deepClone(super.TABS);
  static {
    this.TABS.sheet.push({id: "talents", group: "sheet", icon: "fa-solid fa-bookmark", label: "ITEM.TABS.Talents"});
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.talents = await this._prepareTalents();
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve talents and prepare for rendering.
   * @returns {Promise<object[]>}
   * @protected
   */
  async _prepareTalents() {
    const talents = this.document.system.talents;
    const promises = [];
    for ( const [talentIndex, {item: uuid, level}] of talents.entries() ) {
      let talent = await fromUuid(uuid);
      talent ||= new Item.implementation({type: "talent", name: "INVALID"});
      promises.push(talent.renderInline({showRemove: this.isEditable, showLevel: true, talentIndex, level}));
    }
    return Promise.all(promises);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if ( !this.isEditable ) return;
    const dropZone = this.element.querySelector(".talent-drop");
    dropZone?.addEventListener("drop", this.#onDropTalent.bind(this));
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _processSubmitData(event, form, submitData, options) {
    if ( this.document.parent instanceof foundry.documents.Actor ) {
      try {
        const diff = this.document.updateSource(submitData, {dryRun: true, validate: true});
        if ( foundry.utils.isEmpty(diff) ) return;
      } catch(err) {
        ui.notifications.warn(err.message);
        return;
      }

      // Apply the updated detail item
      const item = this.document.clone(submitData);
      await this.document.parent._applyDetailItem(item, {skillTalents: this.document.parent.type === "hero"});

      // Update this document and re-render the sheet
      this.document.updateSource(item.toObject());
      await this.render();
      return;
    }
    return super._processSubmitData(event, form, submitData, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    
    // Handle talent level changes
    if ( submitData.system.talents ) {
      const updatedTalents = [...this.document.system._source.talents];
      for ( const [idx, changes] of Object.entries(submitData.system.talents) ) {
        foundry.utils.mergeObject(updatedTalents[idx], changes);
      }
      submitData.system.talents = updatedTalents;
    }
    return submitData;
  }

  /* -------------------------------------------- */

  /**
   * Handle drop events for a talent added to this sheet.
   * @param {DragEvent} event
   * @returns {Promise<*>}
   */
  async #onDropTalent(event) {
    const data = CONFIG.ux.TextEditor.getDragEventData(event);
    const talents = this.document.system.talents;
    if ( (data.type !== "Item") ) return;
    if ( talents.some(({item}) => item === data.uuid) ) return;
    const talent = await fromUuid(data.uuid);
    if ( talent?.type !== "talent" ) {
      ui.notifications.warn("ITEM.WARNINGS.NotTalent", {localize: true});
      return;
    }
    if ( talent.system.node?.tier && (talent.system.node.tier !== 0 ) ) {
      return ui.notifications.error("BACKGROUND.ERRORS.TalentTier", {localize: true});
    }
    const tier = talent.system.nodes.reduce((minTier, node) => (minTier < node.tier) ? minTier : node.tier, Infinity);
    const updateData = {
      system: {
        talents: [...talents, {item: data.uuid, level: SYSTEM.TALENT.NODE_TIERS[tier]?.level ?? null}]
      }
    };
    return this._processSubmitData(event, this.form, updateData);
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleActorDetailsItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveTalent(event, target) {
    const talent = target.closest(".talent");
    const talents = new Set(this.document.system.talents);
    const uuid = talent.dataset.uuid || null;
    const toDelete = talents.find(({item}) => item === uuid);
    talents.delete(toDelete);
    const updateData = {system: {talents: [...talents]}};
    return this._processSubmitData(event, this.form, updateData);
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleActorDetailsItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #toggleEquipped(event) {
    const item = event.target.closest(".equipment");
    const equipment = this.document.system.equipment;
    const uuid = item.dataset.uuid;
    const existingItem = equipment.find(i => i.item === uuid);
    existingItem.equipped = !existingItem.equipped;
    const updateData = {system: {equipment}};
    return this._processSubmitData(event, this.form, updateData);
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleActorDetailsItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveEquipment(event) {
    const item = event.target.closest(".equipment");
    const uuid = item.dataset.uuid || null;
    const equipment = this.document.system._source.equipment.filter(i => i.item !== uuid);
    const updateData = {system: {equipment}};
    return this._processSubmitData(event, this.form, updateData);
  }

  /* -------------------------------------------- */

  static async #onRemoveSpell(event, target) {
    const spell = target.closest(".spell");
    const uuid = spell.dataset.uuid;
    const spells = this.document.system._source.spells.filter(i => i.item !== uuid);
    const updateData = {system: {spells}};
    return this._processSubmitData(event, this.form, updateData);
  }
}
