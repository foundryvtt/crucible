import {SYSTEM} from "../config/system.js";
import ActionUseDialog from "./action-use-dialog.mjs";
import CrucibleSpell from "../data/spell.mjs";

/**
 * Prompt the user to configure a spell they wish to cast.
 */
export default class SpellCastDialog extends ActionUseDialog {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `systems/${SYSTEM.id}/templates/dice/spell-cast-dialog.html`,
      classes: [SYSTEM.id, "sheet", "roll", "spell"]
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getData() {
    const actor = this.action.actor;
    const spell = this.action;

    // Spellcraft Components
    const runes = Array.from(actor.grimoire.runes);
    runes.sort((a, b) => a.name.localeCompare(b.name));
    const gestures = Array.from(actor.grimoire.gestures);
    gestures.sort((a, b) => a.name.localeCompare(b.name));
    const inflections = Array.from(actor.grimoire.inflections);
    inflections.sort((a, b) => a.name.localeCompare(b.name));

    // Scaling
    const ability = actor.getAbilityBonus([...spell.scaling]);

    // Merge context
    const context = super.getData();
    return Object.assign(context, {
      spell: spell,
      hasDice: true,
      ability, runes, gestures, inflections,
      chooseDamageType: spell.rune.id === "kinesis",
      damageTypes: {
        bludgeoning: SYSTEM.DAMAGE_TYPES.bludgeoning.label,
        piercing: SYSTEM.DAMAGE_TYPES.piercing.label,
        slashing: SYSTEM.DAMAGE_TYPES.slashing.label,
      }
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("select.component").change(this.#onChangeComponent.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Update the dialog when spell components are changed.
   * @param {Event} event     The input change event
   */
  #onChangeComponent(event) {
    event.preventDefault();
    const select = event.currentTarget;
    const form = select.form;
    const fd = (new FormDataExtended(form)).object;
    this.action.updateSource(fd);
    this.render(true, {height: "auto"});
  }
}
