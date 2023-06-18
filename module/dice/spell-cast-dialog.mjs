import {SYSTEM} from "../config/system.js";
import ActionUseDialog from "./action-use-dialog.mjs";

/**
 * Prompt the user to configure a spell they wish to cast.
 */
export default class SpellCastDialog extends ActionUseDialog {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `systems/${SYSTEM.id}/templates/dice/spell-cast-dialog.hbs`,
      classes: [SYSTEM.id, "sheet", "roll", "spell"]
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options) {
    const spell = this.action;
    const actor = spell.actor;

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
    const context = await super.getData(options);
    return foundry.utils.mergeObject(context, {
      ability, runes, gestures, inflections,
      chooseDamageType: spell.rune.damageType === "physical",
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
    this.action.usage = undefined;
    this.action.updateSource(fd);
    this._clearTargetTemplate();
    this.render(true, {height: "auto"});
  }

  /* -------------------------------------------- */

  /** @override */
  _onSubmit(html) {
    const form = html.querySelector("form");
    const {boons, banes, rollMode, ...updates} = (new FormDataExtended(form, {readonly: true})).object;
    this.action.updateSource({composition: this.action.constructor.COMPOSITION_STATES.COMPOSED, ...updates});
    this.action.usage.rollMode = rollMode;
    Object.assign(this.action.usage.bonuses, {boons, banes});
    return this.action;
  }
}
