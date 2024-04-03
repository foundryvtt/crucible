import ActionConfig from "../config/action.mjs";

const _apps = foundry.applications;

/**
 * A base ItemSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleBaseItemSheet extends _apps.api.HandlebarsApplicationMixin(_apps.sheets.ItemSheet) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "standard-form"],
    tag: "form",
    position: {
      width: 520,
      height: "auto"
    },
    actions: {
      "actionAdd": CrucibleBaseItemSheet.#onActionAdd,
      "actionDelete": CrucibleBaseItemSheet.#onActionDelete,
      "actionEdit": CrucibleBaseItemSheet.#onActionEdit
    },
    form: {
      submitOnChange: true
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
    description: {
      id: "description",
      template: "systems/crucible/templates/sheets/partials/item-description.hbs"
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
    sheet: "description"
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
    const context = {
      item: this.document,
      source: this.document.toObject(),
      fields: this.document.system.schema.fields,
      tabs: this._getTabs(),
      tags: this.document.getTags()
    };
    const actions = this.document.system.actions;
    if ( actions ) context.actions = this.constructor.prepareActions(actions);
    return context;
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

  /* -------------------------------------------- */

  /**
   * Prepare an array of actions for sheet rendering.
   * @param {CrucibleAction[]} actions    The actions being rendered
   * @returns {object[]}                  An object of data suitable for sheet rendering
   */
  static prepareActions(actions) {
    return actions.map(action => ({
      id: action.id,
      name: action.name,
      img: action.img,
      condition: action.condition,
      description: action.description,
      tags: action.getTags(),
      effects: action.effects.map(effect => ({
        name: action.name,
        tags: {
          scope: `Affects ${SYSTEM.ACTION.TARGET_SCOPES.label(effect.scope || action.target.scope)}`,
          duration: effect.duration?.rounds ? `${effect.duration.rounds}R` : "Until Ended"
        }
      }))
    }));
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Add a new Action to the Item.
   * @this {CrucibleBaseItemSheet}
   * @param {PointerEvent} event          The initiating click event
   * @returns {Promise<void>}
   */
  static async #onActionAdd(event) {
    // TODO
    // const fd = this._getSubmitData({});
    // const actions = this.object.toObject().system.actions;
    //
    // // Create a new Action
    // const suffix = actions.length ? actions.length + 1 : "";
    // const actionData = {id: game.system.api.methods.generateId(this.object.name)};
    // if ( actions.length ) {
    //   actionData.id += suffix;
    //   actionData.name = `${this.object.name} ${suffix}`
    // }
    // const action = new game.system.api.models.CrucibleAction(actionData, {parent: this.object.system});
    //
    // // Update the Talent
    // actions.push(action.toObject());
    // fd.system.actions = actions;
    // await this._updateObject(event, fd);
    //
    // // Render the action configuration sheet
    // await (new ActionConfig(action)).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Delete an Action from the Item.
   * @this {CrucibleBaseItemSheet}
   * @param {PointerEvent} event          The initiating click event
   * @param {HTMLAnchorElement} button    The clicked button element
   * @returns {Promise<void>}
   */
  static async #onActionDelete(event, button) {
    // TODO
  //   const actionId = button.closest(".action").dataset.actionId;
  //   const actions = this.object.toObject().system.actions;
  //   const action = actions.findSplice(a => a.id === actionId);
  //   const confirm = await Dialog.confirm({
  //     title: `
  // }Delete Action: ${action.name}`,
  //     content: `<p>Are you sure you wish to delete the <strong>${action.name}</strong> action from the <strong>${this.object.name}</strong> Talent?</p>`
  //   });
  //   if ( confirm ) {
  //     const fd = this._getSubmitData({});
  //     fd.system.actions = actions;
  //     await this._updateObject(event, fd);
  //   }
  }

  /* -------------------------------------------- */

  /**
   * Edit an Action from the Item.
   * @this {CrucibleBaseItemSheet}
   * @param {PointerEvent} event          The initiating click event
   * @param {HTMLAnchorElement} button    The clicked button element
   * @returns {Promise<void>}
   */
  static async #onActionEdit(event, button) {
    const actionId = button.closest(".action").dataset.actionId;
    const action = this.document.system.actions.find(a => a.id === actionId);
    await (new ActionConfig(action)).render(true);
  }
}
