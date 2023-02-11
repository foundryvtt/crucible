import {SYSTEM} from "../config/system.js";
import ActionUseDialog from "./action-use-dialog.mjs";
import CrucibleSpell from "../data/spell.mjs";

/**
 * Prompt the user to configure a spell they wish to cast.
 */
export default class SpellCastDialog extends ActionUseDialog {

  /**
   * The configured Spell being cast
   * @type {CrucibleSpell}
   */
  spell;

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

    // Spellcraft Components
    const runes = Array.from(actor.grimoire.runes);
    runes.sort((a, b) => a.name.localeCompare(b.name));
    const gestures = Array.from(actor.grimoire.gestures);
    gestures.sort((a, b) => a.name.localeCompare(b.name));
    const inflections = Array.from(actor.grimoire.inflections);
    inflections.sort((a, b) => a.name.localeCompare(b.name));

    // Default Spell
    if ( !this.spell ) this.spell = new CrucibleSpell({
      rune: runes[0].id,
      gesture: gestures[0].id
    });

    // Scaling
    const ability = actor.getAbilityBonus([...this.spell.scaling]);

    // Merge context
    const context = super.getData();
    return Object.assign(context, {
      spell: this.spell,
      hasDice: true,
      ability, runes, gestures, inflections
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _getTags() {
    return this.spell.getTags();
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
    const fd = new FormDataExtended(form);
    this.spell = new CrucibleSpell(fd.object);
    this.render();
  }

  /* -------------------------------------------- */

  /** @override */
  static _onSubmit(html, pool) {
    const form = html.querySelector("form");
    const fd = new FormDataExtended(form, {readonly: true});
    pool.initialize(fd.object);
    const spell = new CrucibleSpell(fd.object);
    return {spell, ...pool};
  }
}
