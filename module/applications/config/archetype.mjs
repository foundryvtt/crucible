import { SYSTEM } from "../../config/system.js";

/**
 * An application for configuring Archetype data on an Adversary sheet.
 */
export default class ArchetypeConfig extends FormApplication {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "archetype"],
      template: `systems/${SYSTEM.id}/templates/config/archetype.hbs`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Archetype] ${this.object.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const isEditable = this.isEditable;
    const source = this.object.toObject();
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      archetype: this.object,
      source: source,
      abilities: Object.values(SYSTEM.ABILITIES).map(ability => ({
        id: ability.id,
        label: ability.label,
        value: source.abilities[ability.id]
      })),
      abilitySum: Object.values(source.abilities).reduce((t, n) => t + n, 0)
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    const clone = this.object.clone();
    try {
      clone.updateSource(formData);
      await this.object.actor.update({"system.details.archetype": clone.toObject()});
    }
    catch(err) {
      ui.notifications.warn(err);
      throw err;
    }
  }
}
