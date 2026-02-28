const {api, sheets} = foundry.applications;
import CruciblePhysicalItem from "../../models/item-physical.mjs";

/**
 * A base ItemSheet built on top of ApplicationV2 and the Handlebars rendering backend.
 */
export default class CrucibleBaseItemSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "item", "standard-form"],
    tag: "form",
    position: {
      width: 560,
      height: "auto"
    },
    actions: {
      actionAdd: CrucibleBaseItemSheet.#onActionAdd,
      actionDelete: CrucibleBaseItemSheet.#onActionDelete,
      actionEdit: CrucibleBaseItemSheet.#onActionEdit,
      hookAdd: CrucibleBaseItemSheet.#onHookAdd,
      hookDelete: CrucibleBaseItemSheet.#onHookDelete,
      expandSection: CrucibleBaseItemSheet.#onExpandSection
    },
    form: {
      submitOnChange: true
    },
    item: {
      type: undefined, // Defined by subclass
      includesActions: false,
      includesHooks: false,
      hasAdvancedDescription: false
    },
    window: {
      resizable: true
    }
  };

  /**
   * A template path used to render a single action.
   * @type {string}
   */
  static ACTION_PARTIAL = "systems/crucible/templates/sheets/item/included-action.hbs";

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/item/item-header.hbs"
    },
    tabs: {
      id: "tabs",
      template: "templates/generic/tab-navigation.hbs"
    },
    description: {
      id: "description",
      template: "systems/crucible/templates/sheets/item/item-description.hbs"
    },
    config: {
      id: "config",
      template: undefined // Populated during _initializeItemSheetClass
    }
  };

  /**
   * Define the structure of tabs used by this Item Sheet.
   * @type {Record<string, Array<Record<string, ApplicationTab>>>}
   */
  static TABS = {
    sheet: [
      {id: "description", group: "sheet", icon: "fa-solid fa-book", label: "ITEM.TABS.Description"},
      {id: "config", group: "sheet", icon: "fa-solid fa-cogs", label: "ITEM.TABS.Configuration"}
    ]
  };

  /** @override */
  tabGroups = {
    sheet: "description"
  };

  /* -------------------------------------------- */

  /**
   * A method which can be called by subclasses in a static initialization block to refine configuration options at the
   * class level.
   */
  static _initializeItemSheetClass() {
    const item = this.DEFAULT_OPTIONS.item;
    this.PARTS = foundry.utils.deepClone(this.PARTS);
    this.TABS = foundry.utils.deepClone(this.TABS);

    // Item Type Configuration
    this.DEFAULT_OPTIONS.classes = [this.DEFAULT_OPTIONS.item.type];
    this.PARTS.config.template = `systems/crucible/templates/sheets/item/${item.type}-config.hbs`;

    // Includes Actions
    if ( item.includesActions ) {
      this.PARTS.actions = {
        id: "actions",
        template: "systems/crucible/templates/sheets/item/item-actions.hbs",
        templates: [this.ACTION_PARTIAL],
        scrollable: [""]
      };
      this.TABS.sheet.push({id: "actions", group: "sheet", icon: "fa-solid fa-bullseye", label: "ITEM.TABS.Actions"});
    }

    // Includes Hooks
    if ( item.includesHooks ) {
      this.PARTS.hooks = {
        id: "hooks",
        template: "systems/crucible/templates/sheets/item/item-hooks.hbs",
        scrollable: [""]
      };
      this.TABS.sheet.push({id: "hooks", group: "sheet", icon: "fa-solid fa-cogs", label: "ITEM.TABS.Hooks"});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( this.options.item.includesHooks && !game.user.isGM ) {
      options.parts.findSplice(p => p === "hooks");
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const tabGroups = this._getTabs();
    const source = this.document.toObject();
    const context = {
      item: this.document,
      source,
      system: source.system,
      isEditable: this.isEditable,
      fieldDisabled: this.isEditable ? "" : "disabled",
      fields: this.document.system.schema.fields,
      hasAdvancedDescription: this.options.item.hasAdvancedDescription,
      tabGroups,
      tabs: tabGroups.sheet,
      tabsPartial: this.constructor.PARTS.tabs.template,
      tags: this.document.getTags()
    };

    // Physical Items
    if ( this.document.system instanceof CruciblePhysicalItem ) {
      context.isPhysical = true;
      context.propertiesWidget = this.#propertiesWidget.bind(this);
      context.currencyInput = this.#currencyInput.bind(this);
      context.scaledPriceField = new foundry.data.fields.StringField({label: game.i18n.localize("ITEM.SHEET.ScaledPrice")});
      context.requiresInvestment = source.system.equipped && this.document.system.properties.has("investment");
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preparePartContext(partId, context) {
    switch ( partId ) {
      case "actions":
        context.actionPartial = this.constructor.ACTION_PARTIAL;
        context.actions = await this.document.prepareActionsContext();
        break;
      case "description":
        const editorCls = CONFIG.ux.TextEditor;
        const editorOptions = {relativeTo: this.document, secrets: this.document.isOwner};
        if ( this.options.item.hasAdvancedDescription ) {
          const {public: publicSrc, private: privateSrc} = context.source.system.description;
          context.description = {
            tab: context.tabs.description,
            fields: context.fields.description.fields,
            publicSrc,
            publicHTML: await editorCls.enrichHTML(publicSrc, editorOptions),
            publicClass: publicSrc ? "" : "empty",
            privateSrc,
            privateHTML: await editorCls.enrichHTML(privateSrc, editorOptions),
            privateClass: privateSrc ? "" : "empty"
          };
        } else {
          const src = context.source.system.description;
          context.description = {
            tab: context.tabs.description,
            field: context.fields.description,
            publicSrc: src,
            publicHTML: await editorCls.enrichHTML(src, editorOptions)
          };
        }
        break;
      case "hooks":
        context.actorHooks = this.#prepareActorHooks();
        context.actorHookChoices = Object.entries(SYSTEM.ACTOR.HOOKS).map(([hookId, cfg]) => ({
          value: hookId,
          label: hookId,
          group: game.i18n.localize(cfg.group),
          disabled: hookId in context.actorHooks
        }));
        break;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for the actor hooks currently registered by this item.
   * @returns {Record<string, {label: string, signature: string, argNames: string[]}>}
   */
  #prepareActorHooks() {
    const hooks = {};
    for ( const h of this.document.system.actorHooks ) {
      const cfg = SYSTEM.ACTOR.HOOKS[h.hook];
      const label = `${h.hook}(item, ${cfg.argNames.join(", ")})`;
      hooks[h.hook] = {label, ...h};
    }
    return hooks;
  }

  /* -------------------------------------------- */

  /**
   * Render the properties field as a multi-checkboxes element.
   * @param {foundry.data.fields.DataField} field
   * @param {object} groupConfig
   * @param {object} inputConfig
   * @returns {HTMLMultiCheckboxElement}
   */
  #propertiesWidget(field, groupConfig, inputConfig) {
    inputConfig.name = field.fieldPath;
    const PROPERTIES = this.document.system.constructor.ITEM_PROPERTIES;
    inputConfig.options = Object.entries(PROPERTIES).map(([k, v]) => ({value: k, label: v.label}));
    inputConfig.type = "checkboxes";
    return foundry.applications.fields.createMultiSelectInput(inputConfig);
  }

  /* -------------------------------------------- */

  /**
   * Render a price field using a HTMLCrucibleCurrencyElement element.
   * @param {foundry.data.fields.DataField} field
   * @param {object} inputConfig
   * @returns {HTMLCrucibleCurrencyElement}
   */
  #currencyInput(field, inputConfig) {
    return crucible.api.applications.elements.HTMLCrucibleCurrencyElement.create(inputConfig);
  }

  /* -------------------------------------------- */

  /**
   * Configure the tabs used by this sheet.
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

    // Description style
    const adv = this.options.item.hasAdvancedDescription;
    tabs.sheet.description.cssClass = [
      tabs.sheet.description.cssClass,
      "biography",
      "description",
      adv ? "description-advanced" : ""
    ].filterJoin(" ");

    // Restrict access to hooks
    if ( !game.user.isGM ) delete tabs.sheet.hooks;
    return tabs;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Prepare submission data for the form when needed as a side effect of some other workflow.
   * @param {Event} event
   * @returns {object}
   * @protected
   */
  _getSubmitData(event) {
    const fd = new foundry.applications.ux.FormDataExtended(this.element);
    return this._prepareSubmitData(event, this.element, fd);
  }

  /* -------------------------------------------- */

  /** @override */
  _processFormData(event, form, formData) {
    const submitData = foundry.utils.expandObject(formData.object);
    if ( this.options.item.includesHooks ) {
      submitData.system.actorHooks = Object.values(submitData.system.actorHooks || {});
    }
    return submitData;
  }

  /* -------------------------------------------- */

  /**
   * Add a new Action to the Item.
   * @this {CrucibleBaseItemSheet}
   * @param {PointerEvent} event          The initiating click event
   * @returns {Promise<void>}
   */
  static async #onActionAdd(event) {
    const fd = this._getSubmitData(event);
    const actions = this.document.system.toObject().actions;

    // Configure Action data
    const suffix = actions.length ? actions.length + 1 : "";
    const actionData = {id: crucible.api.methods.generateId(this.document.name)};
    if ( actions.length ) {
      actionData.id += suffix;
      actionData.name = `${this.document.name} ${suffix}`;
    }

    // Add data to the actions array
    const action = new crucible.api.models.CrucibleAction(actionData, {parent: this.document.system});
    actions.push(action.toObject());
    fd.system.actions = actions;
    await this.document.update(fd);

    // Render the action configuration sheet
    await action.sheet.render({force: true});
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
      title: game.i18n.format("ACTION.ACTIONS.Delete", {name: action.name}),
      content: `<p>${game.i18n.format("ACTION.ACTIONS.DeleteConfirm", {
        name: action.name,
        parent: this.document.name,
        type: game.i18n.localize(CONFIG.Item.typeLabels[this.document.type])
      })}</p>`
    });
    if ( !confirm ) return;
    if ( action.sheet.rendered ) action.sheet.close();

    // Remove the action and save
    const fd = this._getSubmitData(event);
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

  /* -------------------------------------------- */

  /**
   * Expand or collapse a sheet section, collapsing sibling sections when expanding.
   * @this {CrucibleBaseItemSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onExpandSection(_event, target) {
    const section = target.closest(".sheet-section");
    const wasExpanded = section.classList.contains("expanded");
    if ( wasExpanded ) {
      for ( const s of section.parentElement.children ) s.classList.remove("expanded", "collapsed");
      return;
    }
    for ( const s of section.parentElement.children ) {
      s.classList.toggle("expanded", s === section);
      s.classList.toggle("collapsed", s !== section);
    }
  }

  /* -------------------------------------------- */

  /**
   * Add a new hooked function to this Talent.
   * @this {CrucibleTalentItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onHookAdd(event, target) {
    const hook = target.previousElementSibling.value;
    const submitData = this._getSubmitData(event);
    submitData.system.actorHooks ||= [];
    if ( submitData.system.actorHooks.find(h => h.hook === hook ) ) {
      ui.notifications.warn(`${this.document.name} already declares a function for the "${hook}" hook.`);
      return;
    }
    submitData.system.actorHooks.push({hook, fn: "// Hook code here"});
    await this.document.update(submitData);
  }

  /* -------------------------------------------- */

  /**
   * Delete a hooked function from this Talent.
   * @this {CrucibleTalentItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onHookDelete(event, target) {
    const hook = target.closest(".hook").querySelector("input[type=hidden]").value;
    const submitData = this._getSubmitData(event);
    submitData.system.actorHooks.findSplice(h => h.hook === hook);
    await this.document.update(submitData);
  }
}
