const {HandlebarsApplicationMixin, DocumentSheetV2} = foundry.applications.api;
import CrucibleItem from "../../documents/item.mjs";
import {formatHookContext, HOOK_PARTIAL} from "../../hooks/_module.mjs";

/**
 * A configuration application used to configure an Action belonging to an Item or an Affix ActiveEffect.
 * @extends {DocumentSheetV2}
 * @mixes {HandlebarsApplication}
 */
export default class CrucibleActionConfig extends HandlebarsApplicationMixin(DocumentSheetV2) {
  constructor({action, ...options}={}) {
    const parent = action.parent;
    const document = parent?.parent;
    const isItem = document instanceof CrucibleItem;
    const isAffix = (document instanceof foundry.documents.ActiveEffect) && (document.type === "affix");
    if ( !isItem && !isAffix ) throw new Error("CrucibleActionConfig requires an Action belonging to a CrucibleItem"
      + " or an ActiveEffect with the affix type.");
    super({document: parent.parent, ...options});
    this.action = action;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["crucible", "action", "standard-form"],
    tag: "form",
    position: {width: 600, height: "auto"},
    actions: {
      addEffect: CrucibleActionConfig.#onAddEffect,
      deleteEffect: CrucibleActionConfig.#onDeleteEffect,
      hookToggleSource: CrucibleActionConfig.#onHookToggleSource
    },
    form: {
      submitOnChange: true
    },
    sheetConfig: false
  };

  /**
   * A template partial used for rendering an Active Effect inside an Action.
   * @type {string}
   */
  static ACTIVE_EFFECT_PARTIAL = "systems/crucible/templates/sheets/action/effect.hbs";

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/action/header.hbs"
    },
    tabs: {
      id: "tabs",
      template: "templates/generic/tab-navigation.hbs"
    },
    description: {
      id: "description",
      template: "systems/crucible/templates/sheets/action/description.hbs"
    },
    usage: {
      id: "usage",
      template: "systems/crucible/templates/sheets/action/usage.hbs",
      scrollable: [""]
    },
    target: {
      id: "target",
      template: "systems/crucible/templates/sheets/action/target.hbs",
      scrollable: [""]
    },
    effects: {
      id: "effects",
      template: "systems/crucible/templates/sheets/action/effects.hbs",
      templates: [CrucibleActionConfig.ACTIVE_EFFECT_PARTIAL],
      scrollable: [""]
    },
    hooks: {
      id: "hooks",
      template: "systems/crucible/templates/sheets/action/hooks.hbs",
      templates: [HOOK_PARTIAL],
      scrollable: [""]
    }
  };

  /**
   * Define the structure of tabs used by this Action Sheet.
   * @type {Record<string, Array<Record<string, ApplicationTab>>>}
   */
  static TABS = {
    sheet: [
      {id: "description", group: "sheet", icon: "fa-solid fa-book", label: "ACTION.TABS.Description"},
      {id: "usage", group: "sheet", icon: "fa-solid fa-cogs", label: "ACTION.TABS.Usage"},
      {id: "target", group: "sheet", icon: "fa-solid fa-bullseye", label: "ACTION.TABS.Target"},
      {id: "effects", group: "sheet", icon: "fa-solid fa-hourglass-clock", label: "ACTION.TABS.Effects"},
      {id: "hooks", group: "sheet", icon: "fa-solid fa-code", label: "ACTION.TABS.Hooks"}
    ]
  };

  /** @override */
  tabGroups = {
    sheet: "description"
  };

  /**
   * Track which module hooks have their source expanded.
   * @type {Set<string>}
   */
  #expandedHooks = new Set();

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `${_loc("ACTION.SHEET.Title")}: ${this.action.name}`;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    const action = this.action.toObject();
    action.name ||= this.document.name;
    action.img ||= this.document.img;
    return {
      action,
      hookPartial: HOOK_PARTIAL,
      moduleHooks: this.#formatModuleHooks(),
      editable: this.isEditable,
      effectPartial: this.constructor.ACTIVE_EFFECT_PARTIAL,
      effects: this.#prepareEffects(),
      fields: this.action.constructor.schema.fields,
      headerTags: this.action.tags.reduce((acc, tagId) => {
        const tag = SYSTEM.ACTION.TAGS[tagId];
        if ( !tag.internal ) acc[tagId] = tag;
        return acc;
      }, {}),
      isSummon: action.tags.includes("summon"),
      tabs: this.#prepareTabs().sheet,
      tags: this.#prepareTags(),
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices,
      targetTypes: SYSTEM.ACTION.TARGET_TYPES,
      effectDurations: CONST.ACTIVE_EFFECT_DURATION_UNITS.reduce((acc, v) => {
        if ( ["months", "turns"].includes(v) ) return acc;
        return [...acc, {value: v, label: _loc(`EFFECT.DURATION.UNITS.${v}`)}];
      }, []),
      effectExpiryEvents: Object.entries(ActiveEffect.EXPIRY_EVENTS).map(([k, v]) => ({value: k, label: _loc(v)}))
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare effects array for the Action.
   * @returns {object[]}
   */
  #prepareEffects() {
    const effects = this.action.toObject().effects;
    for ( const [i, effect] of effects.entries() ) {
      effect.fieldPath = `effects.${i}`;
    }
    return effects;
  }

  /* -------------------------------------------- */

  /**
   * Configure the tabs used by this sheet.
   * @returns {Record<string, Record<string, ApplicationTab>>}
   */
  #prepareTabs() {
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
   * Prepare tag options and selections for the Action.
   * @returns {FormSelectOption[]>}
   */
  #prepareTags() {
    const tags = [];
    for ( const t of Object.values(SYSTEM.ACTION.TAGS) ) {
      if ( t.internal ) continue;
      const cat = SYSTEM.ACTION.TAG_CATEGORIES[t.category];
      const group = cat?.label;
      const selected = this.action.tags.has(t.tag);
      tags.push({value: t.tag, label: t.label, group, selected});
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Format module-defined hooks for display on the action hooks tab.
   * @returns {{hookId: string, label: string, source: string, expanded: boolean}[]}
   */
  #formatModuleHooks() {
    const moduleHookFns = crucible.api.hooks.action[this.action.id];
    if ( !moduleHookFns ) return [];
    const result = [];
    for ( const h of formatHookContext(moduleHookFns, SYSTEM.ACTION_HOOKS) ) {
      h.expanded = this.#expandedHooks.has(h.hookId);
      result.push(h);
    }
    return result;
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    if ( !event.target.name ) return;
    return super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareSubmitData(event, form, formData, updateData) {

    // Construct action update
    const submitData = foundry.utils.expandObject(formData.object);
    submitData.effects = Object.values(submitData.effects || {});
    foundry.utils.mergeObject(submitData, updateData);

    // Validate action update
    let actionData;
    try {
      const a = this.action.clone();
      a.updateSource(submitData);
      actionData = a.toObject();
    } catch(err) {
      throw new Error("Invalid Action Update", {cause: err});
    }

    // Return the full action object
    return actionData;
  }

  /* -------------------------------------------- */

  /** @override */
  async _processSubmitData(event, form, submitData) {

    // Prepare actions array
    const actions = this.document.system.toObject().actions;
    const idx = actions.findIndex(a => a.id === this.action.id);
    if ( idx === -1 ) {
      throw new Error(`Action "${this.action.id}" not found in the actions array for "${this.document.name}"`);
    }
    actions[idx] = submitData;

    // Update actions array
    await this.document.update({"system.actions": actions}, {diff: false});

    // The update has re-constructed the CrucibleAction object.
    // For continuity of this sheet instance, update the reference so we can re-render accordingly.
    this.action = this.document.system.actions[idx];
    await this.render();
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Add an effect to the Action.
   * @this {CrucibleActionConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   * @returns {Promise<void>}
   */
  static async #onAddEffect(_event, _target) {
    const effects = this.action.toObject().effects;
    effects.push({
      scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES,
      duration: {
        value: 1,
        units: "rounds",
        expiry: "turnEnd"
      }
    });
    this.action.updateSource({effects});
    await this.render();
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Delete a status effect from the Action.
   * @this {CrucibleActionConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onDeleteEffect(_event, target) {
    const fieldset = target.closest("fieldset.effect");
    fieldset.remove();
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Toggle the display of a module-defined hook function source.
   * @this {CrucibleActionConfig}
   * @param {PointerEvent} _event         The initiating click event
   * @param {HTMLElement} target           The clicked button element
   */
  static #onHookToggleSource(_event, target) {
    const fieldset = target.closest(".module-hook");
    const hookId = fieldset.dataset.hookId;
    if ( this.#expandedHooks.has(hookId) ) this.#expandedHooks.delete(hookId);
    else this.#expandedHooks.add(hookId);
    this.render({parts: ["hooks"]});
  }
}
