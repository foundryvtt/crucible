
export default class CrucibleJournalSheet extends JournalSheet {

  /** @inheritDoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.template = "systems/crucible/templates/sheets/journal.hbs";
    options.classes.unshift("crucible-new");
    return options;
  }

  async getData(options={}) {
    const context = await super.getData(options);
    return Object.assign(context, {
      overlaySrc: "systems/crucible/ui/journal/overlay.png"  // TODO convert WEBP
    })
  }

  /** @inheritDoc */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    for ( const button of buttons ) {
      button.tooltip = button.label;
      button.label = "";
    }
    return buttons;
  }
}
