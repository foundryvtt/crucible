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

  /**
   * Define the structure of tabs used by this Item Sheet.
   * @type {Record<string, Record<string, ApplicationTab>>}
   */
  static TABS = {
    sheet: [
      {id: "description", group: "sheet", icon: "fa-solid fa-book", label: "ITEM.TABS.DESCRIPTION"},
      {id: "config", group: "sheet", icon: "fa-solid fa-cogs", label: "ITEM.TABS.CONFIGURATION"}
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
  /*  HTML Rendering Helpers
  /* -------------------------------------------- */

  /**
   * A helper for quickly creating HTML elements.
   * @returns {HTMLElement}
   * @internal
   */
  static _createElement(tagName, {innerText, className}={}) {
    const el = document.createElement(tagName);
    if ( innerText ) el.innerText = innerText;
    if ( className ) el.className = className;
    return el;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  #getSubmitData(event) {
    const fd = new FormDataExtended(this.element);
    return this._prepareSubmitData(event, this.element, fd);
  }

  /* -------------------------------------------- */

  /**
   * Add a new Action to the Item.
   * @this {CrucibleBaseItemSheet}
   * @param {PointerEvent} event          The initiating click event
   * @returns {Promise<void>}
   */
  static async #onActionAdd(event) {
    const fd = this.#getSubmitData(event);
    const actions = this.document.system.toObject().actions;

    // Configure Action data
    const suffix = actions.length ? actions.length + 1 : "";
    const actionData = {id: crucible.api.methods.generateId(this.document.name)};
    if ( actions.length ) {
      actionData.id += suffix;
      actionData.name = `${this.object.name} ${suffix}`
    }

    // Add data to the actions array
    actions.push(crucible.api.models.CrucibleAction.cleanData(actionData));
    fd.system.actions = actions;
    await this.document.update(fd);

    // Render the action configuration sheet
    const action = this.document.actions.find(a => a.id === actionData.id);
    await action.sheet.render(true);
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
    const actionId = button.closest(".action").dataset.actionId;
    const idx = this.document.system.actions.findIndex(a => a.id === actionId);
    const action = this.document.system.actions[idx];
    if ( !action ) throw new Error(`Invalid Action id "${actionId}" requested for deletion`);

    // Prompt for confirmation
    const confirm = await api.DialogV2.confirm({
      title: game.i18n.format("ACTION.ACTIONS.DELETE", {name: action.name}),
      content: `<p>${game.i18n.format("ACTION.ACTIONS.DELETE_CONFIRM", {
        name: action.name, 
        parent: this.document.name,
        type: game.i18n.localize(CONFIG.Item.typeLabels[this.document.type])
      })}</p>`
    });
    if ( !confirm ) return;
    if ( action.sheet.rendered ) action.sheet.close();

    // Remove the action and save
    const fd = this.#getSubmitData(event);
    const actions = this.document.system.toObject().actions;
    actions.splice(idx, 1);
    fd.system.actions = actions;
    await this.document.update(fd);
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
    await action.sheet.render(true);
  }
}
