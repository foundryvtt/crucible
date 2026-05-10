export default class CruciblePersistentAOEConfig extends foundry.applications.sheets.RegionBehaviorConfig {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      addEffect: CruciblePersistentAOEConfig.#onAddEffect,
      deleteEffect: CruciblePersistentAOEConfig.#onDeleteEffect
    },
    classes: ["crucible", "persistent-aoe"],
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
      template: "systems/crucible/templates/sheets/region-behavior/persistent-aoe-config.hbs",
      templates: [CruciblePersistentAOEConfig.ACTIVE_EFFECT_PARTIAL],
      scrollable: [""]
    }
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Remove auto-added system fields; will handle these on our own
    context.fields = context.fields.slice(0, -1);
    return {
      ...context,
      effectPartial: this.constructor.ACTIVE_EFFECT_PARTIAL,
      effects: this.#prepareEffects(),
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
   * @this {CruciblePersistentAOEConfig}
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
   * @this {CruciblePersistentAOEConfig}
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
}
