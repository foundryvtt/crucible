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

    // Last cast spell
    const spellId = actor.getFlag("crucible", "lastSpell") || "";
    const [, rune, gesture, inflection] = spellId.split(".");

    // Default Spell
    if ( !this.spell ) this.spell = new CrucibleSpell({
      rune: spellId ? rune : runes[0].id,
      gesture: spellId ? gesture : gestures[0].id,
      inflection: spellId ? inflection : undefined
    }, {parent: actor});

    // Scaling
    const ability = actor.getAbilityBonus([...this.spell.scaling]);

    // Merge context
    const context = super.getData();
    return Object.assign(context, {
      spell: this.spell,
      hasDice: true,
      ability, runes, gestures, inflections,
      chooseDamageType: this.spell.rune.id === "kinesis",
      damageTypes: {
        bludgeoning: SYSTEM.DAMAGE_TYPES.bludgeoning.label,
        piercing: SYSTEM.DAMAGE_TYPES.piercing.label,
        slashing: SYSTEM.DAMAGE_TYPES.slashing.label,
      }
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
    const fd = (new FormDataExtended(form)).object;
    if ( fd.rune !== "kinesis" ) delete fd.damageType;
    this.spell = new CrucibleSpell(fd, {parent: this.action.actor, damageType: fd.damageType});
    this.render(true, {height: "auto"});
  }

  /* -------------------------------------------- */

  /** @override */
  static _onSubmit(html, pool) {
    const form = html.querySelector("form");
    const fd = new FormDataExtended(form, {readonly: true});
    return fd.object;
  }
}
