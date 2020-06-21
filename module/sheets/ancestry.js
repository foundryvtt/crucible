import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Skills
 * @type {ItemSheet}
 */
export default class AncestrySheet extends ItemSheet {

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
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

  /** @override */
  getData() {
    const data = super.getData();
    data.data = this.object.data.data;
    data.system = SYSTEM;
    data.skills = Object.entries(duplicate(SYSTEM.SKILLS)).map(e => {
      let [id, s] = e;
      s.id = id;
      s.checked = data.item.data.skills.includes(id);
      return s;
    });
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    event.preventDefault();

    // Process abilities
    if ( formData["data.primaryAbility"] === formData["data.secondaryAbility"] ) {
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
    if ( !!formData["data.resistance"] !== !!formData["data.vulnerability"] ) {
      const err = game.i18n.localize("ANCESTRY.ResistanceWarning")
      ui.notifications.warn(err);
      throw new Error(err);
    }

    // Update the item
    return this.object.update(formData);
  }
}
