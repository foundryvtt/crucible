import ActionUseDialog from "./action-use-dialog.mjs";

/**
 * Prompt the user to configure their counterspell
 */
export default class CounterspellDialog extends ActionUseDialog {

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/counterspell-dialog.hbs";

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.action.actor;

    // Spellcraft Components
    const runes = Array.from(actor.grimoire.runes);
    runes.sort((a, b) => a.name.localeCompare(b.name));
    const gestures = Array.from(actor.grimoire.gestures);
    gestures.sort((a, b) => a.name.localeCompare(b.name));

    // Scaling
    const ability = actor.getAbilityBonus([...this.action.scaling])

    // Merge context
    return foundry.utils.mergeObject(context, {
      ability, runes, gestures
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    if ( ["rune", "gesture"].includes(event.target.name) ) {
      this.action.updateSource({[event.target.name]: event.target.value});
      this._clearTargetTemplate();
      this.render({window: {title: this.title}});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onRoll(event, button, dialog) {
    const form = event.target;
    const {rune, gesture} = (new FormDataExtended(form)).object;
    this.action.updateSource({rune, gesture});
    return super._onRoll(event, button, dialog);
  }
}
