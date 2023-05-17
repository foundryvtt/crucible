import { SYSTEM } from "../../config/system.js";

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
      template: `systems/${SYSTEM.id}/templates/sheets/ancestry.hbs`,
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
