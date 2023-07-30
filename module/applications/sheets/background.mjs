import CrucibleSheetMixin from "./crucible-sheet.mjs";

/**
 * A sheet application for displaying and configuring Items with the Background type.
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class BackgroundSheet extends CrucibleSheetMixin(ItemSheet) {

  /** @override */
  static documentType = "background";

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
        dragDrop: [{dragSelector: null, dropSelector: ".talents .droppable"}]
    });
  }

  /**
   * The template path for the included talent partial.
   * @type {string}
   */
  static includedTalentPartial = "systems/crucible/templates/sheets/partials/included-talent.hbs";

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const isEditable = this.isEditable;
    const skills = foundry.utils.deepClone(SYSTEM.SKILLS);
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.document,
      source: this.document.toObject(),
      skills: Object.entries(skills).map(e => {
        let [id, s] = e;
        s.id = id;
        s.checked = this.document.system.skills.has(id);
        return s;
      }),
      talents: await this.#prepareTalents()
    };
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
      talents.push(await this.#renderTalentHTML(talent));
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
    return renderTemplate(this.constructor.includedTalentPartial, {
      talent,
      tags: talent.system.getTags(),
      editable: this.isEditable
    });
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    this._disableSkills();
  }

  /* -------------------------------------------- */

  /**
   * Disable skill selection if 2 skills have already been chosen
   * @private
   */
  _disableSkills() {
    if ( !this.isEditable ) return;
    const skills = this.element.find(".skills input");
    const checked = Array.from(skills).reduce((n, s) => n + (s.checked ? 1 : 0), 0);
    for ( let s of skills ) {
      s.disabled = ((checked === 4) && !s.checked);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    this._disableSkills();
  }

  /* -------------------------------------------- */

  /** @override */
  async _handleAction(action, event, button) {
    switch ( action ) {
      case "removeTalent":
        button.closest(".talent").remove();
        const fd = this._getSubmitData();
        await this._updateObject(event, fd);
        this.setPosition({height: "auto"});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _canDragDrop(selector) {
    return this.isEditable;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDrop(event) {
    if ( !this.isEditable ) return;
    const data = TextEditor.getDragEventData(event);
    if ( data.type !== "Item" ) return;
    const talent = await fromUuid(data.uuid);
    if ( talent?.type !== "talent" ) return;
    if ( talent.system.node.tier !== 0 ) {
      return ui.notifications.error("BACKGROUND.TalentTierError", {localize: true});
    }
    const talents = this.element[0].querySelector(".talents .droppable");
    talents.insertAdjacentHTML("beforebegin", await this.#renderTalentHTML(talent));
    this.setPosition({height: "auto"});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getSubmitData(updateData={}) {
    const formData = super._getSubmitData(updateData);

    // Skills
    formData["system.skills"] = Object.keys(SYSTEM.SKILLS).reduce((skills, s) => {
      if ( formData[s] === true ) skills.push(s);
      return skills;
    }, []);

    // Talents
    const talents = this.element[0].querySelectorAll(".talents .talent");
    formData["system.talents"] = Array.from(talents).map(t => t.dataset.uuid);
    return formData;
  }
}
