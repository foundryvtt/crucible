import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Ancestry items
 * @extends {TalentSheet}
 */
export default class TalentSheet extends ItemSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "talent"],
      template: `systems/${SYSTEM.id}/templates/sheets/talent.html`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Talent] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options={}) {
    const context = super.getData(options);
    context.hasActions = this.item.actions.length;
    context.tags = this.item.getTags();
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    event.preventDefault();
    return this.object.update(formData);
  }
}
