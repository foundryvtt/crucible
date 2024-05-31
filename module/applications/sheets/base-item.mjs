import ActionConfig from "../config/action.mjs";
const {api, sheets} = foundry.applications;

/**
 * A base ItemSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleBaseItemSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "standard-form"],
    tag: "form",
    position: {
      width: 560,
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
      template: "templates/generic/tab-navigation.hbs"
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

  static TABS = {
    sheet: [
      {id: "description", group: "sheet", icon: "fa-solid fa-book", label: "ITEM.TABS.DESCRIPTION"},
      {id: "config", group: "sheet", icon: "fa-solid fa-cogs", label: "ITEM.TABS.CONFIGURATION"},
    ],
    description: [
      {id: "public", group: "description", label: "ITEM.TABS.PUBLIC"},
      {id: "private", group: "description", label: "ITEM.TABS.PRIVATE"}
    ]
  }

  /** @override */
  tabGroups = {
    sheet: "description",
    description: "public"
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
    const tabGroups = this._getTabs();
    return {
      item: this.document,
      source: this.document.toObject(),
      fields: this.document.system.schema.fields,
      tabGroups,
      tabs: tabGroups.sheet,
      tabsPartial: this.constructor.PARTS.tabs.template,
      tags: this.document.getTags()
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _preparePartContext(partId, context) {
    switch ( partId ) {
      case "actions":
        const actions = this.document.system.actions;
        if ( actions ) context.actions = this.constructor.prepareActions(actions);
        break;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Configure the tabs used by this sheet, if any.
   * @returns {Record<string, Record<string, ApplicationTab>>}
   * @protected
   */
  _getTabs() {
    const tabs = {};
    for ( const [groupId, config] of Object.entries(this.constructor.TABS) ) {
      const group = {};
      for ( const t of config ) {
        const active = this.tabGroups[t.group] === t.id;
        group[t.id] = Object.assign({active, cssClass: active ? "active" : ""}, t);
      }
      tabs[groupId] = group;
    }
    return tabs;
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
