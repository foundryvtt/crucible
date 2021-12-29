/**
 * The root path for system documentation files
 * @type {string}
 */
const JOURNAL_PATH = "systems/crucible/docs";

/**
 * The documentation configuration
 * @type {string}
 */
const JOURNAL_CONFIG = `${JOURNAL_PATH}/config.json`;

/**
 * The name of a world-level Folder where the rules entries are created
 * @type {string}
 */
const LOCAL_FOLDER_NAME = "Crucible Rules";

/**
 * The collection name of the destination compendium pack where rules should be loaded
 * @type {string}
 */
const COMPENDIUM_PACK_NAME = "crucible.rules"

/**
 * Construct Journal Entries for each configured Markdown documentation file
 * @returns {Promise<void>}
 */
export async function buildJournalCompendium() {

  // Reference the Compendium pack and the local Folder
  const pack = game.packs.get(COMPENDIUM_PACK_NAME);
  const folder = game.folders.getName(LOCAL_FOLDER_NAME) || await Folder.create(
    {name: LOCAL_FOLDER_NAME, type: "JournalEntry"}
  );

  // Load the documentation configuration
  const config = await fetch(JOURNAL_CONFIG).then(r => r.json());

  // Initialize a Showdown converter
  const sd = new showdown.Converter({
    noHeaderId: true,
    simplifiedAutoLink: true,
    openLinksInNewWindow: true,
    tables: true
  });

  // Load each Markdown file and create or update a Journal Entry within the local folder
  for ( let entry of config.entries ) {

    // Convert the MD to HTML
    const src = `${JOURNAL_PATH}/${entry.path}`;
    const md = await fetch(src).then(r => r.text());
    let html = sd.makeHtml(md);

    // Post-process the HTML string
    html = _postProcessJournalHTML(config, html);

    // Update an existing Journal Entry
    const journal = folder.content.find(e => e.name === entry.title);
    if ( journal ) await journal.update({
      content: html,
      "permission.default": CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER
    });

    // Create a new Journal Entry
    else await JournalEntry.create({
      name: entry.title,
      content: html,
      folder: folder.id,
      "permission.default": CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER,
      "flags.crucible.rulesEntry": true
    });
  }
}

/**
 * Post-process the converted HTML before saving the Journal Entry.
 * @param {object} config   The documentation configuration object
 * @param {string} html     The raw HTML string
 * @returns {string}        The processed HTML string
 * @private
 */
function _postProcessJournalHTML(config, html) {
  const div = document.createElement("div");
  div.innerHTML = html;

  // Strip everything prior to and including the first H1 element
  let hasH1 = div.querySelector("h1");
  if ( hasH1 ) {
    let removedH1 = false;
    while ( !removedH1 ) {
      const el = div.childNodes[0];
      div.removeChild(el);
      if ( el.tagName === "H1" ) removedH1 = true;
    }
  }

  // Add divider headers
  const headers = div.querySelectorAll('h1, h2, h3');
  for ( let h of headers ) {
    h.innerHTML = `<span></span><label>${h.textContent}</label><span></span>`;
    h.classList.add("divider");
  }

  // Replace links
  const links = div.querySelectorAll("a[href]");
  for ( let a of links ) {
    if ( !a.href.endsWith(".md") ) continue;
    const src = a.href.split("/").pop();
    const entry = config.entries.find(e => e.path.endsWith(src));
    const title = entry ? entry.title : a.textContent;
    const link = document.createTextNode(`@JournalEntry[${title}]{${a.textContent}}`);
    a.replaceWith(link);
  }

  // Return HTML string
  return div.innerHTML;
}

/**
 * Add a CSS class to Crucible journal entries so we can render them in style.
 */
export function renderJournalRules(app, html, data, options) {
  if (!app.document.getFlag("crucible", "rulesEntry")) return;
  if (!html.hasClass("window-app")) return;
  html.addClass("crucible");
}
