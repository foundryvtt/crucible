import { SYSTEM } from "../config/system.js";

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
      template: `systems/${SYSTEM.id}/templates/sheets/ancestry.html`,
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
  getData() {
    const context = super.getData();
    const systemData = context.systemData = context.data.system;
    context.system = SYSTEM;
    const skills = foundry.utils.deepClone(SYSTEM.SKILLS);
    context.skills = Object.entries(skills).map(e => {
      let [id, s] = e;
      s.id = id;
      s.checked = systemData.skills.includes(id);
      return s;
    });
    return context;
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

  /** @override */
  _updateObject(event, formData) {
    event.preventDefault();

    // Process abilities
    if ( formData["data.primary"] === formData["data.secondary"] ) {
      const err = game.i18n.localize("ANCESTRY.AbilityWarning");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Process skills
    const skills = Object.keys(SYSTEM.SKILLS).reduce((skills, s) => {
      if ( formData[s] === true ) skills.push(s);
      return skills;
    }, []);
    if ( skills.length !== 2 ) {
      const err = game.i18n.localize("ANCESTRY.SkillsWarning");
      ui.notifications.warn(err);
      throw new Error(err);
    }
    formData["data.skills"] = skills;

    // Process resistance and vulnerability
    if ( (!!formData["data.resistance"] !== !!formData["data.vulnerability"]) ) {
      const err = game.i18n.localize("ANCESTRY.ResistanceWarning");
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Update the item
    return this.object.update(formData);
  }
}
