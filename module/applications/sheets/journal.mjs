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
}
