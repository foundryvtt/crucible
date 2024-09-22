const {api} = foundry.applications;
import CrucibleItem from "../../documents/item.mjs";

/**
 * A configuration application used to configure an Action inside a Talent.
 * This application is used to configure an Action that is owned by an Item.
 * @extends {DocumentSheetV2}
 * @mixes {HandlebarsApplication}
 */
export default class ActionConfig extends api.HandlebarsApplicationMixin(api.DocumentSheetV2) {
  constructor({action, ...options}={}) {
    const document = action.parent.parent;
    if ( !(document instanceof CrucibleItem) ) {
      throw new Error("You may only use the ActionConfig sheet to configure an Action that belongs to an Item.");
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
      editImage: ActionConfig.#onEditImage,
      addEffect: ActionConfig.#onAddEffect,
      deleteEffect: ActionConfig.#onDeleteEffect,
      addHook: ActionConfig.#onAddHook,
      deleteHook: ActionConfig.#onDeleteHook
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
      templates: [ActionConfig.ACTIVE_EFFECT_PARTIAL]
    },
    hooks: {
      id: "hooks",
      template: "systems/crucible/templates/sheets/action/hooks.hbs",
      templates: [ActionConfig.HOOK_PARTIAL]
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

  /** @override */
  async _prepareContext(_options) {
    const action = this.action.toObject();
    action.name ||= this.document.name;
    action.img ||= this.document.img;
    return {
      action,
      editable: this.isEditable,
      actionHookChoices: Object.keys(SYSTEM.ACTION_HOOKS).reduce((obj, k) => {
        obj[k] = k;
        return obj;
      }, {}),
      disableHooks: !game.user.isGM,
      actionHooks: this.#prepareActionHooks(),
      fields: this.action.constructor.schema.fields,
      tabs: this.#prepareTabs().sheet,
      headerTags: this.action.tags.map(t => SYSTEM.ACTION.TAGS[t]),
      tags: this.#prepareTags(),
      targetTypes: SYSTEM.ACTION.TARGET_TYPES,
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices,
      effects: this.#prepareEffects(),
      effectPartial: ActionConfig.ACTIVE_EFFECT_PARTIAL,
      hookPartial: ActionConfig.HOOK_PARTIAL
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
      const cat = SYSTEM.ACTION.TAG_CATEGORIES[t.category];
      const group = cat?.label;
      const selected = this.action.tags.has(t.tag);
      tags.push({value: t.tag, label: t.label, group, selected});
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Prepare effects data attached to the action.
   * @returns {ActionEffect[]}
   */
  #prepareEffects() {
    return this.action.effects.map(effect => {
      effect.statuses ||= [];
      return {...effect,
        placeholder: this.action.name,
        statuses: CONFIG.statusEffects.map(s => {
          return {
            id: s.id,
            label: s.label,
            selected: effect.statuses.includes(s.id) ? "selected" : ""
          }
        })
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for defined action hooks attached to the Action.
   * @returns {{label: string, hook: string, fn: string}[]}
   */
  #prepareActionHooks() {
    return this.action.actionHooks.map(h => {
      const cfg = SYSTEM.ACTION_HOOKS[h.hook];
      const label = this.#getHookLabel(h.hook, cfg);
      return {label, ...h};
    });
  }

  /* -------------------------------------------- */

  #getHookLabel(hookId, cfg) {
    const args = ["action", ...cfg.argNames].join(", ");
    return `${cfg.async ? "async " : ""}${hookId}(${args})`;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    for ( const [i, hook] of context.actionHooks.entries() ) {
      const textarea = this.element[`actionHooks.${i}.fn`];
      // FIXME Why the hell does the textarea keep having excess whitespace inserted every time I render it?
      // FIXME Is it because the hook template is rendered inside a partial?
      textarea.textContent = hook.fn;
    }
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
  _processFormData(event, form, formData) {
    const submitData = foundry.utils.expandObject(formData.object);
    submitData.actionHooks = Object.values(submitData.actionHooks || {});
    submitData.effects = Object.values(submitData.effects || {});

    // Validate Action Data
    let actionData;
    try {
      const a = this.action.clone();
      a.updateSource(submitData);
      actionData = a.toObject();
    } catch(err) {
      throw new Error("Invalid Action Update", {cause: err});
    }

    // Construct Database Update
    const actions = this.document.system.toObject().actions;
    actions.findSplice(a => a.id === this.action.id, actionData);
    return {system: {actions}};
  }

  /* -------------------------------------------- */

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used for a document update
   * @returns {Promise<void>}
   * @protected
   */
  async _processSubmitData(event, form, submitData) {
    await this.document.update(submitData, {diff: false});
    const actionData = submitData.system.actions.find(a => a.id === this.action.id);
    this.action.updateSource(actionData);
    await this.render();
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Edit the Action image.
   * TODO Port this to DocumentSheetV2 and remove this in V13.
   * @this {ActionConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onEditImage(event) {
    const attr = event.target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new FilePicker({
      current,
      type: "image",
      callback: path => {
        event.target.src = path;
        if ( this.options.form.submitOnChange ) {
          const submit = new Event("submit");
          this.element.dispatchEvent(submit);
        }
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    await fp.browse();
  }

  /* -------------------------------------------- */

  /**
   * Add a status effect to the Action.
   * @this {ActionConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onAddEffect(event) {
    const html = await renderTemplate(this.constructor.ACTIVE_EFFECT_PARTIAL, {
      i: foundry.utils.randomID(), // Could be anything
      effect: {
        scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES,
        placeholder: this.action.name,
        duration: {
          turns: 1
        },
        statuses: CONFIG.statusEffects
      },
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices
    });
    const section = event.target.parentElement;
    section.insertAdjacentHTML("beforeend", html);
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Delete a status effect from the Action.
   * @this {ActionConfig}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onDeleteEffect(event) {
    const fieldset = event.target.closest("fieldset.effect");
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
  static async #onAddHook(event) {
    const hookId = event.target.previousElementSibling.value;
    const html = await renderTemplate(this.constructor.HOOK_PARTIAL, {
      i: foundry.utils.randomID(), // Could be anything
      hook: {
        label: this.#getHookLabel(hookId, SYSTEM.ACTION_HOOKS[hookId]),
        hook: hookId,
        fn: "// Hook code here"
      }
    });
    const section = event.target.closest("fieldset");
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
  static async #onDeleteHook(event) {
    const hook = event.target.closest(".hook");
    hook.remove();
    const submit = new Event("submit");
    this.element.dispatchEvent(submit);
  }
}
