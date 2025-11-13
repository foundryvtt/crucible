import SpellCastDialog from "./spell-cast-dialog.mjs";

/**
 * Prompt the user to configure their counterspell
 */
export default class CounterspellDialog extends SpellCastDialog {

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/counterspell-dialog.hbs";

}
