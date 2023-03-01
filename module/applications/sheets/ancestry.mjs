import { SYSTEM } from "../../config/system.js";

/**
 * A sheet application for displaying Ancestry items
 * @extends {ItemSheet}
 */
export default class AncestrySheet extends ItemSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "ancestry"],
      template: `systems/${SYSTEM.id}/templates/sheets/ancestry.hbs`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Ancestry] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    const skills = foundry.utils.deepClone(SYSTEM.SKILLS);
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.document,
      source: this.document.toObject(),
      abilities: SYSTEM.ABILITIES,
      damageTypes: SYSTEM.DAMAGE_TYPES,
      skills: Object.entries(skills).map(e => {
        let [id, s] = e;
        s.id = id;
        s.checked = this.document.system.skills.includes(id);
        return s;
      })
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
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
      s.disabled = ((checked === 2) && !s.checked);
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onChangeInput(event) {
    super._onChangeInput(event);
    this._disableSkills();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getSubmitData(updateData) {
    const formData = super._getSubmitData(updateData);
    formData["system.skills"] = formData["system.skills"].filter(s => s);
    return formData;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    const clone = this.document.clone();
    try {
      clone.updateSource(formData);
    } catch(err) {
      ui.notifications.warn(err);
      throw err;
    }
    return super._updateObject(event, formData);
  }
}
