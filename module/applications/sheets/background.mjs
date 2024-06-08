import CrucibleBaseItemSheet from "./base-item.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "background" type.
 */
export default class BackgroundSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["background"],
    actions: {
      removeTalent: BackgroundSheet.#onRemoveTalent
    }
  };

  /**
   * The partial template used to render an included talent.
   * @type {string}
   */
  static talentPartial = "systems/crucible/templates/sheets/partials/included-talent.hbs";

  /** @inheritDoc */
  static PARTS = foundry.utils.mergeObject(super.PARTS, {
    config: {
      template: "systems/crucible/templates/sheets/partials/background-config.hbs",
      templates: [this.talentPartial]
    }
  }, {inplace: false});

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      skillsInput: this.#skillsInput.bind(this),
      talents: await this.#prepareTalents()
    });
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

  /* -------------------------------------------- */

  /**
   * Prepare talent data for the Background.
   * @returns {Promise<{uuid: string, name: string, img: string}[]>}
   */
  async #prepareTalents() {
    const uuids = this.document.system.talents;
    const talents = [];
    for ( const uuid of uuids ) {
      const talent = await fromUuid(uuid)
      if ( !talent ) continue;
      const talentHTML = await this.#renderTalentHTML(talent);
      talents.push(talentHTML);
    }
    return talents;
  }

  /* -------------------------------------------- */

  /**
   * Construct the HTML for a talent displayed on the Background sheet.
   * @param {CrucibleItem} talent     The talent item being displayed
   * @param {boolean} editable        Is the sheet currently editable?
   * @returns {Promise<string>}       The rendered HTML string
   */
  async #renderTalentHTML(talent) {
    const tags = talent.system.getTags();
    return renderTemplate(this.constructor.talentPartial, {talent, tags, editable: this.isEditable});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    if ( !this.isEditable ) return;
    const dropZone = this.element.querySelector(".talent-drop");
    dropZone.addEventListener("drop", this.#onDropTalent.bind(this));
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle drop events for a talent added to the Background sheet.
   * @param {DragEvent} event
   * @returns {Promise<*>}
   */
  async #onDropTalent(event) {
    const dropZone = event.currentTarget;
    const data = TextEditor.getDragEventData(event);
    if ( data.type !== "Item" ) return;
    const talent = await fromUuid(data.uuid);
    if ( talent?.type !== "talent" ) return;
    if ( talent.system.node.tier !== 0 ) {
      return ui.notifications.error("BACKGROUND.ERRORS.TALENT_TIER", {localize: true});
    }
    const talentHTML = await this.#renderTalentHTML(talent);
    dropZone.insertAdjacentHTML("beforebegin", talentHTML);
    dropZone.remove();
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a talent from the Background sheet.
   * @this {BackgroundSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onRemoveTalent(event) {
    const talent = event.target.closest(".talent");
    talent.remove();
    const submitData = this._getSubmitData(event);
    await this.document.update(submitData);
    this.render(); // TODO why is this necessary, shouldn't the document update do it?
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _prepareSubmitData(event, form, formData) {
    const submitData = super._prepareSubmitData(event, form, formData);
    const talents = form.querySelectorAll(".talents .talent");
    submitData.system.talents = Array.from(talents).map(t => t.dataset.uuid);
    return submitData;
  }
}
