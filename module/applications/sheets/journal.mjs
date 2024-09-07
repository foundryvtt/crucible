/**
 * Define a custom JournalSheet class used for the Crucible rules journal entries.
 * @extends JournalSheet
 */
export default class CrucibleJournalSheet extends JournalSheet {

  /** @override */
  static get defaultOptions() {
    const options = JournalSheet.defaultOptions;
    options.classes.unshift("crucible", "journal-sheet");
    return options;
  }

  /** @override */
  get title() {
    return `[${game.i18n.localize("CRUCIBLE.Rules")}] ${this.document.name}`;
  }

  /** @inheritDoc */
  async _renderInner(data) {
    const html = await super._renderInner(data);
    html.find("input[type='search']").addClass("frame-brown");
    html.find("button.create").addClass("frame-brown");
    return html;
  }
}
