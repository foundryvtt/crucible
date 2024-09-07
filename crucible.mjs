/**
 * Crucible Game System
 * Author: Atropos of Foundry Virtual Tabletop
 * Software License: MIT
 * Repository: https://github.com/foundryvtt/crucible
 */

// Configuration
import {SYSTEM} from "./module/config/system.mjs";
globalThis.SYSTEM = SYSTEM;

import CrucibleTalentNode from "./module/config/talent-tree.mjs";
import {statusEffects} from "./module/config/statuses.mjs";

// Import Modules
import * as applications from "./module/applications/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as models from "./module/models/_module.mjs";

// Canvas
import CrucibleRuler from "./module/canvas/ruler.mjs";
import CrucibleTalentTree from "./module/canvas/talent-tree.mjs";
import CrucibleTokenObject from "./module/canvas/token.mjs";

// Helpers
import {handleSocketEvent} from "./module/socket.mjs";
import * as chat from "./module/chat.mjs";
import Enum from "./module/config/enum.mjs";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

const DEVELOPMENT_MODE = true;

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);
  globalThis.crucible = game.system;
  game.system.CONST = SYSTEM;
  CrucibleTalentNode.defineTree();

  // Expose the system API
  game.system.api = {
    applications,
    canvas: {
      CrucibleTalentTree
    },
    dice,
    models,
    documents,
    methods: {
      generateId,
      packageCompendium,
      resetAllActorTalents,
      standardizeItemIds,
      syncTalents
    },
    talents: {
      CrucibleTalentNode,
      nodes: CrucibleTalentNode.nodes
    }
  }

  // Actor document configuration
  CONFIG.Actor.documentClass = documents.CrucibleActor;
  CONFIG.Actor.dataModels = {
    adversary: models.CrucibleAdversary,
    hero: models.CrucibleHero
  };
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM.id, applications.HeroSheet, {types: ["hero"], makeDefault: true});
  Actors.registerSheet(SYSTEM.id, applications.AdversarySheet, {types: ["adversary"], makeDefault: true});

  // Item document configuration
  CONFIG.Item.documentClass = documents.CrucibleItem;
  CONFIG.Item.dataModels = {
    ancestry: models.CrucibleAncestry,
    archetype: models.CrucibleArchetype,
    armor: models.CrucibleArmor,
    background: models.CrucibleBackground,
    talent: models.CrucibleTalent,
    taxonomy: models.CrucibleTaxonomy,
    weapon: models.CrucibleWeapon
  };
  Items.unregisterSheet("core", ItemSheet);

  // V2 Registrations
  DocumentSheetConfig.registerSheet(Item, "crucible", applications.ArmorSheet, {
    types: ["armor"],
    makeDefault: true,
    label: "CRUCIBLE.SHEETS.Armor"
  });

  // V1 Registrations
  Items.registerSheet(SYSTEM.id, applications.AncestrySheet, {types: ["ancestry"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, applications.ArchetypeSheet, {types: ["archetype"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, applications.BackgroundSheet, {types: ["background"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, applications.TalentSheet, {types: ["talent"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, applications.TaxonomySheet, {types: ["taxonomy"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, applications.WeaponSheet, {types: ["weapon"], makeDefault: true});

  // Other Document Configuration
  CONFIG.ChatMessage.documentClass = documents.CrucibleChatMessage;
  CONFIG.Combat.documentClass = documents.CrucibleCombat;
  CONFIG.Combatant.documentClass = documents.CrucibleCombatant;
  CONFIG.Scene.documentClass = documents.CrucibleScene;
  CONFIG.Token.documentClass = documents.CrucibleToken;
  CONFIG.Token.objectClass = CrucibleTokenObject;

  // Journal Document Configuration
  Object.assign(CONFIG.JournalEntryPage.dataModels, {
    "skill": models.CrucibleSkill
  });
  DocumentSheetConfig.registerSheet(JournalEntry, SYSTEM.id, applications.CrucibleJournalSheet, {
    label: "CRUCIBLE.SHEETS.Journal"
  })
  DocumentSheetConfig.registerSheet(JournalEntryPage, SYSTEM.id, applications.SkillPageSheet, {
    types: ["skill"],
    makeDefault: true,
    label: "SKILL.PageSheet"
  });

  // Core Application Overrides
  CONFIG.ui.combat = applications.CrucibleCombatTracker;

  // Dice system configuration
  CONFIG.Dice.rolls.push(dice.StandardCheck, dice.AttackRoll);

  // Status Effects
  CONFIG.statusEffects = statusEffects;
  CONFIG.specialStatusEffects.BLIND = "blinded";

  // Canvas Configuration
  CONFIG.Canvas.rulerClass = CrucibleRuler;

  // Register settings
  game.settings.register("crucible", "actionAnimations", {
    name: "Enable Action Animations",
    hint: "Enable automatic action animations using Sequencer and JB2A. Both modules must be installed and enabled for this feature to work.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("crucible", "autoConfirm", {
    name: "SETTINGS.AutoConfirmName",
    hint: "SETTINGS.AutoConfirmHint",
    scope: "world",
    config: true,
    type: Number,
    choices: {
      0: "SETTINGS.AutoConfirmNone",
      1: "SETTINGS.AutoConfirmSelf",
      2: "SETTINGS.AutoConfirmAll"
    },
  });

  game.settings.register("crucible", "welcome", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });

  // Register keybindings
  game.keybindings.register("crucible", "confirm", {
    name: "KEYBINDINGS.ConfirmAction",
    hint: "KEYBINDINGS.ConfirmActionHint",
    editable: [{key: "KeyX"}],
    restricted: true,
    onDown: chat.onKeyboardConfirmAction
  });

  /**
   * Is animation enabled for the system?
   * @type {boolean}
   */
  Object.defineProperty(game.system, "animationEnabled", {
    value: game.settings.get("crucible", "actionAnimations")
      && game.modules.get("sequencer")?.active
      && ["JB2A_DnD5e", "jb2a_patreon"].some(id => game.modules.get(id)?.active),
    writable: false,
    configurable: true
  });

  // Activate socket handler
  game.socket.on(`system.${SYSTEM.id}`, handleSocketEvent);

  // System Debugging Flags
  CONFIG.debug.talentTree = false;
  CONFIG.debug.flanking = false;
  if ( DEVELOPMENT_MODE ) registerDevelopmentHooks();
});

/* -------------------------------------------- */
/*  Localization                                */
/* -------------------------------------------- */

Hooks.once("i18nInit", function() {

  // Apply localizations
  const toLocalize = [
    "ABILITIES", "ARMOR.CATEGORIES", "ARMOR.PROPERTIES", "DAMAGE_CATEGORIES", "DEFENSES",
    "RESOURCES", "THREAT_LEVELS",
    "QUALITY_TIERS", "ENCHANTMENT_TIERS",
    "ADVERSARY.TAXONOMY_CATEGORIES",
    "SKILL.CATEGORIES", "SKILL.RANKS",
    "WEAPON.CATEGORIES", "WEAPON.PROPERTIES", "WEAPON.SLOTS"
  ];
  for ( let c of toLocalize ) {
    const conf = foundry.utils.getProperty(SYSTEM, c);

    // Special handling for enums
    if ( conf instanceof Enum ) {
      for ( const [k, l] of Object.entries(conf.labels) ) conf.labels[k] = game.i18n.localize(l);
      Object.freeze(conf.labels);
      continue;
    }

    // Other objects
    for ( let [k, v] of Object.entries(conf) ) {
      if ( v.label ) v.label = game.i18n.localize(v.label);
      if ( v.abbreviation) v.abbreviation = game.i18n.localize(v.abbreviation);
      if ( typeof v === "string" ) conf[k] = game.i18n.localize(v);
    }
  }

  // Localize models
  Localization.localizeDataModel(models.CrucibleAction)

  // Pre-localize configuration objects
  preLocalizeConfig();

  // Initialize Spellcraft Components
  models.CrucibleGesture.initialize();
  models.CrucibleInflection.initialize();
  models.CrucibleRune.initialize();

  // Preload Handlebars Templates
  loadTemplates([
    `systems/${SYSTEM.id}/templates/dice/partials/action-use-header.hbs`,
    `systems/${SYSTEM.id}/templates/dice/partials/spell-cast-header.hbs`,
    `systems/${SYSTEM.id}/templates/dice/partials/standard-check-roll.hbs`,
    `systems/${SYSTEM.id}/templates/dice/partials/standard-check-details.hbs`,
    `systems/${SYSTEM.id}/templates/sheets/partials/talent-summary.hbs`
  ]);
});

/* -------------------------------------------- */

/**
 * Perform one-time configuration of system configuration objects.
 */
function preLocalizeConfig() {
  const localizeConfigObject = (obj, keys) => {
    for ( let o of Object.values(obj) ) {
      for ( let k of keys ) {
        o[k] = game.i18n.localize(o[k]);
      }
    }
  }

  // Statuses
  localizeConfigObject(CONFIG.statusEffects, ["label"]);

  // Action Tags
  localizeConfigObject(SYSTEM.DAMAGE_TYPES, ["label", "abbreviation"]);
  localizeConfigObject(SYSTEM.ACTION.TAGS, ["label", "tooltip"]);
  localizeConfigObject(SYSTEM.ACTION.TAG_CATEGORIES, ["label"]);
}

/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

/**
 * On game setup, configure document data.
 */
Hooks.once("setup", function() {

  // Initialize Skill Data
  models.CrucibleSkill.initialize();

  // Initialize Talent tree data
  CrucibleTalentNode.initialize();

  // Create Talent Tree canvas
  game.system.tree = new CrucibleTalentTree();

  // Activate window listeners
  $("#chat-log").on("mouseenter mouseleave", ".crucible.action .target-link", chat.onChatTargetLinkHover);
});

/* -------------------------------------------- */

/**
 * On game ready, display the welcome journal if the user has not yet seen it.
 */
Hooks.once("ready", async function() {
  const welcome = game.settings.get("crucible", "welcome");
  if ( !welcome ) {
    const entry = await fromUuid("Compendium.crucible.rules.JournalEntry.5SgXrAKS2EnqVggJ");
    entry.sheet.render(true);
    game.settings.set("crucible", "welcome", true);
  }
  // FIXME bring this back with a migration version
  // if ( game.user === game.users.activeGM ) await syncTalents();
});


/* -------------------------------------------- */
/*  Rendering Hooks                             */
/* -------------------------------------------- */

Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("createChatMessage", chat.onCreateChatMessage);
Hooks.on("renderChatMessage", chat.renderChatMessage);
Hooks.on("targetToken", dice.ActionUseDialog.debounceChangeTarget);
Hooks.on("preDeleteChatMessage", models.CrucibleAction.onDeleteChatMessage);

/**
 * Actions to take when the main game canvas is re-rendered.
 * Re-open the talent tree if it was previously open for a certain Actor.
 */
Hooks.on("canvasReady", () => {
  if ( game.system.tree.actor ) {
    game.system.tree.open(game.system.tree.actor, {resetView: false});
  }
});

Hooks.on("hotbarDrop", async (bar, data, slot) => {
  if ( data.type === "crucible.action" ) {
    const macro = await Macro.create(data.macroData);
    await game.user.assignHotbarMacro(macro, slot);
  }
});

/* -------------------------------------------- */
/*  Convenience Functions                       */
/* -------------------------------------------- */

/**
 * Package all documents of a certain type into their appropriate Compendium pack
 * @param {string} documentName
 * @param {string} packName
 * @param {Folder|string} folder
 * @returns {Promise<void>}
 */
async function packageCompendium(documentName, packName, folder) {
  const pack = game.packs.get(`crucible.${packName}`);
  if ( typeof folder === "string" ) {
    folder = game.folders.find(f => (f.type === documentName) && (f.name === folder));
  }
  if ( !(folder instanceof Folder) || (folder.type !== documentName) ) {
    throw new Error("Invalid folder provided to the packageCompendium method");
  }

  // Unlock the pack for editing
  await pack.configure({locked: false});

  // Delete all existing documents in the pack
  const cls = getDocumentClass(documentName);
  await pack.getDocuments();
  await cls.deleteDocuments([], {pack: pack.collection, deleteAll: true});
  await Folder.deleteDocuments(Array.from(pack.folders.keys()), {pack: pack.collection});

  // Export all children of the target folder
  await folder.exportToCompendium(pack, {keepId: true, keepFolders: true});

  // Re-lock the pack
  await pack.configure({locked: true});
}

/* -------------------------------------------- */

/**
 * Generate a Crucible-standardized document ID given a provided string title.
 * @param {string} title      An input string title
 * @param {number} [length]   A maximum ID length
 * @returns {string}          A standardized camel-case ID
 */
function generateId(title, length) {
  const id = title.split(" ").map((w, i) => {
    const p = w.slugify({replacement: "", strict: true});
    return i ? p.titleCase() : p;
  }).join("");
  return Number.isNumeric(length) ? id.slice(0, length).padEnd(length, "0") : id;
}

/* -------------------------------------------- */

/**
 * Standardize all World item IDs
 * @returns {Promise<void>}
 */
async function standardizeItemIds() {
  const creations = [];
  const deletions = [];
  for ( const item of game.items ) {
    const standardId = generateId(item.name, 16);
    if ( item.id === standardId ) continue;
    if ( game.items.has(standardId) ) throw new Error(`Standardized system ID ${standardId} is already in use`);
    deletions.push(item.id);
    creations.push(Object.assign(item.toObject(), {_id: standardId}));
  }
  await Item.deleteDocuments(deletions);
  await Item.createDocuments(creations, {keepId: true});
}

function registerDevelopmentHooks() {
  Hooks.on("preCreateItem", (item, data, options, user) => {
    if ( !item.parent && !item.id ) {
      item.updateSource({_id: generateId(item.name, 16)});
      options.keepId = true;
    }
  });

  Hooks.on("updateItem", async (item, change, options, user) => {
    const talentPacks = [SYSTEM.COMPENDIUM_PACKS.talent, SYSTEM.COMPENDIUM_PACKS.talentExtensions];
    if ( !talentPacks.includes(item.pack)  ) return;
    await CrucibleTalentNode.initialize();
    game.system.tree.refresh();
  })
}

/* -------------------------------------------- */

/**
 * Sync talent data across all actors in the world if their synchronized version is stale.
 * @param {boolean} [force]   Force syncing even if the actor stats are current
 * @returns {Promise<void>}
 */
async function syncTalents(force=false) {
  console.groupCollapsed("Crucible | Talent Data Synchronization")
  const total = game.actors.size;
  let n = 0;
  let synced = 0;
  for ( const actor of game.actors ) {
    n++;
    if ( force || foundry.utils.isNewerVersion(game.system.version, actor._stats.systemVersion) ) {
      try {
        await actor.syncTalents();
        console.log(`Crucible | Synchronized talents for Actor "${actor.name}"`);
        synced++;
      } catch(err) {
        console.warn(`Crucible | Talent synchronization failed for Actor "${actor.name}": ${err.message}`);
      }
      SceneNavigation.displayProgressBar({label: "Synchronizing Talent Data", pct: Math.round(n * 100 / total)});
    }
  }
  if ( synced ) SceneNavigation.displayProgressBar({label: "Synchronizing Talent Data", pct: 100});
  console.log(`Crucible | Complete talent synchronization for ${synced} Actors`);
  console.groupEnd();
}

/* -------------------------------------------- */

async function resetAllActorTalents() {
  const updates = [];
  for ( const actor of game.actors ) {
    const items = actor.items.reduce((arr, item) => {
      if ( item.type !== "talent" ) arr.push(item.toObject());
      return arr;
    }, []);
    updates.push({_id: actor.id, items});
  }
  return Actor.updateDocuments(updates, {recursive: false});
}
