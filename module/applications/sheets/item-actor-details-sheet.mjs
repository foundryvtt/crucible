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
    const talents = await Promise.all(uuids.map(fromUuid));
    return talents.map(talent => {
      return {
        uuid: talent.uuid,
        name: talent.name,
        img: talent.img,
        description: talent.system.description,
        tags: talent.getTags()
      }
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    if ( !this.isEditable ) return;
    const dropZone = this.element.querySelector(".talent-drop");
    dropZone?.addEventListener("drop", this.#onDropTalent.bind(this));
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle drop events for a talent added to this sheet.
   * @param {DragEvent} event
   * @returns {Promise<*>}
   */
  async #onDropTalent(event) {
    const data = TextEditor.getDragEventData(event);
    const talents = this.document.system.talents;
    if ( (data.type !== "Item") || talents.has(data.uuid) ) return;
    const talent = await fromUuid(data.uuid);
    if ( talent?.type !== "talent" ) return;
    if ( talent.system.node?.tier && (talent.system.node.tier !== 0 ) ) {
      return ui.notifications.error("BACKGROUND.ERRORS.TALENT_TIER", {localize: true});
    }
    await this.document.update({"system.talents": [...talents, data.uuid]});
  }

  /* -------------------------------------------- */

  /**
   * @this {CrucibleActorDetailsItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveTalent(event) {
    const talent = event.target.closest(".talent");
    const talents = new Set(this.document.system.talents);
    const uuid = talent.dataset.uuid;
    if ( !talents.has(uuid) ) return;
    talents.delete(uuid);
    await this.document.update({"system.talents": [...talents]});
  }
}
