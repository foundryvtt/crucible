import { SYSTEM } from "../../config/system.js";
import CrucibleSheetMixin from "./crucible-sheet.mjs";

/**
 * A sheet application for displaying Ancestry items
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class AncestrySheet extends CrucibleSheetMixin(ItemSheet) {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["crucible-new", "sheet", "ancestry"],
      closeOnSubmit: true,
      height: "auto",
      resizable: false,
      submitOnChange: false,
      template: `systems/${SYSTEM.id}/templates/sheets/ancestry.hbs`,
      width: 480
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.document,
      source: this.document.toObject(),
      abilities: SYSTEM.ABILITIES,
      damageTypes: SYSTEM.DAMAGE_TYPES
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    const clone = this.document.clone();
    try {
      clone.updateSource(formData);
    } catch(err) {
      ui.notifications.warn(err);
      throw err;
    }
    return super._updateObject(event, formData);
  }
}
