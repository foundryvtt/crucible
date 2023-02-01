import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Archetype Items.
 */
export default class ArchetypeSheet extends ItemSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "archetype"],
      template: `systems/${SYSTEM.id}/templates/sheets/archetype.hbs`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Archetype] ${this.item.name}`;
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
