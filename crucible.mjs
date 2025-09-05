/**
 * Crucible Game System
 * Author: Atropos of Foundry Virtual Tabletop
 * Software License: MIT
 * Repository: https://github.com/foundryvtt/crucible
 */

// Configuration
import {SYSTEM} from "./module/config/system.mjs";
globalThis.SYSTEM = SYSTEM;

import CrucibleTalentNode from "./module/config/talent-node.mjs";
import {statusEffects} from "./module/config/statuses.mjs";
import CrucibleSelectiveGridShader from "./module/canvas/shaders/grid-shader.mjs";

// Import Modules
import * as applications from "./module/applications/_module.mjs";
import * as canvas from "./module/canvas/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as models from "./module/models/_module.mjs";
import * as audio from "./module/audio.mjs";
import * as hooks from "./module/hooks/_module.mjs";

// Helpers
import {handleSocketEvent} from "./module/socket.mjs";
import {registerEnrichers} from "./module/enrichers.mjs";
import * as chat from "./module/chat.mjs";
import * as interaction from "./module/interaction.mjs";
import Enum from "./module/config/enum.mjs";
import CrucibleHitBoxShader from "./module/canvas/shaders/hit-box-shader.mjs";
import CrucibleHitboxLayer from "./module/canvas/hit-box.mjs";

// Party
let party = null;

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);
  const crucible = globalThis.crucible = game.system;
  crucible.CONST = SYSTEM;
  CrucibleTalentNode.defineTree();
  crucible.developmentMode = game.data.options.debug;
  crucible.vfxEnabled = !!game.modules.get("foundryvtt-vfx")?.active;

  // Expose the system API
  crucible.api = {
    applications,
    audio,
    canvas,
    dice,
    interaction,
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
    },
    hooks
  }

  /**
   * Configurable properties of the system which affect its behavior.
   */
  crucible.CONFIG = {
    /**
     * Configured setting-specific currency denominations.
     * @type {Record{string, CrucibleCurrencyDenomination}
     * @see @link{SYSTEM.ACTOR.CURRENCY_DENOMINATIONS}
     */
    currency: foundry.utils.deepClone(SYSTEM.ACTOR.CURRENCY_DENOMINATIONS),

    /**
     * Configuration of compendium packs which are used as sources for system workflows.
     * @type {Record<string, Set<string>>}
     */
    packs: {
      ancestry: new Set([SYSTEM.COMPENDIUM_PACKS.ancestry]),
      background: new Set([SYSTEM.COMPENDIUM_PACKS.background]),
      spell: new Set([SYSTEM.COMPENDIUM_PACKS.spell]),
      talent: new Set([SYSTEM.COMPENDIUM_PACKS.talent]),
    },
    /**
     * The character creation sheet class which should be registered
     * @type {typeof applications.CrucibleHeroCreationSheet}
     */
    heroCreationSheet: applications.CrucibleHeroCreationSheet,

    /**
     * The knowledge topics configured for the system.
     * @type {Record<string, CrucibleKnowledgeConfig>}
     */
    knowledge: foundry.utils.deepClone(SYSTEM.SKILL.DEFAULT_KNOWLEDGE),

    /**
     * The categories a language can belong to.
     * @type {Record<string, {label: string}}
     */
    languageCategories: foundry.utils.deepClone(SYSTEM.ACTOR.LANGUAGE_CATEGORIES),

    /**
     * The languages a creature can know.
     * @type {Record<string, {label: string, category?: string}>}
     */
    languages: foundry.utils.deepClone(SYSTEM.ACTOR.LANGUAGES)
  };
  /** @deprecated */
  crucible.CONFIG.ancestryPacks = crucible.CONFIG.packs.ancestry;

  /**
   * The primary party of player characters.
   * @type {CrucibleActor|null}
   */
  Object.defineProperty(crucible, "party", {
    get() {
      return party;
    }
  });

  // Actor document configuration
  CONFIG.Actor.documentClass = documents.CrucibleActor;
  CONFIG.Actor.dataModels = {
    adversary: models.CrucibleAdversaryActor,
    hero: models.CrucibleHeroActor,
    group: models.CrucibleGroupActor
  };

  // Combat document configuration
  CONFIG.Combat.documentClass = documents.CrucibleCombat;
  CONFIG.Combat.dataModels = {
    combat: models.CrucibleCombatChallenge,
    exploration: models.CrucibleExplorationChallenge,
    social: models.CrucibleSocialChallenge
  };

  // Custom grid shader class for all grid types
  for ( const gridType in CONFIG.Canvas.gridStyles ) {
    CONFIG.Canvas.gridStyles[gridType].shaderClass = CrucibleSelectiveGridShader;
  }

  // Item document configuration
  CONFIG.Item.documentClass = documents.CrucibleItem;
  CONFIG.Item.dataModels = {
    accessory: models.CrucibleAccessoryItem,
    ancestry: models.CrucibleAncestryItem,
    archetype: models.CrucibleArchetypeItem,
    armor: models.CrucibleArmorItem,
    background: models.CrucibleBackgroundItem,
    consumable: models.CrucibleConsumableItem,
    loot: models.CrucibleLootItem,
    spell: models.CrucibleSpellItem,
    talent: models.CrucibleTalentItem,
    taxonomy: models.CrucibleTaxonomyItem,
    weapon: models.CrucibleWeaponItem
  };
  CONFIG.Item.compendiumIndexFields = ["system.identifier"];

  // Other Document Configuration
  CONFIG.ChatMessage.documentClass = documents.CrucibleChatMessage;
  CONFIG.Combatant.documentClass = documents.CrucibleCombatant;
  CONFIG.Scene.documentClass = documents.CrucibleScene;
  CONFIG.Token.documentClass = documents.CrucibleToken;
  CONFIG.Token.objectClass = canvas.CrucibleTokenObject;

  // Time
  CONFIG.time.roundTime = SYSTEM.TIME.roundSeconds;

  // Sheet Registrations
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  sheets.registerSheet(Actor, SYSTEM.id, applications.HeroSheet, {types: ["hero"], label: "CRUCIBLE.SHEETS.Hero", makeDefault: true});
  sheets.registerSheet(Actor, SYSTEM.id, applications.AdversarySheet, {types: ["adversary"], label: "CRUCIBLE.SHEETS.Adversary", makeDefault: true});
  sheets.registerSheet(Actor, SYSTEM.id, applications.CrucibleGroupActorSheet, {types: ["group"], label: "CRUCIBLE.SHEETS.Group", makeDefault: true});

  sheets.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleAccessoryItemSheet, {types: ["accessory"], label: "CRUCIBLE.SHEETS.Accessory", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleAncestryItemSheet, {types: ["ancestry"], label: "CRUCIBLE.SHEETS.Ancestry", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleArchetypeItemSheet, {types: ["archetype"], label: "CRUCIBLE.SHEETS.Archetype", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleArmorItemSheet, {types: ["armor"], label: "CRUCIBLE.SHEETS.Armor", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleBackgroundItemSheet, {types: ["background"], label: "CRUCIBLE.SHEETS.Background", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleConsumableItemSheet, {types: ["consumable"], label: "CRUCIBLE.SHEETS.Consumable", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleLootItemSheet, {types: ["loot"], label: "CRUCIBLE.SHEETS.Loot", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleTaxonomyItemSheet, {types: ["taxonomy"], label: "CRUCIBLE.SHEETS.Taxonomy", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleWeaponItemSheet, {types: ["weapon"], label: "CRUCIBLE.SHEETS.Weapon", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleSpellItemSheet, {types: ["spell"], label: "CRUCIBLE.SHEETS.Spell", makeDefault: true});
  sheets.registerSheet(Item, SYSTEM.id, applications.CrucibleTalentItemSheet, {types: ["talent"], label: "CRUCIBLE.SHEETS.Talent", makeDefault: true});

  sheets.registerSheet(JournalEntry, SYSTEM.id, applications.CrucibleJournalSheet, {label: "CRUCIBLE.SHEETS.Journal"});

  // Core Application Overrides
  CONFIG.ui.combat = applications.CrucibleCombatTracker;

  // Custom HTML Elements
  for ( const element of Object.values(applications.elements) ) {
    window.customElements.define(element.tagName, element);
  }

  // Rich Text Enrichers
  registerEnrichers();

  // Dice system configuration
  CONFIG.Dice.rolls.push(dice.StandardCheck, dice.AttackRoll, dice.PassiveCheck, dice.InitiativeCheck);

  // Status Effects
  CONFIG.statusEffects = statusEffects;
  CONFIG.specialStatusEffects.BLIND = "blinded";

  // Canvas Configuration
  canvas.configure();

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

  // Primary party
  game.settings.register("crucible", "party", {
    name: "SETTINGS.CruciblePartyLabel",
    hint: "SETTINGS.CruciblePartyHint",
    scope: "world",
    config: true,
    type: new foundry.data.fields.ForeignDocumentField(documents.CrucibleActor,
      {required: false, idOnly: true, choices: () => game.actors.reduce((obj, a) => {
        if ( a.type === "group" ) obj[a.id] = a.name;
        return obj;
      }, {"": "-- None -- "})
    }),
    default: null,
    onChange: actorId => party = game.actors.get(actorId)
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

  // Patch door sound radius - can we do this better elsewhere?
  Object.defineProperty(foundry.canvas.placeables.Wall.prototype, "soundRadius", {
    get() {
      if ( !canvas.scene ) return 0;
      return canvas.scene.useMicrogrid ? 60 : canvas.dimensions.distance * 12;
    }
  });

  // Activate socket handler
  game.socket.on(`system.${SYSTEM.id}`, handleSocketEvent);

  // System Debugging Flags
  CONFIG.debug.talentTree = false;
  CONFIG.debug.flanking = false;
  if ( crucible.developmentMode ) registerDevelopmentHooks();

  // Add Hit Box layer
  CONFIG.Canvas.layers.crucibleHitBoxes = {
    group: "interface",
    layerClass: CrucibleHitboxLayer
  };
});

/* -------------------------------------------- */
/*  Config                                      */
/* -------------------------------------------- */

Hooks.once("canvasConfig", canvas => {
  // Register the hitbox batched shader
  CrucibleHitBoxShader.registerPlugin();
});

/* -------------------------------------------- */
/*  Localization                                */
/* -------------------------------------------- */

Hooks.once("i18nInit", function() {

  // Apply localizations
  const toLocalize = [
    ["ABILITIES", ["abbreviation", "label"]],
    "ACCESSORY.CATEGORIES", "ACCESSORY.PROPERTIES",
    "ACTOR.CREATURE_CATEGORIES",
    "ARMOR.CATEGORIES", "ARMOR.PROPERTIES",
    "CONSUMABLE.CATEGORIES", "CONSUMABLE.PROPERTIES",
    "DAMAGE_CATEGORIES", "DEFENSES",
    "ITEM.QUALITY_TIERS", "ITEM.ENCHANTMENT_TIERS", "ITEM.LOOT_CATEGORIES",
    "RESOURCES", "THREAT_RANKS",
    "WEAPON.CATEGORIES", "WEAPON.PROPERTIES", "WEAPON.TRAINING", "WEAPON.SLOTS"
  ];
  for ( let c of toLocalize ) {
    let key = c;
    let attrs = ["label"];
    if ( Array.isArray(c) ) [key, attrs] = c;
    const conf = foundry.utils.getProperty(SYSTEM, key);

    // Special handling for enums
    if ( conf instanceof Enum ) {
      for ( const [k, l] of Object.entries(conf.labels) ) conf.labels[k] = game.i18n.localize(l);
      Object.freeze(conf.labels);
      continue;
    }

    // Other objects
    for ( let [k, v] of Object.entries(conf) ) {
      if ( typeof v === "object" ) {
        for ( const attr of attrs ) {
          if ( typeof v[attr] === "function" ) v[attr] = v[attr]();
          else if ( typeof v[attr] === "string" ) v[attr] = game.i18n.localize(v[attr]);
        }
        Object.freeze(v);
      }
      else {
        if ( typeof v === "function" ) conf[k] = v();
        else if ( typeof v === "string" ) conf[k] = game.i18n.localize(v);
      }
    }
  }

  // Localize models
  foundry.helpers.Localization.localizeDataModel(models.CrucibleAction)

  // Pre-localize configuration objects
  preLocalizeConfig();

  // Initialize Spellcraft Components
  models.CrucibleSpellcraftGesture.initialize();
  models.CrucibleSpellcraftInflection.initialize();
  models.CrucibleSpellcraftRune.initialize();

  // Preload Handlebars Templates
  foundry.applications.handlebars.loadTemplates([
    `systems/${SYSTEM.id}/templates/dice/partials/action-use-header.hbs`,
    `systems/${SYSTEM.id}/templates/dice/partials/standard-check-roll.hbs`,
    `systems/${SYSTEM.id}/templates/dice/partials/standard-check-details.hbs`,
    `systems/${SYSTEM.id}/templates/sheets/item/talent-summary.hbs`
  ]);
});

/* -------------------------------------------- */

/**
 * Perform one-time configuration of system configuration objects.
 */
function preLocalizeConfig() {
  const localizeConfigObject = (obj, keys, freeze=true) => {
    for ( let o of Object.values(obj) ) {
      for ( let k of keys ) {
        const v = o[k];
        if ( typeof v === "function" ) o[k] = v();
        else if ( typeof v === "string" ) o[k] = game.i18n.localize(v);
      }
      if ( freeze ) Object.freeze(o);
    }
  }
  localizeConfigObject(SYSTEM.ACTION.TAGS, ["label", "tooltip"]);
  localizeConfigObject(SYSTEM.ACTION.TAG_CATEGORIES, ["label"]);
  localizeConfigObject(SYSTEM.DAMAGE_TYPES, ["label", "abbreviation"]);
  localizeConfigObject(SYSTEM.SKILL.CATEGORIES, ["label", "hint"]);
  localizeConfigObject(SYSTEM.SKILL.SKILLS, ["label"], false);
  localizeConfigObject(SYSTEM.TALENT.NODE_TYPES, ["label"]);
  localizeConfigObject(SYSTEM.TALENT.TRAINING_TYPES, ["group", "label"]);
  localizeConfigObject(SYSTEM.TALENT.TRAINING_RANKS, ["label"]);

  // Config objects
  localizeConfigObject(crucible.CONFIG.currency, ["label", "abbreviation"], false);
  localizeConfigObject(crucible.CONFIG.languageCategories, ["label"]);
  localizeConfigObject(crucible.CONFIG.languages, ["label"]);
}

/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

/**
 * On game setup, configure document data.
 */
Hooks.once("setup", function() {

  // Deferred registration of the hero creation sheet
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.registerSheet(Actor, SYSTEM.id, crucible.CONFIG.heroCreationSheet, {types: ["hero"],
    label: "CRUCIBLE.SHEETS.HeroCreation", makeDefault: false, canBeDefault: false, canConfigure: false});

  // Initialize Party
  party = game.actors.get(game.settings.get("crucible", "party")) || null;

  // Initialize Talent tree data
  CrucibleTalentNode.initialize();

  // Create Talent Tree canvas
  crucible.tree = new canvas.tree.CrucibleTalentTree();
});

/* -------------------------------------------- */

/**
 * On game ready, display the welcome journal if the user has not yet seen it.
 */
Hooks.once("ready", async function() {
  const welcome = game.settings.get("crucible", "welcome");
  if ( !welcome ) {
    const entry = await fromUuid("Compendium.crucible.rules.JournalEntry.5SgXrAKS2EnqVggJ");
    await entry.sheet.render({force: true});
    await game.settings.set("crucible", "welcome", true);
    await _initializePrototypeTokenSettings();
  }

  // FIXME bring this back with a migration version
  // if ( game.user === game.users.activeGM ) await syncTalents();

  // System-specific interaction
  document.body.addEventListener("pointerenter", interaction.onPointerEnter, true);
  document.body.addEventListener("pointerleave", interaction.onPointerLeave, true);
});

/* -------------------------------------------- */

/**
 * One time initialization of prototype token override preferences.
 * @returns {Promise<void>}
 */
async function _initializePrototypeTokenSettings() {
  if ( !game.user.isGM ) return;
  const overrides = game.settings.get("core", foundry.data.PrototypeTokenOverrides.SETTING);
  overrides.updateSource({
    base: {
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
    },
    hero: {
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      sight: {
        enabled: true
      }
    },
    adversary: {
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      sight: {
        enabled: false
      }
    }
  });
  await game.settings.set("core", foundry.data.PrototypeTokenOverrides.SETTING, overrides.toObject());
}

/* -------------------------------------------- */
/*  Rendering Hooks                             */
/* -------------------------------------------- */

Hooks.on("getChatMessageContextOptions", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessageHTML", documents.CrucibleChatMessage.onRenderHTML);
Hooks.on("targetToken", dice.ActionUseDialog.debounceChangeTarget);
Hooks.on("preDeleteChatMessage", models.CrucibleAction.onDeleteChatMessage);
Hooks.on("getSceneControlButtons", controls => {
  const flankingTool = {
    name: "debugFlanking",
    title: "Visualize Flanking",
    icon: "fa-solid fa-circles-overlap",
    toggle: true,
    active: false
  };
  flankingTool.onChange = (_event, active) => {
    CONFIG.debug.flanking = active
    for ( const token of globalThis.canvas.tokens.controlled ) {
      if ( active ) token._visualizeEngagement(token.engagement);
      else token._clearEngagementVisualization();
    }
  }
  controls.tokens.tools.debugFlanking = flankingTool;
});
Hooks.on("renderCombatTracker", models.CrucibleCombatChallenge.onRenderCombatTracker);

/* -------------------------------------------- */
/*  Canvas Hooks                                */
/* -------------------------------------------- */

/**
 * Actions to take when the main game canvas is re-rendered.
 * Re-open the talent tree if it was previously open for a certain Actor.
 */
Hooks.on("canvasReady", () => {
  if ( crucible.tree.actor ) crucible.tree.open(crucible.tree.actor, {resetView: false});
  for ( const token of globalThis.canvas.tokens.placeables ) token.renderFlags.set({refreshFlanking: true}); // No commit
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
  Hooks.on("preCreateItem", (item, data, options, _user) => {
    if ( options.keepId === false ) return;

    // Maintain IDs when importing from a compendium
    // TODO this can be removed in V14
    if ( options.fromCompendium ) {
      const {id} = foundry.utils.parseUuid(item._stats.compendiumSource);
      if ( id ) {
        item.updateSource({_id: id});
        options.keepId = true;
      }
      return;
    }

    // Keep existing _id while exporting into a compendium pack
    // TODO this can be removed in V14
    if ( item.pack && !item.parent && item.id ) {
      options.keepId = true;
      return;
    }

    // Generate a new ID
    if ( !item.parent && !item.id ) {
      item.updateSource({_id: generateId(item.name, 16)});
      options.keepId = true;
    }
  });

  Hooks.on("updateItem", async (item, _change, _options, _user) => {
    if ( crucible.CONFIG.packs.talent.has(item.pack) ) {
      await CrucibleTalentNode.initialize();
      crucible.tree.refresh();
    }
  });

  // Standardized IDs for Rules journal entry pages
  Hooks.on("preCreateJournalEntryPage", (page, data, options, _user) => {
    if ( (page.parent?.pack === "crucible.rules") && (options.keepId !== false) ) {
      page.updateSource({_id: generateId(page.name, 16)});
      options.keepId = true;
    }
  });
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
    if ( force || foundry.utils.isNewerVersion(crucible.version, actor._stats.systemVersion) ) {
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
  foundry.utils.debouncedReload();
}

/* -------------------------------------------- */

async function resetAllActorTalents() {
  for ( const actor of game.actors ) {
    const deleteIds = [];
    for ( const item of actor.items ) {
      if ( item.type !== "talent" ) continue;
      if ( actor.system.details.ancestry?.talents?.has(item.id) ) continue;
      if ( actor.system.details.background?.talents?.has(item.id) ) continue;
      if ( actor.system.details.archetype?.talents?.has(item.id) ) continue;
      if ( actor.system.details.taxonomy?.talents?.has(item.id) ) continue;
      deleteIds.add(item.id);
    }
    await actor.deleteEmbeddedDocuments("Item", deleteIds);
  }
}


/* -------------------------------------------- */
/*  ESModules API                               */
/* -------------------------------------------- */

export {SYSTEM} from "./module/config/system.mjs";
export * as applications from "./module/applications/_module.mjs";
export * as canvas from "./module/canvas/_module.mjs";
export * as dice from "./module/dice/_module.mjs";
export * as documents from "./module/documents/_module.mjs";
export * as models from "./module/models/_module.mjs";
export * as audio from "./module/audio.mjs";
export * as chat from "./module/chat.mjs";
