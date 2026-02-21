const {api} = foundry.applications;

export default class CompendiumSourcesConfig extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["standard-form"],
    window: {
      title: "SETTINGS.COMPENDIUM_SOURCES.label"
    },
    position: {
      width: 500
    },
    form: {
      closeOnSubmit: true,
      handler: CompendiumSourcesConfig.#onSubmit
    }
  };

  /** @override */
  static PARTS = {
    config: {
      template: "systems/crucible/templates/settings/compendium-sources.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.sources = [];
    const settingSchema = game.settings.settings.get("crucible.compendiumSources").type;
    const systemString = game.i18n.localize("PACKAGE.Type.system");
    const worldString = game.i18n.localize("PACKAGE.Type.world");
    for ( const [type, sources] of Object.entries(crucible.CONFIG.packs) ) {
      const choices = settingSchema.fields[type].element.choices();
      const allGroups = Array.from(new Set(Object.values(choices).map(i => i.group)));
      allGroups.sort((a, b) => {
        if ( a.startsWith(systemString) ) return -1;
        if ( b.startsWith(systemString) ) return 1;
        if ( a.startsWith(worldString) ) return -1;
        if ( b.startsWith(worldString) ) return 1;
        return a.localeCompare(b);
      });
      context.sources.push({
        type,
        field: settingSchema.fields[type],
        value: sources,
        groups: allGroups
      });
    }
    context.buttons = [{ type: "submit", icon: "fa-solid fa-save", label: "Save Changes"}];
    return context;
  }

  /**
   * Persist changes, prompting reload there have actually been any.
   * @this {CompendiumSourcesConfig}
   * @param {SubmitEvent} event         The submission event.
   * @param {HTMLFormElement} form      The submitted form element.
   * @param {FormDataExtended} formData The submitted form data.
   */
  static async #onSubmit(event, form, formData) {
    let needsReload = false;
    const current = game.settings.get("crucible", "compendiumSources");
    const newValue = foundry.utils.expandObject(formData.object).crucible.compendiumSources;
    const settingDefaults = game.settings.settings.get("crucible.compendiumSources").default;
    for ( const [type, value] of Object.entries(current) ) {
      if ( !newValue[type].length ) newValue[type] = settingDefaults[type];
      if ( value.equals(new Set(newValue[type])) ) continue;
      needsReload = true;
      break;
    }
    await game.settings.set("crucible", "compendiumSources", newValue);
    if ( needsReload ) return foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
  }
}
