import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Skills
 * @type {ItemSheet}
 */
export class SkillSheet extends ItemSheet {
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 600,
      height: 520,
      classes: [SYSTEM.id, "sheet", "item", "skill"],
      template: `systems/${SYSTEM.id}/templates/sheets/skill.html`,
      resizable: false
    });
  }

  /* -------------------------------------------- */

  get title() {
    return `[Skill] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  getData() {
    const data = super.getData();
    data.config = this.item.config;
    data.system = SYSTEM;
    data.canSpecialize = data.data.rank >= 2;
    console.log(data);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for SkillSheet events
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".rank-control").click(this._onClickRankControl.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Increase or decrease ranks in a given skill
   * @param {Event} event
   * @private
   */
  _onClickRankControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    let rank = this.item.data.data.rank;
    let updateData = {};
    if ( a.dataset.action === "plus" ) {
      rank = Math.min(rank+1, 5);
      if ( rank > 2 && !this.item.data.data.path ) {
        return ui.notifications.error("You must choose a progression path before advancing this skill further.");
      }
    }
    else if ( a.dataset.action === "minus" ) {
      rank = Math.max(rank - 1, 0);
      if (rank < 2) updateData["data.path"] = "";
    }
    updateData["data.rank"] = rank;
    this.item.update(updateData);
  }
}
