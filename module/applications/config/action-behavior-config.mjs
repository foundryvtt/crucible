/**
 * The Region Behavior configuration application specific to Persistent Area of Effect behaviors.
 */
export default class CrucibleActionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      addEffect: CrucibleActionBehaviorConfig.#onAddEffect,
      deleteEffect: CrucibleActionBehaviorConfig.#onDeleteEffect
    },
    classes: ["crucible", "action-behavior"],
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  /**
   * A template partial used for rendering an Active Effect inside this Region Behavior.
   * @type {string}
   */
  static ACTIVE_EFFECT_PARTIAL = "systems/crucible/templates/sheets/action/effect.hbs";

  /** @override */
  static PARTS = {
    form: {
      template: "systems/crucible/templates/sheets/region-behavior/action-behavior-config.hbs",
      templates: [CrucibleActionBehaviorConfig.ACTIVE_EFFECT_PARTIAL],
      scrollable: [""]
    }
  };

  /* -------------------------------------------- */

  /**
   * Does the represented Region Behavior exist purely for pre-configuration?
   */
  get isSynthetic() {
    return !this.document.collection?.has(this.document.id);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  get isEditable() {
    if ( this.isSynthetic ) return true;
    return super.isEditable;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  get isVisible() {
    if ( this.isSynthetic ) return true;
    return super.isVisible;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Remove auto-added system fields; will handle these on our own
    context.fields = context.fields.slice(0, -1);

    // Remove Disabled checkbox if pre-configuring
    if ( this.isSynthetic ) context.fields.splice(1, 1);
    return {
      ...context,
      effectPartial: this.constructor.ACTIVE_EFFECT_PARTIAL,
      effects: this.#prepareEffects(),
      isSynthetic: this.isSynthetic,
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
    const effects = this.document.system.toObject().actionToPerform.effects;
    for ( const [i, effect] of effects.entries() ) {
      effect.fieldPath = `system.actionToPerform.effects.${i}`;
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
      const selected = this.document.system.actionToPerform.tags.has(t.tag);
      tags.push({value: t.tag, label: t.label, group, selected});
    }
    return tags;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Add an effect to this behavior's Action.
   * @this {CrucibleActionBehaviorConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   * @returns {Promise<void>}
   */
  static async #onAddEffect(_event, _target) {
    const effects = this.document.system.toObject().actionToPerform.effects;
    effects.push({
      scope: SYSTEM.ACTION.TARGET_SCOPES.ENEMIES,
      duration: {
        value: 1,
        units: "rounds",
        expiry: "turnEnd"
      }
    });
    this.document.updateSource({"system.actionToPerform.effects": effects});
    await this.render();
    this.document.updateSource({"system.actionToPerform.effects": effects.slice(0, -1)});
    const submit = new SubmitEvent("submit", {cancelable: true});
    this.element.dispatchEvent(submit);
  }

  /* -------------------------------------------- */

  /**
   * Delete a status effect from this behavior's Action.
   * @this {CrucibleActionBehaviorConfig}
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
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /** @override */
  _processFormData(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    data.system.actionToPerform.effects = Object.values(data.system.actionToPerform.effects || {});
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  async _processSubmitData(event, form, submitData, options={}) {
    if ( !this.isSynthetic ) return this.document.update(submitData, options);

    // If not, this isn't a real behavior, exists only to modify an action
    let action;
    if ( this.document.system.actor ) {
      const actor = await fromUuid(this.document.system.actor);
      action = actor?.actions[this.document.system.actionIdentifier];
    } else if ( this.document.getFlag("crucible", "itemUuid") ) {
      const item = await fromUuid(this.document.flags.crucible.itemUuid);
      action = item?.system.actions.find(a => a.id === this.document.system.actionIdentifier);
    }
    if ( !action?.item ) return;
    const itemActions = action.item.system.toObject().actions;
    const idx = itemActions.findIndex(a => a.id === action.id);
    if ( idx === -1 ) return; // Shouldn't be possible?
    foundry.utils.setProperty(itemActions[idx], "regionBehavior", submitData);
    const configApp = Object.values(action.item.apps).find(a => a.action?.id === action.id);
    await action.item.update({"system.actions": itemActions});
    if ( configApp ) {
      configApp.action = action.item.system.actions[idx];
      configApp.render();
    }
  }
}
