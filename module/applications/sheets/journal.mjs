/**
 * Define a custom JournalEntrySheet subclass used for the Crucible rules journal entries.
 */
export default class CrucibleJournalEntrySheet extends foundry.applications.sheets.journal.JournalEntrySheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    position: {
      width: 1080
    },
    classes: ["crucible", "themed", "theme-dark"]
  };

  /** @override */
  get title() {
    let title = super.title;
    if ( this.document.pack === "crucible.rules" ) title = `${_loc("CRUCIBLE.Rules")}: ${title}`;
    return title;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#addChatReadaloudButtons();
  }

  /* -------------------------------------------- */

  /**
   * Add a GM-only send-to-chat button to each read-aloud block.
   */
  #addChatReadaloudButtons() {
    if ( !game.user.isGM ) return;
    for ( const block of this.element.querySelectorAll(".readaloud") ) {
      if ( block.querySelector(":scope > button[data-chat-readaloud]") ) continue;
      block.prepend(crucible.api.chat.createChatReadaloudButton());
    }
  }
}
