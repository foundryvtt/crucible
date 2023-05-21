import { SYSTEM } from "../../config/system.js";

/**
 * A sheet application for displaying Background type Items
 * @extends {ItemSheet}
 */
export default class BackgroundSheet extends ItemSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: ["crucible-new", "sheet", "item", "background"],
      dragDrop: [{dragSelector: null, dropSelector: ".talents .droppable"}],
      template: `systems/${SYSTEM.id}/templates/sheets/background.hbs`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Background] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const isEditable = this.isEditable;
    const skills = foundry.utils.deepClone(SYSTEM.SKILLS);
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.document,
      talents: await BackgroundSheet.#prepareTalents(this.document.system.talents),
      source: this.document.toObject(),
      skills: Object.entries(skills).map(e => {
        let [id, s] = e;
        s.id = id;
        s.checked = this.document.system.skills.has(id);
        return s;
      })
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    for ( const button of buttons ) {
      button.tooltip = button.label;
      button.label = "";
    }
    return buttons;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderOuter() {
    const html = await super._renderOuter();
    const overlaySrc = "systems/crucible/ui/journal/overlay.png"; // TODO convert
    const overlay = `<img class="background-overlay" src="${overlaySrc}">`
    html.prepend(overlay);
    return html;
  }

  /* -------------------------------------------- */

  /**
   * Prepare talent data for the Background.
   * @param {string[]} uuids      The UUIDs of talents associated with this Background.
   * @returns {Promise<{uuid: string, name: string, img: string}[]>}
   */
  static async #prepareTalents(uuids) {
    const talents = [];
    for ( const uuid of uuids ) {
      const talent = await fromUuid(uuid)
      if ( !talent ) continue;
      talents.push(this.#getTalentHTML(talent));
    }
    return talents;
  }

  /* -------------------------------------------- */

  /**
   * Construct the HTML for a talent displayed on the Background sheet.
   * @param {CrucibleItem} talent     The talent item being displayed
   * @returns {string}                The rendered HTML string
   */
  static #getTalentHTML(talent) {
    return `<div class="talent item-list-entry" data-uuid="${talent.uuid}">
      <header class="talent-header flexrow">
        <img class="icon" src="${talent.img}" alt="${talent.name}">
        <h4 class="title">${talent.name}</h4>
        <div class="tags">${Object.entries(talent.system.getTags()).map(([type, tag]) => {
          return `<span class="tag" data-tag="${type}">${tag}</span>`;
        }).join("")}</div>
        <a class="button remove-talent" data-action="removeTalent" data-tooltip="BACKGROUND.RemoveTalent">
            <i class="fa-solid fa-times"></i>
        </a>
      </header>
      <div class="description">${talent.system.description}</div>
    </div>`;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", "[data-action]", this.#onClickAction.bind(this));
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

  #onClickAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "removeTalent":
        const fd = this._getSubmitData();
        fd["system.talents"] = [];
        return this._updateObject(event, fd);
    }
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
    const talents = this.element[0].querySelector(".talents");
    talents.innerHTML = BackgroundSheet.#getTalentHTML(talent);
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
