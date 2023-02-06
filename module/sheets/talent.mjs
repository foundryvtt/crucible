import { SYSTEM } from "../config/system.js";
import CrucibleTalentNode from "../config/talent-tree.mjs";

/**
 * A sheet application for displaying Ancestry items
 */
export default class TalentSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "talent"],
      template: `systems/${SYSTEM.id}/templates/sheets/talent.hbs`,
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "details"}],
      resizable: false,
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Talent] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options = {}) {
    const isEditable = this.isEditable;
    const nodeIds = Array.from(CrucibleTalentNode.nodes.keys());
    nodeIds.sort((a, b) => a.localeCompare(b));
    const source = this.object.toObject();
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.object,
      source: source,
      hasActions: this.item.actions.length,
      tags: this.item.getTags(),
      actionsJSON: JSON.stringify(source.system.actions, null, 2),
      requirementsJSON: JSON.stringify(source.system.requirements, null, 2),
      nodes: Object.fromEntries(nodeIds.map(id => [id, id])),
      runes: SYSTEM.SPELL.RUNES,
      gestures: SYSTEM.SPELL.GESTURES,
      inflections: SYSTEM.SPELL.INFLECTIONS
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if ( !this.object.id ) return;
    return this.object.update(formData, {recursive: false, diff: false, noHook: true});
  }
}
