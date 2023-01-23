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
      template: `systems/${SYSTEM.id}/templates/sheets/talent.html`,
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
    const context = super.getData(options);
    const source = this.item.toObject();
    const nodeIds = Array.from(CrucibleTalentNode.nodes.keys());
    context.hasActions = this.item.actions.length;
    context.tags = this.item.getTags();
    context.actionsJSON = JSON.stringify(source.system.actions, null, 2);
    context.requirementsJSON = JSON.stringify(source.system.requirements, null, 2);
    context.nodes = Object.fromEntries(nodeIds.map(id => [id, id]));
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if ( !this.object.id ) return;
    return this.object.update(formData, {recursive: false, diff: false, noHook: true});
  }
}
