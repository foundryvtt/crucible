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
      classes: [SYSTEM.id, "sheet", "item", "background"],
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
  getData() {
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
        s.checked = this.document.system.skills.includes(id);
        return s;
      })
    };
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
      s.disabled = ((checked === 2) && !s.checked);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onChangeInput(event) {
    super._onChangeInput(event);
    this._disableSkills();
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    event.preventDefault();

    // Process skills
    formData["system.skills"] = Object.keys(SYSTEM.SKILLS).reduce((skills, s) => {
      if ( formData[s] === true ) skills.push(s);
      return skills;
    }, []);

    // Update the item
    return this.object.update(formData);
  }
}
