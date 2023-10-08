import SEQUENCER_DATABASE from "./sequencer-database.mjs";
import SEQUENCER_PRESETS from "./sequencer-presets.mjs";

/**
 * Initiailize Sequencer integration by defining a custom database structure and animation presets.
 * @returns {Promise<void>}
 */
export async function initializeSequencer() {

  // Wait for JB2A to finish registering
  await Sequencer.Helpers.wait(200);

  // Register the database entries
  console.groupCollapsed("Crucible | Sequencer Initialization");
  Sequencer.Database.registerEntries("crucible", SEQUENCER_DATABASE);

  // Register preset configurations
  for ( const [id, fn] of Object.entries(SEQUENCER_PRESETS) ) {
    Sequencer.Presets.add(id, fn);
  }
  console.groupEnd();
}
