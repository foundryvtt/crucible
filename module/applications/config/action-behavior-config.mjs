/**
 * @import RegionBehaviorConfig from "@client/applications/sheets/region-behavior-config.mjs";
 * @import {DocumentSheetConfiguration, DocumentSheetRenderOptions} from "@client/applications/api/document-sheet.mjs";
 */

/**
 * @typedef _ActionBehaviorRenderOptions
 * @property {boolean} [preconfigure]  Render to pre-configure the Region Behavior of an Action, rather than a real one
 * @property {string} [actionId]       The id of the Action being pre-configured
 * @property {ClientDocument} [parent] The CrucibleItem or affix ActiveEffect which records that Action
 */

/** @typedef {DocumentSheetRenderOptions & _ActionBehaviorRenderOptions} ActionBehaviorRenderOptions */

/**
 * The Region Behavior configuration application specific to Crucible Action behaviors.
 * @extends {RegionBehaviorConfig<DocumentSheetConfiguration, ActionBehaviorRenderOptions>}
 */
export default class CrucibleActionBehaviorRegionConfig extends foundry.applications.sheets.RegionBehaviorConfig {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      addEffect: CrucibleActionBehaviorRegionConfig.#onAddEffect,
      deleteEffect: CrucibleActionBehaviorRegionConfig.#onDeleteEffect,
      editImage: CrucibleActionBehaviorRegionConfig.#onEditImage
    },
    classes: ["crucible", "action-behavior", "action", "standard-form"],
    position: {width: 600, height: "auto"},
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
    sheetConfig: false
  };

  /**
   * A template partial used for rendering an Active Effect inside this Region Behavior.
   * @type {string}
   */
  static ACTIVE_EFFECT_PARTIAL = "systems/crucible/templates/sheets/action/effect.hbs";

  /** @override */
  static PARTS = {
    header: {
      id: "header",
      template: "systems/crucible/templates/sheets/region-behavior/action-behavior-header.hbs"
    },
    tabs: {
      id: "tabs",
      template: "templates/generic/tab-navigation.hbs"
    },
    action: {
      id: "action",
      template: "systems/crucible/templates/sheets/region-behavior/action-behavior-action.hbs"
    },
    effects: {
      id: "effects",
      template: "systems/crucible/templates/sheets/region-behavior/action-behavior-effects.hbs",
      templates: [CrucibleActionBehaviorRegionConfig.ACTIVE_EFFECT_PARTIAL],
      scrollable: [""]
    },
    behavior: {
      id: "behavior",
      template: "systems/crucible/templates/sheets/region-behavior/action-behavior-behavior.hbs"
    }
  };

  /** @override */
  static TABS = {
    sheet: {
      tabs: [
        {id: "action", icon: "fa-solid fa-book"},
        {id: "effects", icon: "fa-solid fa-hourglass-clock"},
        {id: "behavior", icon: "fa-solid fa-gear"}
      ],
      initial: "action",
      labelPrefix: "REGION_BEHAVIORS.ACTION.TABS"
    }
  };

  /**
   * The Action for which this Application pre-configures a Region Behavior, captured from render options.
   * @type {{actionId: string, parent: ClientDocument}|null}
   */
  #preconfigure = null;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return _loc("REGION_BEHAVIORS.ACTION.ConfigTitle", {action: this.document.name});
  }

  /* -------------------------------------------- */

  /**
   * Does the represented Region Behavior exist purely for pre-configuration?
   * @type {boolean}
   */
  get isSynthetic() {
    return !this.document.collection?.has(this.document.id);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  get isEditable() {
    if ( this.isSynthetic ) return this.#preconfigure?.parent.isOwner ?? false;
    return super.isEditable;
  }

  /* -------------------------------------------- */

  /**
   * A synthetic behavior has no parent Region to derive permission from, and is only ever opened from an Action
   * config which already tested it. Edit permission is enforced by {@link isEditable} at submit time instead.
   * @inheritDoc
   */
  get isVisible() {
    if ( this.isSynthetic ) return true;
    return super.isVisible;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.window.contentClasses.findSplice(c => c === "standard-form"); // Added by RegionBehaviorConfig
    return options;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( options.preconfigure ) this.#preconfigure = {actionId: options.actionId, parent: options.parent};
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Drop the trailing fieldset of auto-added system fields
    context.fields = context.fields.slice(0, -1).reduce((acc, {fields}) => {
      for ( const {field, value} of fields ) {
        acc[field.name] = {field, value};
      }
      return acc;
    }, {});

    // Remove Disabled checkbox if pre-configuring
    if ( this.isSynthetic ) delete context.fields.disabled;
    return {
      ...context,
      effectPartial: this.constructor.ACTIVE_EFFECT_PARTIAL,
      effects: this.#prepareEffects(),
      headerTags: this.document.system.action.tags.reduce((acc, tagId) => {
        const tag = SYSTEM.ACTION.TAGS[tagId];
        if ( !tag.internal ) acc[tagId] = tag;
        return acc;
      }, {}),
      isSynthetic: this.isSynthetic,
      tabs: this._prepareTabs("sheet"),
      tags: this.#prepareTags(),
      targetScopes: SYSTEM.ACTION.TARGET_SCOPES.choices,
      systemFields: this.document.system.schema.fields,
      effectDurations: CONST.ACTIVE_EFFECT_DURATION_UNITS.reduce((acc, v) => {
        if ( ["months", "turns"].includes(v) ) return acc;
        return [...acc, {value: v, label: _loc(`EFFECT.DURATION.UNITS.${v}`)}];
      }, []),
      effectExpiryEvents: Object.entries(ActiveEffect.EXPIRY_EVENTS).map(([k, v]) => ({value: k, label: _loc(v)}))
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare effects array for this behavior's Action.
   * @returns {object[]}
   */
  #prepareEffects() {
    const effects = this.document.system.toObject().action.effects;
    for ( const [i, effect] of effects.entries() ) {
      effect.fieldPath = `system.action.effects.${i}`;
    }
    return effects;
  }

  /* -------------------------------------------- */

  /**
   * Prepare tag options and selections for this behavior's Action.
   * @returns {FormSelectOption[]}
   */
  #prepareTags() {
    const tags = [];
    for ( const t of Object.values(SYSTEM.ACTION.TAGS) ) {
      if ( t.internal ) continue;
      const cat = SYSTEM.ACTION.TAG_CATEGORIES[t.category];
      const group = cat?.label;
      const selected = this.document.system.action.tags.has(t.tag);
      tags.push({value: t.tag, label: t.label, group, selected});
    }
    return tags;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Add an effect to this behavior's Action.
   * @this {CrucibleActionBehaviorRegionConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   * @returns {Promise<void>}
   */
  static async #onAddEffect(_event, _target) {
    const effects = this.document.system.toObject().action.effects;
    effects.push({
      scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES,
      duration: {
        value: 1,
        units: "rounds",
        expiry: "turnEnd"
      }
    });
    this.document.updateSource({"system.action.effects": effects});
    await this.render();
    this.document.updateSource({"system.action.effects": effects.slice(0, -1)});
    const submit = new SubmitEvent("submit", {cancelable: true});
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Delete an effect from this behavior's Action.
   * @this {CrucibleActionBehaviorRegionConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async #onDeleteEffect(_event, target) {
    const fieldset = target.closest("fieldset.effect");
    fieldset.remove();
    const submit = new SubmitEvent("submit", {cancelable: true});
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Choose a new image for this behavior's Action.
   * @this {CrucibleActionBehaviorRegionConfig}
   * @param {PointerEvent} _event
   * @param {HTMLImageElement} target
   * @returns {Promise<void>}
   */
  static async #onEditImage(_event, target) {
    const fp = new foundry.applications.apps.FilePicker.implementation({
      current: this.document.system.toObject().action.img,
      type: "image",
      callback: async path => {
        target.src = path;
        await this.#submitChanges({system: {action: {img: path}}});
      },
      position: {top: this.position.top + 40, left: this.position.left + 10},
      document: this.document
    });
    await fp.browse();
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /** @override */
  _processFormData(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    data.system.action.effects = Object.values(data.system.action.effects || {});
    data.name = data.system.action.name;
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  async _processSubmitData(event, form, submitData, options={}) {
    return this.#submitChanges(submitData, options);
  }

  /* -------------------------------------------- */

  /**
   * Route changes to the persisted Region Behavior, or to the pre-configuration recorded on its parent Action.
   * @param {object} changes                Partial Region Behavior data
   * @param {object} [options]              Options forwarded to the update operation
   * @returns {Promise<void>}
   * @throws {Error}                        If the Action which records the pre-configuration cannot be resolved
   */
  async #submitChanges(changes, options={}) {

    // Standard document updates for full RegionBehavior documents
    if ( !this.isSynthetic ) {
      await this.document.update(changes, options);
      return;
    }

    // Pre-configure the behavior in the context of an owning CrucibleAction
    this.document.updateSource(changes);
    const {actionId, parent} = this.#preconfigure;
    const actions = parent.system.toObject().actions ?? [];
    const idx = actions.findIndex(a => a.id === actionId);
    if ( idx === -1 ) throw new Error(`Unable to record Region Behavior pre-configuration: Action "${actionId}" was `
      + `not found on Document "${parent.uuid}"`);

    // Record the full state of the transient behavior, including data for fields which have no form input
    const source = this.document.toObject();
    actions[idx].regionBehavior = {
      name: source.name,
      system: {action: source.system.action, events: source.system.events, frequency: source.system.frequency}
    };
    await parent.update({"system.actions": actions}, options);
    await this.render(); // Transient behaviors need to be manually re-rendered
  }
}
