import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Skills
 * @type {Actor}
 */
export class HeroSheet extends ActorSheet {
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 720,
      height: 800,
      classes: [SYSTEM.id, "sheet", "actor"],
      template: `systems/${SYSTEM.id}/templates/sheets/hero.html`,
      resizable: false
    });
  }

  /* -------------------------------------------- */

  getData() {
    const data = super.getData();
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for SkillSheet events
   */
  activateListeners(html) {
    super.activateListeners(html);
  }
}
