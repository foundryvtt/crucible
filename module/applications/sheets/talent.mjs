import CrucibleTalentNode from "../../config/talent-tree.mjs";
import CrucibleBaseItemSheet from "./base-item.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "talent" type.
 */
export default class TalentSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "talent",
      includesActions: true,
      includesHooks: true
    }
  };

  // Initialize subclass options
  static {
    this._initializeItemSheetClass()
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const nodeIds = Array.from(CrucibleTalentNode.nodes.keys());
    nodeIds.sort((a, b) => a.localeCompare(b));
    return Object.assign(context, {
      nodes: nodeIds.map(id => ({value: id, label: id}))
    });
  }
}
