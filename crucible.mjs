/**
 * Crucible Game System
 * Author: Atropos of Foundry Virtual Tabletop
 * Software License: MIT
 * Repository: https://github.com/foundryvtt/crucible
 */

// Configuration
import {SYSTEM} from "./module/const/system.mjs";
globalThis.SYSTEM = SYSTEM;

// Import Modules
import * as applications from "./module/applications/_module.mjs";
import * as canvas from "./module/canvas/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as models from "./module/models/_module.mjs";
import * as audio from "./module/audio.mjs";
import * as hooks from "./module/hooks/_module.mjs";
import {applyEmberPatches} from "./module/hooks/ember.mjs";

// Helpers
import {handleSocketEvent} from "./module/socket.mjs";
import {registerEnrichers} from "./module/enrichers.mjs";
import * as chat from "./module/chat.mjs";
import * as interaction from "./module/interaction.mjs";
import Enum from "./module/const/enum.mjs";
import CrucibleTalentNode from "./module/const/talent-node.mjs";
import {statusEffects} from "./module/const/statuses.mjs";

// Party
let party = null;

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log("Initializing Crucible Game System");
  const crucible = globalThis.crucible = game.system;
  crucible.CONST = SYSTEM;
  CrucibleTalentNode.defineTree();
  crucible.developmentMode = game.data.options.debug;

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
      syncOwnedItems,
      syncWorldItems
    },
    talents: {
      CrucibleTalentNode,
      nodes: CrucibleTalentNode.nodes,
      talentIds: CrucibleTalentNode.talentIds
    },
    hooks
  };

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
      equipment: new Set([SYSTEM.COMPENDIUM_PACKS.equipment]),
      spell: new Set([SYSTEM.COMPENDIUM_PACKS.spell]),
      talent: new Set([SYSTEM.COMPENDIUM_PACKS.talent])
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

  // Active Effect document configuration
  CONFIG.ActiveEffect.documentClass = documents.CrucibleActiveEffect;
  CONFIG.ActiveEffect.dataModels = {
    affix: models.CrucibleAffixActiveEffect,
    base: models.CrucibleBaseActiveEffect,
    flanked: models.CrucibleFlankedActiveEffect
  };
  Object.assign(CONFIG.ActiveEffect, {
    compendiumIndexFields: ["system.identifier", "system.affixType"],
    expiryAction: "delete"
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
    schematic: models.CrucibleSchematicItem,
    spell: models.CrucibleSpellItem,
    talent: models.CrucibleTalentItem,
    taxonomy: models.CrucibleTaxonomyItem,
    tool: models.CrucibleToolItem,
    weapon: models.CrucibleWeaponItem
  };
  CONFIG.Item.compendiumIndexFields = ["system.identifier"];

  // Configure dynamic constants
  for ( const [type, model] of Object.entries(CONFIG.Item.dataModels) ) {
    if ( foundry.utils.isSubclass(model, models.CruciblePhysicalItem) ) {
      SYSTEM.ITEM.PHYSICAL_ITEM_TYPES.add(type);
      if ( model.EQUIPABLE ) SYSTEM.ITEM.EQUIPABLE_ITEM_TYPES.add(type);
      if ( model.AFFIXABLE ) SYSTEM.ITEM.AFFIXABLE_ITEM_TYPES.add(type);
    }
  }
  Object.freeze(SYSTEM.ITEM.PHYSICAL_ITEM_TYPES);
  Object.freeze(SYSTEM.ITEM.EQUIPABLE_ITEM_TYPES);
  Object.freeze(SYSTEM.ITEM.AFFIXABLE_ITEM_TYPES);

  // Other Document Configuration
  CONFIG.ChatMessage.documentClass = documents.CrucibleChatMessage;
  CONFIG.Combatant.documentClass = documents.CrucibleCombatant;
  CONFIG.Scene.documentClass = documents.CrucibleScene;
  CONFIG.Token.documentClass = documents.CrucibleToken;
  CONFIG.Token.objectClass = canvas.CrucibleTokenObject;

  // Spellcraft Initialization
  Hooks.callAll("crucible.initializeSpellcraft");
  models.CrucibleSpellcraftGesture.initialize();
  models.CrucibleSpellcraftInflection.initialize();
  models.CrucibleSpellcraftRune.initialize();

  // Time
  CONFIG.time.roundTime = SYSTEM.TIME.roundSeconds;

  // Sheet Registrations
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  sheets.registerSheet(Actor, "crucible", applications.HeroSheet, {types: ["hero"], label: "CRUCIBLE.SHEETS.Hero", makeDefault: true});
  sheets.registerSheet(Actor, "crucible", applications.AdversarySheet, {types: ["adversary"], label: "CRUCIBLE.SHEETS.Adversary", makeDefault: true});
  sheets.registerSheet(Actor, "crucible", applications.CrucibleGroupActorSheet, {types: ["group"], label: "CRUCIBLE.SHEETS.Group", makeDefault: true});

  sheets.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  sheets.registerSheet(Item, "crucible", applications.CrucibleAccessoryItemSheet, {types: ["accessory"], label: "CRUCIBLE.SHEETS.Accessory", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleAncestryItemSheet, {types: ["ancestry"], label: "CRUCIBLE.SHEETS.Ancestry", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleArchetypeItemSheet, {types: ["archetype"], label: "CRUCIBLE.SHEETS.Archetype", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleArmorItemSheet, {types: ["armor"], label: "CRUCIBLE.SHEETS.Armor", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleBackgroundItemSheet, {types: ["background"], label: "CRUCIBLE.SHEETS.Background", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleConsumableItemSheet, {types: ["consumable"], label: "CRUCIBLE.SHEETS.Consumable", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleLootItemSheet, {types: ["loot"], label: "CRUCIBLE.SHEETS.Loot", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleTaxonomyItemSheet, {types: ["taxonomy"], label: "CRUCIBLE.SHEETS.Taxonomy", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleToolItemSheet, {types: ["tool"], label: "CRUCIBLE.SHEETS.Tool", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleWeaponItemSheet, {types: ["weapon"], label: "CRUCIBLE.SHEETS.Weapon", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleSchematicItemSheet, {types: ["schematic"], label: "CRUCIBLE.SHEETS.Schematic", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleSpellItemSheet, {types: ["spell"], label: "CRUCIBLE.SHEETS.Spell", makeDefault: true});
  sheets.registerSheet(Item, "crucible", applications.CrucibleTalentItemSheet, {types: ["talent"], label: "CRUCIBLE.SHEETS.Talent", makeDefault: true});

  sheets.registerSheet(ActiveEffect, "crucible", applications.CrucibleAffixEffectSheet, {types: ["affix"], label: "CRUCIBLE.SHEETS.Affix", makeDefault: true});

  sheets.registerSheet(JournalEntry, "crucible", applications.CrucibleJournalSheet, {label: "CRUCIBLE.SHEETS.Journal"});

  // Core Application Overrides
  CONFIG.ui.combat = applications.CrucibleCombatTracker;

  // Custom HTML Elements
  for ( const element of Object.values(applications.elements) ) {
    window.customElements.define(element.tagName, element);
  }

  // Font Definitions
  CONFIG.fontDefinitions.AwerySmallcaps = {
    editor: true,
    fonts: [{urls: ["systems/crucible/fonts/AwerySmallcaps/AwerySmallcaps.ttf"]}]
  };

  // Rich Text Enrichers
  registerEnrichers();

  // Register Handlebars helpers
  Handlebars.registerHelper({
    crucibleTags: (tags, options={}) => {
      const {enclosed=true, additionalClasses=null, tagType=null} = options.hash ?? {};
      const tagSpans = Object.entries(tags).map(([id, tag]) => {
        let classes = "tag";
        if ( tag.unmet ) classes += " unmet";
        if ( tag.cssClasses ) classes += ` ${foundry.utils.escapeHTML(tag.cssClasses)}`;
        const label = foundry.utils.escapeHTML(tag.label ?? tag);
        const styleString = tag.color ? ` style="--tag-color: ${tag.color.css}"` : "";
        const tooltipString = tag.tooltip ? ` data-crucible-tooltip-text="${tag.tooltip}"` : "";
        return `<span class="${classes}" data-crucible-tooltip="tag" data-tag="${id}"${styleString}${tooltipString}>${label}</span>`;
      });
      if ( !enclosed) return new Handlebars.SafeString(tagSpans.join(""));
      const enclosingClasses = `tags${additionalClasses ? ` ${foundry.utils.escapeHTML(additionalClasses)}` : ""}`;
      const tagTypeString = tagType ? ` data-tag-type="${foundry.utils.escapeHTML(tagType)}"` : "";
      return new Handlebars.SafeString(`<div class="${enclosingClasses}"${tagTypeString}>${tagSpans.join("")}</div>`);
    }
  });

  // Dice system configuration
  CONFIG.Dice.rolls.push(dice.StandardCheck, dice.AttackRoll, dice.PassiveCheck, dice.InitiativeCheck);

  // Queries
  CONFIG.queries.requestSkillCheck = dice.StandardCheck.handle.bind(dice.StandardCheck);
  CONFIG.queries.requestGroupCheck = dice.GroupCheck.handle.bind(dice.GroupCheck);
  CONFIG.queries.requestCounterspell = ({actorUuid, ...options}) => {
    return models.CrucibleCounterspellAction.prompt(actorUuid, options);
  };

  // Status Effects
  Object.defineProperty(CONFIG, "statusEffects", {value: statusEffects, configurable: true, enumerable: true});
  CONFIG.specialStatusEffects.BLIND = "blinded";
  CONFIG.specialStatusEffects.BURROW = "burrowing";

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
    }
  });

  game.settings.register("crucible", "enableVFX", {
    name: "SETTINGS.EnableVFXName",
    hint: "SETTINGS.EnableVFXHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // Migration Required Version
  game.settings.register("crucible", "migrationVersion", {
    scope: "world",
    config: false,
    default: "0.0.0",
    type: String
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

  const fields = foundry.data.fields;
  /**
   * Get the schema field for a given document and subtype.
   * @param {string} documentType
   * @param {string|null} type
   * @param {string} [labelKey]
   */
  function fieldForType(documentType, type, labelKey) {
    labelKey ??= type;
    const getPacks = (documentType, type) => {
      const potentialPacks = {};
      for (const pack of game.packs) {
        if (pack.metadata.type !== documentType) continue;
        for (const item of pack.index) {
          if (!type || item.type === type) {
            let group = `${_loc(`PACKAGE.Type.${pack.metadata.packageType}`)}: `;
            if ( pack.metadata.packageType === "system" ) group += game.system.title;
            else if ( pack.metadata.packageType === "world" ) group += game.world.title;
            else group += game.modules.get(pack.metadata.packageName).title;
            potentialPacks[pack.metadata.id] = {
              label: `${pack.metadata.label} (${pack.metadata.id})`,
              group
            };
            break;
          }
        }
      }
      return potentialPacks;
    };
    return new fields.SetField(new fields.StringField({ required: true, choices: () => getPacks(documentType, type)}), {
      label: `SETTINGS.COMPENDIUM_SOURCES.${labelKey}.label`,
      hint: `SETTINGS.COMPENDIUM_SOURCES.${labelKey}.hint`
    });
  }

  game.settings.register("crucible", "compendiumSources", {
    name: "SETTINGS.CompendiumSources.label",
    hint: "SETTINGS.CompendiumSources.hint",
    scope: "world",
    config: false,
    type: new fields.SchemaField({
      affix: fieldForType("ActiveEffect", "affix"),
      ancestry: fieldForType("Item", "ancestry"),
      background: fieldForType("Item", "background"),
      equipment: fieldForType("Item", null, "equipment"),
      spell: fieldForType("Item", "spell"),
      talent: fieldForType("Item", "talent")
    }),
    default: {
      affix: [SYSTEM.COMPENDIUM_PACKS.affix],
      ancestry: [SYSTEM.COMPENDIUM_PACKS.ancestry],
      background: [SYSTEM.COMPENDIUM_PACKS.background],
      equipment: [SYSTEM.COMPENDIUM_PACKS.equipment],
      spell: [SYSTEM.COMPENDIUM_PACKS.spell],
      talent: [SYSTEM.COMPENDIUM_PACKS.talent]
    },
    requiresReload: true
  });

  // Register settings menus
  game.settings.registerMenu("crucible", "compendiumSourcesConfig", {
    name: "SETTINGS.COMPENDIUM_SOURCES.name",
    label: "SETTINGS.COMPENDIUM_SOURCES.label",
    hint: "SETTINGS.COMPENDIUM_SOURCES.hint",
    icon: "fa-solid fa-book-open",
    type: applications.CompendiumSourcesConfig,
    restricted: true
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
      const scene = globalThis.canvas.scene;
      if ( !scene ) return 0;
      return scene.useMicrogrid ? 60 : globalThis.canvas.dimensions.distance * 12;
    }
  });

  // Activate socket handler
  game.socket.on("system.crucible", handleSocketEvent);

  // System Debugging Flags
  CONFIG.debug.talentTree = false;
  CONFIG.debug.flanking = false;
  if ( crucible.developmentMode ) {
    registerDevelopmentHooks();
    enableSpellcheckContext();
  }

  // Replace core layer class with custom grid layer class
  CONFIG.Canvas.layers.grid.layerClass = canvas.grid.CrucibleGridLayer;

  // Crucible-specific detection modes
  CONFIG.Canvas.detectionModes.thermalVision = new canvas.detectionModes.DetectionModeThermalVision({
    id: "thermalVision",
    label: "DETECTION_MODES.ThermalVision",
    type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT
  });
});

/* -------------------------------------------- */
/*  Config                                      */
/* -------------------------------------------- */

Hooks.once("canvasConfig", () => {
  canvas.grid.CrucibleHitBoxShader.registerPlugin();
});

/* -------------------------------------------- */
/*  Localization                                */
/* -------------------------------------------- */

Hooks.once("i18nInit", function() {

  // Localize DataModels
  foundry.helpers.Localization.localizeDataModel(models.CrucibleAction);
  foundry.helpers.Localization.localizeSchema(models.CrucibleAction.schema.fields.effects.element, ["EFFECT"], {prefixPath: "effects.element."});
  foundry.helpers.Localization.localizeDataModel(models.CrucibleSpellAction);
  foundry.helpers.Localization.localizeDataModel(models.CrucibleCounterspellAction);

  // Pre-localize configuration objects
  preLocalizeConfig();

  // Preload Handlebars Templates
  foundry.applications.handlebars.loadTemplates([
    ...Object.values(chat.TEMPLATES),
    "systems/crucible/templates/sheets/item/talent-summary.hbs"
  ]);
});

/* -------------------------------------------- */

/**
 * Perform one-time pre-localization of system configuration objects, mutating their `label` (and other localized
 * string fields) into resolved language strings before the SYSTEM is deep-frozen at the `setup` hook.
 */
function preLocalizeConfig() {
  const localizeConfigObject = (obj, keys=["label"]) => {

    // Special handling for legacy Enum instances which keep their labels in a separate dictionary
    if ( obj instanceof Enum ) {
      for ( const [k, l] of Object.entries(obj.labels) ) obj.labels[k] = _loc(l);
      return;
    }

    // Record-style enums where each entry is an object containing one or more localizable string keys
    for ( const o of Object.values(obj) ) {
      for ( const k of keys ) {
        const v = o[k];
        if ( typeof v === "function" ) o[k] = v();
        else if ( typeof v === "string" ) o[k] = _loc(v);
      }
    }
  };

  // Top-level system constants
  localizeConfigObject(SYSTEM.ABILITIES, ["abbreviation", "label", "group"]);
  localizeConfigObject(SYSTEM.DAMAGE_CATEGORIES);
  localizeConfigObject(SYSTEM.DAMAGE_TYPES, ["label", "abbreviation"]);
  localizeConfigObject(SYSTEM.DEFENSES);
  localizeConfigObject(SYSTEM.RESOURCES);
  localizeConfigObject(SYSTEM.TEMPERATURE_TIERS);
  localizeConfigObject(SYSTEM.THREAT_RANKS);

  // Accessory
  localizeConfigObject(SYSTEM.ACCESSORY.CATEGORIES);
  localizeConfigObject(SYSTEM.ACCESSORY.PROPERTIES);

  // Action
  localizeConfigObject(SYSTEM.ACTION.DEFAULT_ACTIONS, ["name", "description"]);
  localizeConfigObject(SYSTEM.ACTION.EFFECT_RESULT_TYPES);
  localizeConfigObject(SYSTEM.ACTION.TAG_CATEGORIES);
  localizeConfigObject(SYSTEM.ACTION.TAGS, ["label", "tooltip"]);
  localizeConfigObject(SYSTEM.ACTION.TARGET_TYPES);

  // Actor
  localizeConfigObject(SYSTEM.ACTOR.CREATURE_CATEGORIES);
  localizeConfigObject(SYSTEM.ACTOR.TRAVEL_PACES);

  // Armor
  localizeConfigObject(SYSTEM.ARMOR.CATEGORIES);
  localizeConfigObject(SYSTEM.ARMOR.PROPERTIES);

  // Consumable
  localizeConfigObject(SYSTEM.CONSUMABLE.CATEGORIES);
  localizeConfigObject(SYSTEM.CONSUMABLE.PROPERTIES);

  // Crafting
  localizeConfigObject(SYSTEM.CRAFTING.TRAINING);

  // Item
  localizeConfigObject(SYSTEM.ITEM.ENCHANTMENT_TIERS);
  localizeConfigObject(SYSTEM.ITEM.LOOT_CATEGORIES);
  localizeConfigObject(SYSTEM.ITEM.QUALITY_TIERS);
  localizeConfigObject(SYSTEM.ITEM.SCHEMATIC_CATEGORIES);
  localizeConfigObject(SYSTEM.ITEM.SCHEMATIC_PROPERTIES);
  localizeConfigObject(SYSTEM.ITEM.TOOL_CATEGORIES);

  // Skill
  localizeConfigObject(SYSTEM.SKILL.CATEGORIES, ["label", "hint"]);
  localizeConfigObject(SYSTEM.SKILL.SKILLS);

  // Spellcraft
  localizeConfigObject(SYSTEM.SPELL.GESTURES, ["name", "adjective"]);
  localizeConfigObject(SYSTEM.SPELL.INFLECTIONS, ["name", "adjective"]);
  localizeConfigObject(SYSTEM.SPELL.RUNES, ["name", "adjective"]);

  // Talent
  localizeConfigObject(SYSTEM.TALENT.NODE_TYPES);
  localizeConfigObject(SYSTEM.TALENT.TRAINING_RANKS);
  localizeConfigObject(SYSTEM.TALENT.TRAINING_TYPES, ["group", "label"]);

  // Weapon
  localizeConfigObject(SYSTEM.WEAPON.CATEGORIES);
  localizeConfigObject(SYSTEM.WEAPON.PROPERTIES);
  localizeConfigObject(SYSTEM.WEAPON.SLOTS);
  localizeConfigObject(SYSTEM.WEAPON.TRAINING);

  // CONFIG objects (not in SYSTEM)
  localizeConfigObject(crucible.CONFIG.currency, ["label", "abbreviation"]);
  localizeConfigObject(crucible.CONFIG.knowledge);
  localizeConfigObject(crucible.CONFIG.languageCategories);
  localizeConfigObject(crucible.CONFIG.languages);
}

/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

/**
 * On game setup, configure document data.
 */
Hooks.once("setup", function() {

  // Apply compatibility patches for Ember module hooks
  applyEmberPatches();

  // Cull deprecated item properties that have been fully migrated
  const mv = game.settings.get("crucible", "migrationVersion");
  for ( const model of Object.values(CONFIG.Item.dataModels) ) {
    const properties = model.ITEM_PROPERTIES;
    if ( !properties ) continue;
    for ( const [id, prop] of Object.entries(properties) ) {
      if ( prop.deprecated && !foundry.utils.isNewerVersion(prop.deprecated, mv) ) delete properties[id];
    }
  }

  // Deep freeze CONST
  foundry.utils.deepFreeze(SYSTEM);

  // Update compendium sources from settings
  const sources = game.settings.get("crucible", "compendiumSources");
  crucible.CONFIG.packs = Object.entries(sources).reduce((acc, [type, packs]) => {
    acc[type] = new Set(packs.filter(p => game.packs.has(p)));
    if ( !acc[type].size ) acc[type] = new Set([crucible.CONST.COMPENDIUM_PACKS[type]]);
    return acc;
  }, {});

  // Deferred registration of the hero creation sheet
  const sheets = foundry.applications.apps.DocumentSheetConfig;
  sheets.registerSheet(Actor, "crucible", crucible.CONFIG.heroCreationSheet, {types: ["hero"],
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

  // System-specific interaction
  document.body.addEventListener("pointerenter", interaction.onPointerEnter, true);
  document.body.addEventListener("pointerleave", interaction.onPointerLeave, true);

  // Perform World Migrations
  if ( game.users.activeGM?.isSelf ) {
    const mv = game.settings.get("crucible", "migrationVersion");
    if ( foundry.utils.isNewerVersion(crucible.version, mv) ) {
      await _performMigrations(mv);
    }
  }

  // Display Welcome Journal
  const welcome = game.settings.get("crucible", "welcome");
  if ( !welcome ) {
    const entry = await fromUuid("Compendium.crucible.rules.JournalEntry.5SgXrAKS2EnqVggJ");
    await entry.sheet.render({force: true});
    await game.settings.set("crucible", "welcome", true);
    await _initializePrototypeTokenSettings();
  }
});

/* -------------------------------------------- */

/**
 * On open detached windows, apply crucible interaction listeners
 */
Hooks.on("openDetachedWindow", (_id, window) => {
  window.document.body.addEventListener("pointerenter", interaction.onPointerEnter, true);
  window.document.body.addEventListener("pointerleave", interaction.onPointerLeave, true);
});

/* -------------------------------------------- */

/**
 * Perform one-time data migrations for the current world.
 * @param {string} priorVersion
 * @returns {Promise<void>}
 */
async function _performMigrations(priorVersion) {
  await syncWorldItems({equipment: true});
  await syncOwnedItems({equipment: true, force: true, reload: false});
  await game.settings.set("crucible", "migrationVersion", crucible.version);
  foundry.utils.debouncedReload();
}

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
    title: "CONTROLS.VisualizeFlanking",
    icon: "fa-solid fa-circles-overlap",
    toggle: true,
    active: false
  };
  flankingTool.onChange = (_event, active) => {
    CONFIG.debug.flanking = active;
    for ( const token of globalThis.canvas.tokens.controlled ) {
      if ( active ) token._visualizeEngagement(token.engagement);
      else token._clearEngagementVisualization();
    }
  };
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
    const p = w.slugify({replacement: "", lowercase: i === 0, strict: true});
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

/**
 * Register development-only hooks for debugging and ID management.
 */
function registerDevelopmentHooks() {
  Hooks.on("preCreateItem", (item, data, options, _user) => {
    if ( options.keepId === false ) return;
    // Generate a new ID
    if ( !item.parent && !item.id ) {
      const id = generateId(item.name, 16);
      const collection = item.pack ? game.packs.get(item.pack)?.index : game.items;
      if ( collection?.has(id) ) {
        ui.notifications.error(`A document with standardized ID "${id}" already exists. Resolve the conflict manually.`);
        return false;
      }
      item.updateSource({_id: id});
      options.keepId = true;
    }
  });

  Hooks.on("createItem", async item => {
    if ( (item.type === "talent") && item.system.nodes.size && crucible.CONFIG.packs.talent.has(item.pack) ) {
      await CrucibleTalentNode.initialize();
      crucible.tree.refresh();
    }
  });

  Hooks.on("updateItem", async item => {
    if ( (item.type === "talent") && item.system.nodes.size && crucible.CONFIG.packs.talent.has(item.pack) ) {
      await CrucibleTalentNode.initialize();
      crucible.tree.refresh();
    }
  });

  // Standardized IDs for Rules journal entry pages
  Hooks.on("preCreateJournalEntryPage", (page, data, options, _user) => {
    if ( (page.parent?.pack === "crucible.rules") && (options.keepId !== false) ) {
      const id = generateId(page.name, 16);
      if ( page.parent.pages.has(id) ) {
        ui.notifications.error(`A page with standardized ID "${id}" already exists in ${page.parent.name}. Resolve the conflict manually.`);
        return false;
      }
      page.updateSource({_id: id});
      options.keepId = true;
    }
  });
}

/* -------------------------------------------- */

/**
 * Allow context menu interaction inside prose-mirror if the CDT is enabled for spellcheck.
 */
function enableSpellcheckContext() {
  document.addEventListener("contextmenu", event => {
    if ( event.target.closest("prose-mirror .editor-content") ) event.stopPropagation();
  }, {capture: true});
}

/* -------------------------------------------- */

/**
 * Sync talent data across all actors in the world if their synchronized version is stale.
 * @param {object} options
 * @param {boolean} [options.force]     Force syncing even if the actor stats are current
 * @param {boolean} [options.reload]    Auto-reload when synchronization is complete
 * @param {boolean} [options.talents]   Sync actor talents
 * @param {boolean} [options.spells]    Sync actor iconic spells
 * @returns {Promise<void>}
 */
async function syncOwnedItems({force=false, reload=true, talents=true, spells=true, equipment=false}={}) {
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
async function syncWorldItems({equipment=true}={}) {
  console.groupCollapsed("Crucible | World Item Synchronization");
  if ( equipment ) {
    const pack = game.packs.get("crucible.equipment");
    await pack.getDocuments();
    const equipmentIndex = pack.contents.reduce((obj, item) => {
      obj[item.system.identifier] = item;
      return obj;
    }, {});
    const updates = [];
    for ( const item of game.items ) {
      const update = _migrateEquipmentItem(item, equipmentIndex);
      if ( update ) {
        updates.push(update);
        console.debug(`Syncing equipment: ${item.name} [${item.uuid}]`);
      }
    }
    if ( updates.length ) await Item.updateDocuments(updates);
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

/**
 * Remove all non-permanent talents from every actor in the world.
 */
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
/*  Module Hooks                                */
/* -------------------------------------------- */

Hooks.once("diceSoNiceReady", dice3d => {
  // Improve Group Skill Checks rendering by hiding only the roll result
  dice3d.setMessageUpdateHideSelector?.(".dice-result");
});

/* -------------------------------------------- */
/*  ESModules API                               */
/* -------------------------------------------- */

export {SYSTEM, applications, canvas, dice, documents, models, audio, chat};
