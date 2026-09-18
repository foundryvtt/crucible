import {SYSTEM} from "./const/system.mjs";

/**
 * World data migrations and the synchronization utilities they depend upon.
 * Migration passes are version-gated in {@link performMigrations} so each one retires itself once it has run.
 */

/**
 * Resolved once this world is known to be at the current system version and safe for downstream migrations.
 * A world which requires migration never resolves this, because migrating always ends in a page reload; awaiting
 * modules resume on the next load instead, against fully migrated data.
 * @type {PromiseWithResolvers<void>}
 */
const migration = Promise.withResolvers();

/**
 * @see {@link migration}
 * @type {Promise<void>}
 */
export const migrating = migration.promise;

/* -------------------------------------------- */
/*  Synchronization Utilities                   */
/* -------------------------------------------- */

/**
 * Sync talent data across all actors in the world if their synchronized version is stale.
 * @param {object} options
 * @param {boolean} [options.force]     Force syncing even if the actor stats are current
 * @param {boolean} [options.reload]    Auto-reload when synchronization is complete
 * @param {boolean} [options.talents]   Sync actor talents
 * @param {boolean} [options.spells]    Sync actor iconic spells
 * @param {boolean} [options.equipment] Sync actor equipment
 * @returns {Promise<void>}
 */
export async function syncOwnedItems({force=false, reload=true, talents=true, spells=true, equipment=false}={}) {
  console.groupCollapsed("Crucible | Owned Item Synchronization");

  // Prepare equipment compendium index
  let equipmentIndex;
  if ( equipment ) {
    const pack = game.packs.get("crucible.equipment");
    await pack.getDocuments();
    equipmentIndex = pack.contents.reduce((obj, item) => {
      obj[item.system.identifier] = item;
      return obj;
    }, {});
  }

  // Sync actor-owned items
  const bar = {n: 0, total: game.actors.size, pct: 0};
  const progress = ui.notifications.info(_loc("CRUCIBLE.Syncing"), {console: true, progress: true});
  for ( const actor of game.actors ) {
    bar.n++;
    bar.pct = bar.n / bar.total;
    if ( force || foundry.utils.isNewerVersion(crucible.version, actor._stats.systemVersion) ) {
      try {
        const batchCreate = [];
        const batchUpdate = [];
        const batchDelete = [];
        const actorUpdate = {"_stats.systemVersion": game.system.version};
        if ( talents ) {
          const {toCreate, toUpdate, toDelete, actorUpdates} = await actor.syncTalents({performUpdates: false});
          batchCreate.push(...toCreate);
          batchUpdate.push(...toUpdate);
          batchDelete.push(...toDelete);
          Object.assign(actorUpdate, actorUpdates);
        }
        if ( spells ) {
          const {toCreate, toUpdate, toDelete} = await actor.syncIconicSpells({performUpdates: false});
          batchCreate.push(...toCreate);
          batchUpdate.push(...toUpdate);
          batchDelete.push(...toDelete);
        }
        if ( equipment ) {
          for ( const item of actor.items ) {
            const update = _migrateEquipmentItem(item, equipmentIndex);
            if ( update ) {
              batchUpdate.push(update);
              console.debug(`Syncing equipment: ${item.name} in Actor ${actor.name} [${item.uuid}]`);
            }
          }
        }
        const batchOperations = actor.defineBatchOperations(actorUpdate, {
          createItems: {changes: batchCreate, options: {keepId: true}},
          updateItems: {changes: batchUpdate, options: {diff: false, recursive: false, noHook: true}},
          deleteItems: batchDelete
        });
        await foundry.documents.modifyBatch(batchOperations);
      } catch(err) {
        console.warn(`Crucible | Item synchronization failed for Actor "${actor.name}": ${err.message}`);
      } finally {
        progress.update({pct: bar.pct, message: actor.name});
      }
    }
  }
  progress.update({pct: 1});
  console.groupEnd();
  if ( reload ) foundry.utils.debouncedReload();
}

/* -------------------------------------------- */

/**
 * Sync world-level equipment items with their upstream compendium source data.
 * @param {object} [options]
 * @param {boolean} [options.equipment=true]      Sync physical equipment items
 * @returns {Promise<void>}
 */
export async function syncWorldItems({equipment=true}={}) {
  console.groupCollapsed("Crucible | World Item Synchronization");
  if ( equipment ) {
    const source = game.packs.get("crucible.equipment");
    await source.getDocuments();
    const equipmentIndex = source.contents.reduce((obj, item) => {
      obj[item.system.identifier] = item;
      return obj;
    }, {});

    // Plan and commit one update operation per collection
    for await ( const {documents, pack} of _worldCollections("Item") ) {
      const updates = [];
      for ( const item of documents ) {
        const update = _migrateEquipmentItem(item, equipmentIndex);
        if ( update ) {
          updates.push(update);
          console.debug(`Syncing equipment: ${item.name} [${item.uuid}]`);
        }
      }
      if ( updates.length ) await Item.updateDocuments(updates, pack ? {pack: pack.collection} : {});
    }
  }
  console.groupEnd();
}

/* -------------------------------------------- */

/**
 * Build an update object that syncs a single equipment item with its upstream compendium source.
 * @param {CrucibleItem} item                         The owned item to sync
 * @param {Record<string, CrucibleItem>} index        The equipment compendium index keyed by identifier
 * @returns {object|null}
 */
function _migrateEquipmentItem(item, index) {
  if ( !SYSTEM.ITEM.PHYSICAL_ITEM_TYPES.has(item.type) ) return null;
  const currentSource = item.toObject();
  const upstreamSource = index[item.system.identifier]?.toObject();
  if ( !upstreamSource ) return null;
  const update = {_id: item.id, type: upstreamSource.type, name: upstreamSource.name, img: upstreamSource.img, system: upstreamSource.system};
  const stateFields = [...item.system.constructor.STATEFUL_FIELDS, "quantity", "quality", "enchantment"];
  for ( const field of stateFields ) {
    const value = currentSource.system[field];
    if ( value !== undefined ) foundry.utils.setProperty(update.system, field, value);
  }
  update.system = _replace(update.system); // Force full replacement
  return update;
}

/* -------------------------------------------- */
/*  Data Migrations                             */
/* -------------------------------------------- */

/**
 * Iterate the document collections which belong to this World: the base collection and World-owned packs.
 * Unlock packs and re-lock after yielding each of their documents.
 * @param {string} documentName   The document type to collect, e.g. "Actor" or "Item"
 * @yields {{documents: Iterable<Document>, pack: CompendiumCollection|null}}
 */
async function* _worldCollections(documentName) {
  yield {documents: game.collections.get(documentName), pack: null};
  for ( const pack of game.packs ) {
    if ( (pack.documentName !== documentName) || (pack.metadata.packageType !== "world") ) continue;
    const wasLocked = pack.locked;
    if ( wasLocked ) await pack.configure({locked: false});
    try {
      yield {documents: await pack.getDocuments(), pack};
    } finally {
      if ( wasLocked ) await pack.configure({locked: true});
    }
  }
}

/* -------------------------------------------- */

/**
 * Resolve the effective world migration version, inferring a baseline for quickstart worlds whose setting is 0.0.0.
 * @returns {string} The resolved migration version.
 */
export function getMigrationVersion() {
  const mv = game.settings.get("crucible", "migrationVersion");
  if ( mv !== "0.0.0" ) return mv;

  // A quickstart world reports 0.0.0 despite holding content from a later vintage; recover the oldest such vintage
  // from the recorded adventure imports.
  const imports = game.settings.get("core", "adventureImports");
  let baseline = null;
  for ( const data of Object.values(imports) ) {
    if ( !data.quickstart?.quickstarted || !data.systemVersion ) continue;
    if ( !baseline || foundry.utils.isNewerVersion(baseline, data.systemVersion) ) baseline = data.systemVersion;
  }
  return baseline ?? mv;
}

/* -------------------------------------------- */

/**
 * Resolve {@link migrating} to release modules which deferred their own migrations until this world was current.
 * Called only when no migration was required, since a migration ends in a reload instead.
 */
export function resolveMigrating() {
  migration.resolve();
}

/* -------------------------------------------- */

/**
 * Perform one-time data migrations for the current world.
 * @param {string} priorVersion
 * @returns {Promise<void>}
 */
export async function performMigrations(priorVersion) {
  const upgradingTo = version => foundry.utils.isNewerVersion(version, priorVersion);

  // Always sync world items and owned items
  await syncWorldItems({equipment: true});
  await syncOwnedItems({equipment: true, force: true, reload: false});

  // Retire flanked active effects in 0.10.2
  if ( upgradingTo("0.10.2") ) await _deleteFlankedEffects();

  // Proficiency redesign requires full respec in 0.11.0
  if ( upgradingTo("0.11.0") ) {
    await _syncDetailItems();
    await _resetHeroTalents();
  }

  // Record the new migration version, then reload so every client re-initializes against the migrated world.
  // The reload is load-bearing: `migrating` is deliberately left unresolved on this path, so a migration which
  // returned without reloading would leave awaiting modules hanging forever.
  await game.settings.set("crucible", "migrationVersion", crucible.version);
  window.location.reload();
}

/* -------------------------------------------- */

/**
 * Re-apply the Ancestry, Background, Archetype, and Taxonomy snapshots held by each Actor from their sources.
 * Detail items gained Proficiency grants in 0.11.0.
 * @returns {Promise<void>}
 */
async function _syncDetailItems() {
  console.groupCollapsed("Crucible | Detail Item Synchronization");
  for await ( const {documents} of _worldCollections("Actor") ) for ( const actor of documents ) {
    if ( !actor.system.schema.has("details") ) continue;
    try {
      const {applied, unresolved} = await actor.syncDetailItems();
      if ( applied.length ) console.debug(`Synced ${applied.join(", ")} for ${actor.name} [${actor.uuid}]`);
      for ( const type of unresolved ) {
        console.warn(`Could not resolve the source ${type} for Actor "${actor.name}" [${actor.uuid}]`);
      }
    } catch(cause) {
      console.error(new Error(`Failed to sync detail items for Actor "${actor.name}" [${actor.uuid}]`, {cause}));
    }
  }
  console.groupEnd();
}

/* -------------------------------------------- */

/**
 * Refund every Talent Point spent by each hero, requiring a full respec.
 * The 0.11.0 tree reorganization retired talents wholesale and repositioned nodes, so prior selections cannot be
 * meaningfully preserved. Talents granted by a detail item are permanent and survive the reset.
 * @returns {Promise<void>}
 */
async function _resetHeroTalents() {
  console.groupCollapsed("Crucible | Hero Talent Reset");
  for await ( const {documents} of _worldCollections("Actor") ) for ( const actor of documents ) {
    if ( actor.type !== "hero" ) continue;
    try {
      await actor.resetTalents({dialog: false});
      console.debug(`Reset talents for ${actor.name} [${actor.uuid}]`);
    } catch(cause) {
      console.error(new Error(`Failed to reset talents for Actor "${actor.name}" [${actor.uuid}]`, {cause}));
    }
  }
  console.groupEnd();
}

/* -------------------------------------------- */

/**
 * Delete the ActiveEffects which the retired automatic flanking system committed to Actors, wherever they persist.
 * Flanking is now derived per-attacker at the moment of use, so these persisted effects are inert automation
 * artifacts. They are identified by their "flanked" subtype, which no manually applied condition ever carries.
 * @returns {Promise<void>}
 */
async function _deleteFlankedEffects() {
  console.groupCollapsed("Crucible | Retired Flanking Effect Cleanup");
  const retiredIds = effects => (effects ?? []).filter(e => e.type === "flanked").map(e => e._id);
  const deleteRetired = async (actor, ids) => {
    await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    console.debug(`Deleted ${ids.length} retired flanking effect(s) from ${actor.name} [${actor.uuid}]`);
  };

  // World Actors, and Actors in world packs which may have been exported while flanked, own their effects directly
  for await ( const {documents} of _worldCollections("Actor") ) for ( const actor of documents ) {
    const ids = retiredIds(actor._source.effects);
    if ( ids.length ) await deleteRetired(actor, ids);
  }

  // An unlinked Token holds an ActorDelta whose own effects are addressed through its synthetic Actor
  for ( const scene of game.scenes ) {
    for ( const token of scene.tokens ) {
      if ( token.isLinked ) continue;
      const ids = retiredIds(token._source.delta?.effects);
      if ( !ids.length ) continue;
      if ( token.actor ) await deleteRetired(token.actor, ids);
      else console.warn(`Could not resolve the Actor for Token [${token.uuid}] to delete its flanking effects`);
    }
  }
  console.groupEnd();
}
