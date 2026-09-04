import CrucibleActorDetailsItemSheet from "./item-actor-details-sheet.mjs";
import CrucibleBackgroundItem from "../../models/item-background.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "background" type.
 */
export default class CrucibleBackgroundItemSheet extends CrucibleActorDetailsItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "background"
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const source = context.source.system;
    const fields = this.document.system.schema.fields;
    const status = name => {
      const granted = source[name];
      const count = granted?.length ?? granted?.size ?? 0;
      const expected = CrucibleBackgroundItem.GRANTS[name];
      const label = _loc(`BACKGROUND.FIELDS.${name}.label`);
      return {
        count, expected,
        warning: count < expected ? _loc("BACKGROUND.SHEET.GrantWarning", {count, expected, label}) : null
      };
    };
    return Object.assign(context, {
      grants: [
        {field: fields.training, value: source.training, options: this.#prepareProficiencyOptions(),
          ...status("training")},
        {field: fields.knowledge, value: source.knowledge, sort: true, ...status("knowledge")},
        {field: fields.languages, value: source.languages, options: this.#prepareLanguageOptions(),
          ...status("languages")}
      ],
      authoring: {talents: status("talents")}
    });
  }

  /* -------------------------------------------- */

  /**
   * Offer every proficiency as a choice, grouped so the long list stays navigable.
   * @returns {{value: string, label: string, group: string}[]}
   */
  #prepareProficiencyOptions() {
    const {PROFICIENCIES, GROUPS} = SYSTEM.PROFICIENCY;
    return Object.entries(PROFICIENCIES).map(([value, config]) => ({
      value, label: config.label, group: _loc(GROUPS[config.group].label)
    }));
  }

  /* -------------------------------------------- */

  #prepareLanguageOptions() {
    const categories = crucible.CONFIG.languageCategories;
    const options = [];
    for ( const [value, {label, category}] of Object.entries(crucible.CONFIG.languages) ) {
      options.push({value, label, group: categories[category]?.label});
    }
    return options;
  }
}
