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
    const runes = Array.from(actor.grimoire.runes);
    runes.sort((a, b) => a.name.localeCompare(b.name));
    const gestures = Array.from(actor.grimoire.gestures);
    gestures.sort((a, b) => a.name.localeCompare(b.name));
    const inflections = Array.from(actor.grimoire.inflections);
    inflections.sort((a, b) => a.name.localeCompare(b.name));

    // Scaling
    const ability = actor.getAbilityBonus([...spell.scaling]);

    // Merge context
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
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    if ( ["rune", "gesture", "inflection"].includes(event.target.name) ) {
      this.action.updateSource({[event.target.name]: event.target.value});
      this._clearTargetTemplate();
      this.render({window: {title: this.title}});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onRoll(event, button, dialog) {
    const form = event.target;
    const {rune, gesture, inflection} = (new FormDataExtended(form)).object;
    const composition = this.action.constructor.COMPOSITION_STATES.COMPOSED;
    this.action.updateSource({composition, rune, gesture, inflection});
    return super._onRoll(event, button, dialog);
  }
}
