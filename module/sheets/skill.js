import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Skills
 * @type {ItemSheet}
 */
export class SkillSheet extends ItemSheet {
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 600,
      height: 450,
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
    data.category = this.item.config.category;
    data.system = SYSTEM;
    data.description = this._getSkillDescription(data);
    data.canSpecialize = data.data.rank >= 2;
    return data;
  }

  /* -------------------------------------------- */

  _getSkillDescription(data) {
    const {ranks, path, paths} = this.item.data;
    const rank = data.data.rank;

    // Rank descriptions
    const description = ranks.reduce((desc, r) => {
      if (( r.rank <= rank ) && r.description) desc.current[0] = {from: r.name, rank: r.rank, desc: r.description};
      else if ( (r.rank === rank+1) && r.description) desc.next[0] = {from: r.name, rank: r.rank, desc: r.description};
      return desc;
    }, {current: [], next: []});

    // Path descriptions
    path.ranks.reduce((desc, r) => {
      if (( r.rank <= rank ) && r.description) desc.current[1] = {from: path.name, rank: r.rank, desc: r.description};
      else if ((r.rank === rank+1) && r.description) desc.next[1] = {from: path.name, rank: r.rank, desc: r.description};
      return desc;
    }, description);

    // Choose a path
    if ( (rank === 1) || (rank === 2 && !data.data.path) ) {
      const pathChoices = paths.filter(p => p.id).map(p => {
        return {from: p.name, rank: 2, desc: p.description}
      });
      const choosePath = {
        from: ranks[2].name,
        rank: 2,
        desc: "Choose a specialization path from the available 3 options."
      };
      if ( rank === 1 ) description.next = [choosePath].concat(pathChoices);
      else description.current = description.current.concat(choosePath);
    }

    // Return descriptions
    return {
      current: description.current.flat(),
      next: description.next.flat()
    }
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for SkillSheet events
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".rank-control").click(this._onClickRankControl.bind(this));
    html.find(".progression-path").click(this._onClickProgressionPath.bind(this));
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

  /* -------------------------------------------- */

  _onClickProgressionPath(event) {
    event.preventDefault();
    const img = event.currentTarget;
    const rank = this.item.data.data.rank;
    if ( rank !== 2 ) {
      return ui.notifications.error("You may only choose a progression path at the Apprentice rank.");
    }
    this.item.update({"data.path": img.dataset.path});
  }
}
