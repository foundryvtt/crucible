const _apps = foundry.applications;

/**
 * A base ItemSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleBaseItemSheet extends _apps.api.HandlebarsApplicationMixin(_apps.sheets.ItemSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "standard-form"],
    tag: "form",
    position: {
      width: 520,
      height: "auto"
    }
  };

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/partials/item-header.hbs"
    },
    tabs: {
      id: "tabs",
      template: "systems/crucible/templates/sheets/partials/item-tabs.hbs"
    },
    config: {
      id: "config",
      template: undefined // Populated by subclass
    },
    actions: {
      id: "actions",
      template: "systems/crucible/templates/sheets/partials/item-actions.hbs"
    }
  }

  /** @override */
  tabGroups = {
    sheet: "config"
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    const src = "systems/crucible/ui/journal/overlay.webp";
    const overlay = `<img class="background-overlay" alt="Background Overlay" src="${src}">`;
    frame.insertAdjacentHTML("afterbegin", overlay);
    return frame;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    return {
      item: this.document,
      source: this.document.toObject(),
      fields: this.document.system.schema.fields,
      tabs: this._getTabs(),
      tags: this.document.getTags(),
      actions: [] // TODO
    };
  }

  /* -------------------------------------------- */

  /**
   * @typedef {Object} CrucibleSheetTab
   * @property {string} id
   * @property {string} group
   * @property {string} icon
   * @property {string} label
   * @property {boolean} active
   * @property {string} cssClass
   */

  /**
   * Configure the tabs used by this sheet, if any.
   * @returns {Record<string, CrucibleSheetTab>}
   * @protected
   */
  _getTabs() {
    return {}
  }
}
