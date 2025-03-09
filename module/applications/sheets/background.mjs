import CrucibleActorDetailsItemSheet from "./item-actor-details-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "background" type.
 */
export default class BackgroundSheet extends CrucibleActorDetailsItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "background"
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillsInput = this.#skillsInput.bind(this);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Render the skills as a multi-checkbox element.
   * @returns {HTMLMultiCheckboxElement}
   */
  #skillsInput(field, inputConfig) {
    const skills = foundry.utils.deepClone(SYSTEM.SKILLS);
    inputConfig.name = field.fieldPath;
    inputConfig.options = Object.entries(skills).map(([id, s]) => ({value: id, label: s.name}));
    inputConfig.type = "checkboxes";
    return foundry.applications.fields.createMultiSelectInput(inputConfig);
  }
}
