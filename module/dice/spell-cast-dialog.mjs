import ActionUseDialog from "./action-use-dialog.mjs";

/**
 * Prompt the user to configure a spell they wish to cast.
 */
export default class SpellCastDialog extends ActionUseDialog {

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/spell-cast-dialog.hbs";

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const spell = this.action;
    const actor = spell.actor;

    // Spellcraft Components
    const runes = Array.from(actor.grimoire.runes.values());
    runes.sort((a, b) => a.name.localeCompare(b.name));
    const gestures = Array.from(actor.grimoire.gestures.values());
    gestures.sort((a, b) => a.name.localeCompare(b.name));
    const inflections = Array.from(actor.grimoire.inflections.values());
    inflections.sort((a, b) => a.name.localeCompare(b.name));

    // Merge context
    return foundry.utils.mergeObject(context, {
      runes, gestures, inflections,
      canInflect: true,
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
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    if ( ["rune", "gesture", "inflection"].includes(event.target.name) ) {
      this.action.updateSource({[event.target.name]: event.target.value});
      this.roll = crucible.api.dice.StandardCheck.fromAction(this.action);
      this._clearTargetTemplate();
      this.render({window: {title: this.title}});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onRoll(event, button, dialog) {
    const form = event.target;
    const {rune, gesture, inflection, damageType} = (new FormDataExtended(form)).object;
    const composition = this.action.constructor.COMPOSITION_STATES.COMPOSED;
    this.action.updateSource({composition, rune, gesture, inflection, damageType});
    return super._onRoll(event, button, dialog);
  }
}
