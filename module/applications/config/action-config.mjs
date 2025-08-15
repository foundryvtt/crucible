const {api} = foundry.applications;
import CrucibleItem from "../../documents/item.mjs";

/**
 * A configuration application used to configure an Action inside a Talent.
 * This application is used to configure an Action that is owned by an Item.
 * @extends {DocumentSheetV2}
 * @mixes {HandlebarsApplication}
 */
export default class CrucibleActionConfig extends api.HandlebarsApplicationMixin(api.DocumentSheetV2) {
  constructor({action, ...options}={}) {
    const document = action.item;
    if ( !(document instanceof CrucibleItem) ) {
      throw new Error("You may only use the CrucibleActionConfig sheet to configure an Action that belongs to an Item.");
    }
    super({document, ...options});
    this.action = action;
    this.talent = action.parent; // TODO is this right? What about actions on Weapons?
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
      addHook: CrucibleActionConfig.#onAddHook,
      deleteHook: CrucibleActionConfig.#onDeleteHook
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

  /**
   * A template partial used for rendering a Hook inside an Action.
   * @type {string}
   */
  static HOOK_PARTIAL = "systems/crucible/templates/sheets/action/hook.hbs";

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/action/header.hbs",
    },
    tabs: {
      id: "tabs",
      template: "templates/generic/tab-navigation.hbs"
    },
    description: {
      id: "description",
      template: "systems/crucible/templates/sheets/action/description.hbs",
    },
    usage: {
      id: "usage",
      template: "systems/crucible/templates/sheets/action/usage.hbs",
    },
    target: {
      id: "target",
      template: "systems/crucible/templates/sheets/action/target.hbs",
    },
    effects: {
      id: "effects",
      template: "systems/crucible/templates/sheets/action/effects.hbs",
      templates: [CrucibleActionConfig.ACTIVE_EFFECT_PARTIAL]
    },
    hooks: {
      id: "hooks",
      template: "systems/crucible/templates/sheets/action/hooks.hbs",
      templates: [CrucibleActionConfig.HOOK_PARTIAL]
    }
  };

  /**
   * Define the structure of tabs used by this Action Sheet.
   * @type {Record<string, Array<Record<string, ApplicationTab>>>}
   */
  static TABS = {
    sheet: [
      {id: "description", group: "sheet", icon: "fa-solid fa-book", label: "ACTION.TABS.DESCRIPTION"},
      {id: "usage", group: "sheet", icon: "fa-solid fa-cogs", label: "ACTION.TABS.USAGE"},
      {id: "target", group: "sheet", icon: "fa-solid fa-bullseye", label: "ACTION.TABS.TARGET"},
      {id: "effects", group: "sheet", icon: "fa-solid fa-hourglass-clock", label: "ACTION.TABS.EFFECTS"},
      {id: "hooks", group: "sheet", icon: "fa-solid fa-code", label: "ACTION.TABS.HOOKS"}
    ]
  }

  /** @override */
  tabGroups = {
    sheet: "description"
  };

  /* -------------------------------------------- */
  /** @override */
  get title() {
    return `${game.i18n.localize("ACTION.SHEET.TITLE")}: ${this.action.name}`;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preRender(context, options) {
    await super._preRender(context, options);
    const hookPartial = await foundry.applications.handlebars.getTemplate(this.constructor.HOOK_PARTIAL);
    Handlebars.registerPartial(this.constructor.HOOK_PARTIAL, hookPartial, {preventIndent: true});
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    const action = this.action.toObject();
    action.name ||= this.document.name;
    action.img ||= this.document.img;
    const disableHooks = !game.user.isGM;
    return {
      action,
      editable: this.isEditable,
      actionHookChoices: Object.entries(SYSTEM.ACTION_HOOKS).reduce((obj, [k, v]) => {
        if ( !v.deprecated ) obj[k] = k;
        return obj;
      }, {}),
      disableHooks,
      actionHooksHTML: await this.#renderActionHooksHTML(disableHooks),
      fields: this.action.constructor.schema.fields,
      tabs: this.#prepareTabs().sheet,
      headerTags: this.action.tags.map(t => SYSTEM.ACTION.TAGS[t]),
      tags: this.#prepareTags(),
      targetTypes: SYSTEM.ACTION.TARGET_TYPES,
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices,
      effectsHTML: await this.#renderEffectsHTML(),
      hookPartial: CrucibleActionConfig.HOOK_PARTIAL
    }
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
    if ( !game.user.isGM ) delete tabs.sheet.hooks;
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
   * Render HTML used for the action hooks tab.
   * We do this rendering in JavaScript and pass the rendered string into the template to avoid the undesirable
   * auto-indenting caused by rendering this normally as a Handlebars Partial.
   * See https://github.com/handlebars-lang/handlebars.js/issues/858
   * @returns {Promise<string>}
   */
  async #renderActionHooksHTML(disableHooks) {
    const hookHTML = [];
    for ( const [i, h] of this.action.actionHooks.entries() ) {
      const cfg = SYSTEM.ACTION_HOOKS[h.hook];
      const label = this.#getHookLabel(h.hook, cfg);
      const ctx = {i, hook: {label, ...h}, disableHooks};
      const html = await foundry.applications.handlebars.renderTemplate(this.constructor.HOOK_PARTIAL, ctx);
      hookHTML.push(html);
    }
    return hookHTML.join("");
  }

  /* -------------------------------------------- */

  /**
   * Prepare effects data attached to the action.
   * @returns {Promise<string>}
   */
  async #renderEffectsHTML() {
    const effectHTML = [];
    for ( const [i, e] of this.action.effects.entries() ) {
      const html = await this.#renderEffectHTML(i, e);
      effectHTML.push(html);
    }
    return effectHTML.join("");
  }

  /* -------------------------------------------- */

  /**
   * Render HTML for a single effect.
   * @param {number} i
   * @param {ActiveEffectData} effect
   * @returns {Promise<string>}
   */
  async #renderEffectHTML(i, effect) {
    const ctx = {i, effect, statuses: CONFIG.statusEffects, targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices};
    return foundry.applications.handlebars.renderTemplate(this.constructor.ACTIVE_EFFECT_PARTIAL, ctx);
  }

  /* -------------------------------------------- */

  #getHookLabel(hookId, cfg) {
    const argLabels = ["this: CrucibleAction", ...cfg.argLabels].join(", ");
    return `${cfg.async ? "async " : ""}${hookId}(${argLabels})`;
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
    submitData.actionHooks = Object.values(submitData.actionHooks || {});
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
      throw new Error(`Action "${this.action.id}" not identified in the actions array for Item "${this.document.id}"`);
    }
    actions[idx] = submitData;

    // Update actions array
    await this.document.update({[`system.actions`]: actions}, {diff: false});
    // Updating the Item has re-constructed the CrucibleAction object
    // For continuity of this sheet instance, we update the source of this.action so we can re-render accordingly.
    this.action = this.document.actions[idx];
    await this.render();
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Add a status effect to the Action.
   * @this {CrucibleActionConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onAddEffect(_event, target) {
    const html = await this.#renderEffectHTML(foundry.utils.randomID(), {
      scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES,
      placeholder: this.action.name,
      duration: {
        turns: 1
      },
    });
    const section = target.parentElement;
    section.insertAdjacentHTML("beforeend", html);
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Delete a status effect from the Action.
   * @this {CrucibleActionConfig}
   * @param {PointerEvent} event
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
   * Add a new hook function to the Action.
   * @this {ActionConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onAddHook(_event, target) {
    const hookId = target.previousElementSibling.value;
    const html = await foundry.applications.handlebars.renderTemplate(this.constructor.HOOK_PARTIAL, {
      i: foundry.utils.randomID(), // Could be anything
      hook: {
        label: this.#getHookLabel(hookId, SYSTEM.ACTION_HOOKS[hookId]),
        hook: hookId,
        fn: "// Hook code here"
      }
    });
    const section = target.closest("fieldset");
    section.insertAdjacentHTML("beforebegin", html);
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Delete a hook function from the Action.
   * @this {ActionConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onDeleteHook(_event, target) {
    const hook = target.closest(".hook");
    hook.remove();
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }
}
