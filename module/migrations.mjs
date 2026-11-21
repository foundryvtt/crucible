import {SYSTEM} from "./const/system.mjs";

/**
 * @import CrucibleActor from "./documents/actor.mjs";
 * @import CrucibleItem from "./documents/item.mjs";
 */

/**
 * World data migrations and the synchronization utilities they depend upon.
 * Migration steps are declared in {@link MIGRATIONS} and run in priority order by {@link performMigrations}.
 */

/* -------------------------------------------- */
/*  Migration Declarations                      */
/* -------------------------------------------- */

/**
 * A one-time data migration step, selected by the version a World upgrades past and ordered by priority.
 * @typedef MigrationStep
 * @property {string} id                      A unique name for the step
 * @property {string} version                 Run when upgrading to this version, or "*" for every migration
 * @property {number} priority                Ascending run order among the selected steps
 * @property {boolean} [once]                 Run only while the World's recorded migration version predates this
 *                                            step, so a manual re-run never repeats it
 * @property {() => Promise<void>} migrate    Perform the step
 */

/**
 * Every migration step, run by {@link performMigrations}.
 * @type {MigrationStep[]}
 */
const MIGRATIONS = [

  // Renamed identifiers must be in place before equipment syncs match owned items to compendium items by identifier
  {id: "talismanIdentifiers", version: "0.11.4", priority: 10, migrate: _renameTalismanIdentifiers},

  // World Actors sync their equipment in the same write as their talents and spells
  {id: "worldEquipment", version: "*", priority: 20, migrate: () => syncWorldEquipment({worldActors: false})},
  {id: "worldActors", version: "*", priority: 30, migrate: () => syncWorldActors({force: true, reload: false})},
  {id: "flankedEffects", version: "0.10.2", priority: 40, migrate: _deleteFlankedEffects},

  // Ancestry renames in 0.11.1 require a detail sync, which also precedes the 0.11.0 proficiency respec
  {id: "detailItems", version: "0.11.1", priority: 50, migrate: _syncDetailItems},
  {id: "heroTalents", version: "0.11.0", priority: 60, once: true, migrate: _resetHeroTalents} // Refunds talents
];

/**
 * The document collections a migration applies to; each migration decides what it migrates within them.
 * @typedef MigrationScopes
 * @property {boolean} [worldItems]         The World Item collection
 * @property {boolean} [compendiumItems]    World-owned Item packs
 * @property {boolean} [worldActors]        The World Actor collection
 * @property {boolean} [compendiumActors]   World-owned Actor packs
 * @property {boolean} [worldScenes]        The World Scene collection
 * @property {boolean} [compendiumScenes]   World-owned Scene packs
 */

/**
 * The default migration scopes, which include every collection.
 * @type {Readonly<Required<MigrationScopes>>}
 */
const MIGRATION_SCOPES = Object.freeze({
  worldItems: true,
  compendiumItems: true,
  worldActors: true,
  compendiumActors: true,
  worldScenes: true,
  compendiumScenes: true
});

/**
 * Talisman identifiers retired in 0.11.4 in favor of identifiers which name their damage type and hands.
 * @type {Record<string, string>}
 */
const TALISMAN_IDENTIFIERS = {
  arcaneOrb: "talismanElectricity1",
  blightedBough: "talismanPoison2",
  boneCrook: "talismanCorruption2",
  ceremonialDagger: "talismanPiercing1",
  cinderWand: "talismanFire1",
  flameStaff: "talismanFire2",
  frostSpire: "talismanCold2",
  grimoire: "talismanBludgeoning1",
  holySymbol: "talismanRadiant1",
  lightningRod: "talismanElectricity2",
  lyre: "talismanPsychic1",
  primordialSeed: "talismanPoison1",
  prismaticSpindle: "talismanRadiant2",
  rimeCrystal: "talismanCold1",
  skullFetish: "talismanCorruption1",
  unblinkingEye: "talismanVoid1",
  verdigrisScepter: "talismanAcid2",
  warDrum: "talismanPsychic2",
  weepingGeode: "talismanAcid1",
  writhingCrozier: "talismanVoid2"
};

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
/*  Migration Lifecycle                         */
/* -------------------------------------------- */

/**
 * Resolve the effective world migration version, inferring a baseline for quickstart worlds whose setting is 0.0.0.
 * @returns {string} The resolved migration version.
 */
export function getMigrationVersion() {
  const mv = game.settings.get("crucible", "migrationVersion");
  if ( mv !== "0.0.0" ) return mv;
  const imports = game.settings.get("core", "adventureImports"); // Quickstart world reports 0.0.0
  let baseline = null;
  for ( const data of Object.values(imports) ) {
    if ( !data.quickstart?.quickstarted || !data.systemVersion ) continue;
    if ( !baseline || foundry.utils.isNewerVersion(baseline, data.systemVersion) ) baseline = data.systemVersion;
  }
  return baseline ?? mv;
}

/* -------------------------------------------- */

/**
 * Perform one-time data migrations for the current world.
 * A step which throws aborts the migration before the version is recorded, so every step runs again on the next load.
 * @param {string} [priorVersion="0.0.0"]   Run steps for versions newer than this, by default all repeatable steps
 * @returns {Promise<void>}
 */
export async function performMigrations(priorVersion="0.0.0") {
  if ( !game.user.isGM ) throw new Error("Only a Gamemaster may perform world migrations.");
  const recordedVersion = getMigrationVersion();
  const steps = MIGRATIONS.filter(s => {
    if ( s.version === "*" ) return true;
    if ( !foundry.utils.isNewerVersion(s.version, priorVersion) ) return false;
    return !s.once || foundry.utils.isNewerVersion(s.version, recordedVersion);
  });
  steps.sort((a, b) => a.priority - b.priority);
  const progress = ui.notifications.success(_loc("CRUCIBLE.MIGRATION.Title"), {progress: true, console: false});
  for ( const [i, step] of steps.entries() ) {
    const label = _loc(`CRUCIBLE.MIGRATION.STEPS.${step.id}`);
    const message = _loc("CRUCIBLE.MIGRATION.Progress", {step: label, index: i + 1, total: steps.length});
    progress.update({pct: i / steps.length, message});
    progress.element.style.order = "-1"; // Notifications prepend, so keep the overall bar above each step bar
    console.log(`Crucible | Migration step "${step.id}"`);
    await step.migrate();
  }
  progress.update({pct: 1});
  await game.settings.set("crucible", "migrationVersion", crucible.version); // Record completed migrations
  window.location.reload(); // Force reload as `migrating` is intentionally left unresolved
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
/*  Synchronization Utilities                   */
/* -------------------------------------------- */

/**
 * Index the equipment items of every configured equipment compendium pack by identifier.
 * @returns {Promise<Record<string, CrucibleItem>>}
 */
export async function getEquipmentIndex() {
  const items = [];
  for ( const packId of crucible.CONFIG.packs.equipment ) {
    const pack = game.packs.get(packId);
    if ( pack ) items.push(...await pack.getDocuments());
  }
  return _indexEquipment(items);
}

/* -------------------------------------------- */

/**
 * Build an update object that syncs a single equipment item with its upstream compendium source.
 * @param {CrucibleItem} item                         The owned item to sync
 * @param {Record<string, CrucibleItem>} index        The equipment compendium index keyed by identifier
 * @returns {object|null}
 */
export function migrateEquipmentItem(item, index) {
  if ( !SYSTEM.ITEM.PHYSICAL_ITEM_TYPES.has(item.type) ) return null;
  if ( item.getFlag("crucible", "customized")?.mechanics ) return null; // Detached from upstream by authored changes
  const currentSource = item.toObject();
  const upstream = index[item.system.identifier];
  if ( !upstream ) return null;
  const upstreamSource = upstream.toObject();
  const update = {_id: item.id, type: upstreamSource.type, name: upstreamSource.name, img: upstreamSource.img,
    system: upstreamSource.system};
  if ( !currentSource._stats.compendiumSource ) {
    update._stats = {...currentSource._stats, compendiumSource: upstream.uuid};
  }
  // Keep quality and enchantment, which belong to this instance (a Fine Longsword syncs from the base Longsword).
  // Detail grants instead take both from the granted item, so these are not retained as customizations.
  for ( const field of ["quality", "enchantment"] ) {
    const value = currentSource.system[field];
    if ( value !== undefined ) update.system[field] = value;
  }
  item._retainCustomizations(update);
  update.system = _replace(update.system); // Force full replacement
  return update;
}

/* -------------------------------------------- */

/**
 * Sync the owned Items of each World Actor whose synchronized system version is stale.
 * @param {object} options
 * @param {boolean} [options.force]     Force syncing even if the actor stats are current
 * @param {boolean} [options.reload]    Auto-reload when synchronization is complete
 * @param {boolean} [options.talents]   Sync actor talents
 * @param {boolean} [options.spells]    Sync actor iconic spells
 * @param {boolean} [options.equipment] Sync actor equipment
 * @returns {Promise<void>}
 */
export async function syncWorldActors({force=false, reload=true, talents=true, spells=true, equipment=true}={}) {
  const equipmentIndex = equipment ? await getEquipmentIndex() : undefined;
  await _migrateAllActors(_loc("CRUCIBLE.MIGRATION.STEPS.worldActors"), async actor => {
    if ( !force && !foundry.utils.isNewerVersion(crucible.version, actor._stats.systemVersion) ) return;
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
      const {toUpdate} = await actor.syncInventoryItems({performUpdates: false, index: equipmentIndex});
      batchUpdate.push(...toUpdate);
    }
    const batchOperations = actor.defineBatchOperations(actorUpdate, {
      createItems: {changes: batchCreate, options: {keepId: true}},
      updateItems: {changes: batchUpdate, options: {diff: false, recursive: false, noHook: true, _crucibleSync: true}},
      deleteItems: batchDelete
    });
    await foundry.documents.modifyBatch(batchOperations);
  }, {scope: {compendiumActors: false, worldScenes: false, compendiumScenes: false}}); // World Actors only
  if ( reload ) foundry.utils.debouncedReload();
}

/* -------------------------------------------- */

/**
 * Sync equipment Items in the World with their upstream compendium source data, wherever the Items are held.
 * @param {MigrationScopes} [scope]     Restrict the collections synced, all by default
 * @returns {Promise<void>}
 */
export async function syncWorldEquipment(scope={}) {
  const equipmentIndex = await getEquipmentIndex();
  const label = _loc("CRUCIBLE.MIGRATION.STEPS.worldEquipment");
  await _migrateAllItems(label, item => migrateEquipmentItem(item, equipmentIndex),
    {options: {diff: false, recursive: false, noHook: true}, scope});
}

/* -------------------------------------------- */
/*  Harnesses and Helpers                       */
/* -------------------------------------------- */

/**
 * Count the documents of a type in the World collections in scope, using pack indexes so no pack is loaded.
 * @param {string} documentName           The document type to count, e.g. "Actor" or "Item"
 * @param {object} [options]
 * @param {boolean} [options.world=true]    Include the base World collection
 * @param {boolean} [options.packs=true]    Include World-owned packs
 * @returns {number}
 */
function _countWorldDocuments(documentName, {world=true, packs=true}={}) {
  let count = world ? game.collections.get(documentName).size : 0;
  if ( packs ) for ( const pack of _worldPacks(documentName) ) count += pack.index.size;
  return count;
}

/* -------------------------------------------- */

/**
 * Index equipment items by identifier, preferring the standard quality item where several share an identifier.
 * @param {CrucibleItem[]} items                      The equipment compendium items
 * @returns {Record<string, CrucibleItem>}
 */
function _indexEquipment(items) {
  const index = {};
  for ( const item of items ) {
    const {identifier, quality} = item.system;
    if ( !(identifier in index) || (quality === "standard") ) index[identifier] = item;
  }
  return index;
}

/* -------------------------------------------- */

/**
 * Apply a migration to every Actor in the World and its world packs, including the synthetic Actors of unlinked Tokens.
 * @param {string} label                                          The localized migration name, shown in progress
 * @param {function(CrucibleActor): Promise<void>} migrateActor   Migrate one Actor
 * @param {object} [config]
 * @param {MigrationScopes} [config.scope]    Restrict the collections migrated; Scene scopes reach unlinked Tokens
 * @returns {Promise<void>}
 */
async function _migrateAllActors(label, migrateActor, {scope={}}={}) {
  console.groupCollapsed(`Crucible | ${label}`);
  scope = {...MIGRATION_SCOPES, ...scope};
  const migrate = async actor => {
    try {
      await migrateActor(actor);
    } catch(cause) {
      console.error(new Error(`${label} failed for Actor "${actor.name}" [${actor.uuid}]`, {cause}));
    }
  };

  const actorScope = {world: scope.worldActors, packs: scope.compendiumActors};
  const sceneScope = {world: scope.worldScenes, packs: scope.compendiumScenes};
  const progress = _trackProgress(label, _countWorldDocuments("Actor", actorScope)
    + _countWorldDocuments("Scene", sceneScope));

  // Actors
  for await ( const {documents} of _worldCollections("Actor", actorScope) ) for ( const actor of documents ) {
    await migrate(actor);
    progress.advance(1, actor.name);
  }

  // Synthetic Actors of unlinked Tokens
  for await ( const {documents} of _worldCollections("Scene", sceneScope) ) for ( const scene of documents ) {
    for ( const token of scene.tokens ) {
      if ( token.actorLink ) continue;
      if ( token.actor ) await migrate(token.actor);
      else console.debug(`Skipped Token [${token.uuid}] whose Actor could not be resolved`);
    }
    progress.advance(1, scene.name);
  }
  progress.complete();
  console.groupEnd();
}

/* -------------------------------------------- */

/**
 * Apply a migration to every Item in the World and its world packs, wherever the Item is held.
 * That covers standalone Items, Items owned by Actors, and Items held by the ActorDelta of unlinked Tokens in Scenes.
 * @param {string} label                                      The localized migration name, shown in progress
 * @param {function(CrucibleItem): object|null} planUpdate    Return the update for one Item, or null to skip it
 * @param {object} [config]
 * @param {object} [config.options]                           Additional options for each update operation
 * @param {MigrationScopes} [config.scope]                    Restrict the collections migrated, all by default
 * @returns {Promise<void>}
 */
async function _migrateAllItems(label, planUpdate, {options={}, scope={}}={}) {
  console.groupCollapsed(`Crucible | ${label}`);
  options = {...options, _crucibleSync: true}; // A migration is not an authored customization
  scope = {...MIGRATION_SCOPES, ...scope};
  const planUpdates = items => {
    const updates = [];
    for ( const item of items ) {
      const update = planUpdate(item);
      if ( update ) updates.push({...update, _id: item.id});
    }
    return updates;
  };
  const migrateEmbedded = async parent => {
    const updates = planUpdates(parent.items);
    if ( !updates.length ) return;
    try {
      await parent.updateEmbeddedDocuments("Item", updates, options);
      console.debug(`Migrated ${updates.length} Item(s) in ${parent.name ?? parent.parent?.name} [${parent.uuid}]`);
    } catch(cause) {
      console.error(new Error(`Failed to migrate Items in [${parent.uuid}]`, {cause}));
    }
  };

  const itemScope = {world: scope.worldItems, packs: scope.compendiumItems};
  const actorScope = {world: scope.worldActors, packs: scope.compendiumActors};
  const sceneScope = {world: scope.worldScenes, packs: scope.compendiumScenes};
  const progress = _trackProgress(label, _countWorldDocuments("Item", itemScope)
    + _countWorldDocuments("Actor", actorScope) + _countWorldDocuments("Scene", sceneScope));

  // Standalone Items
  for await ( const {documents, pack} of _worldCollections("Item", itemScope) ) {
    const updates = planUpdates(documents);
    if ( updates.length ) {
      await Item.updateDocuments(updates, pack ? {...options, pack: pack.collection} : options);
      console.debug(`Migrated ${updates.length} Item(s) in ${pack?.collection ?? "the World"}`);
    }
    progress.advance(documents.size ?? documents.length, pack?.title);
  }

  // Items owned by Actors
  for await ( const {documents} of _worldCollections("Actor", actorScope) ) for ( const actor of documents ) {
    await migrateEmbedded(actor);
    progress.advance(1, actor.name);
  }

  // Items held by the ActorDelta of an unlinked Token
  for await ( const {documents} of _worldCollections("Scene", sceneScope) ) for ( const scene of documents ) {
    for ( const token of scene.tokens ) {
      if ( !token.actorLink && token.delta ) await migrateEmbedded(token.delta);
    }
    progress.advance(1, scene.name);
  }
  progress.complete();
  console.groupEnd();
}

/* -------------------------------------------- */

/**
 * Display a progress notification for a migration which advances through a known number of documents.
 * @param {string} label    The migration name, shown in the notification
 * @param {number} total    The number of documents the migration will visit
 * @returns {{advance: function(number, string=): void, complete: function(): void}}
 */
function _trackProgress(label, total) {
  const progress = ui.notifications.info(label, {progress: true});
  let visited = 0;
  return {
    advance: (count, name) => {
      visited += count;
      const message = name ? _loc("CRUCIBLE.Parenthetical", {label, detail: name}) : label;
      progress.update({pct: total ? Math.min(visited / total, 0.99) : 0, message}); // Closes only once complete
    },
    complete: () => progress.remove() // Immediately, so that quick steps do not stack lingering completed bars
  };
}

/* -------------------------------------------- */

/**
 * Iterate the document collections which belong to this World: the base collection and World-owned packs.
 * Unlock packs and re-lock after yielding each of their documents.
 * @param {string} documentName           The document type to collect, e.g. "Actor" or "Item"
 * @param {object} [options]
 * @param {boolean} [options.world=true]    Include the base World collection
 * @param {boolean} [options.packs=true]    Include World-owned packs
 * @yields {{documents: Iterable<Document>, pack: CompendiumCollection|null}}
 */
async function* _worldCollections(documentName, {world=true, packs=true}={}) {
  if ( world ) yield {documents: game.collections.get(documentName), pack: null};
  if ( !packs ) return;
  for ( const pack of _worldPacks(documentName) ) {
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
 * The World-owned packs which hold documents of a type.
 * @param {string} documentName           The document type held, e.g. "Actor" or "Item"
 * @returns {CompendiumCollection[]}
 */
function _worldPacks(documentName) {
  return game.packs.filter(p => (p.documentName === documentName) && (p.metadata.packageType === "world"));
}

/* -------------------------------------------- */
/*  Migration Steps                             */
/* -------------------------------------------- */

/**
 * Delete leftover "flanked" ActiveEffects attached to actors or tokens.
 * @returns {Promise<void>}
 */
async function _deleteFlankedEffects() {
  const flankedId = SYSTEM.EFFECTS.getEffectId("flanked");
  await _migrateAllActors(_loc("CRUCIBLE.MIGRATION.STEPS.flankedEffects"), async actor => {
    const effects = actor.isToken ? actor.token._source.delta?.effects : actor._source.effects; // Only its own
    if ( !effects?.some(e => e._id === flankedId) ) return;
    await actor.deleteEmbeddedDocuments("ActiveEffect", [flankedId]);
    console.debug(`Deleted a retired flanking effect from ${actor.name} [${actor.uuid}]`);
  });
}

/* -------------------------------------------- */

/**
 * Rename retired talisman identifiers on every Item in the World.
 * @returns {Promise<void>}
 */
async function _renameTalismanIdentifiers() {
  await _migrateAllItems(_loc("CRUCIBLE.MIGRATION.STEPS.talismanIdentifiers"), item => {
    const identifier = (item.type === "weapon") ? TALISMAN_IDENTIFIERS[item._source.system?.identifier] : undefined;
    return identifier ? {"system.identifier": identifier} : null;
  });
}

/* -------------------------------------------- */

/**
 * Refund every Talent Point spent by each hero, requiring a full respec.
 * The 0.11.0 tree reorganization retired talents wholesale and repositioned nodes, so prior selections cannot be
 * meaningfully preserved. Talents granted by a detail item are permanent and survive the reset.
 * @returns {Promise<void>}
 */
async function _resetHeroTalents() {
  await _migrateAllActors(_loc("CRUCIBLE.MIGRATION.STEPS.heroTalents"), async actor => {
    if ( actor.type !== "hero" ) return;
    await actor.resetTalents({dialog: false});
    console.debug(`Reset talents for ${actor.name} [${actor.uuid}]`);
  }, {scope: {worldScenes: false, compendiumScenes: false}});
}

/* -------------------------------------------- */

/**
 * Re-apply the Ancestry, Background, Archetype, and Taxonomy snapshots held by each Actor from their sources.
 * @returns {Promise<void>}
 */
async function _syncDetailItems() {
  await _migrateAllActors(_loc("CRUCIBLE.MIGRATION.STEPS.detailItems"), async actor => {
    if ( !actor.system.schema.has("details") ) return;
    const {applied, unresolved} = await actor.syncDetailItems();
    if ( applied.length ) console.debug(`Synced ${applied.join(", ")} for ${actor.name} [${actor.uuid}]`);
    for ( const type of unresolved ) {
      console.warn(`Could not resolve the source ${type} for Actor "${actor.name}" [${actor.uuid}]`);
    }
  }, {scope: {worldScenes: false, compendiumScenes: false}}); // Syncing a synthetic Actor would copy its Items
}
