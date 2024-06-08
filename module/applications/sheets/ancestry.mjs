import CrucibleBaseItemSheet from "./base-item.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "ancestry" type.
 */
export default class AncestrySheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["ancestry"]
  };

  /** @inheritDoc */
  static PARTS = foundry.utils.mergeObject(super.PARTS, {
    config: {template: "systems/crucible/templates/sheets/partials/ancestry-config.hbs"}
  }, {inplace: false});
}
