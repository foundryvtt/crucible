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
      removeTalent: CrucibleActorDetailsItemSheet.#onRemoveTalent
    }
  };

  /**
   * The template partial used to render an included talent.
   * @type {string}
   */
  static INCLUDED_TALENT_TEMPLATE = "systems/crucible/templates/sheets/item/included-talent.hbs";

  /** @override */
  static PARTS = {
    ...super.PARTS,
    talents: {
      id: "talents",
      template: "systems/crucible/templates/sheets/item/item-talents.hbs",
      templates: [this.INCLUDED_TALENT_TEMPLATE],
      scrollable: [".talents-list"]
    }
  };

  /**
   * Define the structure of tabs used by this Item Sheet.
   * @type {Record<string, Array<Record<string, ApplicationTab>>>}
   */
  static TABS = foundry.utils.deepClone(super.TABS);
  static {
    this.TABS.sheet.push({id: "talents", group: "sheet", icon: "fa-solid fa-bookmark", label: "ITEM.TABS.TALENTS"});
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.talents = await this._prepareTalents();
    context.talentPartial = this.constructor.INCLUDED_TALENT_TEMPLATE;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve talents and prepare for rendering.
   * @returns {Promise<object[]>}
   * @protected
   */
  async _prepareTalents() {
    const uuids = this.document.system.talents;
    const promises = [];
    for ( const uuid of uuids ) {
      promises.push(fromUuid(uuid).then(talent => {
        if ( !talent ) return {uuid, name: "INVALID", img: "", description: "", tags: {}};
        return {
          uuid,
          name: talent.name,
          img: talent.img,
          description: talent.system.description,
          tags: talent.getTags()
        }
      }));
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

  /**
   * Handle drop events for a talent added to this sheet.
   * @param {DragEvent} event
   * @returns {Promise<*>}
   */
  async #onDropTalent(event) {
    const data = CONFIG.ux.TextEditor.getDragEventData(event);
    const talents = this.document.system.talents;
    if ( (data.type !== "Item") || talents.has(data.uuid) ) return;
    const talent = await fromUuid(data.uuid);
    if ( talent?.type !== "talent" ) return;
    if ( talent.system.node?.tier && (talent.system.node.tier !== 0 ) ) {
      return ui.notifications.error("BACKGROUND.ERRORS.TALENT_TIER", {localize: true});
    }

    // Update Actor detail or permanent Item
    const updateData = {system: {talents: [...talents, data.uuid]}};
    if ( this.document.parent instanceof foundry.documents.Actor ) {
      return this._processSubmitData(event, this.form, updateData);
    }
    return this.document.update(updateData);
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleActorDetailsItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveTalent(event, target) {
    const talent = target.closest(".talent");
    const talents = new Set(this.document.system.talents);
    const uuid = talent.dataset.uuid;
    talents.delete(uuid);

    // Update Actor detail or permanent Item
    const updateData = {system: {talents: [...talents]}};
    if ( this.document.parent instanceof foundry.documents.Actor ) {
      return this._processSubmitData(event, this.form, updateData);
    }
    return this.document.update(updateData);
  }
}
